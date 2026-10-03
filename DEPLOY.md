# Deploying GRAPNEL to a public URL

One process serves everything (game + websocket on the same port), so any
Node host works. All three routes below are prepped — pick one.

## Step 0 (all routes): put the project on GitHub

```bash
cd grapnel
git init
git add .
git commit -m "GRAPNEL"
```

Create an empty repo on github.com (private is fine), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/grapnel.git
git push -u origin main
```

## Route A — Render (free, ~10 minutes)

1. Sign up at render.com (GitHub login, no card needed).
2. Dashboard → **New → Blueprint** → connect your `grapnel` repo.
3. Render reads `render.yaml` automatically → click **Apply**.
4. Wait for the build (~3 min). Your game is live at
   `https://grapnel-XXXX.onrender.com` — send that link to anyone.

Caveat: the free tier sleeps after ~15 min idle; the first visitor waits
~30–60s while it wakes. Fine for playtesting, upgrade later if it matters.

## Route B — Railway (~$5/mo, no sleeping)

1. Sign up at railway.com (GitHub login).
2. **New Project → Deploy from GitHub repo** → pick `grapnel`.
3. Railway reads `railway.json` automatically.
4. Settings → **Networking → Generate Domain** → that's your public URL.

## Route C — Colyseus Cloud (purpose-built for this server)

1. Sign up at cloud.colyseus.io.
2. Create an application → connect the GitHub repo.
3. Build command `npm install && npm run build`, start `npm run start`.
4. Deploy; use the provided URL.

## After deploy — checklist

- Open the URL on your phone AND a desktop → both should reach the splash.
- HTTPS means **phone gyro would work too** (relevant if we ever revive TILT).
- Squad rooms: the room code is in the URL (`?room=ABCD`) — sending the
  browser URL to a friend puts them in YOUR room.
- Server logs (Render/Railway dashboard) show `[mission ...] joined` lines —
  that's how you confirm friends actually connected.

## Redeploying after I change code

```bash
git add . && git commit -m "update" && git push
```

Every push auto-redeploys on all three hosts.
