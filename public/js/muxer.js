// public/js/muxer.js

const MuxerModule = (() => {
    // 1. Module scoped references for FFmpeg library and class instance
    let FFmpegLib = null; 
    let ffmpegInstance = null;
    let loadPromise = null;

    // 2. SELF-HOSTED PATHS - Pointing to Step 1 files
    const FFMPEG_LIB_LOCAL_URL = '/assets/ffmpeg/ffmpeg.js'; // The main ESM library
    const FFMPEG_CORE_BASE_URL = '/assets/ffmpeg/';       // Folder containing ffmpeg-core.js and .wasm

    // 3. Robust initialization module (Fixed Turn 26 for strict self-hosting)
    async function initFFmpegMuxer() {
        if (ffmpegInstance) return ffmpegInstance;
        if (loadPromise) return loadPromise;

        showToast("Loading media processor... this requires a strong connection", "warning");

        loadPromise = (async () => {
            try {
                // --- Step A: Dynamically Import the library from LOCAL assets ---
                if (!FFmpegLib) {
                    FFmpegLib = await import(FFMPEG_LIB_LOCAL_URL);
                    console.log("FFmpeg ESM Library imported successfully from local assets.");
                }

                // --- Step B (Robust): Extract FFmpeg constructor from ESM ---
                let FFmpegConstructor = null;

                if (FFmpegLib.FFmpeg && typeof FFmpegLib.FFmpeg === 'function') {
                    // Standard named export
                    FFmpegConstructor = FFmpegLib.FFmpeg;
                } else if (FFmpegLib.default && typeof FFmpegLib.default === 'function') {
                    // Modern esm.run bundling variant often has class as default export
                    FFmpegConstructor = FFmpegLib.default;
                }

                if (!FFmpegConstructor || typeof FFmpegConstructor !== 'function') {
                    throw new Error("Muxer.js Error: Valid FFmpeg constructor not found in local ESM library.");
                }

                // --- Step C: Instantiate and Load the Core explicitly using baseURL ---
                showToast("Finalizing media component...", "warning");
                
                ffmpegInstance = new FFmpegConstructor();
                
                // standard v0.12 pattern: explicit core access via local secure baseURL
                await ffmpegInstance.load({
                    // Point explicitly to the local folder containing ffmpeg-core.js and .wasm
                    baseURL: FFMPEG_CORE_BASE_URL 
                });
                
                console.log("FFmpeg.wasm v0.12.10 (Local ESM) Muxer loaded successfully in isolated context.");
                loadPromise = null;
                return ffmpegInstance;

            } catch (err) {
                // Reset promise on failure to allow retry
                loadPromise = null; 
                console.error("FFmpeg ESM initialization failed:", err);
                showToast(`Processor failure: ${err.message || 'Check files in assets/ffmpeg/'}`, "error");
                throw err;
            }
        })();

        return loadPromise;
    }

    // Main Muxing operation (remains unchanged from Turn 24)
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
            
            // -c copy VITAL performance hook. Just copy packets, do NOT re-encode. Extremely fast.
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

    return { mergeStreamsToBlob };
})();
