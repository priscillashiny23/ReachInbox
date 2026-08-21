# ReachInbox — Full-Stack Email Job Scheduler

A production-oriented email scheduling system built for the ReachInbox Software Development Intern assignment.

The application allows authenticated users to upload email leads, compose emails, schedule them for a specific start time, and monitor scheduled and sent emails through a React dashboard.

## 🚀 Features

### Backend

* TypeScript + Express.js REST API
* PostgreSQL database using Prisma ORM
* BullMQ persistent job queue
* Redis-backed job scheduling and rate limiting
* Configurable worker concurrency
* Configurable minimum delay between emails
* Configurable hourly email limit
* Per-sender rate limiting using Redis
* Atomic Redis Lua-based rate-limit allocation
* Idempotent email processing
* Automatic BullMQ retries
* Persistent delayed jobs across server restarts
* Google OAuth authentication
* Express sessions
* Email cancellation
* Email status tracking
* CSV/text lead processing
* Ethereal SMTP integration for test email delivery

### Frontend

* React + TypeScript
* Tailwind CSS
* Google Login
* User profile/avatar display
* Scheduled Emails dashboard
* Sent Emails dashboard
* Compose Email modal
* CSV/text lead upload
* Automatic email address detection
* Configurable start time
* Configurable delay between emails
* Configurable hourly limit
* Loading states
* Empty states
* Error handling
* Responsive dashboard UI

---

# 🏗 Architecture

```text
                         ┌─────────────────────┐
                         │   React Frontend     │
                         │ React + TypeScript   │
                         └──────────┬──────────┘
                                    │
                                    │ REST API
                                    ▼
                         ┌─────────────────────┐
                         │   Express Backend   │
                         │    TypeScript       │
                         └───────┬─────┬───────┘
                                 │     │
                    ┌────────────┘     └──────────────┐
                    ▼                                 ▼
           ┌─────────────────┐               ┌─────────────────┐
           │   PostgreSQL    │               │      Redis      │
           │     Prisma      │               │     Upstash     │
           └─────────────────┘               └────────┬────────┘
                                                       │
                                                       │ BullMQ
                                                       ▼
                                              ┌─────────────────┐
                                              │  Email Worker   │
                                              │   Concurrency   │
                                              └────────┬────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │ Ethereal SMTP   │
                                              └─────────────────┘
```

---

# 📁 Project Structure

```text
ReachInbox/
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   │
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.ts
│   │   │   └── redis.ts
│   │   │
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── queues/
│   │   │   └── email.queue.ts
│   │   │
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── email.service.ts
│   │   │   └── scheduler.service.ts
│   │   │
│   │   ├── workers/
│   │   │   └── email.worker.ts
│   │   │
│   │   ├── app.ts
│   │   └── ...
│   │
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── ...
│   │
│   ├── package.json
│   └── ...
│
└── README.md
```

---

# ⚙️ Backend Setup

## Requirements

* Node.js 18+
* PostgreSQL
* Redis
* npm

Redis and PostgreSQL can be run locally using Docker, or managed services such as Supabase PostgreSQL and Upstash Redis can be used.

## Install dependencies

```bash
cd backend
npm install
```

## Environment Variables

Create:

```text
backend/.env
```

using `.env.example` as a template.

Example:

```env
DATABASE_URL=postgresql://username:password@host:5432/database

REDIS_URL=redis://localhost:6379

WORKER_CONCURRENCY=5

MIN_EMAIL_DELAY_MS=2000

MAX_EMAILS_PER_HOUR=200

RATE_LIMIT_WINDOW_MS=3600000

QUEUE_MAX_ATTEMPTS=3

QUEUE_BACKOFF_MS=5000

ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=your_ethereal_username
ETHEREAL_PASSWORD=your_ethereal_password
ETHEREAL_FROM=your_ethereal_username

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

FRONTEND_URL=http://localhost:5173

SESSION_SECRET=your_session_secret
```

Never commit `.env` or real credentials to GitHub.

---

# 🗄️ Database Setup

The project uses Prisma with PostgreSQL.

Run:

```bash
npx prisma generate
```

Then apply the database schema:

```bash
npx prisma migrate dev
```

For a production database:

```bash
npx prisma migrate deploy
```

---

# ▶️ Running the Backend

