// public/js/app.js

document.addEventListener('DOMContentLoaded', () => {
    const fetchBtn = document.getElementById('fetch-btn');
    const urlInput = document.getElementById('url-input');
    const copyBtn = document.getElementById('copy-link-btn');
    
    // Updated container reference
    const downloadButtonsContainer = document.getElementById('download-buttons-container');
    
    // Store whole object to access metadata later
    let currentVideoData = null; 

    fetchBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        
        // Basic validation covers both FB and Insta now
        if (!url || (!url.includes('instagram.com') && !url.includes('facebook.com') && !url.includes('fb.watch'))) {
            showToast('Enter valid Instagram or Facebook URL', 'error');
            return;
        }

        UI.setLoading(true);
        UI.resultContainer.classList.add('hidden');

        try {
            const data = await fetchReelData(url);
            
            // Basic validation adapted for new structure
            if (data && (data.video_url || (data.formats && data.formats.length > 0))) {
                currentVideoData = data; // Store whole object
                UI.renderResult(data);
                showToast(`Video from ${data.platform || 'social'} fetched!`);
            } else {
                throw new Error("Invalid response format");
            }
        } catch (error) {
            showToast(error.message || 'Failed to fetch video. Is it public?', 'error');
        } finally {
            UI.setLoading(false);
        }
    });

    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchBtn.click();
    });

    // --- UPDATED: Dynamic Download logic using Event Delegation ---
    downloadButtonsContainer.addEventListener('click', (e) => {
        // Find if the clicked element (or parent) is a quality download button
        const btn = e.target.closest('.quality-download-btn');
        if (btn && currentVideoData) {
            const specificUrl = btn.dataset.url;
            const qualityText = btn.textContent;
            const quality = qualityText.replace('Download ', '').toLowerCase();
            
            if (specificUrl) {
                // Generate a friendly filename based on metadata
                const platform = currentVideoData.platform || 'video';
                const shortcode = currentVideoData.shortcode || Date.now();
                const filename = `finstabook_${platform}_${shortcode}_${quality}.mp4`;

                const tempLink = document.createElement('a');
                tempLink.href = specificUrl;
                tempLink.target = '_blank'; // Modern browsers need this due to CORS
                tempLink.setAttribute('download', filename);
                
                document.body.appendChild(tempLink);
                tempLink.click();
                document.body.removeChild(tempLink);
                
                showToast(`Download (${quality.toUpperCase()}) started!`);
            }
        }
    });

    // Updated Copy link functionality (copies main URL, usually HD)
    copyBtn.addEventListener('click', () => {
        if(currentVideoData) {
            const urlToCopy = currentVideoData.video_url; // copies highest res default
            navigator.clipboard.writeText(urlToCopy).then(() => {
                showToast('HD link copied!');
            }).catch(() => {
                showToast('Failed to copy link', 'error');
            });
        }
    });
});
