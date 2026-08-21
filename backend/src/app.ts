import express from "express";
import cors from "cors";
import session from "express-session";

import { emailQueue } from "./queues/email.queue";
import { emailService } from "./services/email.service";
import emailRoutes from "./routes/email.routes";
import authRoutes from "./routes/auth.routes";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "reachinbox_default_session_secret_123!_@",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/emails", emailRoutes);

app.get("/", (_req, res) => {
  res.json({
    message: "ReachInbox Scheduler API is running"
  });
});

app.post("/api/test-job", async (req, res) => {
  try {
    const { message = "Hello, world!" } = req.body;
    const job = await emailQueue.add("testJob", { message, timestamp: Date.now() });
    console.log(`[Express] Enqueued test job: ${job.id}`);
    res.json({
      success: true,
      jobId: job.id,
      name: job.name,
      data: job.data,
    });
  } catch (error: any) {
    console.error("[Express] Failed to add test job:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/test-email", async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;

    if (!to || !subject || !text) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: 'to', 'subject', and 'text' must be provided."
      });
      return;
    }

    console.log(`[Express] Sending test email to ${to}...`);
    const result = await emailService.sendEmail({ to, subject, text, html });

    res.json({
      success: true,
      messageId: result.messageId,
      previewUrl: result.previewUrl,
    });
  } catch (error: any) {
    console.error("[Express] Failed to send test email:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
// Reload trigger after database schema updates for isStarred and isArchived