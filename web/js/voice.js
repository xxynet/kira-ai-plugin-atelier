/**
 * Speak — text-to-speech backed by the default TTS provider.
 */

import { synthesize } from './api.js'
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
      const res = await synthesize(text)
      addClip(text, res.audio)
      input.value = ''
    } catch (err) {
      showError(err.message)
    } finally {
      setBusy(submitBtn, false)
    }
  })

  function addClip(text, dataUrl) {
    const clip = document.createElement('div')
    clip.className = 'clip'

    const label = document.createElement('div')
    label.className = 'clip-text'
    label.textContent = text

    const player = createPlayer(dataUrl)
    clip.append(label, player.el)
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
