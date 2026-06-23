# Emulator Setup — Genymotion Desktop

## Why Genymotion over Android Studio AVD
- Boots in ~10s vs 60-90s for AVD
- Lower RAM usage (~2GB vs ~4-6GB)
- Built-in GPS spoofing widget (no extra steps)
- Free for personal use

---

## 1. Install Genymotion Desktop

1. Go to https://www.genymotion.com/product-desktop/
2. Create a free account (personal use licence)
3. Download **Genymotion Desktop** (Windows installer)
4. Install — it will also prompt to install **VirtualBox** if not present; accept

---

## 2. Create a Virtual Device

1. Open Genymotion → **Add device**
2. Search for: **Google Pixel 6** — API 33 or 34
3. Click **Install** — downloads the image (~1.5GB)
4. Once installed, select the device → **Launch**

Recommended settings (Edit device before launching):
- RAM: 4096 MB
- Screen: 1080×2400, 420 dpi (matches S25 roughly)

---

## 3. Install Chrome on the Emulator

Google Play isn't available by default. Options:

**Option A — Genymotion OpenGApps (easiest)**
1. Start the virtual device
2. In the toolbar click the **GApps** button (looks like a Google icon)
3. Select **nano** package → Install → reboot emulator
4. Open Play Store → sign in → install Chrome

**Option B — Direct APK**
Download Chrome APK from apkmirror.com, drag-and-drop onto the running emulator window to install.

---

## 4. Connect to Audioguide via Tailscale

The emulator runs behind VirtualBox NAT — it cannot reach your Tailscale IP directly. Two options:

**Option A — Use your PC's local IP (simplest)**
The emulator can reach the host machine via `10.0.2.2` (VirtualBox gateway):
- Open Chrome in emulator → `https://10.0.2.2:8443`
- You will get a cert warning because the cert is issued for `tarailab.tail1868ac.ts.net`
- Accept the warning for testing, or…

**Option B — Install Tailscale on the emulator (cleanest)**
1. Download Tailscale APK from https://pkgs.tailscale.com/stable/#android
2. Drag APK onto emulator to install
3. Log in with your Tailscale account
4. Navigate to `https://tarailab.tail1868ac.ts.net:8443` — works exactly like the phone

**Option B is recommended** — same URL, same cert, same behaviour as the real phone.

---

## 5. Install the mkcert CA Certificate

So Chrome trusts your HTTPS cert:

1. Copy `C:\Users\Ailab\AppData\Local\mkcert\rootCA.pem` to the emulator:
   - Drag-and-drop the file onto the Genymotion window
   - It lands in `/sdcard/Download/`
2. In emulator: **Settings → Security → Install from storage**
3. Select `rootCA.pem` → name it `audioguide-dev` → install
4. Restart Chrome → `https://tarailab.tail1868ac.ts.net:8443` should show green padlock

---

## 6. GPS Spoofing

Genymotion has a GPS widget built into the toolbar:

1. With the virtual device running, click the **GPS** button in the right toolbar
2. Enter latitude/longitude manually, or
3. Click on the map to drop a pin
4. Click **Send** — the emulator's GPS updates immediately

The audioguide app will pick up the new position within a few seconds (next GPS poll).

**Useful test coordinates:**

| Location | Lat | Lon | Why useful |
|---|---|---|---|
| Vilnius Old Town | 54.6872 | 25.2797 | Dense POIs, rich history |
| Trakai | 54.6379 | 24.9340 | Castle, lake, Karaite minority |
| Lithuanian–Latvian border | 56.1500 | 24.3000 | Country crossing test |
| Rural road (empty) | 55.3000 | 24.0000 | No POI test |
| Kaunas centre | 54.8985 | 23.9036 | Second city, different density |
| Kaliningrad border | 54.7100 | 22.7600 | EU border, currency/roaming test |

---

## 7. Route Simulation (optional)

Genymotion doesn't have built-in GPX route playback. Use the audioguide's own **dev panel** (see dev panel docs) to step through waypoints automatically — more controlled than GPS spoofing anyway.

Alternatively, **GPS Replay** (free Android app, install via APK) can play back a GPX file and feed it to all apps as mock location. Useful for recording a real drive and replaying it.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| VirtualBox conflict with Hyper-V | Disable Hyper-V: `bcdedit /set hypervisorlaunchtype off` → reboot. Re-enable after: `bcdedit /set hypervisorlaunchtype auto` |
| Emulator won't boot | Increase RAM in device settings, check VirtualBox is updated |
| Chrome says "not secure" | CA cert not installed — repeat step 5 |
| GPS not updating in app | Check location permission is granted to Chrome in emulator settings |
| Tailscale won't connect | Emulator needs internet access; check VirtualBox NAT adapter is enabled |
