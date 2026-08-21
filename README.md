# ReachInbox — Full-Stack Email Scheduler

## Overview
An asynchronous, resilient, and horizontally scalable full-stack email campaign scheduler. The application enables users to log in securely via Google OAuth, upload lists of leads via CSV/TXT, set custom schedules, and manage email campaigns. 

The scheduling infrastructure utilizes **PostgreSQL** as the primary application state database, **Redis** as a persistent message broker, and **BullMQ** to orchestrate concurrency, safe retries, and distributed rate limiting across multiple stateless worker instances.

---

## Features

### Backend
- **TypeScript & Express**: Modern compiled structure with strict type-safety and route management.
- **Asynchronous Delayed Scheduling**: Handled entirely through BullMQ delayed queues (no cron, custom polling, or in-memory intervals).
- **Restart Persistence**: Scheduled tasks survive system restarts because they are persisted in a Docker-mapped Redis database.
- **Distributed Spacing Delay & Rate Limiting**: Coordinated atomically using Redis Lua scripts to enforce a minimum spacing delay and maximum hourly limit per sender across multiple worker instances.
- **Worker Concurrency**: Scalable execution loop processing multiple dispatches in parallel.
- **Idempotency Safeguards**: Check-and-set database transactions and deterministic job IDs prevent duplicate email dispatches.
- **Failure & Retry Engine**: Bounded exponential backoffs record delivery failure logs directly to PostgreSQL.

### Frontend
- **React & Vite**: Fast development server and bundle optimization.
- **Real Google OAuth**: Implemented stateful authentication using `express-session` cookies.
- **Lead List Parsing**: Local client-side CSV/TXT parsing that filters out malformed strings and duplicates before campaigns are submitted.
- **Campaign Dashboard**: Real-time scheduled and sent status logs showing attempts and errors.
- **Premium Styling**: Slate-based dark mode layout featuring glassmorphic cards, Outfit typography, alerts, and timed toast overlays.

---

## Architecture

```text
               +-----------------------------------+
               |       React Client Dashboard      |
               +-----------------------------------+
                   /                           \
  (Google Auth Redirect)                 (JSON API Request)
                 /                               \
                v                                 v
+-------------------------------+       +----------------------------+
| Google Authorization Server   |       |   Express API Backend      |
+-------------------------------+       +----------------------------+
                                                /            \
                                    (Prisma Client)      (BullMQ Enqueue)
                                              /                \
                                             v                  v
                               +------------------+     +------------+
                               |    PostgreSQL    |     |    Redis   |
                               +------------------+     +------------+
                                                                ^
                                                                |
                                                          (BullMQ Poll)
                                                                |
                                                                v
                                                       +-------------+
                                                       | Worker Loop |
                                                       +-------------+
                                                              |
                                                       (EmailService)
                                                              |
                                                              v
                                                       +-------------+
                                                       | Ethereal    |
                                                       | SMTP Server |
                                                       +-------------+
```

---

## Tech Stack
- **Core**: HTML5, Vanilla CSS, TypeScript, JavaScript
- **Frontend Framework**: React 19, Vite, Lucide Icons
- **Backend Framework**: Express.js, Express Session
- **Database ORM**: Prisma Client
- **Databases**: PostgreSQL (Relational State), Redis (Queue & Cache)
- **Task Orchestration**: BullMQ
- **Mailer**: Nodemailer (Ethereal SMTP)

---

## Project Structure
```text
ReachInbox/
├── backend/
│   ├── prisma/             # Schema definition and migrations
│   ├── src/
│   │   ├── config/         # Database and Redis settings
│   │   ├── controllers/    # Express route handlers
│   │   ├── middleware/     # requireAuth session validator
│   │   ├── queues/         # BullMQ queue instances
│   │   ├── routes/         # Auth and Email router mappings
│   │   ├── services/       # EmailService (SMTP) and SchedulerService
│   │   ├── workers/        # email.worker.ts execution loop
│   │   └── test-*.ts       # Phase verification scripts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/     # ComposeModal, LoadingSpinner, etc.
│   │   ├── pages/          # LoginPage and DashboardPage
│   │   ├── services/       # Centralized apiService wrapper
│   │   ├── types/          # Shared TypeScript type definitions
│   │   ├── App.tsx         # Root Router and Session Guard
│   │   └── index.css       # Core Design System CSS
│   ├── package.json
│   └── tsconfig.json
├── docs/                   # Submission resources and audit logs
└── docker-compose.yml      # Redis and Postgres containers
```

