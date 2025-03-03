import { Discord, Slash, SlashOption } from "discordx";
import { SlashCommandBuilder } from "discord.js";
import { db } from "../database/database.js";
import { users, bonkInteractions } from "../database/schema.js";
import { eq, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { and } from "drizzle-orm";
import { calculateLevel, calculateXpForLevel, XP_PER_BONK } from "../utils/levelUtils.js";
import { User, CommandInteraction, ApplicationCommandOptionType, MessageFlags } from "discord.js";

export const command = new SlashCommandBuilder()
  .setName("bonk")
  .setDescription("Bonk another user!")
  .addUserOption(option =>
    option
      .setName("target")
      .setDescription("The user to bonk")
      .setRequired(true)
  );

@Discord()
export class BonkCommands {
  @Slash({ description: "Bonk another user!" })
  async bonk(
    @SlashOption({
      name: "target",
      description: "The user to bonk",
      required: true,
      type: ApplicationCommandOptionType.User
    }) target: User,
    interaction: CommandInteraction
  ) {
    const sender = interaction.user;

    // Don't allow self-bonking
    if (target.id === sender.id) {
      return interaction.reply({
        content: "You can't bonk yourself!",
        flags: MessageFlags.Ephemeral
      });
    }

    // Get random bonk gif
    const bonkFolder = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "../../assets/bonk"
    );
    const bonkGifs = fs.readdirSync(bonkFolder);
    const randomGif = bonkGifs[Math.floor(Math.random() * bonkGifs.length)];
    const gifPath = path.join(bonkFolder, randomGif);

    // Update database for both users
    await db.transaction(async (tx) => {
      // Get sender's current XP
      const [currentStats] = await tx
        .select({ bonkXp: users.bonkXp })
        .from(users)
        .where(eq(users.userId, sender.id));

      const oldLevel = currentStats ? calculateLevel(currentStats.bonkXp) : 0;
      const newXp = (currentStats?.bonkXp || 0) + XP_PER_BONK;
      const newLevel = calculateLevel(newXp);

      // Update sender's stats
      await tx
        .insert(users)
        .values({
          userId: sender.id,
          bonkXp: XP_PER_BONK,
          bonksSent: 1,
        })
        .onConflictDoUpdate({
          target: [users.userId],
          set: {
            bonkXp: sql`${users.bonkXp} + ${XP_PER_BONK}`,
            bonksSent: sql`${users.bonksSent} + 1`,
            updatedAt: new Date(),
          },
        });

      // Update target's stats
      await tx
        .insert(users)
        .values({
          userId: target.id,
          bonksReceived: 1,
        })
        .onConflictDoUpdate({
          target: [users.userId],
          set: {
            bonksReceived: sql`${users.bonksReceived} + 1`,
            updatedAt: new Date(),
          },
        });

      // Update interaction count
      await tx
        .insert(bonkInteractions)
        .values({
          fromUserId: sender.id,
          toUserId: target.id,
        })
        .onConflictDoUpdate({
          target: [bonkInteractions.fromUserId, bonkInteractions.toUserId],
          set: {
            count: sql`${bonkInteractions.count} + 1`,
            lastBonkAt: new Date(),
          },
        });

      // Get the updated interaction count
      const [bonkCount] = await tx
        .select({ count: bonkInteractions.count })
        .from(bonkInteractions)
        .where(
          and(
            eq(bonkInteractions.fromUserId, sender.id),
            eq(bonkInteractions.toUserId, target.id)
          )
        );

      // Prepare the reply message
      let replyMessage = `${sender} bonked ${target}! (${bonkCount.count} times total)`;
      
      // Add level up message if applicable
      if (newLevel > oldLevel) {
        replyMessage += `\n${sender} reached bonker level ${newLevel}!  🔨💥🤕`;
      }

      // Send the bonk message with the gif and count
      await interaction.reply({
        content: replyMessage,
        files: [gifPath]
      });
    });
  }
}
