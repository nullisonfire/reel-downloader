function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // Slight color code based on type
    if(type === 'error') toast.style.borderLeft = '4px solid #ff4444';
    if(type === 'success') toast.style.borderLeft = '4px solid #00C851';

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}