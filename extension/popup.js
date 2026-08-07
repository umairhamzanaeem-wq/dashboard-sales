const USERS = { saad: 'saad', umair: 'umair' }
const AUTH_KEY = 'bd-auth-session'
const STATE_PREFIX = 'bd-dashboard-v1'
const META_KEY = 'bd-ext-meta'
const DASH_URL = 'https://dashboard-sales-sand.vercel.app/'

const STEPS = [
  { id: 'fiverr', name: 'Fiverr', short: 'Fiverr', url: 'https://www.fiverr.com/' },
  { id: 'linkedin_saad', name: 'LinkedIn (Saad)', short: 'LI Saad', url: 'https://www.linkedin.com/' },
  { id: 'linkedin_umair', name: 'LinkedIn (Umair)', short: 'LI Umair', url: 'https://www.linkedin.com/' },
  { id: 'facebook', name: 'Facebook', short: 'Facebook', url: 'https://www.facebook.com/' },
  { id: 'upwork', name: 'Upwork', short: 'Upwork', url: 'https://www.upwork.com/' },
  { id: 'review', name: 'Daily Review', short: 'Review', url: DASH_URL },
]

const DEFAULT_TARGETS = {
  linkedin_saad: { connections: 30, followUps: 10, comments: 5 },
  linkedin_umair: { connections: 30, followUps: 10, comments: 5 },
  facebook: { comments: 20, dms: 10, posts: 1 },
  upwork: { jobsReviewed: 30, proposals: 5 },
}

let username = null
let state = null
let stepIndex = 0

const $ = (id) => document.getElementById(id)

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function stateKey(user) {
  return user ? `${STATE_PREFIX}:${user}` : STATE_PREFIX
}

function makeChecklist(items) {
  return items.map((label, i) => ({ id: `c-${i}`, label, completed: false }))
}

function createDefaultState() {
  const targets = DEFAULT_TARGETS
  return {
    version: 1,
    updatedAt: Date.now(),
    settings: {
      theme: 'dark',
      notificationsEnabled: true,
      streak: 0,
      lastCompletedDate: null,
      longestStreak: 0,
      dailyTargets: targets,
      timeline: { blocks: [] },
      reminderTimes: {},
      revenueCategories: ['Fiverr', 'Upwork', 'Direct Clients', 'Agency', 'Referral'],
    },
    dailyProgress: {
      date: todayKey(),
      dayStatus: 'not_started',
      dayStartedAt: null,
      dayFinishedAt: null,
      dailyNotes: '',
      confettiShown: false,
      totalTimeWorkedSeconds: 0,
      timeline: [],
      platforms: {
        fiverr: {
          id: 'fiverr',
          name: 'Fiverr',
          estimatedMinutes: 20,
          checklist: makeChecklist([
            'Check Analytics',
            'Review Impressions',
            'Review Clicks',
            'Reply to Buyer Messages',
            'Review Gig Performance',
            'Optimize Gig if Required',
          ]),
          counters: [],
          notes: '',
          completed: false,
        },
        linkedin_saad: {
          id: 'linkedin_saad',
          name: 'LinkedIn (Saad)',
          estimatedMinutes: 80,
          checklist: makeChecklist(['Reply to every unread message']),
          counters: [
            { id: 'connections', label: 'Connection Requests', target: targets.linkedin_saad.connections, completed: 0 },
            { id: 'followups', label: 'Follow-up Messages', target: targets.linkedin_saad.followUps, completed: 0 },
            { id: 'comments', label: 'Meaningful Comments', target: targets.linkedin_saad.comments, completed: 0 },
          ],
          notes: '',
          completed: false,
        },
        linkedin_umair: {
          id: 'linkedin_umair',
          name: 'LinkedIn (Umair)',
          estimatedMinutes: 80,
          checklist: makeChecklist(['Reply to every unread message']),
          counters: [
            { id: 'connections', label: 'Connection Requests', target: targets.linkedin_umair.connections, completed: 0 },
            { id: 'followups', label: 'Follow-up Messages', target: targets.linkedin_umair.followUps, completed: 0 },
            { id: 'comments', label: 'Meaningful Comments', target: targets.linkedin_umair.comments, completed: 0 },
          ],
          notes: '',
          completed: false,
        },
        facebook: {
          id: 'facebook',
          name: 'Facebook',
          estimatedMinutes: 60,
          checklist: makeChecklist([
            'Search Groups',
            'Comment on Posts',
            'Send Personalized DMs',
            "Publish Today's Post",
            'Find & friend request leads (med spa, dental, etc.)',
          ]),
          counters: [
            { id: 'comments', label: 'Meaningful Comments', target: targets.facebook.comments, completed: 0 },
            { id: 'dms', label: 'Personalized DMs', target: targets.facebook.dms, completed: 0 },
            { id: 'posts', label: 'Valuable Posts', target: targets.facebook.posts, completed: 0 },
          ],
          notes: '',
          completed: false,
        },
        upwork: {
          id: 'upwork',
          name: 'Upwork',
          estimatedMinutes: 75,
          checklist: makeChecklist([
            'Search New Jobs',
            'Review Job Details',
            'Shortlist Jobs',
            'Submit Personalized Proposal',
            'Reply to Invitations',
          ]),
          counters: [
            { id: 'jobs_reviewed', label: 'Jobs Reviewed', target: targets.upwork.jobsReviewed, completed: 0 },
            { id: 'jobs_shortlisted', label: 'Jobs Shortlisted', target: 6, completed: 0 },
            { id: 'proposals', label: 'Personalized Proposals', target: targets.upwork.proposals, completed: 0 },
            { id: 'invitations', label: 'Invitations Replied', target: 3, completed: 0 },
          ],
          notes: '',
          completed: false,
        },
        review: {
          id: 'review',
          name: 'Daily Review & Planning',
          estimatedMinutes: 45,
          checklist: makeChecklist([
            "Review today's KPIs",
            'Log revenue if any',
            "Plan tomorrow's priorities",
            'Update notes',
          ]),
          counters: [],
          notes: '',
          completed: false,
        },
      },
    },
    history: [],
    revenue: [],
    notifications: [],
  }
}

