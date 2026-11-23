/**
 * Render — image generation backed by the default image provider, or any
 * image model selected on this page.
 */

import { generateImage } from './api.js'
import { getModel } from './models.js'
import { downloadDataUrl, extensionFor, timestamp } from './download.js'
import { setBusy, refreshIcons } from './ui.js'

export function initImage() {
  const form = document.getElementById('image-form')
  const input = document.getElementById('image-input')
  const gallery = document.getElementById('gallery')
  const sendBtn = form.querySelector('.send-btn')

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const prompt = input.value.trim()
    if (!prompt) return

    const loading = document.createElement('div')
    loading.className = 'gallery-item gallery-loading'
    loading.innerHTML = '<span class="spinner" aria-hidden="true"></span>'
    gallery.prepend(loading)

    setBusy(sendBtn, true)
    try {
      const res = await generateImage(prompt, getModel('image'))
      loading.remove()
      prependImage(prompt, res.image, res.mime)
      input.value = ''
    } catch (err) {
      loading.remove()
      showError(err.message)
    } finally {
      setBusy(sendBtn, false)
    }
  })

  function prependImage(prompt, dataUrl, mime) {
    const item = document.createElement('figure')
    item.className = 'gallery-item'

    const img = document.createElement('img')
    img.src = dataUrl
    img.alt = prompt

    const overlay = document.createElement('figcaption')
    overlay.className = 'gallery-overlay'

    const promptEl = document.createElement('span')
    promptEl.className = 'gallery-prompt'
    promptEl.textContent = prompt

    const filename = `atelier-image-${timestamp()}.${extensionFor(mime, 'image', 'png')}`
    const save = document.createElement('a')
    save.href = dataUrl
    save.download = filename
    save.title = 'Download image'
    save.setAttribute('aria-label', 'Download image')
    save.innerHTML = '<i data-lucide="download"></i>'
    // Data URLs are already in memory; skip navigation for a predictable save.
    save.addEventListener('click', (event) => {
      event.preventDefault()
      downloadDataUrl(dataUrl, filename)
    })

    const actions = document.createElement('div')
    actions.className = 'gallery-actions'
    actions.appendChild(save)

    overlay.append(promptEl, actions)
    item.append(img, overlay)
    gallery.prepend(item)
    refreshIcons()
  }

  function showError(message) {
    const el = document.createElement('div')
    el.className = 'error-note'
    el.textContent = message
    gallery.prepend(el)
  }
}
