// public/js/muxer.js

const MuxerModule = (() => {
    // 1. Module scoped references for FFmpeg library and class instance
    let FFmpegLib = null; 
    let ffmpegInstance = null;
    let loadPromise = null;

    // 2. Optimized multi-threaded FFmpeg Core from standard CDN
    const FFMPEG_BASE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
    const FFMPEG_LIBRARY_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/umd/ffmpeg.min.js';

    // 3. Robust initialization module (Fixed for Cross-Origin Isolation Security)
    async function initFFmpegMuxer() {
        if (ffmpegInstance) return ffmpegInstance;
        if (loadPromise) return loadPromise;

        showToast("Loading media processor... this requires a strong connection", "warning");

        loadPromise = (async () => {
            try {
                // --- Step A: Dynamically Import the modern ESM library ---
                // We are not relying on a global window.FFmpegWASM anymore.
                if (!FFmpegLib) {
                    FFmpegLib = await import(FFMPEG_LIBRARY_URL);
                    console.log("FFmpeg ESM Library imported successfully.");
                }

                const { FFmpeg } = FFmpegLib;

                // --- Step B: Programmatically Convert dependencies to Blob URLs ---
                // This bypasses the browser's dynamic script blocking inside an isolated worker context.
                showToast("Securing media component... (1/2)", "warning");
                const [coreURL, wasmURL, workerURL] = await Promise.all([
                    toBlobURL(`${FFMPEG_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
                    toBlobURL(`${FFMPEG_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
                    toBlobURL(`${FFMPEG_BASE_URL}/ffmpeg-core.worker.js`, 'text/javascript'),
                ]);

                // --- Step C: Load the optimized WASM Core explicitly providing URLs ---
                showToast("Finalizing components... (2/2)", "warning");
                ffmpegInstance = new FFmpeg();
                
                await ffmpegInstance.load({
                    corePath: coreURL,
                    wasmPath: wasmURL,
                    workerPath: workerURL,
                });
                
                console.log("FFmpeg.wasm v0.12 (ESM) Muxer loaded successfully in isolated context.");
                loadPromise = null;
                return ffmpegInstance;

            } catch (err) {
                // Reset promise on failure to allow retry
                loadPromise = null; 
                console.error("FFmpeg ESM initialization failed:", err);
                showToast(`Processor failure: ${err.message || 'Check connection'}`, "error");
                throw err;
            }
        })();

        return loadPromise;
    }

    // Main Muxing operation
    async function mergeStreamsToBlob(videoUrl, audioUrl, onProgress) {
        let fm = null;

        try {
            fm = await initFFmpegMuxer();
            
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
            
            // -c copy VITAL performance hook. Just copy encoded packets, do NOT re-encode. Extemely fast.
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
            if(fm && typeof fm.on === 'function') { fm.on('progress', null); }
        }
    }

    // 4. Utility: Convert any URL into a temporary secure Blob URL (VITAL for Isolation)
    async function toBlobURL(url, mimeType) {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const blob = new Blob([buffer], { type: mimeType });
        return URL.createObjectURL(blob);
    }

    return { mergeStreamsToBlob };
})();
