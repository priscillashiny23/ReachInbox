import { prisma } from "../config/db";
import { emailQueue } from "../queues/email.queue";

export class SchedulerService {
  /**
   * Schedules an email for each recipient by creating a DB entry
   * and queueing a corresponding BullMQ delayed job.
   */
  async scheduleEmails(data: {
    userId: string;
    senderId: string;
    subject: string;
    body: string;
    recipients: string[];
    startTime: Date;
    delayBetweenEmailsMs?: number;
    hourlyLimit?: number;
    attachments?: any;
  }) {
    const scheduledEmails = [];
    const now = new Date();
    const delay = Math.max(0, data.startTime.getTime() - now.getTime());

    for (const recipient of data.recipients) {
      // 1. Create Email record in DB with status SCHEDULED
      const email = await prisma.email.create({
        data: {
          userId: data.userId,
          senderId: data.senderId,
          recipientEmail: recipient,
          subject: data.subject,
          body: data.body,
          scheduledAt: data.startTime,
          status: "SCHEDULED",
          attachments: data.attachments,
        },
      });

      console.log(`[Scheduler] Created email ${email.id}`);

      const jobId = `email-${email.id}`;

      try {
        // 2. Add delayed job to BullMQ.
        // We use email-${email.id} as the BullMQ jobId to enforce uniqueness/idempotency.
        const job = await emailQueue.add(
          "sendEmail",
          { 
            emailId: email.id,
            minDelay: data.delayBetweenEmailsMs,
            maxPerHour: data.hourlyLimit
          },
          {
            jobId: jobId,
            delay: delay,
          }
        );

        console.log(`[Scheduler] Created BullMQ job ${job.id}`);

        // 3. Update the Email record with the BullMQ jobId
        const updatedEmail = await prisma.email.update({
          where: { id: email.id },
          data: { bullmqJobId: job.id },
        });

        scheduledEmails.push(updatedEmail);
      } catch (queueError: any) {
        console.error(`[Scheduler] Failed to enqueue BullMQ job for email ${email.id}. Rolling back DB record...`, queueError.message);
        
        // Rollback: delete the created email in the database to prevent orphaned records without a queue job
        await prisma.email.delete({
          where: { id: email.id }
        }).catch((dbDeleteError: any) => {
          console.error(`[Scheduler] Rollback failed to delete email ${email.id} from DB:`, dbDeleteError.message);
        });

        throw new Error(`Failed to schedule email sending: ${queueError.message}`);
      }
    }

    return scheduledEmails;
  }
  async cancelEmail(emailId: string) {
    const jobId = `email-${emailId}`;
    const job = await emailQueue.getJob(jobId);
    if (job) {
      await job.remove();
      console.log(`[Scheduler] Removed BullMQ job ${jobId}`);
    }
  }
}

export const schedulerService = new SchedulerService();
