// public/js/effects_and_ui.js

// --- 1. Aesthetic Utilities (Global window namespace) ---

// Toast Notifications
window.showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    if(type === 'error') toast.style.borderLeft = '4px solid #ff4444';
    if(type === 'success') toast.style.borderLeft = '4px solid #00C851';
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// Expose Ripple globally
window.addRippleEffect = function(element) {
    element.addEventListener('click', function(e) {
        let rect = e.target.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        let ripples = document.createElement('span');
        ripples.style.left = x + 'px';
        ripples.style.top = y + 'px';
        ripples.style.position = 'absolute';
        ripples.style.background = 'rgba(255,255,255,0.3)';
        ripples.style.transform = 'translate(-50%, -50%)';
        ripples.style.pointerEvents = 'none';
        ripples.style.borderRadius = '50%';
        ripples.style.animation = 'ripple 0.6s linear';
        this.appendChild(ripples);
        if(!document.getElementById('ripple-style')) {
            const style = document.createElement('style');
            style.id = 'ripple-style';
            style.innerHTML = `@keyframes ripple { 0% { width: 0; height: 0; opacity: 0.5; } 100% { width: 500px; height: 500px; opacity: 0; } }`;
            document.head.appendChild(style);
        }
        setTimeout(() => ripples.remove(), 600);
    });
};

// Initialization functions for global effects
function initPageEffects() {
    // Ripples existing
    document.querySelectorAll('.ripple-btn').forEach(btn => addRippleEffect(btn));

    // Particles
    const canvas = document.getElementById('particles-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        canvas.style.position = 'fixed'; canvas.style.top = '0'; canvas.style.left = '0';
        canvas.style.width = '100vw'; canvas.style.height = '100vh'; canvas.style.zIndex = '2'; canvas.style.pointerEvents = 'none';
        let particlesArray = [];
        window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width; this.y = Math.random() * canvas.height;
                this.size = Math.random() * 2 + 0.5; this.speedY = Math.random() * -0.5 - 0.1;
                this.opacity = Math.random() * 0.5;
            }
            update() { this.y += this.speedY; if (this.y < 0) this.y = canvas.height; }
            draw() { ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); }
        }
        for (let i = 0; i < 50; i++) particlesArray.push(new Particle());
        function animate() { ctx.clearRect(0, 0, canvas.width, canvas.height); for (let i = 0; i < particlesArray.length; i++) { particlesArray[i].update(); particlesArray[i].draw(); } requestAnimationFrame(animate); }
        animate();
    }
}

