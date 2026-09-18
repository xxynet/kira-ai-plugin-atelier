/**
 * Small DOM helpers shared across the Atelier modules.
 */

/** Re-run Lucide's icon pass so dynamically inserted ``<i data-lucide>`` tags render. */
export function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons()
  }
}

/**
 * Toggle a button into a busy state (spinner + disabled) and back.
 * The original innerHTML is preserved so icons render again on restore.
 */
export function setBusy(btn, busy) {
  if (!btn) return
  if (busy) {
    if (btn.dataset.busyOriginal === undefined) {
      btn.dataset.busyOriginal = btn.innerHTML
    }
    btn.disabled = true
    btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>'
  } else {
    btn.disabled = false
    if (btn.dataset.busyOriginal !== undefined) {
      btn.innerHTML = btn.dataset.busyOriginal
      delete btn.dataset.busyOriginal
      refreshIcons()
    }
  }
}

/** Format a duration in seconds as m:ss. */
export function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
