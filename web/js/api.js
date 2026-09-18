/**
 * Typed wrappers around the plugin API bridge.
 *
 * Every endpoint returns ``{ ok, ... }`` on success and throws an ``Error``
 * carrying a human-readable message on failure.
 */

const bridge = window.PluginPageContext

async function call(method, path, body) {
  let data
  try {
    data = await bridge.api[method](path, body)
  } catch (_) {
    throw new Error('Network request failed. Please try again.')
  }

  if (data && data.ok) return data

  const message = (data && (data.error || data.detail)) || 'Request failed.'
  throw new Error(message)
}

export function chat(messages) {
  return call('post', '/chat', { messages })
}

export function generateImage(prompt) {
  return call('post', '/image', { prompt })
}

export function synthesize(text) {
  return call('post', '/tts', { text })
}

export function transcribe(audioDataUrl) {
  return call('post', '/stt', { audio: audioDataUrl })
}
