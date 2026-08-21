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
