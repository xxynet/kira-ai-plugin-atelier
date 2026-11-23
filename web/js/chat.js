/**
 * Compose — conversational text generation backed by the default LLM provider.
 */

import { chat as chatApi } from './api.js'
import { getModel } from './models.js'
import { setBusy } from './ui.js'

export function initChat() {
  const log = document.getElementById('chat-log')
  const form = document.getElementById('chat-form')
  const input = document.getElementById('chat-input')
  const clearBtn = document.getElementById('chat-clear')
  const sendBtn = form.querySelector('.send-btn')

  /** Conversation history sent to the backend, [{ role, content }]. */
  let history = []

  function scrollToEnd() {
    log.scrollTop = log.scrollHeight
  }

  function addMessage(role, content, { reveal = false } = {}) {
    const wrap = document.createElement('div')
    wrap.className = `msg msg-${role}`

    const label = document.createElement('span')
    label.className = 'msg-role'
    label.textContent = role === 'user' ? 'You' : 'Atelier'

    const bubble = document.createElement('div')
    bubble.className = 'msg-bubble'
    bubble.textContent = content

    wrap.append(label, bubble)
    log.appendChild(wrap)
    scrollToEnd()

    if (reveal) {
      requestAnimationFrame(() => bubble.classList.add('reveal'))
    }
  }

  function addError(message) {
    const el = document.createElement('div')
    el.className = 'error-note'
    el.textContent = message
    log.appendChild(el)
    scrollToEnd()
  }

  function autoGrow() {
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`
  }

  async function send() {
    const text = input.value.trim()
    if (!text) return

    addMessage('user', text)
    history.push({ role: 'user', content: text })
    input.value = ''
    autoGrow()

    setBusy(sendBtn, true)
    try {
      const res = await chatApi(history, getModel('llm'))
      const reply = (res.text || '').trim()
      addMessage('assistant', reply, { reveal: true })
      history.push({ role: 'assistant', content: reply })
    } catch (err) {
      // Drop the failed turn so a retry does not duplicate it.
      if (history.length && history[history.length - 1].role === 'user') {
        history.pop()
      }
      addError(err.message)
    } finally {
      setBusy(sendBtn, false)
      input.focus()
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    send()
  })

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  })

  input.addEventListener('input', autoGrow)

  clearBtn.addEventListener('click', () => {
    history = []
    log.innerHTML = ''
    input.focus()
  })
}
