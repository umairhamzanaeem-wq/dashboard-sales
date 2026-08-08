import { getConfig, json } from '../lib/http.js'

/** Simple health check so we can verify env + API routing */
export default function handler(req, res) {
  try {
    const config = getConfig()
    return json(res, 200, {
      ok: true,
      missingEnv: config.missing,
      redirectUri: config.redirectUri,
      appUrl: config.appUrl,
      hasClientId: Boolean(config.clientId),
    })
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message })
  }
}
