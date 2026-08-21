import { emailService } from "./services/email.service";

async function main() {
  console.log("Sending test email via EmailService...");
  try {
    const result = await emailService.sendEmail({
      to: "test-recipient@example.com",
      subject: "ReachInbox Ethereal SMTP Test",
      text: "Hello from ReachInbox email service! This is a verification mail.",
      html: "<p>Hello from <b>ReachInbox</b> email service! This is a verification mail.</p>",
    });

    console.log("Email sent successfully!");
    console.log(`Message ID: ${result.messageId}`);
    console.log(`Preview URL: ${result.previewUrl}`);
  } catch (error) {
    console.error("Failed to send email:", error);
    process.exit(1);
  }
}

main();
