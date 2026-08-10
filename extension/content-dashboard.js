/**
 * Bridges BD Dashboard page localStorage ↔ chrome.storage.local
 */
;(() => {
  const STATE_PREFIX = 'bd-dashboard-v1'
  const AUTH_KEY = 'bd-auth-session'
  const META_KEY = 'bd-ext-meta'
  const USERS_KEY = 'bd-users-registry-v1'
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

  function readUsersRegistry() {
    try {
      const raw = localStorage.getItem(USERS_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  function readPageState(username) {
    const key = stateKey(username)
    let raw = localStorage.getItem(key)
    if (!raw && username) raw = localStorage.getItem(STATE_PREFIX)
    // Try both users if username missing
    if (!raw) {
      for (const u of ['umair', 'saad', 'admin']) {
        raw = localStorage.getItem(stateKey(u))
        if (raw) {
          try {
            return { key: stateKey(u), username: u, state: JSON.parse(raw) }
          } catch {
            /* continue */
          }
        }
      }
      return null
    }
    try {
      return { key, username: username ?? null, state: JSON.parse(raw) }
    } catch {
      return null
    }
  }

  function snapshot() {
    const auth = readAuth()
    const username = auth?.username ?? null
    const packed = readPageState(username)
    return {
      auth,
      username: packed?.username ?? username,
      state: packed?.state ?? null,
      registry: readUsersRegistry(),
    }
  }

  function pushPageToExtension() {
    if (applyingFromExt) return
    const snap = snapshot()
    if (snap.registry) {
      chrome.runtime.sendMessage({
        type: 'SET_USERS',
        registry: snap.registry,
      })
    }
    if (!snap.state) return
    chrome.runtime.sendMessage({
      type: 'SET_STATE',
      username: snap.username,
      state: snap.state,
      writer: 'dashboard',
    })
    if (snap.auth) {
      chrome.runtime.sendMessage({ type: 'SET_AUTH', session: snap.auth })
    }
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
      }, 400)
    }
  }

  // Respond to popup pull requests
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'PULL_STATE') {
      const snap = snapshot()
      sendResponse({ ok: true, ...snap })
      // Also push to storage
      if (snap.state) {
        pushPageToExtension()
      }
      return true
    }
    return false
  })

  // Push ASAP and again after app hydrates
  pushPageToExtension()
  setTimeout(pushPageToExtension, 500)
  setTimeout(pushPageToExtension, 1500)
  setTimeout(pushPageToExtension, 3000)

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
    if (data?.source === 'bd-dashboard' && data.type === 'BD_USERS_UPDATED' && data.registry) {
      chrome.runtime.sendMessage({
        type: 'SET_USERS',
        registry: data.registry,
      })
    }
  })

  window.addEventListener('bd-users-updated', (event) => {
    const registry = event.detail?.registry
    if (!registry) return
    chrome.runtime.sendMessage({
      type: 'SET_USERS',
      registry,
    })
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

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    const meta = changes[META_KEY]?.newValue
    if (meta?.lastWriter === 'dashboard') return

    const auth = readAuth()
    const username = auth?.username ?? changes[AUTH_KEY]?.newValue?.username ?? null
    const key = stateKey(username)
    if (!changes[key]?.newValue) return

    const incoming = changes[key].newValue
    const local = readPageState(username)?.state
    // Never let empty/not_started extension state wipe an active dashboard day
    if (
      local &&
      (local.dailyProgress?.dayStatus === 'in_progress' ||
        local.dailyProgress?.dayStatus === 'paused' ||
        (local.updatedAt ?? 0) > 0) &&
      (incoming.dailyProgress?.dayStatus === 'not_started' || (incoming.updatedAt ?? 0) < (local.updatedAt ?? 0))
    ) {
      pushPageToExtension()
      return
    }
    applyExtensionState(username, incoming)
  })

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
  }, 2000)
})()
