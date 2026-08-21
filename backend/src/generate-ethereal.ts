import nodemailer from "nodemailer";

async function main() {
  console.log("Generating Ethereal SMTP test account...");
  try {
    const account = await nodemailer.createTestAccount();
    console.log("\n================ ETHEREAL SMTP CREDENTIALS ================");
    console.log(`ETHEREAL_HOST=smtp.ethereal.email`);
    console.log(`ETHEREAL_PORT=587`);
    console.log(`ETHEREAL_USER=${account.user}`);
    console.log(`ETHEREAL_PASSWORD=${account.pass}`);
    console.log(`ETHEREAL_FROM=${account.user}`);
    console.log("===========================================================\n");
    console.log("Please copy the above lines and paste them into your backend/.env file.");
  } catch (error) {
    console.error("Failed to generate Ethereal SMTP test account:", error);
  }
}

main();
