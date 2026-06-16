# Tideline

An AI journaling companion that helps you reflect on your emotions and track personal goals. Write an entry, get a short, warm reflection back, and keep the conversation going — the companion is aware of the goals you've set and can gently connect how you feel to what you're working toward.

> **Not a medical device.** Tideline is a tool for reflection, not a substitute for professional care. It is prompted to encourage real-world support and surface crisis resources, but it cannot provide diagnosis or treatment.

## Features

- **Reflective journaling** — entries become an ongoing chat thread with a gentle AI companion.
- **Mood tracking** — tag how you feel; moods are shown across your thread.
- **Goal tracking** — set goals with a "why," and let the companion break them into small steps.
- **Wrap-up takeaways** — distill any reflection into a short keepsake summary.
- **Goal-aware reflections** — the journal knows your goals and references them only when relevant.

## Architecture

```
Browser (React + Vite)
   │  POST /api/chat   ← never sees your API key
   ▼
Express server (server.js)
   │  adds x-api-key, calls Anthropic
   ▼
Anthropic Messages API  (model: claude-sonnet-4-6)
```

Journal entries and goals are stored in the **browser** (`localStorage`) — private to the device, no database required for v1. See [Roadmap](#roadmap) for moving to accounts + a shared database.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- An Anthropic API key — create one at <https://console.anthropic.com/>

## Setup

```bash
npm install
cp .env.example .env      # then edit .env and paste your ANTHROPIC_API_KEY
```

## Run in development

```bash
npm run dev
```

This starts the Vite dev server (UI) and the Express backend together. Open the URL Vite prints (default <http://localhost:5173>). Requests to `/api` are proxied to the backend on port 3001, so your key stays server-side.

## Run in production

```bash
npm run build     # bundles the UI into /dist
npm start         # Express serves /dist and the /api proxy on port 3001
```

## Publish to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Tideline journaling companion"
git branch -M main
git remote add origin https://github.com/<your-username>/tideline.git
git push -u origin main
```

`.env` is gitignored, so your API key will **not** be committed. Double-check with `git status` before your first push.

## Deploy

Because the backend holds the key, you need a host that runs Node (not a static-only host):

- **Render / Railway / Fly.io / a small VPS** — set `ANTHROPIC_API_KEY` as an environment variable, build with `npm run build`, start with `npm start`.
- **Vercel / Netlify** — move the `/api/chat` handler into a serverless function and deploy the Vite output as static; set the key as an environment secret in the dashboard.

Never commit the key or expose it to the browser.

## Roadmap

This v1 is single-user and stores data on-device. To make it a multi-user product:

1. **Accounts & auth** — add sign-in (e.g. Auth.js, Clerk, or your own).
2. **Database** — replace `src/storage.js` with API calls to a backend store (Postgres, SQLite, etc.), scoped per user. The storage interface is intentionally tiny so only that one file changes.
3. **Encryption & privacy** — encrypt entries at rest; write a clear privacy policy. Journaling data is sensitive.
4. **Conversation compaction** — summarize older turns so long threads don't resend the whole history on every reply (cost/latency).
5. **Insights** — mood trends over time, links between journal themes and goals.

> Mental-health apps are regulated in some jurisdictions. If you take this to real users, look into the rules that apply to you. This note is not legal advice.

## License

MIT — see [LICENSE](LICENSE).
