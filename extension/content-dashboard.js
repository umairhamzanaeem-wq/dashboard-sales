/**
 * Bridges BD Dashboard page localStorage ↔ chrome.storage.local
 * so the extension popup and open dashboard stay in sync.
 */
;(() => {
  const STATE_PREFIX = 'bd-dashboard-v1'
  const AUTH_KEY = 'bd-auth-session'
  const META_KEY = 'bd-ext-meta'
  let applyingFromExt = false

  function stateKey(username) {
    return username ? `${STATE_PREFIX}:${username}` : STATE_PREFIX
  }

  function readAuth() {
    try {
      const raw = localStorage.getItem(AUTH_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  function readPageState(username) {
    const key = stateKey(username)
    let raw = localStorage.getItem(key)
    if (!raw && username) raw = localStorage.getItem(STATE_PREFIX)
    if (!raw) return null
    try {
      return { key, state: JSON.parse(raw) }
    } catch {
      return null
    }
  }

  function pushPageToExtension() {
    if (applyingFromExt) return
    const auth = readAuth()
    const username = auth?.username ?? null
    const packed = readPageState(username)
    if (!packed?.state) return
    chrome.runtime.sendMessage({
      type: 'SET_STATE',
      username,
      state: packed.state,
      writer: 'dashboard',
    })
  }

  function applyExtensionState(username, state) {
    if (!state) return
    applyingFromExt = true
    try {
      const key = stateKey(username)
      localStorage.setItem(key, JSON.stringify(state))
      window.postMessage(
        { source: 'bd-extension', type: 'BD_STATE_PUSH', username, state },
        '*'
      )
    } finally {
      setTimeout(() => {
        applyingFromExt = false
      }, 300)
    }
  }

  // Initial: page → extension
  setTimeout(pushPageToExtension, 800)

  // Dashboard saved
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    const data = event.data
    if (data?.source === 'bd-dashboard' && data.type === 'BD_STATE_SAVED') {
      if (applyingFromExt) return
      chrome.runtime.sendMessage({
        type: 'SET_STATE',
        username: data.username,
        state: data.state,
        writer: 'dashboard',
      })
    }
  })

  window.addEventListener('bd-dashboard-save', (event) => {
    if (applyingFromExt) return
    const detail = event.detail
    if (!detail?.state) return
    chrome.runtime.sendMessage({
      type: 'SET_STATE',
      username: detail.username,
      state: detail.state,
      writer: 'dashboard',
    })
  })

  // Extension popup changed chrome.storage → push into open dashboard
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    const meta = changes[META_KEY]?.newValue
    if (meta?.lastWriter === 'dashboard') return

    const auth = readAuth()
    const username = auth?.username ?? changes[AUTH_KEY]?.newValue?.username ?? null
    const key = stateKey(username)
    if (!changes[key]?.newValue) return
    applyExtensionState(username, changes[key].newValue)
  })

  // Also poll occasionally in case storage events were missed
  setInterval(() => {
    chrome.storage.local.get([META_KEY, AUTH_KEY, stateKey(readAuth()?.username)].filter(Boolean), (result) => {
      if (result[META_KEY]?.lastWriter !== 'extension') return
      const username = readAuth()?.username ?? result[AUTH_KEY]?.username ?? null
      const key = stateKey(username)
      const remote = result[key]
      if (!remote) return
      const local = readPageState(username)?.state
      if ((remote.updatedAt ?? 0) > (local?.updatedAt ?? 0)) {
        applyExtensionState(username, remote)
      }
    })
  }, 2500)
})()
