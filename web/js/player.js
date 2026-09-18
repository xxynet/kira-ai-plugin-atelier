/**
 * A minimal custom audio player (play/pause + seekable progress + time).
 * Rendered entirely with DOM nodes and Lucide icons.
 */

import { refreshIcons, formatTime } from './ui.js'

export function createPlayer(src) {
  const audio = new Audio()
  audio.src = src
  audio.preload = 'metadata'

  const root = document.createElement('div')
  root.className = 'player'

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'player-btn'
  btn.setAttribute('aria-label', 'Play')
  btn.innerHTML = '<i data-lucide="play"></i>'

  const track = document.createElement('div')
  track.className = 'player-track'
  const progress = document.createElement('div')
  progress.className = 'player-progress'
  track.appendChild(progress)

  const time = document.createElement('span')
  time.className = 'player-time'
  time.textContent = '0:00 / 0:00'

  root.append(btn, track, time)
  refreshIcons()

  function setPlayIcon(playing) {
    btn.innerHTML = playing ? '<i data-lucide="pause"></i>' : '<i data-lucide="play"></i>'
    refreshIcons()
  }

  function update() {
    const duration = audio.duration || 0
    const ratio = duration ? (audio.currentTime / duration) * 100 : 0
    progress.style.width = `${ratio}%`
    time.textContent = `${formatTime(audio.currentTime)} / ${formatTime(duration)}`
  }

  btn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  })

  audio.addEventListener('play', () => setPlayIcon(true))
  audio.addEventListener('pause', () => setPlayIcon(false))
  audio.addEventListener('ended', () => setPlayIcon(false))
  audio.addEventListener('timeupdate', update)
  audio.addEventListener('loadedmetadata', update)

  track.addEventListener('click', (event) => {
    const rect = track.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    if (audio.duration && Number.isFinite(ratio)) {
      audio.currentTime = ratio * audio.duration
    }
  })

  return { el: root, audio }
}
