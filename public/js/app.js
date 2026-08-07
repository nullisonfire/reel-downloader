// public/js/app.js

const API_URL = 'https://reel-worker.zonal8731.workers.dev/'; 

// Consolidated API function
async function fetchReelData(url) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });
        if (!response.ok) throw new Error('Network response not ok');
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Fetch failed');
        return data;
    } catch (error) {
        console.error("API Error:", error); throw error;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const fetchBtn = document.getElementById('fetch-btn');
    const urlInput = document.getElementById('url-input');
    const copyBtn = document.getElementById('copy-link-btn');
    const dlButtonsContainer = document.getElementById('download-buttons-container');
    
    let currentVideoData = null; 

    // Main Fetch logic
    fetchBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url || (!url.includes('instagram.com') && !url.includes('facebook.com') && !url.includes('fb.watch'))) {
            showToast('Enter valid Instagram or Facebook URL', 'error'); return;
        }
        UIRenderer.setLoading(true);
        UIRenderer.resultContainer.classList.add('hidden');
        try {
            const data = await fetchReelData(url);
            
            // New validation hook: allows progressive OR DASH muxable combo
            if (data && (data.video_url || (data.needs_muxing && data.best_video_url))) {
                currentVideoData = data; 
                UIRenderer.renderResult(data);
                showToast(`Video from ${data.platform || 'social'} fetched!`);
            } else { throw new Error("Invalid response format"); }
        } catch (error) {
            showToast(error.message || 'Failed to fetch video.', 'error');
        } finally { UIRenderer.setLoading(false); }
    });

    urlInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') fetchBtn.click(); });

    // --- Dynamic Download logic (Updated for Muxing Request) ---
    dlButtonsContainer.addEventListener('click', async (e) => {
        const btn = e.target.closest('.quality-download-btn');
        if (!btn || !currentVideoData) return;

        // Check the crucial new dataset flag from rendering
        if (btn.dataset.needsMuxing === 'true') {
            const videoStream = btn.dataset.videoUrl;
            const audioStream = btn.dataset.audioUrl;
            
            if (videoStream && audioStream) {
                // Request merge entirely within browser memory
                const mergedBlob = await MuxerModule.mergeStreamsToBlob(videoStream, audioStream, (p) => {
                    // Optional progress handler to console
                    // console.log(`Processing: ${p.progress * 100}%`);
                });
                
                if (mergedBlob) {
                    // Generate friendly filename
                    const platform = currentVideoData.platform || 'video';
                    const shortcode = currentVideoData.shortcode || Date.now();
                    const filename = `finstabook_${platform}_${shortcode}_muxed_best.mp4`;

                    // Create blob URL download
                    const url = URL.createObjectURL(mergedBlob);
                    const tempLink = document.createElement('a');
                    tempLink.href = url;
                    tempLink.setAttribute('download', filename);
                    tempLink.click();
                    
                    // cleanup object url
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    showToast('Merged high-quality download started!');
                }
            }
        } else {
            // Standard progressive download (no muxing required)
            const progressiveUrl = btn.dataset.url;
            if (progressiveUrl) {
                const tempLink = document.createElement('a');
                tempLink.href = progressiveUrl;
                tempLink.target = '_blank'; // Modern browsers need this due to CORS
                tempLink.setAttribute('download', `finstabook_progressive_video_${currentVideoData.shortcode || Date.now()}.mp4`);
                document.body.appendChild(tempLink);
                tempLink.click();
                document.body.removeChild(tempLink);
                showToast('Progressive download started!');
            }
        }
    });

    // Copy link function
    copyBtn.addEventListener('click', () => {
        if(currentVideoData) {
            // Priority for main progressive link, otherwise DASH best_video_url
            const urlToCopy = currentVideoData.video_url || currentVideoData.best_video_url; 
            navigator.clipboard.writeText(urlToCopy).then(() => { showToast('Link copied!'); })
            .catch(() => { showToast('Failed to copy', 'error'); });
        }
    });
});
