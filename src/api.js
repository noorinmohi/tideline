// Talks to OUR backend (/api/chat), never to Anthropic directly.
// The API key lives only on the server — never ship it to the browser.

export async function callClaude(system, messages) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, messages }),
  });
  if (!res.ok) throw new Error("chat request failed: " + res.status);
  const data = await res.json();
  const text = (data.text || "").trim();
  if (!text) throw new Error("empty response");
  return text;
}
