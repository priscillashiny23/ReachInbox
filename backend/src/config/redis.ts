import dotenv from "dotenv";

dotenv.config();

export const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  maxRetriesPerRequest: null, // Required by BullMQ
};
