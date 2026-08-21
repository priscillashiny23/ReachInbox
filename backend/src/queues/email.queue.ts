import { Queue } from "bullmq";
import { redisConfig } from "../config/redis";
import dotenv from "dotenv";

dotenv.config();

const maxAttempts = parseInt(process.env.QUEUE_MAX_ATTEMPTS || "3", 10);
const backoffMs = parseInt(process.env.QUEUE_BACKOFF_MS || "5000", 10);

export const EMAIL_QUEUE_NAME = "emailQueue";

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: maxAttempts,
    backoff: {
      type: "exponential",
      delay: backoffMs,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