Start the development server:

```bash
npm run dev
```

The API runs on:

```text
http://localhost:5000
```

The root endpoint can be checked using:

```text
GET /
```

Expected response:

```json
{
  "message": "ReachInbox Scheduler API is running"
}
```

---

# 📬 Email Scheduling Flow

When a user schedules emails:

```text
1. User logs into dashboard
          ↓
2. User composes email
          ↓
3. CSV/text leads are uploaded
          ↓
4. Frontend extracts email addresses
          ↓
5. Schedule request sent to Express API
          ↓
6. Email records stored in PostgreSQL
          ↓
7. BullMQ delayed jobs created
          ↓
8. Redis persists the jobs
          ↓
9. Worker picks up jobs at scheduled time
          ↓
10. Redis rate limiter assigns a send slot
          ↓
11. Email sent through Ethereal SMTP
          ↓
12. Database status updated to SENT/FAILED
          ↓
13. Dashboard displays updated status
```

No cron jobs are used.

---

# ⏰ Persistent Scheduling

BullMQ delayed jobs are used instead of cron jobs.

Each scheduled email is stored in PostgreSQL and represented by a BullMQ job stored in Redis.

For example:

```text
Email scheduled:
10:00 PM

BullMQ:
delay = time until 10:00 PM

Redis:
stores the delayed job
```

If the application server restarts before 10:00 PM:

```text
Server stops
     ↓
Redis retains BullMQ job
     ↓
Server starts again
     ↓
Worker reconnects to Redis
     ↓
BullMQ resumes processing
```

Therefore scheduled jobs do not need to be recreated after a restart.

---

# 🔁 Idempotency

The worker prevents duplicate email sends by checking the database status before processing an email.

If an email is already marked:

```text
SENT
```

the worker skips it.

The worker also atomically claims scheduled emails using a database update.

Conceptually:

```text
SCHEDULED
    ↓
PROCESSING
    ↓
SENT
```

If another worker attempts to claim the same email, the database update prevents both workers from processing it simultaneously.

This provides protection against duplicate processing when multiple workers are running.

---

# ⚡ Worker Concurrency

Worker concurrency is configurable through:

```env
WORKER_CONCURRENCY=5
```

The BullMQ worker is initialized with the configured concurrency.

For example:

```text
WORKER_CONCURRENCY=5
```

allows up to five jobs to be processed concurrently.

Concurrency is combined with Redis-backed rate limiting so multiple workers can safely operate against the same sender limits.

---

# ⏱️ Minimum Delay Between Emails

The application supports a configurable minimum delay between individual email sends.

Default:

```env
MIN_EMAIL_DELAY_MS=2000
```

This represents:

```text
2 seconds minimum delay
```

between email send slots for a sender.

The actual slot allocation is performed using Redis so that the delay is respected even when multiple workers are processing jobs concurrently.

---

# 🚦 Hourly Rate Limiting

The application supports a configurable hourly email limit.

Example:

```env
MAX_EMAILS_PER_HOUR=200
```

The rate limit is maintained per sender.

Redis keys are based on the sender and hourly window:

```text
email:rate:<senderId>:<window>
```

A separate Redis key tracks the next available send slot:

```text
email:throttle:<senderId>:nextSendAt
```

This means multiple workers or backend instances share the same rate-limit state.

---

# 🔐 Atomic Rate Limiting with Redis Lua

The rate limiter uses a Redis Lua script to perform the following operations atomically:

1. Check the next available send time.
2. Check the current hourly count.
3. Reserve a send slot.
4. Increment the hourly counter.
5. Set the next available send timestamp.

This prevents race conditions such as:

```text
Worker A → sees 199 emails
Worker B → sees 199 emails

Both attempt to send

❌ Potentially 201 emails
```

Instead, Redis performs the allocation atomically.

---

# 📈 Behavior Under Load

The system is designed to handle large batches such as 1000+ emails scheduled for approximately the same time.

Example:

```text
1000 emails
      ↓
1000 BullMQ delayed jobs
      ↓
Workers process jobs concurrently
      ↓
Redis controls send slots
      ↓
200 emails/hour maximum
      ↓
Remaining emails remain queued/rescheduled
```

Emails are not dropped when the hourly limit is reached.

