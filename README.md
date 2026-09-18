# Atelier

A unified creative console for KiraAI. One plugin page exposes the four generative
capabilities already configured in your KiraAI instance — text, image, speech
synthesis, and speech recognition — without any extra provider setup.

![Version](https://img.shields.io/badge/version-1.1.0-blue)

## Features

- **Chat** — conversational text generation backed by the default LLM provider,
  with multi-turn context and a configurable system prompt.
- **Image** — text-to-image generation backed by the default image provider,
  with a hover-to-save gallery.
- **Voice** — text-to-speech backed by the default TTS provider, with an inline
  custom audio player (play/pause, seek, time).
- **Listen** — speech-to-text backed by the default STT provider, recording
  from the microphone with a live input-level meter.

Capabilities are switched through a segmented tab control at the top of the
page; only one view is active at a time. The page follows a minimalist tech
design with light and dark themes and syncs with the parent WebUI theme.

## Requirements

Every capability relies on the **default providers** configured in KiraAI
(Settings → Providers). A capability that has no corresponding default
provider will simply return an error when used; everything else keeps working.

| Capability | Provider |
|------------|----------|
| Chat | Default LLM |
| Image | Default image model |
| Voice | Default TTS |
| Listen | Default STT |

## Configuration

The plugin exposes a single option in the WebUI plugin settings:

- **System prompt** — optional system prompt prepended to every chat
  conversation. Leave empty to use the built-in default.

## API

All endpoints are registered by the plugin and reachable at
`/api/plugin/kira-ai-plugin-atelier/…`. Every endpoint returns
`{ "ok": true, … }` on success and `{ "ok": false, "error": "…" }` on failure.

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/status` | — | `{ available: { llm, image, tts, stt } }` |
| POST | `/chat` | `{ messages: [{ role, content }] }` | `{ text }` |
| POST | `/image` | `{ prompt }` | `{ image, mime }` |
| POST | `/tts` | `{ text }` | `{ audio, mime }` |
| POST | `/stt` | `{ audio }` (data URL or base64) | `{ text }` |

`/chat` accepts `user` and `assistant` messages; a system prompt is prepended
server-side and unknown roles or empty content are dropped.

## Project structure

```
kira-ai-plugin-atelier/
├── main.py           # Plugin entry: API endpoints + page registration
├── manifest.json     # Plugin metadata and locales
├── schema.json       # WebUI settings schema (system prompt)
├── icon.svg
└── web/              # Static frontend served at the plugin page
    ├── index.html
    ├── style.css
    ├── lucide.min.js # Vendored icon library (no CDN dependency)
    └── js/
        ├── app.js    # Entry: tabs, theme, module wiring
        ├── api.js    # Typed wrappers around the plugin API bridge
        ├── chat.js   # Chat capability
        ├── image.js  # Image capability
        ├── voice.js  # TTS capability
        ├── hearing.js# STT capability (MediaRecorder + level meter)
        ├── player.js # Custom audio player
        ├── theme.js  # Theme handling (follows WebUI, local override)
        └── ui.js     # Small shared DOM helpers
```

## Development notes

- The frontend is plain HTML/CSS/ES modules with **no build step** — edit files
  under `web/` and reload the plugin page.
- The page runs inside the WebUI iframe and communicates through
  `window.PluginPageContext` (`/plugin-bridge.js`), which provides theme
  context and same-origin API calls.
- Icons come from the vendored Lucide UMD build (`web/lucide.min.js`), so the
  page works fully offline; no external requests are made.
- Changes to `main.py` require restarting KiraAI (or reloading plugins) to
  take effect.
