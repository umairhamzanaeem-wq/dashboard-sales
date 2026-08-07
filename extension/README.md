# BD Dashboard Chrome Extension

Step-by-step daily tracker popup that syncs with your BD Dashboard while you work on Fiverr, LinkedIn, Facebook, or Upwork.

## Install (Chrome / Edge)

1. Open Chrome → `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder: `extension` (inside the project)
5. Pin **BD Dashboard Tracker** to the toolbar

## First-time sync

1. Open your dashboard: https://dashboard-sales-sand.vercel.app  
2. Log in (saad/saad or umair/umair)  
3. Keep that tab open once (content script copies Local Storage → extension)  
4. Click the extension icon → log in with the **same** user  

After that, updates from the popup write into the open dashboard live.

## Daily use

1. Click the extension icon  
2. **Start Day**  
3. Work step by step: **Fiverr → LinkedIn Saad → LinkedIn Umair → Facebook → Upwork → Review**  
4. Check tasks / use + − counters without leaving LinkedIn etc.  
5. **Next** opens the next platform tab in the background  
6. **Finish Day** when done  

## Logins

| Username | Password |
|----------|----------|
| saad | saad |
| umair | umair |

## Notes

- Data stays on your machine (Chrome storage + dashboard Local Storage).  
- For live dashboard updates, keep the dashboard tab open in the background.  
- Redeploy the website after pulling latest code so the sync bridge is active.