They are rescheduled for the next available rate-limit window.

This allows the system to preserve pending work rather than permanently failing jobs because of temporary throttling.

---

# 🔄 Retry Handling

BullMQ jobs are configured with retry behavior.

Example:

```env
QUEUE_MAX_ATTEMPTS=3
QUEUE_BACKOFF_MS=5000
```

If an email provider temporarily fails:

```text
Attempt 1
   ↓
Failure
   ↓
Backoff
   ↓
Attempt 2
   ↓
Failure
   ↓
Backoff
   ↓
Attempt 3
```

The email database record is updated with the failure information.

---

# 📧 Ethereal Email

The application uses Ethereal Email as the fake SMTP provider required by the assignment.

Ethereal does not deliver messages to real recipients. Instead, messages can be inspected through the Ethereal preview URL.

Create an Ethereal account and configure:

```env
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=your_username
ETHEREAL_PASSWORD=your_password
ETHEREAL_FROM=your_username
```

The backend uses Nodemailer to communicate with the Ethereal SMTP server.

---

# 🔑 Google OAuth

The dashboard uses real Google OAuth authentication.

The OAuth flow is:

```text
User
 ↓
Google Login
 ↓
Google OAuth consent
 ↓
Callback endpoint
 ↓
User information stored/loaded
 ↓
Session created
 ↓
Dashboard
```

Configure the following environment variables:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=...
```

For local development:

```text
http://localhost:5000/api/auth/google/callback
```

The frontend URL should also be configured:

```env
FRONTEND_URL=http://localhost:5173
```

---

# 🖥️ Frontend Setup

Install dependencies:

```bash
cd frontend
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend normally runs at:

```text
http://localhost:5173
```

---

# ✉️ Compose Email

The Compose Email interface allows the user to:

* Enter an email subject
* Enter an email body
* Upload a CSV/text lead file
* Detect email addresses
* Display the number of detected recipients
* Select a start time
* Configure delay between emails
* Configure hourly email limit
* Schedule the emails

Example:

```text
Subject:
Welcome to ReachInbox

Recipients:
100 email addresses

Start:
10:00 PM

Delay:
2000 ms

Hourly limit:
200
```

---

# 📋 Scheduled Emails

The Scheduled Emails section displays:

* Recipient email
* Subject
* Scheduled time
* Current status

Possible states include:

```text
SCHEDULED
PROCESSING
```

Loading and empty states are provided for better UX.

---

# 📤 Sent Emails

The Sent Emails section displays:

* Recipient email
* Subject
* Sent time
* Status

Possible final states:

```text
SENT
FAILED
```

Failed emails retain their error message in the database for debugging.

---

# 🧪 Testing

The backend includes test utilities for validating scheduler behavior and worker concurrency.

The concurrency/delay test schedules multiple emails at the same time and verifies that the configured minimum delay is respected.

Example configuration:

```env
MIN_EMAIL_DELAY_MS=200
WORKER_CONCURRENCY=5
```

The test verifies that multiple jobs can be processed concurrently while still respecting the Redis-based send-slot allocation.

---

# 🐳 Docker

PostgreSQL and Redis can be run locally using Docker.

Example:

```bash
docker compose up -d
```

Check running containers:

```bash
docker ps
```

Stop containers:

```bash
docker compose down
```

Managed PostgreSQL and Redis services can also be used instead of Docker.

---

# 🌐 Deployment

The backend can be deployed to a service such as Render.

The following environment variables must be configured in the deployment platform rather than committed to GitHub:

```text
DATABASE_URL
REDIS_URL
WORKER_CONCURRENCY
MIN_EMAIL_DELAY_MS
MAX_EMAILS_PER_HOUR
RATE_LIMIT_WINDOW_MS
QUEUE_MAX_ATTEMPTS
QUEUE_BACKOFF_MS
ETHEREAL_HOST
ETHEREAL_PORT
ETHEREAL_USER
ETHEREAL_PASSWORD
ETHEREAL_FROM
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL
FRONTEND_URL
SESSION_SECRET
```

The frontend deployment URL must match `FRONTEND_URL`.

Google OAuth authorized origins and redirect URLs must also be updated for the production deployment.

---

# 🔄 Restart Scenario

The application is designed so scheduled jobs survive application restarts.

