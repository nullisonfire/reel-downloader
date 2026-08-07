// public/js/muxer.js

const MuxerModule = (() => {
  let FFmpegLib = null;
  let ffmpegInstance = null;
  let loadPromise = null;

  // --- Cloudflare CDN Configuration ---
  const VERSION = '0.12.10'; // Pin version for stability
  const FFMPEG_CDN = `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${VERSION}/dist/esm/`;
  const CORE_CDN = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/`;

  const FFMPEG_LIB_URL = `${FFMPEG_CDN}ffmpeg.js`;
  const CORE_SCRIPT = `${CORE_CDN}ffmpeg-core.js`;
  const WASM_BINARY = `${CORE_CDN}ffmpeg-core.wasm`;
  const WORKER_SCRIPT = `${CORE_CDN}ffmpeg-core.worker.js`;

  // --- Fallback CDN if jsdelivr fails ---
  const FALLBACK_CDN = `https://unpkg.com/@ffmpeg/ffmpeg@${VERSION}/dist/esm/`;
  const FALLBACK_CORE = `https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/`;

  async function initFFmpegMuxer() {
    if (ffmpegInstance) return ffmpegInstance;
    if (loadPromise) return loadPromise;

    showToast("Loading media processor...", "warning");

    loadPromise = (async () => {
      try {
        // Try primary CDN
        let libUrl = FFMPEG_LIB_URL;
        let coreBase = CORE_CDN;
        
        if (!FFmpegLib) {
          try {
            FFmpegLib = await import(libUrl);
          } catch (primaryError) {
            console.warn("Primary CDN failed, trying fallback:", primaryError);
            // Try fallback CDN
            libUrl = FALLBACK_CDN + 'ffmpeg.js';
            coreBase = FALLBACK_CORE;
            FFmpegLib = await import(libUrl);
          }
          console.log("FFmpeg ESM Library loaded from CDN.");
        }

        let FFmpegConstructor = null;
        if (FFmpegLib.FFmpeg && typeof FFmpegLib.FFmpeg === 'function') {
          FFmpegConstructor = FFmpegLib.FFmpeg;
        } else if (FFmpegLib.default && typeof FFmpegLib.default === 'function') {
          FFmpegConstructor = FFmpegLib.default;
        }

        if (!FFmpegConstructor || typeof FFmpegConstructor !== 'function') {
          throw new Error("Valid FFmpeg constructor not found.");
        }

        showToast("Initializing media processor...", "warning");
        
        ffmpegInstance = new FFmpegConstructor();
        
        // Load with explicit CDN paths
        await ffmpegInstance.load({
          corePath: `${coreBase}ffmpeg-core.js`,
          wasmPath: `${coreBase}ffmpeg-core.wasm`,
          workerPath: `${coreBase}ffmpeg-core.worker.js`,
        });
        
        console.log("FFmpeg.wasm loaded successfully from CDN.");
        loadPromise = null;
        showToast("Media processor ready!", "success");
        return ffmpegInstance;

      } catch (err) {
        loadPromise = null;
        console.error("FFmpeg CDN initialization failed:", err);
        showToast(`Failed to load processor: ${err.message || 'Check console'}`, "error");
        throw err;
      }
    })();

    return loadPromise;
  }

  async function mergeStreamsToBlob(videoUrl, audioUrl, onProgress) {
    let fm = null;

    try {
      fm = await initFFmpegMuxer();
      
      if (typeof onProgress === 'function') fm.on('progress', onProgress);

      UIRenderer.setProcessingOverlay(true);

      showToast("Fetching streams...", "warning");
      const [videoBuffer, audioBuffer] = await Promise.all([
        fetch(videoUrl).then(r => { if(!r.ok) throw new Error("Video fetch failed"); return r.arrayBuffer(); }),
        fetch(audioUrl).then(r => { if(!r.ok) throw new Error("Audio fetch failed"); return r.arrayBuffer(); })
      ]);

      await fm.writeFile('input_video.mp4', new Uint8Array(videoBuffer));
      await fm.writeFile('input_audio.mp4', new Uint8Array(audioBuffer));

      showToast("Muxing streams...", "warning");
      await fm.exec(['-i', 'input_video.mp4', '-i', 'input_audio.mp4', '-c', 'copy', 'output_merged.mp4']);

      showToast("Finalizing...", "warning");
      const outputData = await fm.readFile('output_merged.mp4');

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
