// public/js/muxer.js

const MuxerModule = (() => {
  let FFmpegLib = null;
  let ffmpegInstance = null;
  let loadPromise = null;

  // --- CDN Configuration with Multiple Fallbacks ---
  // Additional CDN providers for even more redundancy
  const CDN_PROVIDERS = [
    {
      name: 'jsdelivr',
      base: 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/',
      core: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/'
    },
    {
      name: 'unpkg',
      base: 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/',
      core: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/'
    },
    {
      name: 'esm',
      base: 'https://esm.sh/@ffmpeg/ffmpeg@0.12.10/',
      core: 'https://esm.sh/@ffmpeg/core@0.12.6/'
    },
    {
      name: 'skypack',
      base: 'https://cdn.skypack.dev/@ffmpeg/ffmpeg@0.12.10/',
      core: 'https://cdn.skypack.dev/@ffmpeg/core@0.12.6/'
    },
    {
      name: 'cloudflare',
      base: 'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg.js/0.12.10/',
      core: 'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg-core/0.12.6/'
    },
    {
      name: 'fastly',
      base: 'https://fastly.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/',
      core: 'https://fastly.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/'
    }
  ];

  // --- Alternative: Using esm.sh CDN (also Cloudflare powered) ---
  // {
  //   name: 'esm',
  //   base: 'https://esm.sh/@ffmpeg/ffmpeg@0.12.10/',
  //   core: 'https://esm.sh/@ffmpeg/core@0.12.6/'
  // }

  // --- Helper: Fetch with timeout and retry ---
  async function fetchWithTimeout(url, timeout = 15000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { 
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit'
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // --- Helper: Test CDN availability ---
  async function testCDNAvailability(provider) {
    try {
      // Test with a small file (worker.js is usually smaller)
      const testUrl = `${provider.core}ffmpeg-core.worker.js`;
      await fetchWithTimeout(testUrl, 5000);
      return true;
    } catch (error) {
      console.warn(`CDN ${provider.name} unavailable:`, error.message);
      return false;
    }
  }

  // --- Helper: Find working CDN ---
  async function findWorkingCDN() {
    // Shuffle providers for load balancing (optional)
    const providers = [...CDN_PROVIDERS];
    // Randomize order to distribute load
    // providers.sort(() => Math.random() - 0.5);
    
    for (const provider of providers) {
      console.log(`Testing CDN: ${provider.name}...`);
      const isAvailable = await testCDNAvailability(provider);
      if (isAvailable) {
        console.log(`✅ Using CDN: ${provider.name}`);
        return provider;
      }
    }
    
    throw new Error('All CDN providers failed. Please check your internet connection.');
  }

  // --- Main initialization with fallback ---
  async function initFFmpegMuxer() {
    if (ffmpegInstance) return ffmpegInstance;
    if (loadPromise) return loadPromise;

    showToast("Loading media processor from CDN...", "warning");

    loadPromise = (async () => {
      let lastError = null;
      let workingProvider = null;

      try {
        // --- Step 1: Find a working CDN ---
        workingProvider = await findWorkingCDN();
        
        // --- Step 2: Try to load FFmpeg from working CDN ---
        if (!FFmpegLib) {
          const libUrl = `${workingProvider.base}ffmpeg.js`;
          console.log(`Loading FFmpeg from: ${libUrl}`);
          
          try {
            // Use dynamic import with cache busting
            FFmpegLib = await import(/* @vite-ignore */ `${libUrl}?t=${Date.now()}`);
            console.log(`✅ FFmpeg ESM loaded from ${workingProvider.name}`);
          } catch (importError) {
            console.error(`Failed to import from ${workingProvider.name}:`, importError);
            
            // Try alternative import method for some CDNs
            if (workingProvider.name === 'cloudflare') {
              // Cloudflare cdnjs might use different structure
              FFmpegLib = await import(/* @vite-ignore */ `${workingProvider.base}ffmpeg.min.js?t=${Date.now()}`);
            } else {
              throw importError;
            }
          }
        }

        // --- Step 3: Extract constructor (with multiple fallback checks) ---
        let FFmpegConstructor = null;
        
        // Try different export patterns
        if (FFmpegLib.FFmpeg && typeof FFmpegLib.FFmpeg === 'function') {
          FFmpegConstructor = FFmpegLib.FFmpeg;
        } else if (FFmpegLib.default && typeof FFmpegLib.default === 'function') {
          FFmpegConstructor = FFmpegLib.default;
        } else if (FFmpegLib.default && FFmpegLib.default.FFmpeg && typeof FFmpegLib.default.FFmpeg === 'function') {
          FFmpegConstructor = FFmpegLib.default.FFmpeg;
        }

        if (!FFmpegConstructor || typeof FFmpegConstructor !== 'function') {
          throw new Error(`Valid FFmpeg constructor not found in ${workingProvider.name} library.`);
        }

        // --- Step 4: Create instance ---
        showToast("Initializing media processor...", "warning");
        ffmpegInstance = new FFmpegConstructor();

        // --- Step 5: Load with core files from same CDN ---
        const corePaths = {
          corePath: `${workingProvider.core}ffmpeg-core.js`,
          wasmPath: `${workingProvider.core}ffmpeg-core.wasm`,
          workerPath: `${workingProvider.core}ffmpeg-core.worker.js`
        };

        console.log(`Loading core files from: ${workingProvider.core}`);
        
        // Try loading with different options based on CDN
        try {
          await ffmpegInstance.load(corePaths);
        } catch (loadError) {
          console.warn(`Standard load failed, trying alternative options...`, loadError);
          
          // Alternative: Try with just corePath (some versions auto-detect)
          await ffmpegInstance.load({
            corePath: corePaths.corePath
          });
        }

        console.log(`✅ FFmpeg.wasm fully loaded from ${workingProvider.name} CDN`);
        showToast("Media processor ready!", "success");
        loadPromise = null;
        return ffmpegInstance;

      } catch (err) {
        loadPromise = null;
        console.error("FFmpeg initialization failed:", err);
        
        // Show detailed error with CDN info
        const cdnName = workingProvider ? workingProvider.name : 'unknown';
        showToast(
          `Processor load failed (${cdnName}): ${err.message || 'Check console'}`,
          "error"
        );
        throw err;
      }
    })();

    return loadPromise;
  }

  // --- Main Muxing function with retry logic ---
  async function mergeStreamsToBlob(videoUrl, audioUrl, onProgress) {
    let fm = null;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      try {
        // If retrying, reset instance
        if (retryCount > 0) {
          console.log(`Retry attempt ${retryCount}/${maxRetries}`);
          ffmpegInstance = null;
          FFmpegLib = null;
          loadPromise = null;
          // Random delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }

        fm = await initFFmpegMuxer();
        
        if (typeof onProgress === 'function') {
          fm.on('progress', onProgress);
        }

        UIRenderer.setProcessingOverlay(true);

        showToast("Fetching streams... (1/3)", "warning");
        
        // Fetch with timeout
        const fetchPromises = [
          fetchWithTimeout(videoUrl, 30000),
          fetchWithTimeout(audioUrl, 30000)
        ];

        const [videoResponse, audioResponse] = await Promise.all(fetchPromises);
        const [videoBuffer, audioBuffer] = await Promise.all([
          videoResponse.arrayBuffer(),
          audioResponse.arrayBuffer()
        ]);

        // --- Write to virtual filesystem ---
        await fm.writeFile('input_video.mp4', new Uint8Array(videoBuffer));
        await fm.writeFile('input_audio.mp4', new Uint8Array(audioBuffer));

        // --- Execute muxing ---
        showToast("Muxing streams... (2/3)", "warning");
        
        // Add progress reporting for the muxing process
        const progressInterval = setInterval(() => {
          if (typeof onProgress === 'function') {
            onProgress({ ratio: 0.5 }); // Fake progress during muxing
          }
        }, 500);

        await fm.exec(['-i', 'input_video.mp4', '-i', 'input_audio.mp4', '-c', 'copy', 'output_merged.mp4']);
        clearInterval(progressInterval);

        // --- Read output ---
        showToast("Finalizing... (3/3)", "warning");
        const outputData = await fm.readFile('output_merged.mp4');

        // --- Cleanup ---
        await fm.deleteFile('input_video.mp4');
        await fm.deleteFile('input_audio.mp4');
        await fm.deleteFile('output_merged.mp4');

        showToast("Muxing complete!", "success");
        return new Blob([outputData.buffer], { type: 'video/mp4' });

      } catch (error) {
        console.error(`Muxing attempt ${retryCount + 1} failed:`, error);
        
        if (retryCount === maxRetries) {
          // All retries failed
          showToast(`Muxing failed: ${error.message || 'Unknown error'}`, "error");
          return null;
        }
        
        // Prepare for retry
        retryCount++;
        showToast(`Retrying... (${retryCount}/${maxRetries})`, "warning");
        
        // Cleanup failed instance
        if (fm) {
          try {
            await fm.terminate?.();
          } catch (e) {
            // Ignore cleanup errors
          }
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

  // --- Public API with health check ---
  async function healthCheck() {
    try {
      const workingProvider = await findWorkingCDN();
      return {
        status: 'healthy',
        cdn: workingProvider.name,
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
    healthCheck 
  };
})();

// --- Optional: Auto health check on page load ---
if (typeof window !== 'undefined') {
  window.addEventListener('load', async () => {
    try {
      const health = await MuxerModule.healthCheck();
      console.log('Muxer Health Status:', health);
      if (health.status === 'unhealthy') {
        console.warn('⚠️ No CDN available. Muxer may not work.');
      }
    } catch (e) {
      console.warn('Health check failed:', e);
    }
  });
}