---

## Prerequisites
- **Node.js** (v20+ recommended)
- **Docker Desktop** (to host databases)
- **Google Cloud Console account** (for OAuth API credentials)

---

## Environment Variables

### Backend (`backend/.env`)
Create a `.env` file inside `backend/` with the following configuration variables:
```env
DATABASE_URL=postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox
REDIS_HOST=localhost
REDIS_PORT=6379
WORKER_CONCURRENCY=5
QUEUE_MAX_ATTEMPTS=3
QUEUE_BACKOFF_MS=5000
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=200
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
FRONTEND_URL=http://localhost:5173
SESSION_SECRET=your_cryptographically_signed_session_secret
```

### Frontend (`frontend/.env`)
Create a `.env` file inside `frontend/` with the following configuration variables:
```env
VITE_API_URL=http://localhost:5000
```

---

## Running the Project

1. **Start Infrastructure Services**:
   ```bash
   docker compose up -d
   ```

2. **Setup the Database**:
   ```bash
   cd backend
   npm install
   npx prisma db push
   ```

3. **Setup the Frontend**:
   ```bash
   cd ../frontend
   npm install
   ```

4. **Run the Backend Services**:
   - Start the Express API:
     ```bash
     cd backend
     npm run dev
     ```
   - Start the worker loop process in a separate terminal:
     ```bash
     cd backend
     npm run worker
     ```

5. **Run the Frontend Server**:
   ```bash
   cd frontend
   npm run dev
   ```

---

## Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and select **APIs & Services** > **OAuth consent screen**. Set user type to **External** and add your profile/support emails.
3. Under **Scopes**, add `.../auth/userinfo.profile` and `.../auth/userinfo.email`. Add your tester email under the test users section.
4. Select **Credentials** > **Create Credentials** > **OAuth client ID**. Choose **Web application**.
5. Set:
   - **Authorized JavaScript origins**: `http://localhost:5173` and `http://localhost:5000`
   - **Authorized redirect URIs**: `http://localhost:5000/api/auth/google/callback`
6. Copy the Client ID and Secret and paste them into `backend/.env`.

---

## Ethereal Setup
The system automatically logs in using Ethereal configuration variables. If `ETHEREAL_USER` and `ETHEREAL_PASSWORD` are left empty, the application uses Nodemailer's built-in `nodemailer.createTestAccount()` to dynamically provision a developer Ethereal mailbox on startup and logs the login details in the console.

---

## API Endpoints

### Authentication
- `GET /api/auth/google`: Redirects clients to Google's consent screen.
- `GET /api/auth/google/callback`: Receives credentials, registers users, and signs the session cookie.
- `GET /api/auth/me`: Retrieves current session data.
- `POST /api/auth/logout`: Terminates sessions and clears cookies.

### Scheduling
- `POST /api/emails/schedule`: Enqueues email dispatches.
  - **Body**:
    ```json
    {
      "subject": "Hello Campaign",
      "body": "Hi there!",
      "recipients": ["alice@example.com", "bob@example.com"],
      "startTime": "2026-08-21T18:00:00.000Z",
      "delayBetweenEmailsMs": 2000,
      "hourlyLimit": 100
    }
    ```
- `GET /api/emails/scheduled`: Lists pending/scheduled campaigns for the user.
- `GET /api/emails/sent`: Lists completed (`SENT` or `FAILED`) deliveries.

---

## Scheduling Architecture
All scheduled campaigns are mapped to persistent BullMQ delayed jobs inside Redis. The job is queued with a `delay` calculated as `startTime - currentTime`, ensuring that jobs reside in Redis memory until the scheduled delivery time arrives.

