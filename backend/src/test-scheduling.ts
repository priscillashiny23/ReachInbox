import dotenv from "dotenv";

dotenv.config();

async function runTests() {
  console.log("Starting Phase 4 verification tests...");
  const baseUrl = "http://localhost:5000/api/emails";

  // Test Case 1: Test invalid email validation
  console.log("\n--- Test Case 1: Invalid Email Validation ---");
  try {
    const res = await fetch(`${baseUrl}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "Test invalid email",
        body: "Hello",
        recipients: ["not-an-email"],
        startTime: new Date(Date.now() + 10000).toISOString(),
      }),
    });
    const data: any = await res.json();
    console.log("Status Code:", res.status);
    console.log("Response Data:", data);
    if (res.status === 400 && data.success === false) {
      console.log("PASSED: Invalid email validation worked.");
    } else {
      console.log("FAILED: Invalid email validation did not return 400.");
    }
  } catch (err: any) {
    console.error("Test Case 1 Error:", err.message);
  }

  // Test Case 2: Test past startTime validation
  console.log("\n--- Test Case 2: Past StartTime Validation ---");
  try {
    const res = await fetch(`${baseUrl}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "Test past date",
        body: "Hello",
        recipients: ["test@example.com"],
        startTime: new Date(Date.now() - 60000).toISOString(), // 1 minute in the past
      }),
    });
    const data: any = await res.json();
    console.log("Status Code:", res.status);
    console.log("Response Data:", data);
    if (res.status === 400 && data.success === false) {
      console.log("PASSED: Past startTime validation worked.");
    } else {
      console.log("FAILED: Past startTime validation did not return 400.");
    }
  } catch (err: any) {
    console.error("Test Case 2 Error:", err.message);
  }

  // Test Case 3: Schedule one email 10 seconds in the future
  console.log("\n--- Test Case 3: Schedule Single Email (10s delay) ---");
  let scheduledEmailId = "";
  try {
    const startTime = new Date(Date.now() + 10000).toISOString();
    const res = await fetch(`${baseUrl}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "ReachInbox Test Single Recipient",
        body: "Hello from Phase 4 scheduler!",
        recipients: ["single@example.com"],
        startTime: startTime,
      }),
    });
    const data: any = await res.json();
    console.log("Status Code:", res.status);
    console.log("Response Data:", data);
    if (data.success && data.emails.length === 1) {
      scheduledEmailId = data.emails[0].id;
      console.log(`PASSED: Email scheduled successfully. ID: ${scheduledEmailId}`);
    } else {
      console.log("FAILED: Failed to schedule single email.");
    }
  } catch (err: any) {
    console.error("Test Case 3 Error:", err.message);
  }

  // Test Case 4: Verify SCHEDULED status immediately
  console.log("\n--- Test Case 4: Verify SCHEDULED Status ---");
  try {
    const res = await fetch(`${baseUrl}/scheduled`);
    const data: any = await res.json();
    const found = data.emails.find((e: any) => e.id === scheduledEmailId);
    if (found && found.status === "SCHEDULED") {
      console.log("PASSED: Email has status SCHEDULED.");
    } else {
      console.log("FAILED: Scheduled email not found with status SCHEDULED.");
    }
  } catch (err: any) {
    console.error("Test Case 4 Error:", err.message);
  }

  // Test Case 5: Schedule multiple recipients
  console.log("\n--- Test Case 5: Schedule Multiple Recipients (15s delay) ---");
  let multiIds: string[] = [];
  try {
    const startTime = new Date(Date.now() + 15000).toISOString();
    const res = await fetch(`${baseUrl}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "ReachInbox Test Multi Recipient",
        body: "Hello to all of you!",
        recipients: ["multi1@example.com", "multi2@example.com"],
        startTime: startTime,
      }),
    });
    const data: any = await res.json();
    console.log("Response Data:", data);
    if (data.success && data.emails.length === 2) {
      multiIds = data.emails.map((e: any) => e.id);
      console.log(`PASSED: 2 separate email records created: ${multiIds.join(", ")}`);
    } else {
      console.log("FAILED: Failed to schedule multiple emails.");
    }
  } catch (err: any) {
    console.error("Test Case 5 Error:", err.message);
  }

  // Wait for jobs to execute
  console.log("\nWaiting 20 seconds for the jobs to execute...");
  await new Promise((resolve) => setTimeout(resolve, 20000));

  // Test Case 6: Verify SENT status after delay
  console.log("\n--- Test Case 6: Verify Status changes to SENT/FAILED ---");
  try {
    const res = await fetch(`${baseUrl}/sent`);
    const data: any = await res.json();
    const single = data.emails.find((e: any) => e.id === scheduledEmailId);
    const multi1 = data.emails.find((e: any) => e.id === multiIds[0]);
    const multi2 = data.emails.find((e: any) => e.id === multiIds[1]);

    if (single && single.status === "SENT" && single.sentAt) {
      console.log(`PASSED: Single recipient email status updated to SENT. sentAt: ${single.sentAt}`);
    } else {
      console.log("FAILED: Single recipient email not updated to SENT.");
    }

    if (multi1 && multi1.status === "SENT" && multi2 && multi2.status === "SENT") {
      console.log(`PASSED: Both multi recipient emails updated to SENT.`);
    } else {
      console.log("FAILED: Multi recipient emails not updated to SENT.");
    }
  } catch (err: any) {
    console.error("Test Case 6 Error:", err.message);
  }
}

runTests();
