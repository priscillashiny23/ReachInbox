import { Router } from "express";
import { emailController } from "../controllers/email.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);

// Endpoint routing mapping
router.post("/schedule", emailController.schedule.bind(emailController));
router.get("/scheduled", emailController.getScheduled.bind(emailController));
router.get("/sent", emailController.getSent.bind(emailController));
router.delete("/:id", emailController.delete.bind(emailController));
router.patch("/:id", emailController.update.bind(emailController));

export default router;
