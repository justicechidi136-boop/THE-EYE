# Staging Public Object Storage

This runbook prepares the staging MinIO object API for mobile evidence uploads that use short-lived presigned URLs.

## Architecture

Internal storage traffic stays on Docker networking:

```text
API -> S3_ENDPOINT -> http://minio:9000
```

Client upload/download traffic uses a dedicated public HTTPS hostname:

```text
Mobile -> S3_PUBLIC_ENDPOINT -> nginx :443 -> minio:9000
```

`S3_PUBLIC_ENDPOINT` must be the URL used during SigV4 signing. Do not sign `minio:9000` and replace the hostname afterward.

## Required Hostname

The project owner must provide a dedicated staging hostname before deployment:

```text
STAGING_STORAGE_HOST=<owner-supplied staging storage hostname>
THE_EYE_STORAGE_SERVER_NAME=<same hostname>
S3_PUBLIC_ENDPOINT=https://<same hostname>
```

Use a project-owned staging hostname, for example a DNS name under `theeye.com.ng` that clearly includes `staging`. Do not reuse the API, admin, or LiveKit hostnames.

Required DNS record:

```text
A <owner-supplied staging storage hostname> -> <staging VPS public IPv4>
```

Do not create the DNS record from this repository unless the owner explicitly authorizes DNS changes.

## TLS

The storage hostname must have a valid Let's Encrypt certificate. The existing Certbot scripts include `THE_EYE_STORAGE_SERVER_NAME` when it is set.

Bootstrap order:

1. Add the DNS `A` record.
2. Set `THE_EYE_STORAGE_SERVER_NAME` in staging `.env`.
3. Run `scripts/issue-letsencrypt.sh` in HTTP bootstrap mode.
4. Set `THE_EYE_SSL_REDIRECT=true`.
5. Restart/reload nginx.

Self-signed certificates, plain HTTP, and TLS verification bypasses are not acceptable for mobile evidence upload certification.

## Security

The public proxy exposes only MinIO object API traffic.

- MinIO API port `9000` remains bound to `127.0.0.1` on the host.
- MinIO console port `9001` remains bound to `127.0.0.1` and is never proxied.
- Buckets remain private.
- Anonymous bucket/object access remains disabled.
- Public object access requires a valid presigned URL.
- Presigned query values must not be logged.

The nginx storage vhost preserves `Host: $host` because AWS SigV4 includes the host in the canonical request. Nginx must not rewrite the host to `minio`.

## Smoke Test

After deploying staging with the storage hostname configured, run:

```bash
STAGING_API_BASE_URL=https://staging-api.theeye.com.ng/v1 \
STAGING_STORAGE_HOST=<owner-supplied staging storage hostname> \
STAGING_STORAGE_SMOKE_TOKEN=<authenticated staging citizen token> \
node scripts/staging-storage-smoke.cjs
```

The script logs only safe structural information:

```text
event=presign scheme=https host=<storage-host> port=(default) hasQuery=true
event=put method=PUT status=200
```

It does not print credentials, bearer tokens, signatures, or complete presigned URLs.
