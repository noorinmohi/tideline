// Minimal backend for Tideline.
//
// Responsibilities:
//   1. Hold the Anthropic API key (from env) and proxy chat requests so the
//      key is NEVER exposed to the browser.
//   2. In production, serve the built React app from /dist.
//
// Run: `node server.js` (after `npm run build`), or use the Vite dev proxy
// during development (see vite.config.js).

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

if (!API_KEY) {
  console.warn("⚠  ANTHROPIC_API_KEY is not set — /api/chat will return 500. Copy .env.example to .env and add your key.");
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.post("/api/chat", async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY" });

  const { system, messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array required" });
  }

  // Guard against empty-content messages, which the API rejects and which
  // would otherwise break later turns in a thread.
  const safe = messages.map((m) => ({
    role: m.role,
    content: m.content && String(m.content).trim() ? m.content : "…",
  }));

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 1000, system, messages: safe }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error("Anthropic error", upstream.status, detail);
      return res.status(502).json({ error: "upstream error" });
    }

    const data = await upstream.json();
    const text = (data.content || [])
      .map((b) => (b.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!text) return res.status(502).json({ error: "empty response" });
    return res.json({ text });
  } catch (err) {
    console.error("proxy failure", err);
    return res.status(502).json({ error: "request failed" });
  }
});

// Serve the built frontend in production.
const dist = path.join(__dirname, "dist");
app.use(express.static(dist));
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));

app.listen(PORT, () => console.log(`Tideline server on http://localhost:${PORT}`));
