/**
 * Typed wrappers around the plugin API bridge.
 *
 * Every endpoint returns ``{ ok, ... }`` on success and throws an ``Error``
 * carrying a human-readable message on failure. Each generation call takes an
 * optional model reference ("providerId:modelId"); an empty string means the
 * framework default configured in KiraAI.
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

export function status() {
  return call('get', '/status')
}

export function saveSelection(models) {
  return call('post', '/selection', { models })
}

export function chat(messages, model) {
  return call('post', '/chat', { messages, model: model || '' })
}

export function generateImage(prompt, model) {
  return call('post', '/image', { prompt, model: model || '' })
}

export function synthesize(text, model) {
  return call('post', '/tts', { text, model: model || '' })
}

export function transcribe(audioDataUrl, model) {
  return call('post', '/stt', { audio: audioDataUrl, model: model || '' })
}
