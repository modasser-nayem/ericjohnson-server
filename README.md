# Real-Time Multiplayer Game Platform

A backend server for a real-time multiplayer game platform built with Node.js, Express, Socket.IO, MongoDB, and Redis.

---

## Tech Stack

- **Runtime:** Node.js 20
- **Framework:** Express 5
- **Real-time:** Socket.IO with Redis adapter
- **Database:** MongoDB (via Prisma ORM)
- **Cache / Queue:** Redis + BullMQ
- **Auth:** JWT + bcrypt
- **File Storage:** AWS S3
- **Video Calls:** Zego Cloud
- **Metrics:** Prometheus (`prom-client`)
- **Language:** TypeScript

---

## Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) v20+
- [npm](https://www.npmjs.com/) v9+
- [Docker](https://www.docker.com/) & Docker Compose (for containerized setup)
- A MongoDB Atlas cluster (or any MongoDB instance)
- A Redis instance (handled automatically via Docker)

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable            | Description                                      |
| ------------------- | ------------------------------------------------ |
| `NODE_ENV`          | Environment (`development` / `production`)       |
| `PORT`              | Port the server listens on (default: `5040`)     |
| `DATABASE_URL`      | MongoDB connection string                        |
| `REDIS_URL`         | Redis connection URL                             |
| `FRONTEND_URL`      | Allowed frontend origin for CORS                 |
| `BCRYPT_SALT_ROUNDS`| Number of bcrypt salt rounds (e.g. `10`)         |
| `ZEGO_APP_ID`       | Zego Cloud App ID                                |
| `ZEGO_APP_SECRET`   | Zego Cloud App Secret                            |
| `ACCESS_TOKEN_SECRET` | JWT signing secret                             |
| `ACCESS_EXPIRES_IN` | JWT expiry duration (e.g. `7d`)                  |
| `AWS_ACCESS_KEY`    | AWS IAM access key                               |
| `AWS_SECRET_KEY`    | AWS IAM secret key                               |
| `AWS_REGION`        | AWS region (e.g. `us-east-1`)                    |
| `AWS_S3_BUCKET_NAME`| S3 bucket name for file uploads                  |

---

## Running the App

### Option 1 — Docker (Recommended)

This starts the app and Redis together. You only need a MongoDB URL in your `.env`.

```bash
npm run docker:up
```

To stop:

```bash
npm run docker:down
```

To tail logs:

```bash
npm run docker:logs
```

The server will be available at `http://localhost:5040`.

---

### Option 2 — Local Development

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Generate Prisma client**

   ```bash
   npx prisma generate
   ```

3. **Start a local Redis instance** (skip if you have one running)

   ```bash
   docker run -d -p 6379:6379 redis:7.2-alpine
   ```

4. **Start the dev server**

   ```bash
   npm run dev
   ```

   The server starts with hot-reload via `ts-node-dev` on `http://localhost:5040`.

---

### Option 3 — Production Build

1. **Build the TypeScript source**

   ```bash
   npm run build
   ```

2. **Start the compiled server**

   ```bash
   npm start
   ```

---

## API Endpoints

| Method | Path            | Description                        | Auth     |
| ------ | --------------- | ---------------------------------- | -------- |
| GET    | `/`             | Health check (plain text)          | No       |
| GET    | `/health`       | Health check (JSON)                | No       |
| GET    | `/ready`        | Readiness check (Redis + DB)       | No       |
| POST   | `/auth/register`| Register a new user                | No       |
| POST   | `/auth/login`   | Login and receive a JWT            | No       |
| GET    | `/zego-token`   | Generate a Zego Cloud token        | Yes      |
| POST   | `/file-upload`  | Upload a file to S3 (multipart)    | Yes      |
| GET    | `/metrics`      | Prometheus metrics                 | No       |

For real-time Socket.IO events, see [`socket_api_docs.md`](./socket_api_docs.md).

---

## Project Structure

```
src/
├── app.ts              # Express app setup and routes
├── server.ts           # Server entry point
├── config/             # Redis, Socket.IO, env, pub/sub config
├── controllers/        # Route handlers
├── core/               # Game config and registry
├── db/                 # Prisma client
├── engines/            # Game engine logic
├── errors/             # Custom error classes
├── metrics/            # Prometheus metrics setup
├── middleware/         # Auth, validation, error handling
├── queue/              # BullMQ job queue and worker
├── services/           # Business logic
├── socket/             # Socket.IO event handlers and streams
├── types/              # TypeScript types
├── upload/             # File upload (S3)
└── utils/              # Logger, cron, helpers
prisma/
└── schema.prisma       # MongoDB schema (GameSession, GameEvent, User)
```

---

## Useful Scripts

| Script               | Description                              |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start dev server with hot-reload         |
| `npm run build`      | Compile TypeScript to `dist/`            |
| `npm start`          | Run compiled production build            |
| `npm run typecheck`  | Type-check without emitting files        |
| `npm run docker:up`  | Build and start Docker containers        |
| `npm run docker:down`| Stop and remove Docker containers        |
| `npm run docker:logs`| Tail logs for app and Redis containers   |
