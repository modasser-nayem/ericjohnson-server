# Docker Setup

This setup runs:
- `app` (Node.js backend)
- `redis` (required, in Docker now)
- optional `mongo` service for future use

## 1) Keep MongoDB external (current setup)

In `.env`, keep your external MongoDB URL:

`DATABASE_URL=<your external mongodb url>`

You do not need to change it for Redis-in-Docker.

## 2) Start app + Redis

```bash
docker compose up -d --build
```

Verify:

```bash
docker compose ps
docker compose logs -f app redis
```

Stop:

```bash
docker compose down
```

## 3) Future: move MongoDB to Docker

1. Start with Mongo profile:

```bash
docker compose --profile mongo up -d --build
```

2. Update `.env`:

`DATABASE_URL=mongodb://mongo:27017/ericjohnson`

3. Restart app container.

## 4) Default app endpoint

- API: `http://localhost:5000`
- Health: `http://localhost:5000/health`
- Ready: `http://localhost:5000/ready`
