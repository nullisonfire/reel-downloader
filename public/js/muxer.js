// public/js/muxer.js

const MuxerModule = (() => {
  let FFmpegLib = null;
  let ffmpegInstance = null;
  let loadPromise = null;

  // --- USE CLOUDFLARE CDN ---
  // Using jsdelivr CDN (backed by Cloudflare)
  const FFMPEG_CDN_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/';
  const FFMPEG_LIB_URL = `${FFMPEG_CDN_BASE}ffmpeg.js`;
  
  // Core files from the same CDN
  const CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/';
  const CORE_SCRIPT = `${CORE_BASE}ffmpeg-core.js`;
  const WASM_BINARY = `${CORE_BASE}ffmpeg-core.wasm`;
  const WORKER_SCRIPT = `${CORE_BASE}ffmpeg-core.worker.js`;

  // --- OR use unpkg (also Cloudflare backed) ---
  // const FFMPEG_CDN_BASE = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/';
  // const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/';

  async function initFFmpegMuxer() {
    if (ffmpegInstance) return ffmpegInstance;
    if (loadPromise) return loadPromise;

    showToast("Loading media processor from CDN...", "warning");

    loadPromise = (async () => {
      try {
        // --- Import from CDN ---
        if (!FFmpegLib) {
          FFmpegLib = await import(FFMPEG_LIB_URL);
          console.log("FFmpeg ESM Library loaded from CDN.");
        }

        // --- Extract constructor ---
        let FFmpegConstructor = null;
        if (FFmpegLib.FFmpeg && typeof FFmpegLib.FFmpeg === 'function') {
          FFmpegConstructor = FFmpegLib.FFmpeg;
        } else if (FFmpegLib.default && typeof FFmpegLib.default === 'function') {
          FFmpegConstructor = FFmpegLib.default;
        }

        if (!FFmpegConstructor || typeof FFmpegConstructor !== 'function') {
          throw new Error("Valid FFmpeg constructor not found in CDN library.");
        }

        showToast("Initializing media processor...", "warning");
        
        ffmpegInstance = new FFmpegConstructor();
        
        // --- Load from CDN with explicit paths ---
        await ffmpegInstance.load({
          corePath: CORE_SCRIPT,
          wasmPath: WASM_BINARY,
          workerPath: WORKER_SCRIPT,
        });
        
        console.log("FFmpeg.wasm loaded successfully from CDN.");
        loadPromise = null;
        return ffmpegInstance;

      } catch (err) {
        loadPromise = null;
        console.error("FFmpeg CDN initialization failed:", err);
        showToast(`Processor load failed: ${err.message || 'Check console'}`, "error");
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
