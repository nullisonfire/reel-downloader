// public/js/muxer.js - SIMPLIFIED VERSION using MediaRecorder

const MuxerModule = (() => {
  
  // --- Merge streams using MediaRecorder (Simplest) ---
  async function mergeStreamsToBlob(videoUrl, audioUrl, onProgress) {
    try {
      showToast('Loading media streams...', 'warning');
      UIRenderer.setProcessingOverlay(true);

      // Fetch both streams
      const [videoResponse, audioResponse] = await Promise.all([
        fetch(videoUrl),
        fetch(audioUrl)
      ]);

      if (!videoResponse.ok || !audioResponse.ok) {
        throw new Error('Failed to fetch streams');
      }

      const [videoBlob, audioBlob] = await Promise.all([
        videoResponse.blob(),
        audioResponse.blob()
      ]);

      showToast('Processing streams...', 'warning');

      // Create video and audio elements to combine
      const video = document.createElement('video');
      const audio = document.createElement('audio');
      
      video.src = URL.createObjectURL(videoBlob);
      audio.src = URL.createObjectURL(audioBlob);

      // Wait for both to load
      await Promise.all([
        new Promise(resolve => video.onloadedmetadata = resolve),
        new Promise(resolve => audio.onloadedmetadata = resolve)
      ]);

      // Create a canvas to capture the combined stream
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');

      // Create audio context for mixing
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const destination = audioContext.createMediaStreamDestination();
      
      // Connect audio to destination
      const audioSource = audioContext.createMediaElementSource(audio);
      audioSource.connect(destination);
      audioSource.connect(audioContext.destination);

      // Get canvas stream
      const canvasStream = canvas.captureStream(30);
      const audioTrack = destination.stream.getAudioTracks()[0];
      canvasStream.addTrack(audioTrack);

      // Use MediaRecorder to record the combined stream
      const mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType: 'video/mp4',
        videoBitsPerSecond: 2500000
      });

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      // Start recording
      mediaRecorder.start(1000);

      // Play the video and audio to start recording
      video.play();
      audio.play();

      // Draw video frames to canvas
      const drawFrame = () => {
        if (!video.paused && !video.ended) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          requestAnimationFrame(drawFrame);
        }
      };
      drawFrame();

      // Wait for video to end
      await new Promise(resolve => video.onended = resolve);

      // Stop recording
      mediaRecorder.stop();
      
      // Wait for final chunks
      await new Promise(resolve => mediaRecorder.onstop = resolve);

      // Clean up
      URL.revokeObjectURL(video.src);
      URL.revokeObjectURL(audio.src);
      video.remove();
      audio.remove();
      canvas.remove();

      showToast('Muxing complete!', 'success');
      return new Blob(chunks, { type: 'video/mp4' });

    } catch (error) {
      console.error('Muxing failed:', error);
      showToast(`Muxing failed: ${error.message || 'Unknown error'}`, 'error');
      return null;
    } finally {
      UIRenderer.setProcessingOverlay(false);
    }
  }

  // --- Health check ---
  async function healthCheck() {
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
    const hasCanvasCapture = typeof HTMLCanvasElement !== 'undefined' && 
                            typeof canvas?.captureStream === 'function';
    
    return {
      status: hasMediaRecorder && hasCanvasCapture ? 'healthy' : 'unhealthy',
      mediaRecorder: hasMediaRecorder,
      canvasCapture: hasCanvasCapture
    };
  }

  return {
    mergeStreamsToBlob,
    healthCheck
  };
})();
