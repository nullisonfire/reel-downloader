// functions/api/reels.js

export async function onRequestPost(context) {
  const { request } = context;

  try {
    const body = await request.json();

    if (!body.url) {
      return new Response(JSON.stringify({ success: false, error: "Missing Instagram URL." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const response = await fetch("https://saveigreel.com/api/", {
      method: "POST",
      headers: {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        "origin": "https://saveigreel.com",
        "referer": "https://saveigreel.com/"
      },
      body: JSON.stringify({ url: body.url })
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}