---

## Persistence
- **PostgreSQL**: Stores persistent relationships, tracking the state of emails through their lifecycle (`SCHEDULED` -> `PROCESSING` -> `SENT`/`FAILED`).
- **Redis & Docker Volume**: Redis enqueues BullMQ records. The `redis_data` volume is bound to Docker container storage, guaranteeing that scheduled jobs survive backend restarts.

---

## Concurrency
Worker concurrency is governed via the `WORKER_CONCURRENCY` env parameter. Spawning multiple processing threads enables simultaneous execution of dispatches without database row locking.

---

## Minimum Delay
To prevent senders from spamming mailservers, an atomic Redis Lua script checks:
`email:throttle:${senderId}:nextSendAt`
If the current timestamp is less than this value, the slot is reserved, and the worker reschedules the email. If allowed, it advances the timestamp by `MIN_EMAIL_DELAY_MS`.

---

## Hourly Rate Limiting
The worker atomic Lua script maintains an hourly window counter:
`email:rate:${senderId}:${windowIndex}`
If the counter exceeds `MAX_EMAILS_PER_HOUR`, the script returns `LIMIT_REACHED`.

---

## Rescheduling
When the worker receives `THROTTLED` or `LIMIT_REACHED` from the Redis Lua script, it reverts the PostgreSQL email status back to `SCHEDULED`, calculates the next available time delay, and re-enqueues the job into BullMQ using its original deterministic job ID.

---

## Idempotency
1. **Deterministic Job IDs**: BullMQ jobs are named as `email-${email.id}`. If the scheduler attempts to re-add a job with the same ID, BullMQ ignores it.
2. **Atomic Status Check-and-Set**: When claiming a job, the worker executes a Prisma update statement:
   ```typescript
   prisma.email.updateMany({
     where: { id: emailId, status: { in: ["SCHEDULED", "FAILED"] } },
     data: { status: "PROCESSING" }
   })
   ```
   If the query updates 0 rows, the worker skips the job, protecting against concurrent processing races.

---

## Failure Handling
Upon SMTP failures, the worker records the error in the database, transitions the state to `FAILED`, and raises an error to trigger BullMQ's automatic retry logic. Once maximum attempts are exhausted, the job halts.

---

## 1000+ Emails
Under massive load, workers coordinate cooperatively via Redis. Jobs exceeding hourly rate limits or spacing delays are systematically pushed back (rescheduled) into the next open send window, avoiding job drops or buffer overflows.

---

## Testing

Run these tests in `backend/` to verify each core scheduling requirement:
- **Restart Persistence**: `npx ts-node src/test-restart.ts`
- **Idempotency Lock**: `npx ts-node src/test-idempotency.ts`
- **Backoff Retries**: `npx ts-node src/test-retry.ts`
- **Spacing Constraints**: `npx ts-node src/test-concurrency.ts`
- **Rate-Limiting Spacing**: `npx ts-node src/test-rate-limit.ts`
- **Authentication**: `npx ts-node src/test-auth-endpoints.ts`

---

## Assumptions and Trade-offs
- **SMTP Exactly-Once Limits**: It is impossible to guarantee exactly-once delivery over TCP/SMTP due to potential worker crashes after SMTP acknowledgment but before database status writes. The system handles this by utilizing the claim state checks.
- **Clock Synchronization**: Rescheduling calculations rely on the Redis and Node server clocks being synchronized.

---

