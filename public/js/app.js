document.addEventListener('DOMContentLoaded', () => {
    const fetchBtn = document.getElementById('fetch-btn');
    const urlInput = document.getElementById('url-input');
    const copyBtn = document.getElementById('copy-link-btn');
    const downloadBtn = document.getElementById('download-btn'); // Add this line
    let currentVideoUrl = '';

    fetchBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        
        if (!url || !url.includes('instagram.com')) {
            showToast('Please enter a valid Instagram URL', 'error');
            return;
        }

        UI.setLoading(true);
        UI.resultContainer.classList.add('hidden');

        try {
            const data = await fetchReelData(url);
            
            if (data && data.video_url) {
                currentVideoUrl = data.video_url;
                UI.renderResult(data);
                showToast('Video fetched successfully!');
            } else {
                throw new Error("Invalid response format");
            }
        } catch (error) {
            showToast(error.message || 'Failed to fetch video. Is the profile public?', 'error');
        } finally {
            UI.setLoading(false);
        }
    });

    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchBtn.click();
    });

    // --- NEW: Download functionality ---
    downloadBtn.addEventListener('click', () => {
        if (currentVideoUrl) {
            // Programmatically create an anchor element to trigger download
            const tempLink = document.createElement('a');
            tempLink.href = currentVideoUrl;
            tempLink.target = '_blank'; // Opens in new tab if browser blocks direct cross-origin download
            tempLink.setAttribute('download', 'instagram_video.mp4');
            
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);
            
            showToast('Download started!');
        }
    });

    // Copy link functionality
    copyBtn.addEventListener('click', () => {
        if(currentVideoUrl) {
            navigator.clipboard.writeText(currentVideoUrl).then(() => {
                showToast('Video link copied to clipboard!');
            }).catch(() => {
                showToast('Failed to copy link', 'error');
            });
        }
    });
});