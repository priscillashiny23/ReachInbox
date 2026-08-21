import { Worker, Job } from "bullmq";
import { createRedisInstance } from "../config/redis";
import { prisma } from "../config/db";
import { emailService } from "../services/email.service";
import { emailQueue } from "../queues/email.queue";
import dotenv from "dotenv";
import Redis from "ioredis";

dotenv.config();

const workerConcurrency = parseInt(process.env.WORKER_CONCURRENCY || "5", 10);

const redisClient = createRedisInstance();

const rateLimitLua = `
local nextSendAtKey = KEYS[1]
local rateKey = KEYS[2]
local now = tonumber(ARGV[1])
local minDelay = tonumber(ARGV[2])
local maxPerHour = tonumber(ARGV[3])

-- 1. Check nextSendAt (Minimum Delay Check)
local nextSendAt = redis.call('GET', nextSendAtKey)
local nextSlot = now
if nextSendAt then
    nextSlot = math.max(now, tonumber(nextSendAt))
end

if nextSlot > now then
    return { "THROTTLED", string.format("%.0f", nextSlot) }
end

-- 2. Check Hourly Rate Limit
local currentCount = redis.call('GET', rateKey)
if currentCount then
    currentCount = tonumber(currentCount)
else
    currentCount = 0
end

if currentCount >= maxPerHour then
    return { "LIMIT_REACHED", tostring(currentCount) }
end

-- 3. Atomic Allocation
redis.call('INCR', rateKey)
redis.call('EXPIRE', rateKey, 7200)

local updatedNextSendAt = now + minDelay
redis.call('SET', nextSendAtKey, string.format("%.0f", updatedNextSendAt))

return { "ALLOWED", string.format("%.0f", now) }
`;

redisClient.defineCommand("checkAndReserveEmailSlot", {
  numberOfKeys: 2,
  lua: rateLimitLua,
});

