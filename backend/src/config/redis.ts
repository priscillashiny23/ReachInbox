import dotenv from "dotenv";
import Redis from "ioredis";

dotenv.config();

export const redisConfig: any = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      maxRetriesPerRequest: null, // Required by BullMQ
    };

export const createRedisInstance = () => {
  const url = process.env.REDIS_URL;
  if (url) {
    return new Redis(url, {
      maxRetriesPerRequest: null,
      tls: url.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
    });
  }
  return new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    maxRetriesPerRequest: null,
  });
};

