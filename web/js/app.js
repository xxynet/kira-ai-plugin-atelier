/**
 * Atelier entry point — wires up theme, topbar tabs, and the four
 * capability modules.
 */

import { refreshIcons } from './ui.js'
import { initTheme } from './theme.js'
import { initModels } from './models.js'
import { initChat } from './chat.js'
import { initImage } from './image.js'
import { initVoice } from './voice.js'
import { initHearing } from './hearing.js'

/** The input to focus when a capability becomes active, by tab id. */
const VIEW_FOCUS = {
  chat: 'chat-input',
  image: 'image-input',
  voice: 'tts-input',
}

function initTabs() {
  const tabs = Array.from(document.querySelectorAll('.tab'))
  const views = Array.from(document.querySelectorAll('.view'))

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.tab

      tabs.forEach((t) => {
        const active = t === tab
        t.classList.toggle('is-active', active)
        t.setAttribute('aria-selected', active ? 'true' : 'false')
      })

      views.forEach((v) => v.classList.toggle('is-active', v.dataset.view === id))

      const focusId = VIEW_FOCUS[id]
      if (focusId) document.getElementById(focusId)?.focus()
    })
  })
}

function init() {
  refreshIcons()
  initTheme(document.getElementById('theme-toggle'))
  initTabs()
  initModels()
  initChat()
  initImage()
  initVoice()
  initHearing()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
