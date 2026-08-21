# ReachInbox Project Submission Checklist

Use this checklist to ensure all code, credentials, and assets are fully prepared before finalizing submission.

---

## Pre-Submission Verification

- [ ] **GitHub Repository Configured**
  - Create a private repository.
  - Add relevant reviewers/collaborators from ReachInbox.
- [ ] **README.md Complete**
  - Architecture diagram, prerequisite software, setup guides, and rate-limiting limits described.
- [ ] **Credential Protection**
  - Verified that local `.env` configuration files are NOT committed to git.
  - Verified that `.env.example` placeholder files are committed and contain zero secrets.
- [ ] **Build Verification**
  - Backend compiles successfully (`npm run build` exits with code 0).
  - Frontend compiles successfully (`npm run build` exits with code 0).
- [ ] **Database Setup Verification**
  - Prisma migrations run clean (`npx prisma migrate status` or `db push`).
  - Schema contains necessary indexes and relation settings.
- [ ] **BullMQ & Redis Verification**
  - Docker Compose starts Postgres and Redis.
  - Redis data volume is persisted locally.
  - Redis is coordinating spacing delay and hourly rate limits correctly.
- [ ] **Google OAuth Setup**
  - App redirects client to Google login.
  - Session cookie is successfully established on redirect callback.
- [ ] **Ethereal Delivery**
  - Emails dispatch through Nodemailer to Ethereal SMTP.
  - Ethereal console prints preview URLs.
- [ ] **Scheduling & Worker Resilience**
  - Asynchronous dispatch queue processes multiple emails without dropped jobs.
  - Future tasks survive database/worker/server restarts.
- [ ] **Demo Video Recording**
  - 5-minute video recorded following `docs/DEMO_SCRIPT.md`.
  - Video uploaded to Google Drive/Loom/YouTube (set access to unlisted/anyone with link).
- [ ] **Final Submission Form**
  - ClickUp / Application submission form filled out.
  - Included repository link and video demo URL.
