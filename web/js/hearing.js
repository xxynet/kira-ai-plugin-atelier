/**
 * Listen — speech-to-text backed by the default STT provider.
 *
 * Records from the microphone with MediaRecorder, visualizes the input level
 * with an AnalyserNode, and posts the resulting audio to the backend for
 * transcription.
 */

import { transcribe } from './api.js'
import { getModel } from './models.js'
import { refreshIcons, formatTime } from './ui.js'

function pickMimeType() {
  if (!window.MediaRecorder) return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read the recording.'))
    reader.readAsDataURL(blob)
  })
}

export function initHearing() {
  const btn = document.getElementById('record-btn')
  const stateEl = document.getElementById('record-state')
  const timerEl = document.getElementById('record-timer')
  const levelEl = document.getElementById('level')
  const transcriptEl = document.getElementById('transcript')
  const bars = Array.from(levelEl.querySelectorAll('span'))

  let recorder = null
  let stream = null
  let chunks = []
  let timer = null
  let startTime = 0

  let audioCtx = null
  let analyser = null
  let raf = null

  function startMeter() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      audioCtx = new Ctx()
      const source = audioCtx.createMediaStreamSource(stream)
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.5
      source.connect(analyser)

      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i += 1) sum += data[i]
        const norm = Math.min(1, (sum / data.length / 255) * 3.2)

        bars.forEach((bar, i) => {
          const envelope = 0.35 + 0.65 * Math.sin((i / bars.length) * Math.PI)
          const height = 3 + Math.max(3, norm * 19) * envelope
          bar.style.height = `${height.toFixed(1)}px`
        })
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    } catch (_) {
      // The meter is purely cosmetic; ignore when the audio graph is unavailable.
    }
  }

  function stopMeter() {
    if (raf) cancelAnimationFrame(raf)
    raf = null
    if (audioCtx) {
      audioCtx.close().catch(() => {})
      audioCtx = null
      analyser = null
    }
  }

  function resetBars() {
    bars.forEach((bar) => { bar.style.height = '3px' })
  }

  function setRecording(active) {
    btn.classList.toggle('is-recording', active)
    levelEl.classList.toggle('is-active', active)
    stateEl.textContent = active ? 'Recording' : 'Tap to record'
    if (!active) timerEl.textContent = '0:00'
  }

  async function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone access is not supported in this browser.')
    }

    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = pickMimeType()
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    chunks = []

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size) chunks.push(event.data)
    }

    recorder.start()
    startTime = Date.now()
    setRecording(true)
    startMeter()

    timer = setInterval(() => {
      timerEl.textContent = formatTime((Date.now() - startTime) / 1000)
    }, 250)
  }

  function stop() {
    return new Promise((resolve) => {
      recorder.onstop = () => {
        stopMeter()
        if (stream) stream.getTracks().forEach((track) => track.stop())
        stream = null
        clearInterval(timer)
        setRecording(false)
        resetBars()
        const type = recorder.mimeType || 'audio/webm'
        resolve(new Blob(chunks, { type }))
      }
      recorder.stop()
    })
  }

  function renderTranscript(text) {
    transcriptEl.innerHTML = ''

    const content = document.createElement('p')
    content.className = 'transcript-text'
    content.textContent = text

    const toolbar = document.createElement('div')
    toolbar.className = 'transcript-toolbar'
    const copyBtn = document.createElement('button')
    copyBtn.type = 'button'
    copyBtn.className = 'text-btn'
    copyBtn.innerHTML = '<i data-lucide="copy"></i><span>Copy</span>'
    copyBtn.addEventListener('click', () => {
      navigator.clipboard?.writeText(text).catch(() => {})
    })

    toolbar.appendChild(copyBtn)
    transcriptEl.append(content, toolbar)
    refreshIcons()
  }

  function renderError(message) {
    transcriptEl.innerHTML = ''
    const el = document.createElement('div')
    el.className = 'error-note'
    el.textContent = message
    transcriptEl.appendChild(el)
  }

  btn.addEventListener('click', async () => {
    if (recorder && recorder.state !== 'inactive') {
      btn.disabled = true
      try {
        const blob = await stop()
        stateEl.textContent = 'Transcribing'
        const dataUrl = await blobToDataUrl(blob)
        const res = await transcribe(dataUrl, getModel('stt'))
        renderTranscript((res.text || '').trim())
      } catch (err) {
        renderError(err.message)
        setRecording(false)
      } finally {
        btn.disabled = false
        stateEl.textContent = 'Tap to record'
      }
      return
    }

    try {
      await start()
    } catch (err) {
      renderError(err.message)
    }
  })
}
