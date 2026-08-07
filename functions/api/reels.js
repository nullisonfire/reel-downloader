// functions/api/reels.js

export async function onRequestPost({ request }) {
  try {
    const { url } = await request.json();

    if (!url) {
      return json(
        {
          success: false,
          error: "Missing Instagram URL."
        },
        400
      );
    }

    const browserHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",

      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",

      "Origin": "https://saveigreel.com",
      "Referer": "https://saveigreel.com/",

      "Content-Type": "application/json",

      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty"
    };

    // Visit homepage first in case the service sets non-protective cookies
    const home = await fetch("https://saveigreel.com/", {
      headers: browserHeaders,
      redirect: "follow"
    });

    const cookie = home.headers.get("set-cookie");

    const headers = new Headers(browserHeaders);

    if (cookie) {
      headers.set("Cookie", cookie);
    }

    const api = await fetch("https://saveigreel.com/api/", {
      method: "POST",
      headers,
      body: JSON.stringify({ url }),
      redirect: "follow"
    });

    const contentType = api.headers.get("content-type") || "";
    const body = await api.text();

    // Detect Cloudflare challenge
    if (
      body.includes("Just a moment") ||
      body.includes("cf-browser-verification") ||
      body.includes("challenge-platform")
    ) {
      return json(
        {
          success: false,
          error:
            "Upstream website is protected by Cloudflare and returned a browser challenge."
        },
        503
      );
    }

    return new Response(body, {
      status: api.status,
      headers: {
        "Content-Type": contentType || "application/json",
        "Cache-Control": "no-store"
      }
    });
  } catch (e) {
    return json(
      {
        success: false,
        error: e.message
      },
      500
    );
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
