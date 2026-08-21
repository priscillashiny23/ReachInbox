import express from "express";
import session from "express-session";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import emailRoutes from "./routes/email.routes";
import { emailQueue } from "./queues/email.queue";
import { prisma } from "./config/db";

async function runTests() {
  console.log("Starting Auth API endpoint verification tests...");

  // Set environment vars for testing
  process.env.SESSION_SECRET = "test_session_secret";
  process.env.GOOGLE_CLIENT_ID = "test_client_id";
  process.env.GOOGLE_CLIENT_SECRET = "test_client_secret";
  process.env.GOOGLE_CALLBACK_URL = "http://localhost:5999/api/auth/google/callback";
  process.env.FRONTEND_URL = "http://localhost:5998";

  const app = express();
  app.use(cors({ origin: "http://localhost:5998", credentials: true }));
  app.use(
    session({
      secret: "test_session_secret",
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, secure: false, sameSite: "lax" },
    })
  );
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/emails", emailRoutes);

  const server = app.listen(5999);

  try {
    // 1. GET /api/auth/me should return authenticated: false
    const meRes = await fetch("http://localhost:5999/api/auth/me");
    const meData = (await meRes.json()) as any;
    console.log("GET /api/auth/me when unauthenticated:", meData);
    if (meData.authenticated !== false) {
      throw new Error("Expected authenticated: false when unauthenticated");
    }

    // 2. GET /api/emails/scheduled should return 401 Unauthorized
    const scheduledRes = await fetch("http://localhost:5999/api/emails/scheduled");
    console.log("GET /api/emails/scheduled when unauthenticated status:", scheduledRes.status);
    if (scheduledRes.status !== 401) {
      throw new Error("Expected 401 Unauthorized when retrieving scheduled emails without session");
    }

    // 3. GET /api/auth/google should redirect to Google accounts OAuth screen
    const googleRes = await fetch("http://localhost:5999/api/auth/google", { redirect: "manual" });
    console.log("GET /api/auth/google redirect status:", googleRes.status);
    const location = googleRes.headers.get("location");
    console.log("GET /api/auth/google redirect location:", location);
    if (googleRes.status !== 302 || !location || !location.startsWith("https://accounts.google.com")) {
      throw new Error("Expected 302 redirect to https://accounts.google.com");
    }

    console.log("\nALL AUTH VERIFICATION CHECKS PASSED!");
    
    // Close connections
    await emailQueue.close();
    await prisma.$disconnect();
    
    server.close(() => {
      process.exit(0);
    });
  } catch (error) {
    console.error("\nVERIFICATION FAILED:", error);
    
    try {
      await emailQueue.close();
      await prisma.$disconnect();
    } catch (err) {}
    
    server.close(() => {
      process.exit(1);
    });
  }
}

runTests();