Demo:

```text
1. Schedule an email for the future.
2. Confirm the email appears as SCHEDULED.
3. Stop the backend/worker.
4. Wait.
5. Restart the backend/worker.
6. BullMQ reconnects to Redis.
7. The pending job is recovered.
8. The worker processes the email.
9. Database status changes to SENT.
10. Dashboard displays the updated status.
```

Redis provides persistence for the BullMQ queue while PostgreSQL provides persistence for email state.

---

# 🛡️ Security

Sensitive credentials are stored using environment variables.

The following files should never be committed:

```text
.env
.env.local
```

The repository contains only:

```text
.env.example
```

with placeholder values.

Never commit:

* Database passwords
* Redis credentials
* Google OAuth secrets
* Ethereal credentials
* Session secrets
* API keys

---

# 📊 Assignment Requirement Mapping

| Assignment Requirement | Implementation                    |
| ---------------------- | --------------------------------- |
| TypeScript             | Backend + frontend                |
| Express.js             | Backend REST API                  |
| PostgreSQL/MySQL       | PostgreSQL + Prisma               |
| BullMQ                 | Persistent email job queue        |
| Redis                  | Upstash/local Redis               |
| No cron                | BullMQ delayed jobs               |
| Persistent scheduling  | Redis + PostgreSQL                |
| Worker concurrency     | Configurable BullMQ concurrency   |
| Minimum send delay     | Redis-backed send-slot allocation |
| Hourly rate limit      | Redis per-sender counters         |
| Multi-worker safe      | Atomic Redis Lua script           |
| Rescheduling           | BullMQ delayed re-enqueue         |
| Idempotency            | Database status/atomic claiming   |
| Retries                | BullMQ retry/backoff              |
| SMTP                   | Ethereal + Nodemailer             |
| Google Login           | Google OAuth                      |
| Dashboard              | React + TypeScript                |
| CSV/text leads         | Frontend lead parser              |
| Scheduled Emails       | Dashboard table                   |
| Sent Emails            | Dashboard table                   |
| Loading states         | Frontend                          |
| Empty states           | Frontend                          |
| Error handling         | API + UI                          |
| Restart persistence    | Redis/BullMQ                      |

---

# 🎯 Design Trade-offs

### Redis-backed rate limiting

Redis was selected because it provides fast shared state across workers and supports atomic Lua scripts.

### PostgreSQL + Prisma

PostgreSQL provides durable email state while Prisma provides type-safe database access.

### BullMQ delayed jobs

BullMQ was selected instead of cron because the assignment explicitly requires persistent queue-based scheduling.

### Per-sender throttling

Rate limits are maintained per sender instead of globally, allowing multiple senders to operate independently.

### Rescheduling instead of dropping

When a sender reaches the hourly limit, pending jobs are delayed rather than permanently failed.

---

# 📹 Demo Checklist

The recommended demonstration covers:

1. Google Login
2. Dashboard
3. Compose New Email
4. Upload CSV/text lead file
5. Show detected recipients
6. Configure start time
7. Configure delay
8. Configure hourly limit
9. Schedule emails
10. Show Scheduled Emails
11. Show BullMQ/worker logs
12. Show Redis-backed processing
13. Show Sent Emails
14. Demonstrate concurrency/rate limiting
15. Stop the worker/server
16. Restart the worker/server
17. Show that pending jobs are still processed

---

# 📝 Assumptions

* Ethereal is used for safe email testing and does not deliver emails to real recipients.
* Redis is used as the shared state layer for BullMQ and rate limiting.
* PostgreSQL is the source of truth for email records and statuses.
* Email sending is idempotent based on the database state and atomic claiming.
* Rate limits are configurable through environment variables.
* The system prioritizes reliability and persistence over maximum SMTP throughput.

---

# 👩‍💻 Tech Stack

### Frontend

* React
* TypeScript
* Tailwind CSS
* Vite

### Backend

* Node.js
* TypeScript
* Express.js
* BullMQ
* Nodemailer
* Prisma

### Infrastructure

* PostgreSQL
* Redis
* Docker
* Render
* Supabase
* Upstash Redis

### Authentication

* Google OAuth
* Express Session

---

# 📄 License

This project was developed as part of the ReachInbox Software Development Intern hiring assignment.
