// public/js/api.js

// Simply point to the local function route!
const API_URL = '/api/reels';

async function fetchReelData(url) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });

        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        
        if (!data.success) throw new Error(data.error || 'Failed to fetch video');
        
        return data;
    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
}