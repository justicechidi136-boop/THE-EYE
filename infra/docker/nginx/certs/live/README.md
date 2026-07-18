# TLS certificates (live)

Place production certificates here:

- `fullchain.pem` — certificate + intermediate chain (shared SAN cert)
- `privkey.pem` — private key (mode 600 on host)

Per-hostname certificates (when `THE_EYE_TLS_PER_HOST=true`):

```text
<hostname>/fullchain.pem
<hostname>/privkey.pem
```

## Let's Encrypt (recommended)

Use Certbot on the host or the optional `certbot` compose profile:

```bash
export THE_EYE_ADMIN_SERVER_NAME=staging-dashboard8jps.theeye.com.ng
export THE_EYE_API_SERVER_NAME=staging-api.theeye.com.ng
export THE_EYE_LIVEKIT_SERVER_NAME=staging-livekit.theeye.com.ng
export CERTBOT_EMAIL=ops@example.com
bash scripts/issue-letsencrypt.sh
```

Default: single SAN certificate copied to:

```text
infra/docker/nginx/certs/live/fullchain.pem
infra/docker/nginx/certs/live/privkey.pem
```

Per-hostname mode: set `THE_EYE_TLS_PER_HOST=true` before issuing.

## Local / staging self-signed

From the repository root:

```powershell
powershell -File scripts/generate-dev-ssl.ps1
```

Or set `THE_EYE_GENERATE_DEV_SSL=true` in `.env` to auto-generate on nginx container start (development only).

## Production

- Do **not** commit real keys or certificates.
- Set `THE_EYE_SSL_REDIRECT=true` after certificates are installed.
- Set all three `THE_EYE_*_SERVER_NAME` values to your public hostnames.
- Update `CORS_ORIGINS`, `NEXT_PUBLIC_API_BASE_URL`, and `NEXT_PUBLIC_LIVEKIT_URL` to match the split-hostname architecture.
