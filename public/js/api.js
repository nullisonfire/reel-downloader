// public/js/api.js

// Change this to point to the new endpoint
// const API_URL = '/api/reels'; // old Pages Function route
const API_URL = 'https://reel-worker.zonal8731.workers.dev/'; // NEW Worker endpoint

async function fetchReelData(url) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            // Keep content-type so Worker parses JSON body
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });

        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        
        // Use the Worker's error handling structure if present
        if (!data.success) throw new Error(data.error || 'Failed to fetch video');
        
        return data;
    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
}
