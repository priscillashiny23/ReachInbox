import { Request, Response } from "express";
import { prisma } from "../config/db";
import { schedulerService } from "../services/scheduler.service";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Helper function to retrieve or register the Ethereal SMTP sender
 * using configuration credentials from env.
 */
async function getOrCreateEtherealSender() {
  const senderEmail = process.env.ETHEREAL_USER || "dev-sender@example.com";
  let sender = await prisma.sender.findFirst({
    where: { email: senderEmail },
  });
  if (!sender) {
    sender = await prisma.sender.create({
      data: {
        email: senderEmail,
        displayName: "ReachInbox Scheduler",
        etherealUser: senderEmail,
        etherealPassword: process.env.ETHEREAL_PASSWORD || "fake-pass",
      },
    });
  }
  return sender;
}

export class EmailController {
  /**
   * POST /api/emails/schedule
   */
  async schedule(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: "Unauthorized. Please log in." });
        return;
      }

      const { subject, body, recipients, startTime, delayBetweenEmailsMs, hourlyLimit, attachments } = req.body;

      // Validation
      if (!subject || typeof subject !== "string" || subject.trim() === "") {
        res.status(400).json({ success: false, error: "Subject is required and must be a non-empty string." });
        return;
      }
      if (!body || typeof body !== "string" || body.trim() === "") {
        res.status(400).json({ success: false, error: "Body is required and must be a non-empty string." });
        return;
      }
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        res.status(400).json({ success: false, error: "Recipients must be a non-empty array." });
        return;
      }
      for (const email of recipients) {
        if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
          res.status(400).json({ success: false, error: `Invalid email address: ${email}` });
          return;
        }
      }

      const uniqueRecipients = new Set(recipients);
      if (uniqueRecipients.size !== recipients.length) {
        res.status(400).json({ success: false, error: "Duplicate recipients are not allowed in the same request." });
        return;
      }

      if (!startTime) {
        res.status(400).json({ success: false, error: "StartTime is required." });
        return;
      }

      const parsedStartTime = new Date(startTime);
      if (isNaN(parsedStartTime.getTime())) {
        res.status(400).json({ success: false, error: "Invalid startTime format." });
        return;
      }

      // Allow 5 seconds tolerance for network delay
      if (parsedStartTime.getTime() < Date.now() - 5000) {
        res.status(400).json({ success: false, error: "StartTime cannot be in the past." });
        return;
      }

      let parsedDelayMs: number | undefined = undefined;
      if (delayBetweenEmailsMs !== undefined) {
        parsedDelayMs = parseInt(delayBetweenEmailsMs, 10);
        if (isNaN(parsedDelayMs) || parsedDelayMs < 0) {
          res.status(400).json({ success: false, error: "delayBetweenEmailsMs must be a non-negative number." });
          return;
        }
      }

      let parsedHourlyLimit: number | undefined = undefined;
      if (hourlyLimit !== undefined) {
        parsedHourlyLimit = parseInt(hourlyLimit, 10);
        if (isNaN(parsedHourlyLimit) || parsedHourlyLimit <= 0) {
          res.status(400).json({ success: false, error: "hourlyLimit must be a positive number." });
          return;
        }
      }

      const sender = await getOrCreateEtherealSender();

      const emails = await schedulerService.scheduleEmails({
        userId,
        senderId: sender.id,
        subject,
        body,
        recipients,
        startTime: parsedStartTime,
        delayBetweenEmailsMs: parsedDelayMs,
        hourlyLimit: parsedHourlyLimit,
        attachments,
      });

      res.json({
        success: true,
        emails: emails.map((e) => ({
          id: e.id,
          recipientEmail: e.recipientEmail,
          scheduledAt: e.scheduledAt,
          status: e.status,
          bullmqJobId: e.bullmqJobId,
        })),
      });
    } catch (error: any) {
      console.error("[EmailController] Schedule error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/emails/scheduled
   */
  async getScheduled(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: "Unauthorized. Please log in." });
        return;
      }

      const emails = await prisma.email.findMany({
        where: {
          userId,
          status: "SCHEDULED",
        },
        orderBy: { scheduledAt: "asc" },
      });

      res.json({ success: true, emails });
    } catch (error: any) {
      console.error("[EmailController] GetScheduled error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/emails/sent
   */
  async getSent(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: "Unauthorized. Please log in." });
        return;
      }

      const emails = await prisma.email.findMany({
        where: {
          userId,
          status: { in: ["SENT", "FAILED"] },
        },
        orderBy: { sentAt: "desc" },
      });

      res.json({ success: true, emails });
    } catch (error: any) {
      console.error("[EmailController] GetSent error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/emails/:id
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: "Unauthorized. Please log in." });
        return;
      }

      const emailId = req.params.id as string;
      const email = await prisma.email.findFirst({
        where: { id: emailId, userId },
      });

      if (!email) {
        res.status(404).json({ success: false, error: "Email not found." });
        return;
      }

      // If scheduled or processing, remove from queue
      if (email.status === "SCHEDULED" || email.status === "PROCESSING") {
        await schedulerService.cancelEmail(email.id);
      }

      // Delete from DB
      await prisma.email.delete({
        where: { id: email.id },
      });

      res.json({ success: true, message: "Email successfully deleted." });
    } catch (error: any) {
      console.error("[EmailController] Delete error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PATCH /api/emails/:id
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: "Unauthorized. Please log in." });
        return;
      }

      const emailId = req.params.id as string;
      const { isStarred, isArchived } = req.body;

      const email = await prisma.email.findFirst({
        where: { id: emailId, userId },
      });

      if (!email) {
        res.status(404).json({ success: false, error: "Email not found." });
        return;
      }

      const updatedEmail = await prisma.email.update({
        where: { id: email.id },
        data: {
          ...(isStarred !== undefined && { isStarred }),
          ...(isArchived !== undefined && { isArchived }),
        },
      });

      res.json({ success: true, email: updatedEmail });
    } catch (error: any) {
      console.error("[EmailController] Update error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const emailController = new EmailController();
