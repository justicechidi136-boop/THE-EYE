# TLS certificates (live)

Place production certificates here:

- `fullchain.pem` — certificate + intermediate chain
- `privkey.pem` — private key (mode 600 on host)

## Let's Encrypt (recommended)

Use Certbot on the host or the optional `certbot` compose profile, then copy or mount:

```text
infra/docker/nginx/certs/live/fullchain.pem
infra/docker/nginx/certs/live/privkey.pem
```

## Local / staging self-signed

From the repository root:

```powershell
powershell -File scripts/generate-dev-ssl.ps1
```

Or set `THE_EYE_GENERATE_DEV_SSL=true` in `.env` to auto-generate on nginx container start (development only).

## Production

- Do **not** commit real keys or certificates.
- Set `THE_EYE_SSL_REDIRECT=true` after certificates are installed.
- Set `THE_EYE_SERVER_NAME` to your public hostname.
- Update `CORS_ORIGINS` and `NEXT_PUBLIC_LIVEKIT_URL` to use `https://`.
