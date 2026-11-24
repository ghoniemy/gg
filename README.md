# SpeakMate AI

A responsive, installable English-practice web app with an optional Gemini-powered tutor.

## Run locally

Requirements: Node.js 18 or newer.

1. Copy `.env.example` and name the copy `.env`.
2. Open `.env` and add your Gemini key after `GEMINI_API_KEY=`.
3. In a terminal opened inside this folder, run:

```bash
npm start
```

4. Open http://localhost:3000.
5. Check http://localhost:3000/api/health. With a valid key, `aiConfigured` should be `true`.
6. Send a practice message in the app. The mode label should say that AI is connected.

The server reads `.env` automatically. Environment variables set by a hosting provider take precedence over `.env`.

## Gemini setup and key safety

- Create/manage keys in Google AI Studio: https://aistudio.google.com/apikey
- Never paste your key into `app.js`, `index.html`, screenshots, chat messages, or GitHub.
- `.env` is excluded by `.gitignore`; upload the project contents, not your `.env`.
- For hosted deployment, add `GEMINI_API_KEY` as a secret/environment variable in the hosting provider's dashboard.
- If a key was shared or exposed, revoke it in Google AI Studio and create a replacement.
- API availability, free quotas, and pricing depend on Google's current terms and account.

Optional setting: `GEMINI_MODEL=gemini-2.5-flash`.

## Deploy

This project runs a Node.js HTTP server. GitHub stores the source; GitHub Pages alone cannot run this server. Deploy it to a Node-compatible host with HTTPS and environment-variable support. Set the start command to `npm start`, then add `GEMINI_API_KEY` in the host's secret settings.

## Current limitations

- Speech recognition converts speech to text; it does not perform phoneme-level pronunciation scoring.
- Spoken replies use the browser's speech synthesis voices. Voice quality and available voices vary by device/browser.
- Progress is stored in the current browser's local storage and is not synced across devices.
- Speech recognition support varies by browser; Chrome on HTTPS or localhost is recommended.
