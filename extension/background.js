const STATE_PREFIX = 'bd-dashboard-v1'
const AUTH_KEY = 'bd-auth-session'
const META_KEY = 'bd-ext-meta'

function stateKey(username) {
  return username ? `${STATE_PREFIX}:${username}` : STATE_PREFIX
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('BD Dashboard Tracker extension installed')
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_BUNDLE') {
    chrome.storage.local.get(null).then((all) => sendResponse({ ok: true, all })).catch((e) => sendResponse({ ok: false, error: String(e) }))
    return true
  }

  if (message?.type === 'SET_STATE') {
    const { username, state, writer } = message
    const key = stateKey(username)
    chrome.storage.local
      .set({
        [key]: state,
        [AUTH_KEY]: username ? { username, token: btoa(`${username}:${username}`) } : null,
        [META_KEY]: { lastWriter: writer || 'extension', updatedAt: Date.now() },
      })
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }))
    return true
  }

  if (message?.type === 'SET_AUTH') {
    chrome.storage.local
      .set({ [AUTH_KEY]: message.session })
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }))
    return true
  }

  return false
})
