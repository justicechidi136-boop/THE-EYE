# THE EYE Docker Deployment

This folder containerizes THE EYE for development and production.

Services:

- `api`: NestJS backend API
- `admin-web`: Next.js admin dashboard
- `postgres-postgis`: PostgreSQL with PostGIS
- `pgbouncer`: optional connection pooler (`--profile pooling`)
- `redis`: cache and BullMQ queues
- `minio`: S3-compatible evidence storage
- `livekit`: live video server
- `nginx`: production reverse proxy
- `api-migrate`: one-shot Prisma migration command
- `api-seed`: one-shot seed command

## Local Development

From the repository root:

```bash
cp .env.example .env
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.dev.yml up --build
```

Development URLs:

- Admin web: `http://localhost:3000`
- API docs: `http://localhost:4000/docs`
- MinIO console: `http://localhost:9001`
- LiveKit: `ws://localhost:7880`

Run migrations:

```bash
docker compose -f infra/docker/docker-compose.yml --profile tools run --rm api-migrate
```

Run seed:

```bash
docker compose -f infra/docker/docker-compose.yml --profile tools run --rm api-seed
```

## Production on Ubuntu VPS

1. Install Docker:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out and back in after adding your user to the Docker group.

2. Clone and configure:

```bash
git clone <your-repo-url> the-eye
cd the-eye
cp .env.example .env
nano .env
```

Change at least:

- `POSTGRES_PASSWORD`
- `MINIO_ROOT_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `LIVE_LOCATION_LINK_SECRET`
- `LIVEKIT_API_SECRET`
- `NEXT_PUBLIC_LIVEKIT_URL`

3. Build and start infrastructure:

```bash
docker compose -f infra/docker/docker-compose.yml up -d --build postgres-postgis redis minio livekit
docker compose -f infra/docker/docker-compose.yml build api admin-web
docker compose -f infra/docker/docker-compose.yml --profile tools run --rm api-migrate
docker compose -f infra/docker/docker-compose.yml --profile tools run --rm api-seed
docker compose -f infra/docker/docker-compose.yml up -d --build
```

Optional PgBouncer for multi-replica API pools:

```bash
docker compose -f infra/docker/docker-compose.yml --profile pooling up -d pgbouncer
```

Set `DATABASE_DIRECT_URL` to `postgres-postgis:5432` for migrations/seeds and `DATABASE_URL` to `pgbouncer:6432` with `pgbouncer=true` for API workers. See `docs/postgres-scaling.md`.

4. Check health:

```bash
docker compose -f infra/docker/docker-compose.yml ps
curl http://localhost/healthz
curl http://localhost/v1/docs
```

## SSL Setup

The nginx config is SSL-ready.

Recommended approach:

1. Point your domain DNS `A` record to the VPS.
2. Install Certbot on the VPS or use a temporary Certbot container.
3. Place certificates here:

```text
infra/docker/nginx/certs/live/fullchain.pem
infra/docker/nginx/certs/live/privkey.pem
```

4. Edit `infra/docker/nginx/conf.d/the-eye.conf`:

- Replace `server_name example.com`.
- Uncomment the `listen 443 ssl http2` server block.
- Optionally redirect HTTP to HTTPS.

5. Reload nginx:

```bash
docker compose -f infra/docker/docker-compose.yml exec nginx nginx -s reload
```

## Firewall

For production, expose only:

- `80/tcp`
- `443/tcp`
- LiveKit RTC ports if clients connect directly: `7881/tcp`, `7882/udp`

Example:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 7881/tcp
sudo ufw allow 7882/udp
sudo ufw enable
```

## Volumes

Persistent volumes:

- `postgres_data`
- `redis_data`
- `minio_data`
- `nginx_cache`

Back up PostgreSQL:

```bash
docker compose -f infra/docker/docker-compose.yml exec postgres-postgis pg_dump -U the_eye the_eye > the_eye_backup.sql
```

Back up MinIO by copying objects from the `minio_data` volume or using `mc mirror`.

## Common Commands

Start:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

Stop:

```bash
docker compose -f infra/docker/docker-compose.yml down
```

View logs:

```bash
docker compose -f infra/docker/docker-compose.yml logs -f api
docker compose -f infra/docker/docker-compose.yml logs -f nginx
```

Run migration:

```bash
docker compose -f infra/docker/docker-compose.yml --profile tools run --rm api-migrate
```

Run seed:

```bash
docker compose -f infra/docker/docker-compose.yml --profile tools run --rm api-seed
```

Rebuild:

```bash
docker compose -f infra/docker/docker-compose.yml build --no-cache api admin-web
docker compose -f infra/docker/docker-compose.yml up -d
```
