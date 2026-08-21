import { emailQueue } from "./queues/email.queue";
import { prisma } from "./config/db";

async function main() {
  console.log("Starting idempotency test...");

  // 1. Find an email that is already marked as SENT
  const sentEmail = await prisma.email.findFirst({
    where: { status: "SENT" },
  });

  if (!sentEmail) {
    console.error("No SENT email found. Run test-scheduling.ts first!");
    process.exit(1);
  }

  console.log(`Found SENT email in DB: ID = ${sentEmail.id}, recipient = ${sentEmail.recipientEmail}`);

  // 2. Queue another job with this same emailId.
  // Note: We use a different jobId (timestamped) to bypass Redis-level deduplication,
  // focusing testing specifically on our worker-level database-check idempotency rule.
  const job = await emailQueue.add(
    "sendEmail",
    { emailId: sentEmail.id },
    { jobId: `test-idempotency-${Date.now()}` }
  );

  console.log(`Enqueued duplicate job ${job.id} targeting emailId ${sentEmail.id}`);
  console.log("Wait 5 seconds and inspect worker logs...");
  await new Promise((resolve) => setTimeout(resolve, 5000));
  console.log("Done.");
}

main();