function ensureToday(s) {
  if (s.dailyProgress?.date === todayKey()) return s
  const fresh = createDefaultState()
  fresh.settings = s.settings || fresh.settings
  fresh.history = s.history || []
  fresh.revenue = s.revenue || []
  return fresh
}

function platformProgress(section) {
  const checklistDone = section.checklist.filter((c) => c.completed).length
  const checklistTotal = section.checklist.length
  const counterDone = section.counters.reduce((sum, c) => sum + Math.min(c.completed, c.target), 0)
  const counterTotal = section.counters.reduce((sum, c) => sum + c.target, 0)
  const total = checklistTotal + counterTotal
  const completed = checklistDone + counterDone
  const pct = total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100))
  return { pct, completed, total }
}

function overallPct(s) {
  let completed = 0
  let total = 0
  Object.values(s.dailyProgress.platforms).forEach((p) => {
    const r = platformProgress(p)
    completed += r.completed
    total += r.total
  })
  return total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100))
}

async function loadBundle() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (all) => resolve(all || {}))
  })
}

async function persist(writer = 'extension') {
  if (!state) return
  state = { ...state, updatedAt: Date.now() }
  await chrome.storage.local.set({
    [stateKey(username)]: state,
    [AUTH_KEY]: { username, token: btoa(`${username}:${username}`) },
    [META_KEY]: { lastWriter: writer, updatedAt: Date.now() },
  })
}

function showLogin() {
  $('view-login').classList.remove('hidden')
  $('view-main').classList.add('hidden')
}

function showMain() {
  $('view-login').classList.add('hidden')
  $('view-main').classList.remove('hidden')
  $('user-label').textContent = username.charAt(0).toUpperCase() + username.slice(1)
  renderAll()
}

function renderSteps() {
  const nav = $('step-tabs')
  nav.innerHTML = ''
  STEPS.forEach((step, i) => {
    const section = state.dailyProgress.platforms[step.id]
    const { pct } = platformProgress(section)
    const btn = document.createElement('button')
    btn.textContent = step.short
    if (i === stepIndex) btn.classList.add('on')
    if (pct >= 100) btn.classList.add('complete')
    btn.addEventListener('click', () => {
      stepIndex = i
      renderAll()
    })
    nav.appendChild(btn)
  })
}

function renderSession() {
  const status = state.dailyProgress.dayStatus || 'not_started'
  const pill = $('day-status')
  pill.textContent = status.replace('_', ' ')
  pill.className = 'pill' + (status === 'in_progress' ? ' active' : status === 'finished' ? ' done' : '')
  $('btn-start-day').classList.toggle('hidden', status === 'in_progress')
  $('btn-finish-day').classList.toggle('hidden', status !== 'in_progress')
}

