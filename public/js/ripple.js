document.querySelectorAll('.ripple-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        let x = e.clientX - e.target.getBoundingClientRect().left;
        let y = e.clientY - e.target.getBoundingClientRect().top;
        
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
        
        // Add ripple keyframes dynamically if not present
        if(!document.getElementById('ripple-style')) {
            const style = document.createElement('style');
            style.id = 'ripple-style';
            style.innerHTML = `@keyframes ripple { 0% { width: 0; height: 0; opacity: 0.5; } 100% { width: 500px; height: 500px; opacity: 0; } }`;
            document.head.appendChild(style);
        }
        
        setTimeout(() => ripples.remove(), 600);
    });
});