## Demo
For a recommended demonstration flow, follow the timelines detailed in [DEMO_SCRIPT.md](file:///c:/Users/Priscilla/Desktop/ReachInbox/docs/DEMO_SCRIPT.md) and use the sample data provided in [demo-emails.csv](file:///c:/Users/Priscilla/Desktop/ReachInbox/docs/demo-emails.csv).

---

## Production Deployment (100% Free Tier, No Credit Card Required)

This project is configured to run on completely free-tier services without requiring a credit card, paid trial, or subscription.

### Architecture Overview
1. **Frontend**: Hosted on **Vercel** (Free Hobby plan).
2. **Backend API + Worker**: Hosted on **Render** as a single **Free Web Service**.
   - Express server and BullMQ worker run in the same process to eliminate Render Background Worker costs.
   - Pinned 24/7 awake using **cron-job.org** to prevent Render from sleeping.
3. **Database (PostgreSQL)**: Hosted on **Supabase** (Free Tier).
4. **Queue Broker (Redis)**: Hosted on **Upstash** (Free Serverless Redis).

---

### Step-by-Step Deployment Instructions

#### 1. Setup PostgreSQL (Supabase)
1. Sign up on [Supabase](https://supabase.com) (free, no credit card).
2. Create a new project and set a secure database password.
3. Go to **Project Settings** > **Database** and copy the **Transaction Connection String** (mode: `transaction`, port `6543`, protocol `postgresql://`).
4. This connection string is your production `DATABASE_URL`.

#### 2. Setup Redis (Upstash)
1. Sign up on [Upstash](https://upstash.com) (free, no credit card).
2. Create a new serverless Redis database.
3. Copy the **Redis Connection URL** (e.g., `rediss://default:your-password@your-endpoint.upstash.io:6379`).
4. This connection URL is your production `REDIS_URL`.

#### 3. Deploy Backend (Render)
1. Sign up on [Render](https://render.com) (free, no credit card).
2. Create a **New** > **Web Service**.
3. Link your GitHub repository.
4. Set the following settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm run start`
   - **Instance Type**: `Free`
5. Click **Advanced** and add these Environment Variables:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *(Your Supabase Connection String)*
   - `REDIS_URL`: *(Your Upstash Connection URL)*
   - `SESSION_SECRET`: *(A random secure secret key)*
   - `FRONTEND_URL`: *(Your Vercel frontend URL, e.g., https://your-app.vercel.app)*
   - `PORT`: `10000`
   - `MIN_EMAIL_DELAY_MS`: `2000`
   - `MAX_EMAILS_PER_HOUR`: `200`
   - `WORKER_CONCURRENCY`: `5`
6. Click **Deploy Web Service**.
7. Copy your backend service URL (e.g., `https://reachinbox-api.onrender.com`).

#### 4. Run Database Migrations
Before using the app, push the schema to the Supabase database. In your local terminal, run:
```bash
# Set DATABASE_URL locally or run directly:
DATABASE_URL="your_supabase_connection_string" npx prisma db push --schema=backend/prisma/schema.prisma
```

#### 5. Deploy Frontend (Vercel)
1. Sign up on [Vercel](https://vercel.com) (free, no credit card).
2. Create a new project and import your GitHub repository.
3. In the **Environment Variables** section, add:
   - `VITE_API_URL`: *(Your Render Backend URL, e.g., https://reachinbox-api.onrender.com)*
4. Click **Deploy**.
5. Copy your frontend URL and update the `FRONTEND_URL` environment variable on your Render backend service.

#### 6. Keep Backend Awake 24/7 (cron-job.org)
Render's free tier spins down after 15 minutes of inactivity. To keep the background worker and API awake continuously:
1. Sign up on [cron-job.org](https://cron-job.org/) (free, no credit card).
2. Create a new cron job.
3. Set the target URL to your Render backend root endpoint: `https://your-api.onrender.com/`
4. Set the execution interval to every **10 minutes**.

---

### Free-Tier Limitations
- **Render Web Service**: Takes ~50 seconds to spin up from a cold start if it does sleep. Pinging it every 10 minutes prevents this.
- **Upstash Redis**: Limited to 10,000 requests/day, which is perfect for demonstration and testing.
- **Supabase**: Free database projects will pause after 1 week of inactivity (easily unpaused from the dashboard). Pinging the API keeps it active.
- **Google OAuth Redirect URIs**: You must update the authorized redirect URIs in Google Cloud Console to match your production URLs:
  - Authorized JavaScript Origin: `https://your-app.vercel.app`
  - Authorized Redirect URI: `https://your-api.onrender.com/api/auth/google/callback`