export const emailWorker = new Worker(
  "emailQueue",
  async (job: Job) => {
    console.log(`[Worker] Processing job ${job.id} (name: ${job.name})...`);

    // Keep support for legacy test jobs
    if (job.name === "testJob") {
      console.log(`[Worker] Test job data:`, job.data);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log(`[Worker] Test job ${job.id} processed successfully!`);
      return { success: true };
    }

    // Real email sending job
    const { emailId } = job.data;
    if (!emailId) {
      throw new Error("Job missing emailId in data");
    }

    // 1. Retrieve Email from Prisma
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: { sender: true },
    });

    if (!email) {
      throw new Error(`Email record with ID ${emailId} not found in database`);
    }

    // 2. Idempotency Check (status === SENT)
    if (email.status === "SENT") {
      console.log(`[Worker] Email ${emailId} already SENT, skipping`);
      return { success: true, alreadySent: true };
    }

    // 3. Atomically update status to PROCESSING where status is SCHEDULED or FAILED (Claiming step)
    console.log(`[Worker] Claiming email ${emailId}`);
    const claimResult = await prisma.email.updateMany({
      where: {
        id: emailId,
        status: { in: ["SCHEDULED", "FAILED"] },
      },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
      },
    });

    if (claimResult.count === 0) {
      console.log(`[Worker] Email ${emailId} already claimed or processed. Skipping.`);
      return { success: true, skipped: true };
    }

    // Check minimum delay & hourly rate limiting
    const nowTime = Date.now();
    const minDelay = job.data.minDelay ?? parseInt(process.env.MIN_EMAIL_DELAY_MS || "2000", 10);
    const maxPerHour = job.data.maxPerHour ?? parseInt(process.env.MAX_EMAILS_PER_HOUR || "200", 10);
    // Rate limit window defaults to 1 hour (3,600,000 ms)
    const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "3600000", 10);

    const windowIndex = Math.floor(nowTime / rateLimitWindowMs);
    const senderId = email.senderId;
    const nextSendAtKey = `email:throttle:${senderId}:nextSendAt`;
    const rateKey = `email:rate:${senderId}:${windowIndex}`;

    const [status, timeOrCount] = await (redisClient as any).checkAndReserveEmailSlot(
      nextSendAtKey,
      rateKey,
      nowTime,
      minDelay,
      maxPerHour
    );

    if (status === "THROTTLED") {
      const targetTime = parseInt(timeOrCount, 10);
      const delay = Math.max(0, targetTime - nowTime);

      console.log(`[Throttle] Email ${emailId} assigned send slot ${new Date(targetTime).toISOString()}`);
      console.log(`[RateLimiter] Rescheduling email ${emailId} for ${new Date(targetTime).toISOString()}`);

      // Revert status back to SCHEDULED
      await prisma.email.update({
        where: { id: emailId },
        data: { status: "SCHEDULED" },
      });

      return { rescheduled: true, delay, emailId };
    }

    if (status === "LIMIT_REACHED") {
      const nextWindowStart = (windowIndex + 1) * rateLimitWindowMs;
      const delay = Math.max(0, nextWindowStart - nowTime);

      console.log(`[RateLimiter] Sender ${senderId} hourly limit reached`);
      console.log(`[RateLimiter] Rescheduling email ${emailId} for ${new Date(nextWindowStart).toISOString()}`);

      // Revert status back to SCHEDULED
      await prisma.email.update({
        where: { id: emailId },
        data: { status: "SCHEDULED" },
      });

      return { rescheduled: true, delay, emailId };
    }

    // Allowed to proceed!
    console.log(`[RateLimiter] Sender ${senderId} allowed email ${emailId}`);

    try {
      console.log(`[Worker] Sending email ${emailId}`);

      // 4. Send using EmailService
      const sendResult = await emailService.sendEmail({
        to: email.recipientEmail,
        subject: email.subject,
        text: email.body,
        html: email.body.includes("<") && email.body.includes(">") ? email.body : undefined,
        attachments: email.attachments ? (email.attachments as any) : undefined,
      });

      console.log(`[Worker] Email ${emailId} sent successfully`);
      if (sendResult.previewUrl) {
        console.log(`[Worker] Preview URL for email ${emailId}: ${sendResult.previewUrl}`);
      }

      // 5. Update Email status to SENT
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: "SENT",
          sentAt: new Date(nowTime),
          errorMessage: null, // Clear error message on success
        },
      });

      return { success: true, messageId: sendResult.messageId, previewUrl: sendResult.previewUrl };
    } catch (sendError: any) {
      console.log(`[Worker] Email ${emailId} failed: ${sendError.message}`);

      // 6. Update Email status to FAILED and record error message
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: "FAILED",
          errorMessage: sendError.message,
        },
      });

      throw sendError; // Re-throw to trigger BullMQ's automatic retry logic
    }
  },
  {
    connection: createRedisInstance(),
    concurrency: workerConcurrency,
  }
);

emailWorker.on("completed", async (job) => {
  console.log(`[Worker] Job ${job.id} completed!`);
  if (job.returnvalue && job.returnvalue.rescheduled) {
    const { emailId, delay } = job.returnvalue;
    try {
      const newJobId = `email-${emailId}-resched-${Date.now()}`;
      console.log(`[Worker] Re-enqueuing rescheduled job ${job.id} as ${newJobId} with delay ${delay} ms`);
      
      const newJob = await emailQueue.add(
        "sendEmail",
        { 
          emailId,
          minDelay: job.data.minDelay,
          maxPerHour: job.data.maxPerHour
        },
        {
          jobId: newJobId,
          delay: delay,
        }
      );

      // Update the DB with the new Job ID
      await prisma.email.update({
        where: { id: emailId },
        data: { bullmqJobId: newJob.id }
      });
    } catch (err: any) {
      console.error(`[Worker] Error re-enqueuing rescheduled job ${job.id}:`, err.message);
    }
  }
});

emailWorker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed with error: ${err.message}`);
});

console.log(`[Worker] Email worker started with concurrency = ${workerConcurrency}`);
