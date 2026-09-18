/**
 * Theme handling for the plugin page.
 *
 * Follows the parent WebUI theme via the plugin bridge, with a local toggle
 * as an override. Persists the local choice so it survives reloads.
 */

const STORAGE_KEY = 'atelier:theme'

function apply(isDark) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
}

function initialDark() {
  const fromBridge = window.PluginPageContext.getContext()
  if (fromBridge && typeof fromBridge.isDark === 'boolean') {
    return fromBridge.isDark
  }
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'dark') return true
  if (saved === 'light') return false
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function initTheme(toggleBtn) {
  apply(initialDark())

  window.PluginPageContext.onThemeChange((isDark) => {
    if (typeof isDark === 'boolean') apply(isDark)
  })

  toggleBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') !== 'dark'
    apply(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
    } catch (_) {
      // storage may be unavailable; theme still applies for this session
    }
  })
}