function renderStepBody() {
  const step = STEPS[stepIndex]
  const section = state.dailyProgress.platforms[step.id]
  const { pct } = platformProgress(section)

  $('step-title').textContent = step.name
  $('step-meta').textContent = `${pct}% · Step ${stepIndex + 1} of ${STEPS.length}`
  $('btn-prev').disabled = stepIndex === 0
  $('btn-next').textContent = stepIndex === STEPS.length - 1 ? 'Done' : 'Next →'

  const countersEl = $('counters')
  countersEl.innerHTML = ''
  if (section.counters.length === 0) {
    countersEl.innerHTML = '<p class="muted">No counters — complete the checklist below.</p>'
  } else {
    section.counters.forEach((c) => {
      const row = document.createElement('div')
      row.className = 'counter'
      row.innerHTML = `
        <div>
          <div class="label">${c.label}</div>
          <div class="sub">${c.completed} / ${c.target} · ${Math.max(0, c.target - c.completed)} left</div>
        </div>
        <div class="ops">
          <button type="button" data-op="-">−</button>
          <span>${c.completed}</span>
          <button type="button" data-op="+">+</button>
        </div>`
      row.querySelector('[data-op="-"]').addEventListener('click', async () => {
        c.completed = Math.max(0, c.completed - 1)
        await persist()
        renderAll()
      })
      row.querySelector('[data-op="+"]').addEventListener('click', async () => {
        c.completed += 1
        await persist()
        renderAll()
      })
      countersEl.appendChild(row)
    })
  }

  const listEl = $('checklist')
  listEl.innerHTML = ''
  section.checklist.forEach((item) => {
    const row = document.createElement('label')
    row.className = 'check-row' + (item.completed ? ' done' : '')
    row.innerHTML = `<input type="checkbox" ${item.completed ? 'checked' : ''} /><span>${item.label}</span>`
    row.querySelector('input').addEventListener('change', async (e) => {
      item.completed = e.target.checked
      const { pct: p } = platformProgress(section)
      section.completed = p >= 100
      await persist()
      renderAll()
    })
    listEl.appendChild(row)
  })

  $('notes').value = section.notes || ''

  const overall = overallPct(state)
  $('progress-label').textContent = `${overall}% today`
  $('progress-bar').style.width = `${overall}%`
}

function renderAll() {
  if (!state) return
  renderSession()
  renderSteps()
  renderStepBody()
}

async function init() {
  const all = await loadBundle()
  const auth = all[AUTH_KEY]
  if (auth?.username && USERS[auth.username]) {
    username = auth.username
    state = ensureToday(all[stateKey(username)] || createDefaultState())
    const fb = state.dailyProgress.platforms.facebook
    if (fb && !fb.checklist.some((i) => i.id === 'c-friend-requests' || i.label.includes('friend request'))) {
      fb.checklist.push({
        id: 'c-friend-requests',
        label: 'Find & friend request leads (med spa, dental, etc.)',
        completed: false,
      })
    }
    await persist('extension')
    showMain()
  } else {
    showLogin()
  }
}

$('btn-login').addEventListener('click', async () => {
  const u = $('login-user').value.trim().toLowerCase()
  const p = $('login-pass').value
  const err = $('login-error')
  if (USERS[u] !== p) {
    err.textContent = 'Invalid username or password'
    err.classList.remove('hidden')
    return
  }
  err.classList.add('hidden')
  username = u
  const all = await loadBundle()
  state = ensureToday(all[stateKey(username)] || createDefaultState())
  await persist('extension')
  showMain()
})

$('btn-logout').addEventListener('click', async () => {
  await chrome.storage.local.remove([AUTH_KEY])
  username = null
  state = null
  showLogin()
})

$('btn-start-day').addEventListener('click', async () => {
  state.dailyProgress.dayStatus = 'in_progress'
  state.dailyProgress.dayStartedAt = new Date().toISOString()
  state.dailyProgress.dayFinishedAt = null
  await persist()
  renderAll()
})

$('btn-finish-day').addEventListener('click', async () => {
  state.dailyProgress.dayStatus = 'finished'
  state.dailyProgress.dayFinishedAt = new Date().toISOString()
  const pct = overallPct(state)
  const entry = {
    date: state.dailyProgress.date,
    completionPercent: pct,
    tasksCompleted: 0,
    tasksTotal: 0,
    connections: 0,
    followUps: 0,
    facebookComments: 0,
    facebookDms: 0,
    jobsReviewed: 0,
    proposalsSent: 0,
    revenue: 0,
    notes: state.dailyProgress.dailyNotes || '',
    totalTimeWorkedSeconds: state.dailyProgress.totalTimeWorkedSeconds || 0,
    productivityScore: pct,
    dayStartedAt: state.dailyProgress.dayStartedAt,
    dayFinishedAt: state.dailyProgress.dayFinishedAt,
    dayStatus: 'finished',
  }
  state.history = [entry, ...(state.history || []).filter((h) => h.date !== entry.date)]
  await persist()
  renderAll()
})

$('btn-prev').addEventListener('click', () => {
  if (stepIndex > 0) {
    stepIndex -= 1
    renderAll()
  }
})

$('btn-next').addEventListener('click', () => {
  const step = STEPS[stepIndex]
  if (step.url) chrome.tabs.create({ url: step.url, active: false })
  if (stepIndex < STEPS.length - 1) {
    stepIndex += 1
    renderAll()
  }
})

$('btn-open-dash').addEventListener('click', () => {
  chrome.tabs.create({ url: DASH_URL })
})

let notesTimer = null
$('notes').addEventListener('input', (e) => {
  const step = STEPS[stepIndex]
  state.dailyProgress.platforms[step.id].notes = e.target.value
  clearTimeout(notesTimer)
  notesTimer = setTimeout(() => persist(), 400)
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !username) return
  if (changes[META_KEY]?.newValue?.lastWriter === 'extension') return
  const key = stateKey(username)
  if (changes[key]?.newValue) {
    state = ensureToday(changes[key].newValue)
    renderAll()
  }
})

init()
