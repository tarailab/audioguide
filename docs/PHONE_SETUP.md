# Phone Setup — One-time HTTPS certificate install

GPS and compass APIs require HTTPS on mobile browsers. This is a one-time setup.

## Step 1 — Generate certs (done once on tarailab)

```powershell
cd D:\Projects\audioguide
mkcert -install   # installs CA in Windows
mkcert -cert-file certs\audioguide.crt -key-file certs\audioguide.key `
       100.118.34.9 tarailab.tail1868ac.ts.net localhost 127.0.0.1
```

This creates:
- `certs\audioguide.crt` — server certificate (used by Caddy)
- `certs\audioguide.key` — private key (used by Caddy)
- CA cert location printed by mkcert (needed for Android)

## Step 2 — Install CA cert on your Android phone

### Find the CA cert file
```powershell
mkcert -CAROOT   # prints the folder path
# Usually: C:\Users\Ailab\AppData\Local\mkcert\
# File: rootCA.pem
```

### Transfer to phone (pick one)
- **Email**: Email yourself the `rootCA.pem` file, open on phone
- **Tailscale**: Copy to a shared folder or serve temporarily
- **Quick serve**: 
  ```powershell
  cd (mkcert -CAROOT); python -m http.server 9999
  # Then on phone: http://100.118.34.9:9999/rootCA.pem
  ```

### Install on Android
1. Download `rootCA.pem` on phone
2. Settings → Security → More security settings → Install from device storage
3. Select "CA Certificate" → find the file → confirm
4. Name it "Audioguide Dev"

## Step 3 — Access the app

Open Chrome on phone:
```
https://tarailab.tail1868ac.ts.net:8443
```

Accept GPS permission when prompted.

## Troubleshooting

- **"Your connection is not private"** — CA cert not installed yet on phone
- **GPS not working** — must be HTTPS, not HTTP
- **Compass not working on Android** — no permission needed, just needs HTTPS
- **Compass not working on iPhone** — tap "Enable compass" button in app (iOS needs user gesture)
