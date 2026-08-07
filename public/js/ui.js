// public/js/ui.js

const UI = {
    btn: document.getElementById('fetch-btn'),
    btnText: document.querySelector('.btn-text'),
    spinner: document.querySelector('.spinner'),
    resultContainer: document.getElementById('result-container'),
    
    setLoading(isLoading) {
        if (isLoading) {
            this.btnText.classList.add('hidden');
            this.spinner.classList.remove('hidden');
            this.btn.disabled = true;
        } else {
            this.btnText.classList.remove('hidden');
            this.spinner.classList.add('hidden');
            this.btn.disabled = false;
        }
    },

    renderResult(data) {
        // --- Setup basic details ---
        // Handle case where profile pic might be empty string in new API
        const avatar = document.getElementById('author-pic');
        if (data.author_profile_pic && data.author_profile_pic !== "") {
            avatar.src = data.author_profile_pic;
            avatar.style.display = 'block';
        } else {
            avatar.style.display = 'none'; // Hide if no pic
        }

        document.getElementById('author-name').textContent = data.author_full_name || 'Author';
        document.getElementById('author-username').textContent = `@${data.username || 'unknown'}`;
        document.getElementById('caption').textContent = data.caption || 'No caption';
        
        // --- Update Stats with new metadata options ---
        document.getElementById('like-count').textContent = (data.like_count || 0).toLocaleString();
        
        // Map new metadata (or default if null)
        const commentsParent = document.getElementById('comment-count').parentElement;
        commentsParent.innerHTML = `<span id="comment-count">${(data.play_count || 0).toLocaleString()}</span> Views`; // Changed to views based on typical request, keep ID for simplicity or change properly in HTML

        // --- Setup Download Buttons Dynamically ---
        const buttonsContainer = document.getElementById('download-buttons-container');
        buttonsContainer.innerHTML = ''; // Clear old buttons

        if (data.formats && data.formats.length > 0) {
            // Set highest quality as default preview poster/source
            const best = data.formats.find(f => f.quality === 'hd') || data.formats[0];
            document.getElementById('preview-video').src = best.url;
            document.getElementById('preview-video').poster = data.thumbnail || '';

            // Generate a button for every quality format
            data.formats.forEach(format => {
                const btn = document.createElement('button');
                btn.className = 'ripple-btn primary-btn quality-download-btn';
                btn.textContent = `Download ${format.quality.toUpperCase()}`;
                
                // Store the specific URL as a dataset attribute
                btn.dataset.url = format.url; 
                
                // Ensure ripple styles are added dynamically to this specific button
                initRippleForElement(btn); 

                buttonsContainer.appendChild(btn);
            });
        } else {
            // Fallback for old worker structure or missing formats
            document.getElementById('preview-video').src = data.video_url;
            const btn = document.createElement('button');
            btn.className = 'ripple-btn primary-btn quality-download-btn';
            btn.textContent = `Download MP4`;
            btn.dataset.url = data.video_url;
            initRippleForElement(btn);
            buttonsContainer.appendChild(btn);
        }

        // --- Finalize UI state ---
        this.resultContainer.classList.remove('hidden');
        this.resultContainer.classList.add('fade-in');
        
        if(typeof initTilt === 'function') initTilt();
    }
};

// Helper function to re-apply ripple to dynamically generated elements
function initRippleForElement(btn) {
    if (typeof addRippleEffect === 'function') {
        addRippleEffect(btn);
    }
}
