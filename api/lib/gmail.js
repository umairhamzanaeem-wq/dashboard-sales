import { getConfig } from './http.js'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function assetUrl(path) {
  const { appUrl } = getConfig()
  return `${appUrl}${path.startsWith('/') ? path : `/${path}`}`
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

export function sendDailyStartEmail(input) {
  const lines = [
    'Daily Work Started',
    '',
    `Date: ${input.date}`,
    `Start Time: ${input.startTime}`,
    `User: ${input.userName}`,
    '',
    "Today's planned activities:",
    ...(input.activities?.length
      ? input.activities.map((a, i) => `${i + 1}. ${a}`)
      : ['- No activities listed']),
    '',
    '— Sent automatically from CRM Dashboard',
  ]
  return {
    subject: `Daily Work Started - ${input.date}`,
    text: lines.join('\n'),
    body: lines.join('\n'),
  }
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

function buildPerformanceHtml(input) {
  const brand = '#E60000'
  const logos = {
    company: assetUrl('/logo.png'),
    facebook: assetUrl('/platforms/facebook.png'),
    linkedin: assetUrl('/platforms/linkedin.png'),
    threads: assetUrl('/platforms/threads.png'),
    instagram: assetUrl('/platforms/instagram.png'),
    upwork: assetUrl('/platforms/upwork.png'),
    fiverr: assetUrl('/platforms/fiverr.png'),
  }

  const revenue = `$${Number(input.revenueGenerated || 0).toFixed(2)}`
  const pct = Number(input.performancePercent ?? 0)
  const score = Number(input.productivityScore ?? 0)

  const notesBlock = input.notes?.trim()
    ? `
      <tr>
        <td style="padding:8px 0 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E5E5E5;border-radius:14px;">
            <tr>
              <td style="padding:18px 20px;">
                <div style="font-size:13px;font-weight:700;color:#111111;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em;">Notes</div>
                <div style="font-size:14px;color:#555555;line-height:1.6;white-space:pre-wrap;">${escapeHtml(input.notes.trim())}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : ''

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
          <!-- Header -->
          <tr>
            <td style="background:#000000;border-radius:18px 18px 0 0;padding:28px 28px 24px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${logos.company}" width="48" height="48" alt="CRM" style="display:block;border-radius:12px;border:1px solid #262626;" />
                  </td>
                  <td style="vertical-align:middle;padding-left:14px;">
                    <div style="font-size:12px;color:#A3A3A3;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">CRM Dashboard</div>
                    <div style="font-size:22px;color:#FFFFFF;font-weight:700;letter-spacing:-0.3px;margin-top:2px;">Daily Performance Report</div>
                  </td>
                </tr>
              </table>
              <div style="margin-top:18px;height:3px;background:linear-gradient(90deg,${brand},#FF1A1A,#990000);border-radius:999px;font-size:0;line-height:0;">&nbsp;</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                <tr>
                  <td style="font-size:13px;color:#A3A3A3;">
                    <strong style="color:#FFFFFF;">${escapeHtml(input.userName)}</strong>
                    &nbsp;·&nbsp; ${escapeHtml(input.date)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#F8F8F8;padding:24px 20px;border-left:1px solid #E5E5E5;border-right:1px solid #E5E5E5;">
              <!-- Session strip -->
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

              <!-- KPI cards -->
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

              <!-- Platforms -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${platformCard({
                  name: 'Instagram',
                  logo: logos.instagram,
                  color: '#E1306C',
                  rows:
                    metricRow('Businesses found', input.instagramBusinesses) +
                    metricRow('DMs sent', input.instagramDms) +
                    metricRow('Replies', input.instagramReplies) +
                    metricRow('Interested leads', input.instagramInterestedLeads),
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
                    metricRow('Proposals sent', input.upworkProposals),
                })}
                ${platformCard({
                  name: 'Fiverr & Sales',
                  logo: logos.fiverr,
                  color: '#1DBF73',
                  rows:
                    metricRow('Email outreach', input.emailOutreach) +
                    metricRow('Leads generated', input.leadsGenerated) +
                    metricRow('Meetings booked', input.meetingsBooked) +
                    metricRow('Deals won', input.dealsWon) +
                    metricRow('Revenue generated', revenue),
                })}
                ${notesBlock}
              </table>
            </td>
          </tr>

          <!-- Footer -->
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
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function sendDailyPerformanceEmail(input) {
  const lines = [
    'Daily Performance Report',
    '',
    `Date: ${input.date}`,
    `User: ${input.userName}`,
    `Start Time: ${input.startTime}`,
    `End Time: ${input.endTime}`,
    `Total Working Time: ${input.totalWorkingTime}`,
    `Overall Daily Performance: ${input.performancePercent}%`,
    `Productivity Score: ${input.productivityScore}`,
    '',
    '— Instagram —',
    `Businesses found: ${input.instagramBusinesses}`,
    `DMs sent: ${input.instagramDms}`,
    `Replies: ${input.instagramReplies}`,
    `Interested leads: ${input.instagramInterestedLeads}`,
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
    '— Upwork / Sales —',
    `Jobs reviewed: ${input.upworkJobsReviewed}`,
    `Proposals sent: ${input.upworkProposals}`,
    `Email outreach: ${input.emailOutreach}`,
    `Leads generated: ${input.leadsGenerated}`,
    `Meetings booked: ${input.meetingsBooked}`,
    `Deals won: ${input.dealsWon}`,
    `Revenue generated: $${Number(input.revenueGenerated || 0).toFixed(2)}`,
  ]

  if (input.notes?.trim()) {
    lines.push('', 'Notes:', input.notes.trim())
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
