// api/analyze.js
export const config = { api: { bodyParser: true } };

// In-memory rate limit store — resets on each cold start (good enough for serverless)
// Limits: 3 full analyses per IP per day (each analysis = ~7 calls, so 21 calls max)
const rateLimitStore = new Map();
const CALLS_PER_IP_PER_DAY = 21; // 3 analyses worth

function getRateLimitKey(ip) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${ip}:${today}`;
}

function isRateLimited(ip) {
  const key = getRateLimitKey(ip);
  const count = rateLimitStore.get(key) || 0;
  return count >= CALLS_PER_IP_PER_DAY;
}

function incrementCount(ip) {
  const key = getRateLimitKey(ip);
  rateLimitStore.set(key, (rateLimitStore.get(key) || 0) + 1);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Rate limiting
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Daily limit reached. You've used your 3 free analyses for today — come back tomorrow!" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON body" }); }
    }

    const system = body?.system;
    const user = body?.user;

    if (!system || !user) {
      return res.status(400).json({ error: "Missing system or user" });
    }

    // Count this call
    incrementCount(ip);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1024,
        temperature: 0,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(400).json({ error: "Anthropic error", details: data });
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
