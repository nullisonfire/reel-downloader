// public/js/muxer.js

const MuxerModule = (() => {
  let FFmpegLib = null;
  let ffmpegInstance = null;
  let loadPromise = null;

  // --- Use the official CDN that actually works ---
  // These are the correct paths for the latest version
  const CDN_CONFIG = {
    // Use jsdelivr with correct ESM path
    base: 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/',
    // Core files - this is the tricky part
    // Actually, we'll let the library handle core loading
    core: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/'
  };

  async function initFFmpegMuxer() {
    if (ffmpegInstance) return ffmpegInstance;
    if (loadPromise) return loadPromise;

    showToast("Loading media processor...", "warning");

    loadPromise = (async () => {
      try {
        // Import from CDN
        FFmpegLib = await import(/* @vite-ignore */ `${CDN_CONFIG.base}ffmpeg.js`);
        
        const FFmpegConstructor = FFmpegLib.FFmpeg || FFmpegLib.default;
        if (!FFmpegConstructor) {
          throw new Error('FFmpeg constructor not found');
        }

        ffmpegInstance = new FFmpegConstructor();
        
        // Let the library handle core loading with just the path
        await ffmpegInstance.load({
          corePath: CDN_CONFIG.core
        });

        console.log('✅ FFmpeg loaded successfully');
        showToast("Media processor ready!", "success");
        loadPromise = null;
        return ffmpegInstance;

      } catch (err) {
        loadPromise = null;
        console.error('FFmpeg initialization failed:', err);
        showToast(`Failed to load: ${err.message}`, "error");
        throw err;
      }
    })();

    return loadPromise;
  }

  // --- Main muxing function with retry ---
  async function mergeStreamsToBlob(videoUrl, audioUrl, onProgress) {
    let fm = null;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      try {
        if (retryCount > 0) {
          console.log(`Retry attempt ${retryCount}/${maxRetries}`);
          ffmpegInstance = null;
          FFmpegLib = null;
          loadPromise = null;
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }

        // Use fallback initialization
        fm = await initFFmpegWithFallback();
        
        if (typeof onProgress === 'function') {
          fm.on('progress', onProgress);
        }

        UIRenderer.setProcessingOverlay(true);

        showToast("Fetching streams...", "warning");
        
        // Fetch streams with timeout
        const fetchWithTimeout = (url, timeout = 30000) => {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Fetch timeout')), timeout);
            fetch(url)
              .then(response => {
                clearTimeout(timer);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                resolve(response);
              })
              .catch(err => {
                clearTimeout(timer);
                reject(err);
              });
          });
        };

        const [videoResponse, audioResponse] = await Promise.all([
          fetchWithTimeout(videoUrl),
          fetchWithTimeout(audioUrl)
        ]);

        const [videoBuffer, audioBuffer] = await Promise.all([
          videoResponse.arrayBuffer(),
          audioResponse.arrayBuffer()
        ]);

        // Write files
        await fm.writeFile('input_video.mp4', new Uint8Array(videoBuffer));
        await fm.writeFile('input_audio.mp4', new Uint8Array(audioBuffer));

        // Mux
        showToast("Muxing streams...", "warning");
        await fm.exec(['-i', 'input_video.mp4', '-i', 'input_audio.mp4', '-c', 'copy', 'output_merged.mp4']);

        // Read output
        showToast("Finalizing...", "warning");
        const outputData = await fm.readFile('output_merged.mp4');

        // Cleanup
        await fm.deleteFile('input_video.mp4');
        await fm.deleteFile('input_audio.mp4');
        await fm.deleteFile('output_merged.mp4');

        showToast("Muxing complete!", "success");
        return new Blob([outputData.buffer], { type: 'video/mp4' });

      } catch (error) {
        console.error(`Attempt ${retryCount + 1} failed:`, error);
        
        if (retryCount === maxRetries) {
          showToast(`Muxing failed: ${error.message || 'Unknown error'}`, "error");
          return null;
        }
        
        retryCount++;
        showToast(`Retrying... (${retryCount}/${maxRetries})`, "warning");
        
        if (fm) {
          try {
            await fm.terminate?.();
          } catch (e) {}
        }
        fm = null;
      } finally {
        UIRenderer.setProcessingOverlay(false);
        if (fm && typeof fm.on === 'function') {
          fm.on('progress', null);
        }
      }
    }
    
    return null;
  }

  // --- Health check ---
  async function healthCheck() {
    try {
      const provider = await findWorkingCDN();
      return {
        status: 'healthy',
        cdn: provider.name,
        version: '0.12.10'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  return { 
    mergeStreamsToBlob,
    healthCheck,
    initFFmpegWithFallback
  };
})();

// Auto health check
if (typeof window !== 'undefined') {
  window.addEventListener('load', async () => {
    try {
      const health = await MuxerModule.healthCheck();
      console.log('Muxer Health Status:', health);
      if (health.status === 'unhealthy') {
        console.warn('⚠️ No CDN available. Will try local fallback.');
      }
    } catch (e) {
      console.warn('Health check failed:', e);
    }
  });
}
