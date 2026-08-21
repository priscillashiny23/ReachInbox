import { schedulerService } from "./services/scheduler.service";
import { prisma } from "./config/db";
import { emailQueue } from "./queues/email.queue";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("=== Phase 5 Restart Scenario Test ===");
  
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

  // 1. Schedule email 30 seconds in the future
  const startTime = new Date(Date.now() + 30000);
  console.log(`[Test] Scheduling email to deliver in 30 seconds (at ${startTime.toISOString()})...`);
  const emails = await schedulerService.scheduleEmails({
    userId: user.id,
    senderId: sender.id,
    subject: "Restart Persistence Test",
    body: "This message should survive worker restarts!",
    recipients: ["restart-test@example.com"],
    startTime: startTime
  });

  const emailId = emails[0].id;
  const jobId = emails[0].bullmqJobId!;

  // 2. Confirm Email record exists in DB
  const dbRecord = await prisma.email.findUnique({ where: { id: emailId } });
  console.log(`[Test] DB Record check: status = ${dbRecord?.status} (Expected: SCHEDULED)`);

  // 3. Confirm job exists in BullMQ
  const job = await emailQueue.getJob(jobId);
  if (job) {
    console.log(`[Test] BullMQ Job check: Job exists with ID ${job.id}. State: ${await job.getState()} (Expected: delayed)`);
  } else {
    console.error(`[Test] FAILED: BullMQ Job ${jobId} not found!`);
    process.exit(1);
  }

  console.log("\n=================== ACTION REQUIRED ===================");
  console.log("Please restart your Express API server and your Worker process now!");
  console.log("You have 15 seconds to restart them before the check resumes.");
  console.log("=======================================================\n");

  await new Promise((resolve) => setTimeout(resolve, 15000));

  console.log("\nResuming checks...");

  // 7. Confirm delayed job still exists
  const jobAfterRestart = await emailQueue.getJob(jobId);
  if (jobAfterRestart) {
    console.log(`[Test] Post-restart check: Job still exists in Redis with ID ${jobAfterRestart.id}. State: ${await jobAfterRestart.getState()}`);
  } else {
    console.error(`[Test] Post-restart check: Job not found!`);
  }

  console.log("Waiting 20 seconds for the scheduled execution time...");
  await new Promise((resolve) => setTimeout(resolve, 20000));

  // 11. Confirm PostgreSQL status becomes SENT
  const dbRecordFinal = await prisma.email.findUnique({ where: { id: emailId } });
  console.log(`\n[Test] Final DB Record status: ${dbRecordFinal?.status} (Expected: SENT)`);
  console.log(`[Test] sentAt timestamp: ${dbRecordFinal?.sentAt}`);
  if (dbRecordFinal?.status === "SENT") {
    console.log("PASSED: Restart persistence test completed successfully.");
  } else {
    console.log("FAILED: Email status was not updated to SENT.");
  }

  process.exit(0);
}

main();
