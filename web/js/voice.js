/**
 * Speak — text-to-speech backed by the default TTS provider, or any TTS model
 * selected on this page.
 */

import { synthesize } from './api.js'
import { getModel } from './models.js'
import { downloadDataUrl, extensionFor, timestamp } from './download.js'
import { setBusy, refreshIcons } from './ui.js'
import { createPlayer } from './player.js'

export function initVoice() {
  const form = document.getElementById('tts-form')
  const input = document.getElementById('tts-input')
  const clips = document.getElementById('clips')
  const submitBtn = form.querySelector('.solid-btn')

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const text = input.value.trim()
    if (!text) return

    setBusy(submitBtn, true)
    try {
      const res = await synthesize(text, getModel('tts'))
      addClip(text, res.audio, res.mime)
      input.value = ''
    } catch (err) {
      showError(err.message)
    } finally {
      setBusy(submitBtn, false)
    }
  })

  function addClip(text, dataUrl, mime) {
    const clip = document.createElement('div')
    clip.className = 'clip'

    const label = document.createElement('div')
    label.className = 'clip-text'
    label.textContent = text

    const bar = document.createElement('div')
    bar.className = 'clip-bar'

    const player = createPlayer(dataUrl)

    const filename = `atelier-voice-${timestamp()}.${extensionFor(mime, 'audio', 'mp3')}`
    const download = document.createElement('button')
    download.type = 'button'
    download.className = 'text-btn download-btn'
    download.title = 'Download audio'
    download.setAttribute('aria-label', 'Download audio')
    download.innerHTML = '<i data-lucide="download"></i><span>Download</span>'
    download.addEventListener('click', () => downloadDataUrl(dataUrl, filename))

    bar.append(player.el, download)
    clip.append(label, bar)
    clips.prepend(clip)
    refreshIcons()
  }

  function showError(message) {
    const el = document.createElement('div')
    el.className = 'error-note'
    el.textContent = message
    clips.prepend(el)
  }
}
