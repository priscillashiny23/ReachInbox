import dotenv from "dotenv";
dotenv.config();

// Override env vars BEFORE importing database/worker
process.env.MIN_EMAIL_DELAY_MS = "10";
process.env.MAX_EMAILS_PER_HOUR = "10";
process.env.RATE_LIMIT_WINDOW_MS = "5000"; // 5 seconds rate limit window!
process.env.WORKER_CONCURRENCY = "5";

import { schedulerService } from "./services/scheduler.service";
import { prisma } from "./config/db";
import { emailWorker } from "./workers/email.worker";
import { emailQueue } from "./queues/email.queue";
import { emailService } from "./services/email.service";

// Mock sendEmail to resolve instantly
emailService.sendEmail = async () => {
  return {
    messageId: "mock-message-id",
    previewUrl: "https://ethereal.email/mock-preview"
  };
};

async function main() {
  console.log("=== Phase 6 Hourly Rate Limit Test ===");

  // Clear queue
  await emailQueue.drain(true);

  // Clear DB Email table
  await prisma.email.deleteMany({});

  // Clean up Redis throttle and rate keys
  const Redis = require("ioredis");
  const { redisConfig } = require("./config/redis");
  const redisClient = new Redis(redisConfig);
  const keys = await redisClient.keys("email:*");
  if (keys.length > 0) {
    await redisClient.del(...keys);
  }
  await redisClient.quit();

  // Get/Create Dev User and Sender
  let user = await prisma.user.findFirst({ where: { email: "dev-user@example.com" } });
  if (!user) {
    user = await prisma.user.create({
      data: { googleId: "dev", name: "Dev", email: "dev-user@example.com", avatar: "" }
    });
  }
  let sender = await prisma.sender.findFirst({ where: { email: process.env.ETHEREAL_USER || "dev-sender@example.com" } });
  if (!sender) {
    sender = await prisma.sender.create({
      data: { email: process.env.ETHEREAL_USER || "dev-sender@example.com", displayName: "Dev", etherealUser: "dev", etherealPassword: "dev" }
    });
  }

  // Schedule 25 emails
  const recipients = Array.from({ length: 25 }, (_, i) => `rate-recp-${i}@example.com`);
  console.log(`[Test] Scheduling 25 emails simultaneously...`);
  const startTime = new Date();
  
  const emails = await schedulerService.scheduleEmails({
    userId: user.id,
    senderId: sender.id,
    subject: "Rate Limit Test",
    body: "Rate limit verification",
    recipients,
    startTime
  });

  console.log(`[Test] Scheduled ${emails.length} emails. Processing via worker...`);

  // Wait for all 25 emails to be sent.
  // With a 5s window and limit of 10, the windows are:
  // Window 1: 10 emails
  // Window 2: 10 emails (after 5 seconds)
  // Window 3: 5 emails (after 10 seconds)
  // Total wait time should be around 12-15 seconds.
  let allDone = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const counts = await prisma.email.groupBy({
      by: ["status"],
      _count: true
    });
    console.log(`[Test] Status check:`, counts.map(c => `${c.status}: ${c._count}`).join(", "));
    
    const totalSent = await prisma.email.count({ where: { status: "SENT" } });
    if (totalSent === 25) {
      allDone = true;
      break;
    }
  }

  // Close worker
  await emailWorker.close();

  if (!allDone) {
    console.error("FAILED: Not all emails reached SENT state in time.");
    process.exit(1);
  }

  // Retrieve records and sort by sentAt
  const sentEmails = await prisma.email.findMany({
    orderBy: { sentAt: "asc" }
  });

  console.log("\n=== Rate Limiting Window Distribution ===");
  const windowSize = 5000;
  const distribution: { [windowId: number]: number } = {};

  sentEmails.forEach((email, idx) => {
    const sentTime = email.sentAt?.getTime() || 0;
    const windowId = Math.floor(sentTime / windowSize);
    distribution[windowId] = (distribution[windowId] || 0) + 1;
    console.log(`Email ${idx + 1}: sent at ${email.sentAt?.toISOString()} (absolute window ${windowId})`);
  });

  // Find all unique windows and sort them
  const sortedWindows = Object.keys(distribution)
    .map(Number)
    .sort((a, b) => a - b);

  console.log("\n=== Final Distribution Analysis ===");
  sortedWindows.forEach((wId, idx) => {
    console.log(`Window ${idx + 1} (absolute index ${wId}): ${distribution[wId]} emails`);
  });

  const count1 = distribution[sortedWindows[0]] || 0;
  const count2 = distribution[sortedWindows[1]] || 0;
  const count3 = distribution[sortedWindows[2]] || 0;

  if (count1 === 10 && count2 === 10 && count3 === 5) {
    console.log("PASSED: Hourly rate limiting and rescheduling distributed the jobs correctly across windows.");
  } else {
    console.log("FAILED: Distribution did not match expectation.");
  }

  process.exit(0);
}

main();
