import { prisma } from "./config/db";

async function main() {
  console.log("Testing database connection...");
  try {
    const timestamp = Date.now();
    // 1. Insert User
    const user = await prisma.user.create({
      data: {
        googleId: `test-google-id-${timestamp}`,
        name: "Test User",
        email: `testuser-${timestamp}@example.com`,
        avatar: "https://example.com/avatar.png",
      },
    });
    console.log("Successfully created user:", user);

    // 2. Insert Sender
    const sender = await prisma.sender.create({
      data: {
        email: `sender-${timestamp}@example.com`,
        displayName: "Test Sender",
        etherealUser: "ethereal-user",
        etherealPassword: "ethereal-password",
      },
    });
    console.log("Successfully created sender:", sender);

    // 3. Insert Email
    const email = await prisma.email.create({
      data: {
        userId: user.id,
        senderId: sender.id,
        recipientEmail: "recipient@example.com",
        subject: "Test Subject",
        body: "Test Body",
        scheduledAt: new Date(),
        status: "SCHEDULED",
      },
    });
    console.log("Successfully created email:", email);

    // 4. Retrieve Email with User and Sender relation
    const retrieved = await prisma.email.findUnique({
      where: { id: email.id },
      include: {
        user: true,
        sender: true,
      },
    });
    console.log("Retrieved email with relations:", retrieved);

    // 5. Clean up
    await prisma.email.delete({ where: { id: email.id } });
    await prisma.sender.delete({ where: { id: sender.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log("Cleanup completed successfully.");
    console.log("Database verification PASSED.");
  } catch (error) {
    console.error("Database verification FAILED:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
