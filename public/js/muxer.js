// public/js/muxer.js

const MuxerModule = (() => {
  let FFmpegLib = null;
  let ffmpegInstance = null;
  let loadPromise = null;
  let currentCDN = null;

  // --- CORRECT CDN CONFIGURATION ---
  // The core files are actually inside the @ffmpeg/core package
  // and may need specific version paths
  const CDN_PROVIDERS = [
    {
      name: 'jsdelivr-esm',
      // ESM version of ffmpeg
      base: 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/',
      // Core files - note the different path structure
      core: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/'
    },
    {
      name: 'unpkg-esm',
      base: 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/',
      core: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/'
    },
    {
      name: 'cdnjs',
      // cdnjs might have different version numbering
      base: 'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg.js/0.12.10/',
      core: 'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg-core/0.12.6/'
    }
  ];

  // --- ALTERNATIVE: Use single CDN with correct paths ---
  // Actually, the most reliable is to use the official CDN for wasm files
  const WASM_CDN = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/';

  // --- Helper: Test if a file exists (HEAD request) ---
  async function testFileExists(url, timeout = 5000) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit'
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // --- Helper: Test CDN by checking core files ---
  async function testCDNAvailability(provider) {
    try {
      // Check if the main library file exists
      const libUrl = `${provider.base}ffmpeg.js`;
      const libExists = await testFileExists(libUrl);
      
      if (!libExists) {
        console.warn(`CDN ${provider.name}: Library file not found`);
        return false;
      }

      // Check core files (at least one)
      const coreFiles = [
        `${provider.core}ffmpeg-core.js`,
        `${provider.core}ffmpeg-core.wasm`
      ];

      for (const file of coreFiles) {
        const exists = await testFileExists(file);
        if (!exists) {
          console.warn(`CDN ${provider.name}: Core file not found: ${file}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.warn(`CDN ${provider.name} unavailable:`, error.message);
      return false;
    }
  }

  // --- Find working CDN ---
  async function findWorkingCDN() {
    // Try providers in order
    for (const provider of CDN_PROVIDERS) {
      console.log(`Testing CDN: ${provider.name}...`);
      const isAvailable = await testCDNAvailability(provider);
      if (isAvailable) {
        console.log(`✅ Using CDN: ${provider.name}`);
        currentCDN = provider;
        return provider;
      }
    }
    
    // If all CDNs fail, throw error
    throw new Error('All CDN providers failed. Please check your internet connection.');
  }

  // --- Dynamic import with fallback ---
  async function loadFFmpegFromCDN(provider) {
    try {
      // Try to import from CDN
      const libUrl = `${provider.base}ffmpeg.js`;
      console.log(`Loading from: ${libUrl}`);
      
      // Use import with cache busting
      return await import(/* @vite-ignore */ `${libUrl}?v=${Date.now()}`);
    } catch (error) {
      console.error(`Failed to load from ${provider.name}:`, error);
      
      // Try alternative path for cdnjs
      if (provider.name === 'cdnjs') {
        try {
          const altUrl = `${provider.base}ffmpeg.min.js`;
          return await import(/* @vite-ignore */ `${altUrl}?v=${Date.now()}`);
        } catch (altError) {
          console.error('Alternative path also failed:', altError);
          throw altError;
        }
      }
      throw error;
    }
  }

  // --- Main initialization ---
  async function initFFmpegMuxer() {
    if (ffmpegInstance) return ffmpegInstance;
    if (loadPromise) return loadPromise;

    showToast("Loading media processor from CDN...", "warning");

    loadPromise = (async () => {
      let provider = null;
      
      try {
        // Find working CDN
        provider = await findWorkingCDN();
        
        // Load FFmpeg library
        if (!FFmpegLib) {
          FFmpegLib = await loadFFmpegFromCDN(provider);
          console.log(`✅ FFmpeg ESM loaded from ${provider.name}`);
        }

        // Extract constructor
        let FFmpegConstructor = null;
        
        if (FFmpegLib.FFmpeg && typeof FFmpegLib.FFmpeg === 'function') {
          FFmpegConstructor = FFmpegLib.FFmpeg;
        } else if (FFmpegLib.default && typeof FFmpegLib.default === 'function') {
          FFmpegConstructor = FFmpegLib.default;
        } else if (FFmpegLib.default?.FFmpeg && typeof FFmpegLib.default.FFmpeg === 'function') {
          FFmpegConstructor = FFmpegLib.default.FFmpeg;
        }

        if (!FFmpegConstructor) {
          throw new Error('FFmpeg constructor not found');
        }

        // Create instance
        showToast("Initializing media processor...", "warning");
        ffmpegInstance = new FFmpegConstructor();

        // Load core files
        const corePath = provider.core;
        
        // Try loading with explicit paths
        try {
          await ffmpegInstance.load({
            corePath: `${corePath}ffmpeg-core.js`,
            wasmPath: `${corePath}ffmpeg-core.wasm`,
            workerPath: `${corePath}ffmpeg-core.worker.js`
          });
        } catch (loadError) {
          console.warn('Standard load failed, trying simplified load...', loadError);
          
          // Some versions work with just corePath
          await ffmpegInstance.load({
            corePath: corePath
          });
        }

        console.log(`✅ FFmpeg.wasm fully loaded from ${provider.name}`);
        showToast("Media processor ready!", "success");
        loadPromise = null;
        return ffmpegInstance;

      } catch (err) {
        loadPromise = null;
        console.error('FFmpeg initialization failed:', err);
        
        const cdnName = provider?.name || 'unknown';
        showToast(
          `Processor load failed: ${err.message || 'Unknown error'}`,
          "error"
        );
        throw err;
      }
    })();

    return loadPromise;
  }

  // --- Fallback: Try to load from local assets if CDN fails ---
  async function initFFmpegWithFallback() {
    try {
      // Try CDN first
      return await initFFmpegMuxer();
    } catch (cdnError) {
      console.warn('CDN failed, trying local assets...', cdnError);
      
      try {
        // Try local assets as fallback
        showToast("CDN unavailable, trying local...", "warning");
        
        const LOCAL_BASE = '/assets/ffmpeg/';
        FFmpegLib = await import(/* @vite-ignore */ `${LOCAL_BASE}ffmpeg.js`);
        
        let FFmpegConstructor = FFmpegLib.FFmpeg || FFmpegLib.default;
        if (!FFmpegConstructor) {
          throw new Error('Local FFmpeg constructor not found');
        }
        
        ffmpegInstance = new FFmpegConstructor();
        await ffmpegInstance.load({
          corePath: `${LOCAL_BASE}ffmpeg-core.js`,
          wasmPath: `${LOCAL_BASE}ffmpeg-core.wasm`,
          workerPath: `${LOCAL_BASE}ffmpeg-core.worker.js`
        });
        
        showToast("Media processor loaded locally!", "success");
        return ffmpegInstance;
        
      } catch (localError) {
        console.error('Local fallback also failed:', localError);
        showToast("Unable to load media processor", "error");
        throw new Error('Both CDN and local sources failed');
      }
    }
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
