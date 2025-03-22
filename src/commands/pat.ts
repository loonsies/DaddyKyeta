import { Discord, Slash, SlashOption } from "discordx";
import { SlashCommandBuilder } from "discord.js";
import { db } from "../database/database.js";
import { users, patInteractions } from "../database/schema.js";
import { eq, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { and } from "drizzle-orm";
import { calculateLevel, calculateXpForLevel, XP_PER_BONK as XP_PER_PAT } from "../utils/levelUtils.js";
import { getRandomGif } from "../utils/gifUtils.js";
import { CommandInteraction, ApplicationCommandOptionType, User, MessageFlags } from "discord.js";
import { INTERACTION_TITLES, INTERACTION_EMOJIS } from "../data/interactions.js";

export const command = new SlashCommandBuilder()
  .setName("pat")
  .setDescription("Pat another user!")
  .addUserOption(option =>
    option
      .setName("target")
      .setDescription("The user to pat")
      .setRequired(true)
  );

@Discord()
export class PatCommands {
  @Slash({ description: "Pat another user!" })
  async pat(
    @SlashOption({
      name: "target",
      description: "The user to pat",
      required: true,
      type: ApplicationCommandOptionType.User
    }) target: User,
    interaction: CommandInteraction
  ) {
    const sender = interaction.user;

    // Don't allow self-patting
    if (target.id === sender.id) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      return interaction.editReply({
        content: "You can't pat yourself!"
      });
    }

    // Defer the reply immediately
    await interaction.deferReply();

    // Get random pat gif
    const patFolder = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "../../assets/pat"
    );
    const patGifs = fs.readdirSync(patFolder);
    const randomGif = getRandomGif('pat', patGifs);
    const gifPath = path.join(patFolder, randomGif);

    // Update database for both users
    await db.transaction(async (tx) => {
      // Get sender's current XP
      const [currentStats] = await tx
        .select({ patXp: users.patXp })
        .from(users)
        .where(eq(users.userId, sender.id));

      const oldLevel = currentStats ? calculateLevel(currentStats.patXp) : 0;
      const newXp = (currentStats?.patXp || 0) + XP_PER_PAT;
      const newLevel = calculateLevel(newXp);

      // Update sender's stats
      await tx
        .insert(users)
        .values({
          userId: sender.id,
          patXp: XP_PER_PAT,
          patsSent: 1,
        })
        .onConflictDoUpdate({
          target: [users.userId],
          set: {
            patXp: sql`${users.patXp} + ${XP_PER_PAT}`,
            patsSent: sql`${users.patsSent} + 1`,
            updatedAt: new Date(),
          },
        });

      // Update target's stats
      await tx
        .insert(users)
        .values({
          userId: target.id,
          patsReceived: 1,
        })
        .onConflictDoUpdate({
          target: [users.userId],
          set: {
            patsReceived: sql`${users.patsReceived} + 1`,
            updatedAt: new Date(),
          },
        });

      // Update interaction count
      await tx
        .insert(patInteractions)
        .values({
          fromUserId: sender.id,
          toUserId: target.id,
        })
        .onConflictDoUpdate({
          target: [patInteractions.fromUserId, patInteractions.toUserId],
          set: {
            count: sql`${patInteractions.count} + 1`,
            lastPatAt: new Date(),
          },
        });

      // Get the updated interaction count
      const [patCount] = await tx
        .select({ count: patInteractions.count })
        .from(patInteractions)
        .where(
          and(
            eq(patInteractions.fromUserId, sender.id),
            eq(patInteractions.toUserId, target.id)
          )
        );

      // Prepare the reply message
      let replyMessage = `${sender} pat ${target}! (${patCount.count} times total)`;
      
      // Add level up message if applicable
      if (newLevel > oldLevel) {
        replyMessage += `\n${sender} reached ${INTERACTION_TITLES.pat} level ${newLevel}! ${INTERACTION_EMOJIS.pat}`;
      }

      // Send the pat message with the gif and count
      await interaction.editReply({
        content: replyMessage,
        files: [gifPath]
      });
    });
  }
} 