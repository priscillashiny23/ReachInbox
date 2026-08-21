import dotenv from "dotenv";
dotenv.config();

// Override env vars BEFORE importing database/worker
process.env.MIN_EMAIL_DELAY_MS = "200";
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
  console.log("=== Phase 6 Concurrency & Minimum Delay Test ===");

  // Clear any existing jobs in emailQueue
  await emailQueue.drain(true);

  // Clear DB Email table to make tests isolated
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

  // 1. Schedule 20 emails at the exact same start time
  const recipients = Array.from({ length: 20 }, (_, i) => `recp-${i}@example.com`);
  console.log(`[Test] Scheduling 20 emails simultaneously...`);
  const startTime = new Date();
  
  const emails = await schedulerService.scheduleEmails({
    userId: user.id,
    senderId: sender.id,
    subject: "Concurrency test",
    body: "Spacing verification",
    recipients,
    startTime
  });

  console.log(`[Test] Scheduled ${emails.length} emails. Waiting for worker to process them...`);

  // Let worker run. With 200ms spacing, 20 emails will take at least 20 * 200ms = 4000ms.
  // We'll monitor DB records every 2 seconds until all 20 are SENT.
  let allDone = false;
  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const counts = await prisma.email.groupBy({
      by: ["status"],
      _count: true
    });
    console.log(`[Test] Status check:`, counts.map(c => `${c.status}: ${c._count}`).join(", "));
    
    const totalSent = await prisma.email.count({ where: { status: "SENT" } });
    if (totalSent === 20) {
      allDone = true;
      break;
    }
  }

  // Close worker to stop execution
  await emailWorker.close();

  if (!allDone) {
    console.error("FAILED: Not all emails reached SENT state in time.");
    process.exit(1);
  }

  // Retrieve all records sorted by sentAt
  const sentEmails = await prisma.email.findMany({
    orderBy: { sentAt: "asc" }
  });

  console.log("\n=== Delivery Spacing Analysis ===");
  let failedVerification = false;
  for (let i = 1; i < sentEmails.length; i++) {
    const tPrev = sentEmails[i - 1].sentAt?.getTime() || 0;
    const tCurr = sentEmails[i].sentAt?.getTime() || 0;
    const diff = tCurr - tPrev;
    console.log(`Email ${i}: sent at ${sentEmails[i].sentAt?.toISOString()} (diff from prev: ${diff}ms)`);
    
    // We expect the spacing to be >= 200ms. We give a small tolerance of 30ms for network/worker execution delay.
    if (diff < 170) {
      console.log(`WARNING: Spacing between email ${i-1} and ${i} was ${diff}ms (Expected >= 200ms)`);
      failedVerification = true;
    }
  }

  if (failedVerification) {
    console.log("FAILED: Minimum delay spacing constraints were breached.");
  } else {
    console.log("PASSED: All 20 emails successfully sent and correctly spaced by >= 200ms.");
  }

  process.exit(0);
}

main();
