import { Queue, Worker, Job } from "bullmq";
import { redisConfig } from "./config/redis";

const q = new Queue("scratchQueue", { 
  connection: redisConfig,
  defaultJobOptions: { removeOnComplete: true }
});

async function main() {
  await q.drain(true);

  const w = new Worker(
    "scratchQueue",
    async (job: Job) => {
      console.log(`[Worker] Processing job ${job.id}, data:`, job.data);
      if (job.data.reschedule) {
        console.log(`[Worker] Returning reschedule request...`);
        return { rescheduled: true, delay: 3000 };
      }
      console.log(`[Worker] Job ${job.id} completed successfully.`);
      return { success: true };
    },
    { 
      connection: redisConfig
    }
  );

  w.on("completed", async (job) => {
    console.log(`[Event completed] Job ${job.id} completed with result:`, job.returnvalue);
    if (job.returnvalue && job.returnvalue.rescheduled) {
      const delay = job.returnvalue.delay;
      console.log(`[Event completed] Attempting to re-enqueue ${job.id} with delay ${delay}...`);
      try {
        const newJob = await q.add(
          job.name,
          { ...job.data, reschedule: false },
          { jobId: job.id, delay }
        );
        console.log(`[Event completed] Re-enqueued job ${newJob.id} successfully!`);
      } catch (err: any) {
        console.error(`[Event completed] Error re-enqueuing:`, err.message);
      }
    }
  });

  console.log("Adding job to scratchQueue...");
  await q.add("test", { reschedule: true }, { jobId: "test-job-id-3" });

  await new Promise((resolve) => setTimeout(resolve, 8000));
  await w.close();
  process.exit(0);
}

main();
