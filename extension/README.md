# BD Dashboard Chrome Extension

Step-by-step daily tracker popup that syncs with your BD Dashboard while you work on Fiverr, LinkedIn, Facebook, or Upwork.

## Install (Chrome / Edge)

1. Open Chrome → `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder: `extension` (inside the project)
5. Pin **BD Dashboard Tracker** to the toolbar

## Fix sync (important)

1. Go to `chrome://extensions`
2. Find **BD Dashboard Tracker** → click **Reload**
3. Open https://dashboard-sales-sand.vercel.app and **refresh** that tab (logged in)
4. Open the extension → click **Sync Dashboard**

You should see your started day and current progress.


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
