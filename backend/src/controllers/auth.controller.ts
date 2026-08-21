import { Request, Response } from "express";
import { prisma } from "../config/db";

export class AuthController {
  /**
   * GET /api/auth/google
   * Redirects the client to Google's OAuth consent screen.
   */
  async google(req: Request, res: Response): Promise<void> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL;

    // Check if configuration matches default placeholders or is missing
    if (!clientId || clientId === "your_client_id.apps.googleusercontent.com" || !callbackUrl) {
      console.log("[AuthController] Google Client ID is placeholder. Initiating local developer bypass session.");
      
      // Check for existing mock user or create a new one
      let user = await prisma.user.findFirst({
        where: { googleId: "mock-developer-id-9999" },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            googleId: "mock-developer-id-9999",
            email: "developer@example.com",
            name: "Demo Developer",
            avatar: null,
          },
        });
      }

      // Initialize session using the mock user id
      req.session.userId = user.id;

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      res.redirect(`${frontendUrl}`);
      return;
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(
      callbackUrl
    )}&response_type=code&scope=${encodeURIComponent(
      "profile email"
    )}&prompt=select_account`;

    res.redirect(authUrl);
  }

  /**
   * GET /api/auth/google/callback
   * Exchanges auth code for access token, fetches profile details, creates/updates User, and initializes session.
   */
  async googleCallback(req: Request, res: Response): Promise<void> {
    try {
      const code = req.query.code as string;
      if (!code) {
        res.status(400).send("Authorization code is missing.");
        return;
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

      if (!clientId || !clientSecret || !callbackUrl) {
        res.status(500).send("OAuth environment variables are missing.");
        return;
      }

      // Exchange auth code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl,
          grant_type: "authorization_code",
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("[AuthController] Token exchange failed:", errorText);
        res.status(500).send(`Failed to exchange authorization code: ${errorText}`);
        return;
      }

      const tokens = await tokenResponse.json();
      const accessToken = tokens.access_token;

      // Retrieve Google user info using the access token
      const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!profileResponse.ok) {
        res.status(500).send("Failed to fetch user profile info from Google.");
        return;
      }

      const profile = await profileResponse.json();
      const googleId = profile.id;
      const email = profile.email;
      const name = profile.name || email.split("@")[0];
      const avatar = profile.picture || null;

      if (!googleId || !email) {
        res.status(400).send("Incomplete profile information returned by Google.");
        return;
      }

      // Upsert User in PostgreSQL
      let user = await prisma.user.findUnique({
        where: { googleId },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            googleId,
            email,
            name,
            avatar,
          },
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { name, email, avatar },
        });
      }

      // Attach user ID to active session
      req.session.userId = user.id;

      // Redirect client to frontend dashboard
      res.redirect(`${frontendUrl}/dashboard`);
    } catch (error: any) {
      console.error("[AuthController] Callback error:", error);
      res.status(500).send(`Authentication error: ${error.message}`);
    }
  }

  /**
   * GET /api/auth/me
   * Returns current user identity session info.
   */
  async me(req: Request, res: Response): Promise<void> {
    try {
      if (!req.session || !req.session.userId) {
        res.json({ authenticated: false });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.session.userId },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      });

      if (!user) {
        req.session.destroy(() => {});
        res.json({ authenticated: false });
        return;
      }

      res.json({
        authenticated: true,
        user,
      });
    } catch (error: any) {
      console.error("[AuthController] Me query error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/auth/logout
   * Clears session context and cookies.
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      if (!req.session) {
        res.json({ authenticated: false });
        return;
      }

      req.session.destroy((err) => {
        if (err) {
          console.error("[AuthController] Logout session destroy error:", err);
          res.status(500).json({ success: false, error: "Failed to destroy session" });
          return;
        }
        res.clearCookie("connect.sid"); // Clear express-session default cookie
        res.json({ authenticated: false });
      });
    } catch (error: any) {
      console.error("[AuthController] Logout error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/auth/login
   * Authenticates using email ID and password.
   * If the user doesn't exist, automatically sign them up.
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ success: false, error: "Email and password are required." });
        return;
      }

      // Find user
      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Auto-register since UI says "or sign up through email"
        const googleId = `email-login-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        user = await prisma.user.create({
          data: {
            googleId,
            email,
            name: email.split("@")[0],
            password,
            avatar: null,
          },
        });
      } else {
        // Verify password
        if (user.password && user.password !== password) {
          res.status(401).json({ success: false, error: "Invalid password." });
          return;
        }
      }

      // Initialize session
      req.session.userId = user.id;

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        },
      });
    } catch (error: any) {
      console.error("[AuthController] Login error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const authController = new AuthController();
