# ReachInbox – Full-Stack Email Job Scheduler

A production-style full-stack email scheduling application built for the ReachInbox Software Development Intern Assignment.

The application allows users to authenticate using Google, compose and schedule emails, process them asynchronously using BullMQ and Redis, enforce configurable rate limits and delays, and view scheduled/sent emails through a React dashboard.

---

# 🚀 Live Application

### Frontend

**Live Demo:** https://reach-inbox-livid.vercel.app/

### Deployment Stack

* **Frontend:** Vercel
* **Backend:** Render
* **Database:** PostgreSQL on Supabase
* **Redis:** Upstash Redis
* **Source Code:** GitHub

---

# 🛠️ Tech Stack

## Frontend

* React.js
* TypeScript
* Tailwind CSS
* Vite
* Axios

## Backend

* Node.js
* Express.js
* TypeScript
* Prisma ORM
* BullMQ
* Redis
* Google OAuth
* Express Session

## Infrastructure

* **Vercel** – Frontend deployment
* **Render** – Backend deployment
* **Supabase** – PostgreSQL database
* **Upstash Redis** – Persistent Redis instance
* **GitHub** – Source control

---

# ✨ Features

* Google OAuth authentication
* Email scheduling
* CSV/text recipient upload
* BullMQ delayed jobs
* Redis-backed persistent queue
* Configurable worker concurrency
* Configurable minimum email delay
* Redis-backed hourly rate limiting
* Automatic retry handling
* Email idempotency
* Scheduled emails dashboard
* Sent emails dashboard
* Loading and empty states
* PostgreSQL persistence
* Production deployment using Vercel and Render

---

# 🏗️ Architecture

```text
                    ┌────────────────────┐
                    │      Vercel        │
                    │   React Frontend   │
                    └─────────┬──────────┘
                              │
                              │ HTTPS
                              ▼
                    ┌────────────────────┐
                    │      Render        │
                    │ Express + Node.js  │
                    └──────┬───────┬─────┘
                           │       │
             ┌─────────────┘       └─────────────┐
             ▼                                   ▼
    ┌─────────────────┐                  ┌─────────────────┐
    │    Supabase     │                  │  Upstash Redis  │
    │   PostgreSQL    │                  │                 │
    └─────────────────┘                  │ BullMQ + Queue  │
                                         │ Rate Limiting   │
                                         └────────┬────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────┐
                                         │  BullMQ Worker  │
                                         │ Email Processor │
                                         └─────────────────┘
```

---

# 📧 Email Scheduling Flow

```text
User
 ↓
React Dashboard
 ↓
Schedule API
 ↓
PostgreSQL Email Record
 ↓
BullMQ Delayed Job
 ↓
Redis
 ↓
BullMQ Worker
 ↓
Rate Limit / Delay Check
 ↓
Email Provider
 ↓
PostgreSQL Status Update
 ↓
Dashboard
```

---

# 🚦 Rate Limiting

The system uses Redis-backed rate limiting to coordinate multiple workers.

Configuration:

```env
WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=200
```

The Redis rate limiter atomically checks:

1. Minimum delay between sends
2. Current hourly send count
3. Available send slot

If the hourly limit is reached, emails are rescheduled instead of being permanently dropped.

---

# 🔄 Persistence & Restart Handling

BullMQ jobs are persisted in Redis while email state is stored in PostgreSQL.

If the backend is restarted:

```text
Pending Jobs
     ↓
Redis
     ↓
Backend Restart
     ↓
BullMQ Reconnects
     ↓
Pending Jobs Continue
```

Emails that have already been sent are identified through their database status and are not processed again.

---

# ☁️ Deployment

### Frontend – Vercel

Live frontend:

[ReachInbox Dashboard](https://reach-inbox-livid.vercel.app/?utm_source=chatgpt.com)

### Backend – Render

The Express backend is deployed on Render and connects to the managed PostgreSQL and Redis services.

### Database – Supabase

PostgreSQL is hosted on Supabase and accessed through Prisma.

### Redis – Upstash

Upstash Redis provides the persistent Redis instance used by BullMQ and distributed rate limiting.

---

# 🔐 Security

Sensitive credentials are stored as environment variables and are not committed to GitHub.

Examples include:

```env
DATABASE_URL=...
REDIS_URL=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...
```

The `.env` file is excluded from version control.

---

# 🎯 Assignment Requirements

| Requirement        | Implementation         |
| ------------------ | ---------------------- |
| TypeScript Backend | Express + TypeScript   |
| React Frontend     | React + TypeScript     |
| PostgreSQL         | Supabase               |
| Persistent Queue   | BullMQ + Upstash Redis |
| Delayed Scheduling | BullMQ delayed jobs    |
| No Cron            | No cron jobs/libraries |
| Worker Concurrency | Configurable           |
| Minimum Delay      | Redis-backed           |
| Hourly Rate Limit  | Redis-backed           |
| Multiple Workers   | Supported              |
| Persistence        | PostgreSQL + Redis     |
| Idempotency        | Database status checks |
| Google Login       | Google OAuth           |
| Dashboard          | React                  |
| Deployment         | Vercel + Render        |

---

# 📹 Demo

The demo covers:

1. Google login
2. Dashboard
3. Creating an email campaign
4. Uploading recipients
5. Configuring scheduling options
6. Scheduling emails
7. Viewing scheduled emails
8. Background processing through BullMQ
9. Viewing sent emails
10. Restart/persistence behavior
11. Rate limiting and delay behavior

---

# 👩‍💻 Author

**Priscilla**

Built as part of the ReachInbox Full-Stack Software Development Intern Assignment.
