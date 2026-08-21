import { schedulerService } from "./services/scheduler.service";
import { prisma } from "./config/db";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("=== Phase 5 Retry Strategy Test ===");

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

  // 1. Schedule email bypassing validation with an invalid address to force SMTP fail
  console.log("[Test] Scheduling email to malformed address 'invalid-email-format' to force SMTP error...");
  const emails = await schedulerService.scheduleEmails({
    userId: user.id,
    senderId: sender.id,
    subject: "SMTP Failure Retry Test",
    body: "This should fail SMTP and trigger retries.",
    recipients: ["invalid-email-format"], // Invalid format to force Nodemailer rejection
    startTime: new Date()
  });

  const emailId = emails[0].id;
  console.log(`[Test] Email scheduled in DB. ID: ${emailId}`);

  // Monitor attempts and status every 4 seconds
  console.log("[Test] Monitoring state transitions...");
  for (let i = 0; i < 6; i++) {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const record = await prisma.email.findUnique({ where: { id: emailId } });
    console.log(`[Test] Check ${i + 1}: status = ${record?.status}, attempts = ${record?.attempts}, errorMessage = ${record?.errorMessage}`);
  }

  const finalRecord = await prisma.email.findUnique({ where: { id: emailId } });
  console.log("\n=== Final Results ===");
  console.log(`Status: ${finalRecord?.status} (Expected: FAILED)`);
  console.log(`Attempts: ${finalRecord?.attempts} (Expected: 3)`);
  console.log(`Error Message: ${finalRecord?.errorMessage}`);

  if (finalRecord?.status === "FAILED" && finalRecord?.attempts === 3) {
    console.log("PASSED: SMTP failure retry test passed.");
  } else {
    console.log("FAILED: Retry behavior did not match expectations.");
  }

  process.exit(0);
}

main();
