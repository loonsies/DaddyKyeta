import { Client, TextChannel } from "discord.js";
import { DateTime } from "luxon";
import { db } from "../database/database.js";
import { users } from "../database/schema.js";
import { and, eq, isNotNull } from "drizzle-orm";
import PgBoss from 'pg-boss';

const BIRTHDAY_QUEUE = 'birthday-notifications';

export class BirthdayService {
  private client: Client;
  private boss: PgBoss;

  constructor(client: Client) {
    this.client = client;
    
    // Initialize PgBoss with the same database connection
    this.boss = new PgBoss(process.env.DATABASE_URL || '');
    
    // Handle errors
    this.boss.on('error', (error: Error) => console.error('PgBoss error:', error));
  }

  async start() {
    try {
      // Start the job queue
      await this.boss.start();
      
      // Create the queues first
      await this.boss.createQueue(BIRTHDAY_QUEUE);
      await this.boss.createQueue('birthday-check');

      // Schedule all birthdays first
      await this.scheduleBirthdays();
      
      // Then set up handlers
      await this.boss.work<{userId: string}>(BIRTHDAY_QUEUE, async (jobs) => {
        for (const job of jobs) {
          if (job.data?.userId) {
            await this.sendBirthdayMessage(job.data.userId);
            await this.scheduleUserBirthday(job.data.userId);
          }
        }
      });

      // Add handler for birthday-check
      await this.boss.work('birthday-check', async () => {
        await this.scheduleBirthdays();
      });

      // Schedule daily check
      await this.boss.schedule('birthday-check', '0 0 * * *', {}, {
        retryLimit: 3,
        retryBackoff: true
      });

    } catch (error) {
      console.error("Error starting birthday service:", error);
    }
  }

  async stop() {
    await this.boss.stop();
  }

  private async scheduleBirthdays() {
    try {
      const birthdayUsers = await db
        .select({
          userId: users.userId,
          timezone: users.timezone,
          birthday: users.birthday,
        })
        .from(users)
        .where(and(
          isNotNull(users.birthday),
          isNotNull(users.timezone)
        ));

      for (const user of birthdayUsers) {
        await this.scheduleUserBirthday(user.userId);
      }
    } catch (error) {
      console.error("Error scheduling birthdays:", error);
    }
  }

  private async scheduleUserBirthday(userId: string) {
    try {
      // Delete any existing birthday jobs for this user first
      await this.boss.deleteQueue(`birthday-${userId}`);

      const userInfo = await db
        .select({
          timezone: users.timezone,
          birthday: users.birthday,
        })
        .from(users)
        .where(and(
          isNotNull(users.birthday),
          isNotNull(users.timezone),
          eq(users.userId, userId)
        ))
        .then(rows => rows[0]);

      if (!userInfo?.birthday || !userInfo?.timezone) return;

      // Calculate next birthday
      const userBirthday = DateTime.fromJSDate(userInfo.birthday).setZone(userInfo.timezone);
      const now = DateTime.now().setZone(userInfo.timezone);
      let nextBirthday = DateTime.fromObject({
        year: now.year,
        month: userBirthday.month,
        day: userBirthday.day,
        hour: userBirthday.hour,
        minute: userBirthday.minute,
      }, { zone: userInfo.timezone });

      // If birthday has passed this year, schedule for next year
      if (nextBirthday < now) {
        nextBirthday = nextBirthday.plus({ years: 1 });
      }

      // Schedule the birthday notification using send for one-time jobs
      await this.boss.send(
        BIRTHDAY_QUEUE,
        { userId },
        {
          retryLimit: 3,
          retryBackoff: true,
          singletonKey: `birthday-${userId}`,
          startAfter: nextBirthday.toJSDate()
        }
      );

      // Debug message when scheduling birthday
      //const channelId = process.env.CHAT_CHANNEL_ID;
      //if (channelId) {
      //  const channel = await this.client.channels.fetch(channelId);
      //  if (channel instanceof TextChannel) {
      //    const unixTimestamp = Math.floor(nextBirthday.toSeconds());
      //    await channel.send({
      //      content: `Debug: Scheduled birthday notification for <@${userId}>\nWill trigger at <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)`
      //    });
      //  }
      //}

    } catch (error) {
      console.error(`Error scheduling birthday for user ${userId}:`, error);
    }
  }

  private async sendBirthdayMessage(userId: string) {
    try {
      const channelId = process.env.CHAT_CHANNEL_ID;
      if (!channelId) {
        throw new Error("CHAT_CHANNEL_ID not configured in environment variables");
      }

      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !(channel instanceof TextChannel)) {
        throw new Error("Invalid channel or channel type");
      }

      await channel.send({
        content: `🎉 Happy Birthday <@${userId}>! 🎂\nWishing you an amazing day filled with joy and celebration! 🎈✨`,
      });
    } catch (error) {
      console.error("Error sending birthday message:", error);
    }
  }
} 