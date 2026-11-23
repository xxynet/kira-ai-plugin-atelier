/**
 * Per-capability model selection.
 *
 * Loads the catalog exposed by the backend, fills the selectors embedded in
 * each view, and persists a change server-side so the choice survives page
 * reloads and KiraAI restarts. An empty value means "use the framework
 * default configured in KiraAI".
 */

import { status as fetchStatus, saveSelection } from './api.js'

const CAPABILITIES = ['llm', 'image', 'tts', 'stt']
const selects = {}
let state = null

function capabilityName(capability) {
  return capability === 'llm' ? 'chat' : capability
}

function defaultLabel(capability) {
  const fallback = state.catalog[capability] || {}
  const def = fallback.default || {}
  if (!def.configured) return 'Default (not configured)'
  const parts = [def.provider, def.model].filter(Boolean)
  return parts.length ? `Default · ${parts.join(' / ')}` : 'Default · KiraAI'
}

function optionLabel(item) {
  const head = item.provider || item.reference
  return item.model ? `${head} · ${item.model}` : head
}

function notify(message) {
  const el = document.createElement('div')
  el.className = 'model-toast'
  el.textContent = message
  document.body.appendChild(el)
  window.setTimeout(() => el.remove(), 4200)
}

function fill() {
  if (!state) return

  CAPABILITIES.forEach((capability) => {
    const select = selects[capability]
    if (!select) return

    const catalog = state.catalog[capability] || { models: [], default: {} }
    const saved = state.selection[capability] || ''
    select.innerHTML = ''

    const defOption = document.createElement('option')
    defOption.value = ''
    defOption.textContent = defaultLabel(capability)
    select.appendChild(defOption)

    catalog.models.forEach((item) => {
      const option = document.createElement('option')
      option.value = item.reference
      option.textContent = optionLabel(item)
      select.appendChild(option)
    })

    const known = catalog.models.some((item) => item.reference === saved)
    select.value = known ? saved : ''
    select.disabled = catalog.models.length === 0 && !catalog.default.configured
    const selected = catalog.models.find((item) => item.reference === select.value)
    select.title = selected ? optionLabel(selected) : defaultLabel(capability)
  })
}

async function handleChange(capability, select) {
  if (!state) return

  const previous = state.selection[capability] || ''
  const next = select.value
  select.disabled = true

  try {
    const res = await saveSelection({ [capability]: next })
    state = {
      ...state,
      selection: res.selection || state.selection,
      catalog: res.catalog || state.catalog,
      available: res.available || state.available,
    }
    fill()
  } catch (error) {
    select.value = previous
    select.disabled = false
    notify(`${capabilityName(capability)} model: ${error.message}`)
  }
}

export async function initModels() {
  CAPABILITIES.forEach((capability) => {
    const select = document.querySelector(`select[data-model-for="${capability}"]`)
    if (!select) return
    selects[capability] = select
    select.addEventListener('change', () => handleChange(capability, select))
  })

  try {
    state = await fetchStatus()
  } catch (error) {
    notify(`Could not load models: ${error.message}`)
    return
  }

  fill()
}

/** Current model reference for a capability; '' means the KiraAI default. */
export function getModel(capability) {
  const select = selects[capability]
  if (select) return select.value || ''
  return state ? (state.selection[capability] || '') : ''
}