// 3D Tilt initializer
function initTiltEffect() {
    document.querySelectorAll('.tilt-element').forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const centerX = rect.width / 2; const centerY = rect.height / 2;
            const rotateX = (((e.clientY - rect.top) - centerY) / centerY) * -5;
            const rotateY = (((e.clientX - rect.left) - centerX) / centerX) * 5;
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`; card.style.transition = 'none';
        });
        card.addEventListener('mouseleave', () => { card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)'; card.style.transition = 'transform 0.5s ease'; });
    });
}


// --- 2. Synced Player Logic (New) ---

// Elements managed by player sync
const playerRef = {
    video: null,
    audio: null,
    listenersInstalled: false
};

// Critical listeners to keep audio perfectly synced with video
const syncEvents = {
    play: () => playerRef.audio.play(),
    pause: () => playerRef.audio.pause(),
    volumechange: () => {
        playerRef.audio.volume = playerRef.video.volume;
        playerRef.audio.muted = playerRef.video.muted;
    },
    // The main sync hook: every seek or time update ensures audio matches exactly
    timeupdate: () => {
        if (!playerRef.video || !playerRef.audio) return;
        // Check if out of sync by more than small threshold
        if (Math.abs(playerRef.video.currentTime - playerRef.audio.currentTime) > 0.15) {
            playerRef.audio.currentTime = playerRef.video.currentTime;
        }
    },
    seeking: () => { playerRef.audio.currentTime = playerRef.video.currentTime; },
    waiting: () => { playerRef.audio.pause(); }, // Handle buffering sync
    canplay: () => { /* possibly preload audio here */ }
};

// Call once on DOMContentLoaded
function setupSyncManager() {
    playerRef.video = document.getElementById('preview-video');
    playerRef.audio = document.getElementById('synced-audio');
    
    // Hide audio native controls, video handles master volume/seek
    playerRef.audio.controls = false; 
    playerRef.audio.preload = "auto";
}

// Attach listeners when separate audio is active
function enableAudioSync(audioUrl) {
    if (!playerRef.video || !playerRef.audio) return;
    
    // Set sources
    playerRef.audio.src = audioUrl;
    
    // Apply initial state
    playerRef.audio.volume = playerRef.video.volume;
    playerRef.audio.muted = playerRef.video.muted;

    if (!playerRef.listenersInstalled) {
        Object.keys(syncEvents).forEach(eventName => {
            playerRef.video.addEventListener(eventName, syncEvents[eventName]);
        });
        playerRef.listenersInstalled = true;
    }
}

// Reset/Disable sync when playing a progressve video with internal audio
function disableAudioSync() {
    if (!playerRef.video || !playerRef.audio) return;
    
    // Stop and clear audio source
    playerRef.audio.pause();
    playerRef.audio.removeAttribute('src');
    playerRef.audio.load();

    if (playerRef.listenersInstalled) {
        Object.keys(syncEvents).forEach(eventName => {
            playerRef.video.removeEventListener(eventName, syncEvents[eventName]);
        });
        playerRef.listenersInstalled = false;
    }
}


// --- 3. Rendering Logic ---

window.UIRenderer = {
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

    setProcessingOverlay(show) {
        const overlay = document.getElementById('processing-overlay');
        if (show) overlay.classList.remove('hidden');
        else overlay.classList.add('hidden');
    },

    renderResult(data) {
        // --- 1. Author & Metadata ---
        const avatar = document.getElementById('author-pic');
        if (data.author_profile_pic) { avatar.src = data.author_profile_pic; avatar.style.display = 'block'; }
        else { avatar.style.display = 'none'; }
        document.getElementById('author-name').textContent = data.author_full_name || 'Author';
        document.getElementById('author-username').textContent = `@${data.username || 'unknown'}`;
        document.getElementById('caption').textContent = data.caption || 'No caption';
        document.getElementById('like-count').textContent = (data.like_count || 0).toLocaleString();
        
        // Changed to views based on your example response
        document.getElementById('comment-count').textContent = (data.play_count || 0).toLocaleString(); 

        // --- 2. Dynamic Player Setup (New Audio Sync Handling) ---
        const videoElement = document.getElementById('preview-video');
        videoElement.poster = data.thumbnail || 'assets/favicon.svg';

        if (data.needs_muxing && data.audio_url && data.best_video_url) {
            // Muxing required scenario (playing separate streams)
            disableAudioSync(); // clean old state
            videoElement.src = data.best_video_url;
            enableAudioSync(data.audio_url); // hook up hidden audio
            videoElement.load();
        } else if (data.video_url) {
            // Standard progressive scenario scenario (video has audio)
            disableAudioSync(); // turn off hooks
            videoElement.src = data.video_url;
            videoElement.load();
        }

        // --- 3. Dynamic Download Buttons ---
        const buttonsContainer = document.getElementById('download-buttons-container');
        buttonsContainer.innerHTML = ''; 

        // Scene 1: Main payload indicates muxing is required for best quality
        if (data.needs_muxing && data.best_video_url && data.audio_url) {
            const btn = document.createElement('button');
            btn.className = 'ripple-btn primary-btn quality-download-btn muxing-btn';
            btn.innerHTML = `<span class="icon">✨</span> Mux & Download (BEST)`;
            // Crucial: Store multiple URLs for muxer
            btn.dataset.needsMuxing = 'true';
            btn.dataset.videoUrl = data.best_video_url;
            btn.dataset.audioUrl = data.audio_url;
            addRippleEffect(btn);
            buttonsContainer.appendChild(btn);
        }

        // Scene 2: Standard Progressive/Alternative formats available
        if (data.formats && data.formats.length > 0) {
            data.formats.forEach(format => {
                // If it already has audio, it doesn't need client-side muxing
                const btn = document.createElement('button');
                btn.className = 'ripple-btn secondary-btn quality-download-btn';
                btn.textContent = `Download ${format.quality || 'MP4'}`;
                btn.dataset.url = format.url; 
                addRippleEffect(btn);
                buttonsContainer.appendChild(btn);
            });
        }

        // --- Finalize UI state ---
        this.resultContainer.classList.remove('hidden');
        initTiltEffect(); // re-init tilt for dynamic element
    }
};

// Global effect init on load
document.addEventListener('DOMContentLoaded', () => {
    initPageEffects();
    setupSyncManager();
});
