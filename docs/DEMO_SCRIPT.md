# ReachInbox Email Scheduler Demo Script

This script outlines a concise, 5-minute video demonstration flow.

---

## Timeline & Presentation Guide

| Time | Segment | Actions / Talking Points |
| :--- | :--- | :--- |
| **0:00 - 0:20** | **Introduction** | - State your name and introduce the ReachInbox Full-Stack Email Scheduler.<br>- Highlight that the backend is built on TypeScript, Express, PostgreSQL, Redis, and BullMQ, and the frontend on React + Vite. |
| **0:20 - 0:50** | **Architecture Overview** | - Show the ASCII diagram in the `README.md`. Explain that delayed scheduling is managed via persistent BullMQ jobs in Redis. Rate limiting and minimum delays are coordinated using atomic Redis Lua scripts. |
| **0:50 - 1:20** | **Google OAuth Login** | - Open `http://localhost:5173/`. Click **Sign in with Google**.<br>- Complete Google authentication and show that the session redirects to the dashboard, displaying the user's name, email, and avatar. |
| **1:20 - 2:00** | **Compose Campaign & CSV Upload** | - Click **Compose Campaign**.<br>- Drag and drop the `docs/demo-emails.csv` file. Show that the uploader automatically parses the leads, removes invalid addresses, and filters out duplicates.<br>- Fill in the Subject, Body, select a Start Time, Spacing Delay (e.g. 5 seconds), and Hourly Rate Limit. |
| **2:00 - 2:30** | **Schedule Campaign** | - Click **Schedule Campaign**. Show the floating success toast.<br>- Navigate to the **Scheduled Emails** tab. Point out the scheduled emails with `Scheduled` badges and 0 attempts. |
| **2:30 - 3:10** | **Worker Processing** | - Show the background worker logs processing the enqueued emails one by one, respecting the spacing delay.<br>- Point out the database state transition: `SCHEDULED` -> `PROCESSING` -> `SENT`. |
| **3:10 - 3:40** | **Ethereal Delivery** | - Open the printed Ethereal mail logs or preview URL in the worker console.<br>- Show the actual email subject, body, and headers delivered through Ethereal SMTP. |
| **3:40 - 4:10** | **Sent History Logs** | - Go to the **Sent History** tab on the React dashboard.<br>- Show the sent emails with `Sent` badges, precise dispatch times, and attempts count. |
| **4:10 - 4:40** | **Restart & Persistence Demonstration** | - Kill the Express API server and the Worker process.<br>- Point out that the scheduled jobs remain safely enqueued in Redis (thanks to Docker persistent volumes).<br>- Start the worker back up and show that it successfully picks up and resumes sending. |
| **4:40 - 5:00** | **Concurrency & Conclusion** | - Highlight how concurrent worker workers (e.g. concurrency = 5) safely process high-volume emails without resource lock issues.<br>- Click **Logout** to demonstrate session termination and redirect back to the onboarding login page. |
