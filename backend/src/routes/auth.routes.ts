import { Router } from "express";
import { authController } from "../controllers/auth.controller";

const router = Router();

// OAuth Trigger
router.get("/google", authController.google.bind(authController));

// OAuth Callback redirect
router.get("/google/callback", authController.googleCallback.bind(authController));

// Credentials Login / Signup
router.post("/login", authController.login.bind(authController));

// Current Session Info
router.get("/me", authController.me.bind(authController));

// Session terminate
router.post("/logout", authController.logout.bind(authController));

export default router;
