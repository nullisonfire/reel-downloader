// public/js/muxer.js

const MuxerModule = (() => {
    let ffmpeg = null;
    let isLoaded = false;
    let loadPromise = null;

    // FFmpeg is heavy. Use JSDelivr's optimized multi-threaded version
    // NOTE: This REQUIRES Cross-Origin Isolation (public/_headers) to load.
    async function loadFFmpeg() {
            if (isLoaded) return ffmpeg;
            if (loadPromise) return loadPromise;
    
            showToast("Initial FFmpeg load... please wait", "warning");
            
            loadPromise = (async () => {
                // FIX: Use exact capitalization 'FFmpegWASM' based on the CDN source code
                if (!window.FFmpegWASM) {
                    throw new Error("FFmpeg script from CDN failed to initialize or is blocked.");
                }
                const { FFmpeg } = window.FFmpegWASM;
    
                const corePath = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js';
                const wasmPath = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm';
                const workerPath = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.worker.js';
    
                ffmpeg = new FFmpeg();
                
                // Critical setup required for multi-threaded WASM version
                await ffmpeg.load({
                    corePath: corePath,
                    wasmPath: wasmPath,
                    workerPath: workerPath,
                });
                
                isLoaded = true;
                loadPromise = null;
                return ffmpeg;
            })();
    
            return loadPromise;
        }

    // Main Muxing operation
    async function mergeStreamsToBlob(videoUrl, audioUrl, onProgress) {
        // FIX 2: Declare let outside try for scoping access in finally
        let fm = null;

        try {
            fm = await loadFFmpeg(); // assign to outer scope
            
            if (typeof onProgress === 'function') fm.on('progress', onProgress);

            UIRenderer.setProcessingOverlay(true);

            // --- Step 1: Fetch binary data of both streams ---
            showToast("Fetching raw streams... (1/3)", "warning");
            const [videoBuffer, audioBuffer] = await Promise.all([
                fetch(videoUrl).then(r => { if(!r.ok) throw new Error("Video fetch failed"); return r.arrayBuffer(); }),
                fetch(audioUrl).then(r => { if(!r.ok) throw new Error("Audio fetch failed"); return r.arrayBuffer(); })
            ]);

            // --- Step 2: Write buffers to FFmpeg's virtual filesystem (MEMFS) ---
            await fm.writeFile('input_video.mp4', new Uint8Array(videoBuffer));
            await fm.writeFile('input_audio.mp4', new Uint8Array(audioBuffer));

            // --- Step 3: Execute FFmpeg Muxing Command ---
            showToast("Muxing in browser... (2/3)", "warning");
            
            // -c copy VITAL performance hook. Just copy packets, do NOT re-encode.
            const command = ['-i', 'input_video.mp4', '-i', 'input_audio.mp4', '-c', 'copy', 'output_merged.mp4'];
            await fm.exec(command);

            // --- Step 4: Read output back from MEMFS as a download blob ---
            showToast("Finalizing... (3/3)");
            const outputData = await fm.readFile('output_merged.mp4');

            // Cleanup MEMFS to save memory
            await fm.deleteFile('input_video.mp4');
            await fm.deleteFile('input_audio.mp4');
            await fm.deleteFile('output_merged.mp4');

            return new Blob([outputData.buffer], { type: 'video/mp4' });

        } catch (error) {
            console.error("Muxing failure:", error);
            showToast(`Muxing failed: ${error.message || 'Error'}`, "error");
            return null;
        } finally {
            UIRenderer.setProcessingOverlay(false);
            // Robust cleanup (checking fm exists before unhooking listener)
            if(fm && typeof fm.on === 'function') {
                 fm.on('progress', null);
            }
        }
    }

    return { mergeStreamsToBlob };
})();
