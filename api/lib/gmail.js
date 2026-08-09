import { getConfig } from './http.js'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function assetUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const { appUrl } = getConfig()
  return `${appUrl}${path.startsWith('/') ? path : `/${path}`}`
}

/** Known dashboard avatars under /public/avatars */
function resolveAvatarUrl(username, avatarUrl) {
  if (avatarUrl) return assetUrl(avatarUrl)
  const key = String(username || '').trim().toLowerCase()
  const defaults = {
    umair: '/avatars/umair.png',
  }
  if (defaults[key]) return assetUrl(defaults[key])
  return ''
}

function encodeSubject(subject) {
  // RFC 2047 for non-ASCII safety
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`
}

/**
 * Send email via Gmail API.
 * @param {string} accessToken
 * @param {string} to
 * @param {string} subject
 * @param {string | { text: string, html?: string }} body
 */
export async function sendGmailMessage(accessToken, to, subject, body) {
  const text = typeof body === 'string' ? body : body.text || ''
  const html = typeof body === 'string' ? null : body.html || null

  let mime
  if (html) {
    const boundary = `bd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    mime = [
      `To: ${to}`,
      `Subject: ${encodeSubject(subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      text,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      html,
      '',
      `--${boundary}--`,
    ].join('\r\n')
  } else {
    mime = [
      `To: ${to}`,
      `Subject: ${encodeSubject(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      text,
    ].join('\r\n')
  }

  const encoded = Buffer.from(mime)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to send Gmail message')
  }
  return data
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function brandLogos() {
  return {
    company: assetUrl('/logo.png'),
    facebook: assetUrl('/platforms/facebook.png'),
    linkedin: assetUrl('/platforms/linkedin.png'),
    threads: assetUrl('/platforms/threads.png'),
    instagram: assetUrl('/platforms/instagram.png'),
    upwork: assetUrl('/platforms/upwork.png'),
    fiverr: assetUrl('/platforms/fiverr.png'),
  }
}

function platformLogoFor(id, logos) {
  const map = {
    fiverr: logos.fiverr,
    linkedin_saad: logos.linkedin,
    linkedin_umair: logos.linkedin,
    linkedin: logos.linkedin,
    facebook: logos.facebook,
    threads: logos.threads,
    instagram: logos.instagram,
    upwork: logos.upwork,
  }
  return map[id] || logos.company
}

function platformAccent(id) {
  const map = {
    fiverr: '#1DBF73',
    linkedin_saad: '#0A66C2',
    linkedin_umair: '#0A66C2',
    linkedin: '#0A66C2',
    facebook: '#1877F2',
    threads: '#111111',
    instagram: '#E1306C',
    upwork: '#14A800',
    review: '#E60000',
  }
  return map[id] || '#E60000'
}

function userProfileBlock(input, logos) {
  const brand = '#E60000'
  const name = escapeHtml(input.userName || 'User')
  const email = escapeHtml(input.userEmail || '')
  const avatar = resolveAvatarUrl(input.username, input.avatarUrl)
  const initial = escapeHtml((input.userName || 'U').charAt(0).toUpperCase())

  const avatarCell = avatar
    ? `<img src="${avatar}" width="52" height="52" alt="${name}" style="display:block;border-radius:50%;border:2px solid #333333;object-fit:cover;" />`
    : `<div style="width:52px;height:52px;border-radius:50%;background:${brand};color:#FFFFFF;font-size:20px;font-weight:700;line-height:52px;text-align:center;">${initial}</div>`

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
      <tr>
        <td style="vertical-align:middle;width:52px;">${avatarCell}</td>
        <td style="vertical-align:middle;padding-left:14px;">
          <div style="font-size:16px;color:#FFFFFF;font-weight:700;">${name}</div>
          ${
            email
              ? `<div style="font-size:13px;color:#A3A3A3;margin-top:2px;">${email}</div>`
              : ''
          }
          <div style="font-size:12px;color:#737373;margin-top:4px;">${escapeHtml(input.date || '')}</div>
        </td>
        <td style="vertical-align:middle;text-align:right;">
          <img src="${logos.company}" width="40" height="40" alt="CRM" style="display:inline-block;border-radius:10px;border:1px solid #262626;" />
        </td>
      </tr>
    </table>`
}

function emailFooter(logos) {
  return `
    <tr>
      <td style="background:#000000;border-radius:0 0 18px 18px;padding:20px 28px;text-align:center;">
        <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 12px auto;">
          <tr>
            <td style="padding:0 4px;"><img src="${logos.fiverr}" width="22" height="22" alt="Fiverr" style="border-radius:6px;display:block;" /></td>
            <td style="padding:0 4px;"><img src="${logos.linkedin}" width="22" height="22" alt="LinkedIn" style="border-radius:6px;display:block;" /></td>
            <td style="padding:0 4px;"><img src="${logos.facebook}" width="22" height="22" alt="Facebook" style="border-radius:6px;display:block;" /></td>
            <td style="padding:0 4px;"><img src="${logos.threads}" width="22" height="22" alt="Threads" style="border-radius:6px;display:block;" /></td>
            <td style="padding:0 4px;"><img src="${logos.instagram}" width="22" height="22" alt="Instagram" style="border-radius:6px;display:block;" /></td>
            <td style="padding:0 4px;"><img src="${logos.upwork}" width="22" height="22" alt="Upwork" style="border-radius:6px;display:block;" /></td>
          </tr>
        </table>
        <div style="font-size:12px;color:#A3A3A3;line-height:1.5;">
          Sent automatically from your CRM Dashboard<br />
          <span style="color:#666666;">Ignite · Business Development</span>
        </div>
      </td>
    </tr>`
}

function metricRow(label, value) {
  return `
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#555555;border-bottom:1px solid #F1F1F1;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;font-size:14px;color:#111111;font-weight:600;text-align:right;border-bottom:1px solid #F1F1F1;">${escapeHtml(value)}</td>
    </tr>`
}

function platformCard({ name, logo, color, rows }) {
  return `
    <tr>
      <td style="padding:0 0 16px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E5E5;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="height:4px;background:${color};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:18px 20px 8px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <img src="${logo}" width="36" height="36" alt="${escapeHtml(name)}" style="display:block;border-radius:10px;border:1px solid #E5E5E5;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-size:16px;font-weight:700;color:#111111;letter-spacing:-0.2px;">${escapeHtml(name)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 20px 16px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${rows}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
}

function activityListRows(items) {
  if (!items?.length) {
    return `<tr><td style="padding:6px 0;font-size:14px;color:#888888;">No targets listed</td></tr>`
  }
  return items
    .map(
      (item, i) => `
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#555555;border-bottom:1px solid #F1F1F1;vertical-align:top;width:22px;">
          <span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:#F5F5F5;color:#111111;font-size:11px;font-weight:700;line-height:18px;text-align:center;">${i + 1}</span>
        </td>
        <td style="padding:6px 0 6px 8px;font-size:14px;color:#111111;border-bottom:1px solid #F1F1F1;">${escapeHtml(item)}</td>
      </tr>`
    )
    .join('')
}

function buildStartHtml(input) {
  const brand = '#E60000'
  const logos = brandLogos()
  const platforms = Array.isArray(input.platforms) ? input.platforms : []

  const platformCards = platforms.length
    ? platforms
        .map((p) =>
          platformCard({
            name: p.name || p.id || 'Platform',
            logo: platformLogoFor(p.id, logos),
            color: platformAccent(p.id),
            rows: activityListRows(
              Array.isArray(p.items) && p.items.length
                ? p.items
                : Array.isArray(p.targets)
                  ? p.targets
                  : []
            ),
          })
        )
        .join('')
    : platformCard({
        name: "Today's plan",
        logo: logos.company,
        color: brand,
        rows: activityListRows(input.activities || []),
      })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Daily Work Started</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background:#000000;border-radius:18px 18px 0 0;padding:28px 28px 24px 28px;">
              <div style="font-size:12px;color:#A3A3A3;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">CRM Dashboard</div>
              <div style="font-size:22px;color:#FFFFFF;font-weight:700;letter-spacing:-0.3px;margin-top:4px;">Daily Work Started</div>
              <div style="margin-top:18px;height:3px;background:linear-gradient(90deg,${brand},#FF1A1A,#990000);border-radius:999px;font-size:0;line-height:0;">&nbsp;</div>
              ${userProfileBlock(input, logos)}
            </td>
          </tr>
          <tr>
            <td style="background:#F8F8F8;padding:24px 20px;border-left:1px solid #E5E5E5;border-right:1px solid #E5E5E5;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E5E5;border-radius:14px;margin-bottom:16px;">
                <tr>
                  <td style="padding:16px 18px;width:50%;border-right:1px solid #F1F1F1;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#888888;margin-bottom:4px;">Start time</div>
                    <div style="font-size:18px;font-weight:700;color:#111111;">${escapeHtml(input.startTime || '—')}</div>
                  </td>
                  <td style="padding:16px 18px;width:50%;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#888888;margin-bottom:4px;">Status</div>
                    <div style="font-size:18px;font-weight:700;color:${brand};">In progress</div>
                  </td>
                </tr>
              </table>
              <div style="font-size:13px;font-weight:700;color:#111111;margin:0 0 12px 4px;text-transform:uppercase;letter-spacing:0.04em;">Today's planned activities</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${platformCards}
              </table>
            </td>
          </tr>
          ${emailFooter(logos)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildPerformanceHtml(input) {
  const brand = '#E60000'
  const logos = brandLogos()

  const revenue = `$${Number(input.revenueGenerated || 0).toFixed(2)}`
  const pct = Number(input.performancePercent ?? 0)
  const score = Number(input.productivityScore ?? 0)

  const notesBlock = (() => {
    const daily = input.notes?.trim() || ''
    const platformNotes = Array.isArray(input.platformNotes)
      ? input.platformNotes.filter((n) => n?.name && n?.notes?.trim())
      : []
    if (!daily && platformNotes.length === 0) return ''

    const platformHtml = platformNotes
      .map(
        (n) => `
          <div style="margin-top:10px;">
            <div style="font-size:12px;font-weight:700;color:#111111;">${escapeHtml(n.name)}</div>
            <div style="font-size:14px;color:#555555;line-height:1.6;white-space:pre-wrap;margin-top:2px;">${escapeHtml(n.notes.trim())}</div>
          </div>`
      )
      .join('')

    return `
      <tr>
        <td style="padding:8px 0 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E5E5;border-radius:14px;">
            <tr>
              <td style="padding:18px 20px;">
                <div style="font-size:13px;font-weight:700;color:#111111;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em;">Notes</div>
                ${
                  daily
                    ? `<div style="font-size:14px;color:#555555;line-height:1.6;white-space:pre-wrap;">${escapeHtml(daily)}</div>`
                    : ''
                }
                ${platformHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>`
  })()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Daily Performance Report</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background:#000000;border-radius:18px 18px 0 0;padding:28px 28px 24px 28px;">
              <div style="font-size:12px;color:#A3A3A3;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">CRM Dashboard</div>
              <div style="font-size:22px;color:#FFFFFF;font-weight:700;letter-spacing:-0.3px;margin-top:4px;">Daily Performance Report</div>
              <div style="margin-top:18px;height:3px;background:linear-gradient(90deg,${brand},#FF1A1A,#990000);border-radius:999px;font-size:0;line-height:0;">&nbsp;</div>
              ${userProfileBlock(input, logos)}
            </td>
          </tr>

          <tr>
            <td style="background:#F8F8F8;padding:24px 20px;border-left:1px solid #E5E5E5;border-right:1px solid #E5E5E5;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E5E5;border-radius:14px;margin-bottom:16px;">
                <tr>
                  <td style="padding:16px 18px;font-size:13px;color:#555555;width:33%;border-right:1px solid #F1F1F1;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#888888;margin-bottom:4px;">Start</div>
                    <div style="font-size:15px;font-weight:700;color:#111111;">${escapeHtml(input.startTime)}</div>
                  </td>
                  <td style="padding:16px 18px;font-size:13px;color:#555555;width:33%;border-right:1px solid #F1F1F1;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#888888;margin-bottom:4px;">End</div>
                    <div style="font-size:15px;font-weight:700;color:#111111;">${escapeHtml(input.endTime)}</div>
                  </td>
                  <td style="padding:16px 18px;font-size:13px;color:#555555;width:34%;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#888888;margin-bottom:4px;">Worked</div>
                    <div style="font-size:15px;font-weight:700;color:#111111;">${escapeHtml(input.totalWorkingTime)}</div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
                <tr>
                  <td width="32%" style="padding:0 6px 12px 0;vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E5E5;border-radius:14px;">
                      <tr><td style="padding:16px;">
                        <div style="font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.06em;">Performance</div>
                        <div style="font-size:28px;font-weight:800;color:${brand};margin-top:6px;">${escapeHtml(pct)}%</div>
                      </td></tr>
                    </table>
                  </td>
                  <td width="32%" style="padding:0 6px 12px 6px;vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E5E5;border-radius:14px;">
                      <tr><td style="padding:16px;">
                        <div style="font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.06em;">Score</div>
                        <div style="font-size:28px;font-weight:800;color:#111111;margin-top:6px;">${escapeHtml(score)}</div>
                      </td></tr>
                    </table>
                  </td>
                  <td width="36%" style="padding:0 0 12px 6px;vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E5E5;border-radius:14px;">
                      <tr><td style="padding:16px;">
                        <div style="font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.06em;">Revenue</div>
                        <div style="font-size:28px;font-weight:800;color:#16A34A;margin-top:6px;">${escapeHtml(revenue)}</div>
                      </td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${platformCard({
                  name: 'Instagram',
                  logo: logos.instagram,
                  color: '#E1306C',
                  rows:
                    metricRow('Businesses found', input.instagramBusinesses) +
                    metricRow('DMs sent', input.instagramDms),
                })}
                ${platformCard({
                  name: 'Threads',
                  logo: logos.threads,
                  color: '#111111',
                  rows:
                    metricRow('Posts', input.threadsPosts) +
                    metricRow('DMs', input.threadsDms),
                })}
                ${platformCard({
                  name: 'LinkedIn',
                  logo: logos.linkedin,
                  color: '#0A66C2',
                  rows:
                    metricRow('Connection requests', input.linkedinConnections) +
                    metricRow('Follow-ups', input.linkedinFollowUps) +
                    metricRow('Comments', input.linkedinComments),
                })}
                ${platformCard({
                  name: 'Facebook',
                  logo: logos.facebook,
                  color: '#1877F2',
                  rows:
                    metricRow('Comments', input.facebookComments) +
                    metricRow('DMs', input.facebookDms) +
                    metricRow('Posts', input.facebookPosts),
                })}
                ${platformCard({
                  name: 'Upwork',
                  logo: logos.upwork,
                  color: '#14A800',
                  rows:
                    metricRow('Jobs reviewed', input.upworkJobsReviewed) +
                    metricRow('Proposals sent', input.upworkProposals) +
                    metricRow('Leads generated (total)', input.leadsGenerated ?? 0),
                })}
                ${notesBlock}
              </table>
            </td>
          </tr>
          ${emailFooter(logos)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function sendDailyStartEmail(input) {
  const lines = [
    'Daily Work Started',
    '',
    `Date: ${input.date}`,
    `Start Time: ${input.startTime}`,
    `User: ${input.userName}`,
    input.userEmail ? `Email: ${input.userEmail}` : null,
    '',
    "Today's planned activities:",
  ].filter((line) => line !== null)

  if (Array.isArray(input.platforms) && input.platforms.length) {
    for (const p of input.platforms) {
      lines.push('', `— ${p.name || p.id} —`)
      const items = Array.isArray(p.items) ? p.items : Array.isArray(p.targets) ? p.targets : []
      if (items.length) items.forEach((a, i) => lines.push(`${i + 1}. ${a}`))
      else lines.push('- No targets listed')
    }
  } else if (input.activities?.length) {
    input.activities.forEach((a, i) => lines.push(`${i + 1}. ${a}`))
  } else {
    lines.push('- No activities listed')
  }

  lines.push('', '— Sent automatically from CRM Dashboard')

  const text = lines.join('\n')
  return {
    subject: `Daily Work Started - ${input.date}`,
    text,
    html: buildStartHtml(input),
    body: text,
  }
}

export function sendDailyPerformanceEmail(input) {
  const lines = [
    'Daily Performance Report',
    '',
    `Date: ${input.date}`,
    `User: ${input.userName}`,
    input.userEmail ? `Email: ${input.userEmail}` : null,
    `Start Time: ${input.startTime}`,
    `End Time: ${input.endTime}`,
    `Total Working Time: ${input.totalWorkingTime}`,
    `Overall Daily Performance: ${input.performancePercent}%`,
    `Productivity Score: ${input.productivityScore}`,
    `Revenue: $${Number(input.revenueGenerated || 0).toFixed(2)}`,
    '',
    '— Instagram —',
    `Businesses found: ${input.instagramBusinesses}`,
    `DMs sent: ${input.instagramDms}`,
    '',
    '— Threads —',
    `Posts: ${input.threadsPosts}`,
    `DMs: ${input.threadsDms}`,
    '',
    '— LinkedIn —',
    `Connection requests: ${input.linkedinConnections}`,
    `Follow-ups: ${input.linkedinFollowUps}`,
    `Comments: ${input.linkedinComments}`,
    '',
    '— Facebook —',
    `Comments: ${input.facebookComments}`,
    `DMs: ${input.facebookDms}`,
    `Posts: ${input.facebookPosts}`,
    '',
    '— Upwork —',
    `Jobs reviewed: ${input.upworkJobsReviewed}`,
    `Proposals sent: ${input.upworkProposals}`,
    '',
    '— Summary —',
    `Leads generated: ${input.leadsGenerated ?? 0}`,
  ].filter((line) => line !== null)

  if (input.notes?.trim()) {
    lines.push('', 'Notes:', input.notes.trim())
  }

  if (Array.isArray(input.platformNotes) && input.platformNotes.length) {
    lines.push('', 'Platform notes:')
    for (const item of input.platformNotes) {
      if (item?.name && item?.notes?.trim()) {
        lines.push(`- ${item.name}: ${item.notes.trim()}`)
      }
    }
  }

  lines.push('', '— Sent automatically from CRM Dashboard')

  const text = lines.join('\n')
  return {
    subject: `Daily Performance Report - ${input.date}`,
    text,
    html: buildPerformanceHtml(input),
    body: text,
  }
}
