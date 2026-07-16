# Running GeoChron as an always-on wall display (macOS)

This guide turns the app into a self-healing kiosk: it restarts itself if it crashes,
comes back automatically after a reboot, and fills the screen with no browser chrome.

You only need to do this once on the machine that drives the office monitor.

---

## 1. Build the production app

A production build is much lighter and more stable than the `npm run dev` server
(no hot-reloading, lower memory use — important for 24/7 running).

```bash
cd ~/Desktop/geochron-clean
npm run build
```

## 2. Keep the server alive with pm2

[pm2](https://pm2.keymetrics.io/) is a process manager. It restarts the app if it ever
crashes and can relaunch it automatically when the Mac boots.

```bash
# Install pm2 once, globally
npm install -g pm2

# Point the disk cache at a persistent folder so last-good data survives reboots
mkdir -p ~/.geochron-cache

# Start the app under pm2 (runs `next start` on http://localhost:3000)
GEOCHRON_CACHE_DIR=~/.geochron-cache pm2 start npm --name geochron -- start

# Save this process list and enable start-on-boot
pm2 save
pm2 startup
# ^ pm2 prints one more command to copy-paste (it needs admin rights). Run it.
```

Handy pm2 commands later:

```bash
pm2 status          # is it running?
pm2 logs geochron   # live logs
pm2 restart geochron
pm2 stop geochron
```

After you change the code and want the display to pick it up:

```bash
cd ~/Desktop/geochron-clean
git pull            # if you pulled changes from GitHub
npm run build
pm2 restart geochron
```

## 3. Launch the browser in full-screen kiosk mode

Point Chrome at the app with no tabs, address bar, or cursor clutter. The app already
does a **nightly 4 AM reload** on its own to flush memory, so the browser can stay open
indefinitely.

```bash
open -na "Google Chrome" --args \
  --kiosk \
  --app=http://localhost:3000 \
  --autoplay-policy=no-user-gesture-required \
  --disable-session-crashed-bubble \
  --disable-infobars \
  --user-data-dir="$HOME/.geochron-chrome"
```

- `--kiosk` = full screen, no chrome.
- `--autoplay-policy=no-user-gesture-required` lets the ISS live video autoplay.
- The separate `--user-data-dir` keeps this from touching your normal Chrome profile.
- To exit kiosk mode: `Cmd+Q`.

## 4. Stop the monitor (not the Mac) from sleeping

So the display stays lit:

- **System Settings → Displays → Advanced** → turn off "Put displays to sleep when inactive,"
  or set a long delay.
- Optionally run the app machine with `caffeinate -d` to prevent display sleep:
  ```bash
  caffeinate -d &
  ```

## 5. (Optional) Auto-launch the browser on login

Create a tiny launcher and add it to **System Settings → General → Login Items**:

```bash
cat > ~/geochron-kiosk.command <<'EOF'
#!/bin/bash
sleep 8   # give pm2 a moment to bring the server up after boot
open -na "Google Chrome" --args --kiosk --app=http://localhost:3000 \
  --autoplay-policy=no-user-gesture-required \
  --disable-session-crashed-bubble --disable-infobars \
  --user-data-dir="$HOME/.geochron-chrome"
EOF
chmod +x ~/geochron-kiosk.command
```

Then add `geochron-kiosk.command` under Login Items so it runs when you log in.

---

### What makes this reliable

- **pm2** restarts the Node server on crash and on boot.
- **Nightly 4 AM page reload** (built into the app) clears slow memory/GPU creep.
- **WebGL watchdog** (built in) rebuilds the map if the GPU drops its context.
- **Disk cache** (`GEOCHRON_CACHE_DIR`) means a restart shows last-good data instantly
  instead of a blank screen while feeds refetch.
- **Auto-expiring errors** mean a brief feed hiccup never leaves a stuck error on the wall.
