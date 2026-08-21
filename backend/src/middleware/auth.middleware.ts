import { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Middleware that rejects unauthenticated requests and attaches
 * the active session user ID to the request object.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session || !req.session.userId) {
    res.status(401).json({ success: false, error: "Unauthorized. Please log in." });
    return;
  }

  req.userId = req.session.userId;
  next();
}
