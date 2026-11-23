# Atelier

A unified creative console for KiraAI. One plugin page exposes the four generative
capabilities already configured in your KiraAI instance — text, image, speech
synthesis, and speech recognition — without any extra provider setup. Every
capability starts on the KiraAI default model and can be pointed at any other
configured model from the page itself.

![Version](https://img.shields.io/badge/version-1.2.0-blue)

## Features

- **Chat** — conversational text generation backed by the default LLM provider,
  with multi-turn context and a configurable system prompt.
- **Image** — text-to-image generation backed by the default image provider,
  with a hover-to-save gallery.
- **Voice** — text-to-speech backed by the default TTS provider, with an inline
  custom audio player (play/pause, seek, time) and a download button per clip.
- **Listen** — speech-to-text backed by the default STT provider, recording
  from the microphone with a live input-level meter.
- **Model switching** — each of the four views has its own selector listing every
  configured model of that type. Leave it on `Default` to keep following the
  KiraAI default; pick a specific model to pin that capability to it. The choice
  is saved server-side and survives page reloads and KiraAI restarts.
- **Downloads** — generated images and synthesized audio can be saved locally
  with timestamped filenames (`atelier-image-<stamp>.<ext>`,
  `atelier-voice-<stamp>.<ext>`).

Capabilities are switched through a segmented tab control at the top of the
page; only one view is active at a time. The page follows a minimalist tech
design with light and dark themes and syncs with the parent WebUI theme.

## Requirements

Every capability relies on the **default providers** configured in KiraAI
(Settings → Providers). A capability that has no corresponding default
provider will simply return an error when used; everything else keeps working.
Selecting another model in the page only requires that model to exist under a
provider that is currently enabled.

| Capability | Default used when the selector is on `Default` |
|------------|-----------------------------------------------|
| Chat | Default LLM |
| Image | Default image model |
| Voice | Default TTS |
| Listen | Default STT |

## Configuration

The plugin exposes a single option in the WebUI plugin settings:

- **System prompt** — optional system prompt prepended to every chat
  conversation. Leave empty to use the built-in default.

Per-capability model choices are made on the plugin page, not in the settings
form. They are stored by the plugin in its own runtime data directory
(`data/plugin_data/kira-ai-plugin-atelier/models.json`). If a saved model is
later removed or its provider is disabled, the plugin logs a warning and falls
back to the KiraAI default instead of failing.

## API

All endpoints are registered by the plugin and reachable at
`/api/plugin/kira-ai-plugin-atelier/…`. Every endpoint returns
`{ "ok": true, … }` on success and `{ "ok": false, "error": "…" }` on failure.

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/status` | — | `{ available, selection, catalog }` |
| POST | `/selection` | `{ models: { llm, image, tts, stt } }` (or `{ capability, reference }`) | `{ selection, available, catalog }` |
| POST | `/chat` | `{ messages: [{ role, content }], model? }` | `{ text, model }` |
| POST | `/image` | `{ prompt, model? }` | `{ image, mime, name, model }` |
| POST | `/tts` | `{ text, model? }` | `{ audio, mime, name, model }` |
| POST | `/stt` | `{ audio }` (data URL or base64), `model?` | `{ text, model }` |

`model` is a `provider_id:model_id` reference. Omit it (or send an empty
string) to use the stored selection, which itself falls back to the KiraAI
default. `catalog` lists, per capability, every model of that type with its
reference, provider name, upstream model name, and whether it is the current
default.

`/chat` accepts `user` and `assistant` messages; a system prompt is prepended
server-side and unknown roles or empty content are dropped.

## Project structure

```
kira-ai-plugin-atelier/
├── main.py           # Plugin entry: provider resolution, API endpoints, page
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
        ├── models.js # Model catalog loading + per-view selectors
        ├── download.js # Data-URL download helper and extension mapping
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
- Changes to `main.py` (including new API routes) require restarting KiraAI (or
  reloading plugins) to take effect.
- Model resolution lives in `AtelierPlugin._client_for()`; add a capability to
  the `CAPABILITIES` table to expose another model type on the page.
