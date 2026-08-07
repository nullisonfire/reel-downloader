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
        document.getElementById('preview-video').src = data.video_url;
        document.getElementById('preview-video').poster = data.thumbnail;
        
        document.getElementById('author-pic').src = data.author_profile_pic || '';
        document.getElementById('author-name').textContent = data.author_full_name;
        document.getElementById('author-username').textContent = `@${data.username}`;
        
        document.getElementById('caption').textContent = data.caption || 'No caption';
        document.getElementById('like-count').textContent = data.like_count.toLocaleString();
        document.getElementById('comment-count').textContent = data.comment_count.toLocaleString();
        

        this.resultContainer.classList.remove('hidden');
        this.resultContainer.classList.add('fade-in');
        
        // Re-initialize tilt effect for new rendered content
        if(typeof initTilt === 'function') initTilt();
    }
};