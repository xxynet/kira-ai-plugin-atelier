/**
 * Download helpers for generated media.
 *
 * The backend returns data URLs, so a plain anchor carrying the ``download``
 * attribute hands the bytes to the browser's download manager without another
 * round trip.
 */

const IMAGE_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

const AUDIO_EXT = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'audio/silk': 'silk',
  'audio/flac': 'flac',
}

/** Pick a file extension for a response MIME type, falling back per media kind. */
export function extensionFor(mime, kind, fallback) {
  const table = kind === 'audio' ? AUDIO_EXT : IMAGE_EXT
  const normalized = (mime || '').split(';')[0].trim().toLowerCase()
  return table[normalized] || fallback
}

/** Compact local timestamp used to keep downloaded files distinct. */
export function timestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('') + '-' + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('')
}

export function downloadDataUrl(dataUrl, filename) {
  if (!dataUrl) return
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename || `atelier-${timestamp()}`
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}
