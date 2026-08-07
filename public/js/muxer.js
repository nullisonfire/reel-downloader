// public/js/muxer.js

const MuxerModule = (() => {
  
  /**
   * Merge video and audio streams into a single MP4 file
   * Uses browser's native MediaRecorder API - no external libraries needed!
   */
  async function mergeStreamsToBlob(videoUrl, audioUrl, onProgress) {
    try {
      showToast('Loading media streams...', 'warning');
      UIRenderer.setProcessingOverlay(true);

      // --- Step 1: Fetch both streams ---
      const [videoResponse, audioResponse] = await Promise.all([
        fetch(videoUrl),
        fetch(audioUrl)
      ]);

      if (!videoResponse.ok || !audioResponse.ok) {
        throw new Error('Failed to fetch media streams');
      }

      const [videoBlob, audioBlob] = await Promise.all([
        videoResponse.blob(),
        audioResponse.blob()
      ]);

      // Update progress
      if (onProgress) onProgress({ ratio: 0.3 });

      showToast('Preparing media playback...', 'warning');

      // --- Step 2: Create hidden media elements ---
      const video = document.createElement('video');
      const audio = document.createElement('audio');
      
      video.src = URL.createObjectURL(videoBlob);
      audio.src = URL.createObjectURL(audioBlob);

      // --- Step 3: Wait for metadata to load ---
      await Promise.all([
        new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = () => reject(new Error('Video metadata load failed'));
        }),
        new Promise((resolve, reject) => {
          audio.onloadedmetadata = resolve;
          audio.onerror = () => reject(new Error('Audio metadata load failed'));
        })
      ]);

      // Update progress
      if (onProgress) onProgress({ ratio: 0.5 });

      showToast('Processing streams...', 'warning');

      // --- Step 4: Setup canvas for video capture ---
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');

      // --- Step 5: Setup audio mixing ---
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const destination = audioContext.createMediaStreamDestination();
      
      const audioSource = audioContext.createMediaElementSource(audio);
      audioSource.connect(destination);
      audioSource.connect(audioContext.destination);

      // --- Step 6: Combine video and audio streams ---
      const canvasStream = canvas.captureStream(30);
      const audioTrack = destination.stream.getAudioTracks()[0];
      
      // Add audio track to canvas stream if available
      if (audioTrack) {
        canvasStream.addTrack(audioTrack);
      }

      // --- Step 7: Setup MediaRecorder ---
      // Try to use MP4 format first, fallback to WebM
      let mimeType = 'video/mp4';
      let mediaRecorder = null;
      
      try {
        mediaRecorder = new MediaRecorder(canvasStream, {
          mimeType: mimeType,
          videoBitsPerSecond: 2500000
        });
      } catch (e) {
        // Fallback to WebM if MP4 not supported
        mimeType = 'video/webm;codecs=vp8,opus';
        try {
          mediaRecorder = new MediaRecorder(canvasStream, {
            mimeType: mimeType,
            videoBitsPerSecond: 2500000
          });
        } catch (e2) {
          // Fallback to default
          mediaRecorder = new MediaRecorder(canvasStream, {
            videoBitsPerSecond: 2500000
          });
        }
      }

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      let recordingComplete = false;
      mediaRecorder.onstop = () => {
        recordingComplete = true;
      };

      // --- Step 8: Start recording and playback ---
      mediaRecorder.start(1000); // Collect data every second
      
      video.play();
      audio.play();

      // --- Step 9: Draw video frames to canvas ---
      const totalDuration = video.duration || 0;
      let startTime = Date.now();

      const drawFrame = () => {
        if (!video.paused && !video.ended) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Update progress
          if (onProgress && totalDuration > 0) {
            const progress = Math.min(video.currentTime / totalDuration, 1);
            onProgress({ 
              ratio: 0.5 + progress * 0.4,
              currentTime: video.currentTime,
              duration: totalDuration
            });
          }
          
          requestAnimationFrame(drawFrame);
        }
      };
      drawFrame();

      // --- Step 10: Wait for video to complete ---
      await new Promise((resolve, reject) => {
        video.onended = resolve;
        video.onerror = () => reject(new Error('Video playback error'));
        
        // Timeout fallback (if video doesn't end properly)
        setTimeout(() => {
          if (!video.ended) {
            console.warn('Video didn\'t end, forcing completion');
            resolve();
          }
        }, (totalDuration * 1000) + 5000);
      });

      // --- Step 11: Stop everything ---
      mediaRecorder.stop();
      video.pause();
      audio.pause();
      
      // Wait for final data
      await new Promise(resolve => {
        if (recordingComplete) {
          resolve();
        } else {
          mediaRecorder.onstop = resolve;
        }
      });

      // --- Step 12: Cleanup ---
      URL.revokeObjectURL(video.src);
      URL.revokeObjectURL(audio.src);
      video.remove();
      audio.remove();
      canvas.remove();
      audioContext.close();

      if (onProgress) onProgress({ ratio: 0.95 });

      showToast('Finalizing...', 'warning');

      // --- Step 13: Create final blob ---
      const blobType = mimeType.includes('mp4') ? 'video/mp4' : 'video/webm';
      const mergedBlob = new Blob(chunks, { type: blobType });

      // If we got a WebM but want MP4, convert (optional)
      if (blobType === 'video/webm' && mimeType.includes('mp4')) {
        // WebM is fine, most players support it
        console.warn('Falling back to WebM format');
      }

      if (onProgress) onProgress({ ratio: 1 });

      showToast('Merging complete!', 'success');
      return mergedBlob;

    } catch (error) {
      console.error('Muxing failed:', error);
      showToast(`Failed to merge: ${error.message || 'Unknown error'}`, 'error');
      return null;
    } finally {
      UIRenderer.setProcessingOverlay(false);
    }
  }

  /**
   * Check if MediaRecorder is supported
   */
  async function healthCheck() {
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
    const hasCanvasCapture = typeof HTMLCanvasElement !== 'undefined' && 
                            !!HTMLCanvasElement.prototype.captureStream;
    const hasAudioContext = typeof AudioContext !== 'undefined' || 
                           typeof webkitAudioContext !== 'undefined';
    
    return {
      status: hasMediaRecorder && hasCanvasCapture && hasAudioContext ? 'healthy' : 'unhealthy',
      mediaRecorder: hasMediaRecorder,
      canvasCapture: hasCanvasCapture,
      audioContext: hasAudioContext,
      mimeTypes: MediaRecorder.isTypeSupported ? {
        mp4: MediaRecorder.isTypeSupported('video/mp4'),
        webm: MediaRecorder.isTypeSupported('video/webm'),
      } : 'Not supported'
    };
  }

  return {
    mergeStreamsToBlob,
    healthCheck
  };
})();

// Auto health check
if (typeof window !== 'undefined') {
  window.addEventListener('load', async () => {
    try {
      const health = await MuxerModule.healthCheck();
      console.log('📊 Muxer Health Status:', health);
      
      if (health.status === 'unhealthy') {
        console.warn('⚠️ MediaRecorder not fully supported. Some features may not work.');
      }
      
      if (health.mimeTypes) {
        console.log('📹 Supported formats:', Object.entries(health.mimeTypes)
          .filter(([_, supported]) => supported)
          .map(([format]) => format)
          .join(', '));
      }
    } catch (e) {
      console.warn('Health check failed:', e);
    }
  });
}
