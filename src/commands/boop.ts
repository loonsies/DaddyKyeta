import { Discord, Slash, SlashOption } from "discordx";
import { SlashCommandBuilder } from "discord.js";
import { db } from "../database/database.js";
import { users, boopInteractions } from "../database/schema.js";
import { eq, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { and } from "drizzle-orm";
import { calculateLevel, calculateXpForLevel, XP_PER_BONK as XP_PER_BOOP } from "../utils/levelUtils.js";
import { getRandomGif } from "../utils/gifUtils.js";
import { CommandInteraction, ApplicationCommandOptionType, User, MessageFlags } from "discord.js";

export const command = new SlashCommandBuilder()
  .setName("boop")
  .setDescription("Boop another user!")
  .addUserOption(option =>
    option
      .setName("target")
      .setDescription("The user to boop")
      .setRequired(true)
  );

@Discord()
export class BoopCommands {
  @Slash({ description: "Boop another user!" })
  async boop(
    @SlashOption({
      name: "target",
      description: "The user to boop",
      required: true,
      type: ApplicationCommandOptionType.User
    }) target: User,
    interaction: CommandInteraction
  ) {
    const sender = interaction.user;

    // Don't allow self-booping
    if (target.id === sender.id) {
      return interaction.reply({
        content: "You can't boop yourself!",
        flags: MessageFlags.Ephemeral
      });
    }

    // Get random boop gif
    const boopFolder = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "../../assets/boop"
    );
    const boopGifs = fs.readdirSync(boopFolder);
    const randomGif = getRandomGif('boop', boopGifs);
    const gifPath = path.join(boopFolder, randomGif);

    // Update database for both users
    await db.transaction(async (tx) => {
      // Get sender's current XP
      const [currentStats] = await tx
        .select({ boopXp: users.boopXp })
        .from(users)
        .where(eq(users.userId, sender.id));

      const oldLevel = currentStats ? calculateLevel(currentStats.boopXp) : 0;
      const newXp = (currentStats?.boopXp || 0) + XP_PER_BOOP;
      const newLevel = calculateLevel(newXp);

      // Update sender's stats
      await tx
        .insert(users)
        .values({
          userId: sender.id,
          boopXp: XP_PER_BOOP,
          boopsSent: 1,
        })
        .onConflictDoUpdate({
          target: [users.userId],
          set: {
            boopXp: sql`${users.boopXp} + ${XP_PER_BOOP}`,
            boopsSent: sql`${users.boopsSent} + 1`,
            updatedAt: new Date(),
          },
        });

      // Update target's stats
      await tx
        .insert(users)
        .values({
          userId: target.id,
          boopsReceived: 1,
        })
        .onConflictDoUpdate({
          target: [users.userId],
          set: {
            boopsReceived: sql`${users.boopsReceived} + 1`,
            updatedAt: new Date(),
          },
        });

      // Update interaction count
      await tx
        .insert(boopInteractions)
        .values({
          fromUserId: sender.id,
          toUserId: target.id,
        })
        .onConflictDoUpdate({
          target: [boopInteractions.fromUserId, boopInteractions.toUserId],
          set: {
            count: sql`${boopInteractions.count} + 1`,
            lastBoopAt: new Date(),
          },
        });

      // Get the updated interaction count
      const [boopCount] = await tx
        .select({ count: boopInteractions.count })
        .from(boopInteractions)
        .where(
          and(
            eq(boopInteractions.fromUserId, sender.id),
            eq(boopInteractions.toUserId, target.id)
          )
        );

      // Prepare the reply message
      let replyMessage = `${sender} booped ${target}! (${boopCount.count} times total)`;
      
      // Add level up message if applicable
      if (newLevel > oldLevel) {
        replyMessage += `\n${sender} reached booper level ${newLevel}!  👉✨🥺`;
      }

      // Send the boop message with the gif and count
      await interaction.reply({
        content: replyMessage,
        files: [gifPath]
      });
    });
  }
} 