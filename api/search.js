// api/search.js
// Serverless function — searches Google via Serper and returns top results

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) return res.status(500).json({ error: "Serper API key not configured" });

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
    }

    const { query } = body || {};
    if (!query) return res.status(400).json({ error: "Missing query" });

    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": serperKey,
      },
      body: JSON.stringify({
        q: query,
        num: 5,
        gl: "us",
        hl: "en",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();

    // Extract and clean up organic results
    const results = (data.organic || []).slice(0, 4).map(r => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet,
      source: r.source || new URL(r.link).hostname.replace("www.", ""),
      date: r.date || null,
    }));

    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
