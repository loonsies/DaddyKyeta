import { Discord, Slash, SlashOption } from "discordx";
import { SlashCommandBuilder } from "discord.js";
import { db } from "../database/database.js";
import { users, smoochInteractions } from "../database/schema.js";
import { eq, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { and } from "drizzle-orm";
import { calculateLevel, calculateXpForLevel, XP_PER_BONK as XP_PER_SMOOCH } from "../utils/levelUtils.js";
import { CommandInteraction, ApplicationCommandOptionType, User, MessageFlags } from "discord.js";

export const command = new SlashCommandBuilder()
  .setName("smooch")
  .setDescription("Smooch another user!")
  .addUserOption(option =>
    option
      .setName("target")
      .setDescription("The user to smooch")
      .setRequired(true)
  );

@Discord()
export class SmoochCommands {
  @Slash({ description: "Smooch another user!" })
  async smooch(
    @SlashOption({
      name: "target",
      description: "The user to smooch",
      required: true,
      type: ApplicationCommandOptionType.User
    }) target: User,
    interaction: CommandInteraction
  ) {
    const sender = interaction.user;

    // Don't allow self-poking
    if (target.id === sender.id) {
      return interaction.reply({
        content: "You can't smooch yourself!",
        flags: MessageFlags.Ephemeral
      });
    }

    // Get random smooch gif
    const smoochFolder = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "../../assets/smooch"
    );
    const smoochGifs = fs.readdirSync(smoochFolder);
    const randomGif = smoochGifs[Math.floor(Math.random() * smoochGifs.length)];
    const gifPath = path.join(smoochFolder, randomGif);

    // Update database for both users
    await db.transaction(async (tx) => {
      // Get sender's current XP
      const [currentStats] = await tx
        .select({ smoochXp: users.smoochXp })
        .from(users)
        .where(eq(users.userId, sender.id));

      const oldLevel = currentStats ? calculateLevel(currentStats.smoochXp) : 0;
      const newXp = (currentStats?.smoochXp || 0) + XP_PER_SMOOCH;
      const newLevel = calculateLevel(newXp);

      // Update sender's stats
      await tx
        .insert(users)
        .values({
          userId: sender.id,
          smoochXp: XP_PER_SMOOCH,
          smoochsSent: 1,
        })
        .onConflictDoUpdate({
          target: [users.userId],
          set: {
            smoochXp: sql`${users.smoochXp} + ${XP_PER_SMOOCH}`,
            smoochsSent: sql`${users.smoochsSent} + 1`,
            updatedAt: new Date(),
          },
        });

      // Update target's stats
      await tx
        .insert(users)
        .values({
          userId: target.id,
          smoochsReceived: 1,
        })
        .onConflictDoUpdate({
          target: [users.userId],
          set: {
            smoochsReceived: sql`${users.smoochsReceived} + 1`,
            updatedAt: new Date(),
          },
        });

      // Update interaction count
      await tx
        .insert(smoochInteractions)
        .values({
          fromUserId: sender.id,
          toUserId: target.id,
        })
        .onConflictDoUpdate({
          target: [smoochInteractions.fromUserId, smoochInteractions.toUserId],
          set: {
            count: sql`${smoochInteractions.count} + 1`,
            lastSmoochAt: new Date(),
          },
        });

      // Get the updated interaction count
      const [smoochCount] = await tx
        .select({ count: smoochInteractions.count })
        .from(smoochInteractions)
        .where(
          and(
            eq(smoochInteractions.fromUserId, sender.id),
            eq(smoochInteractions.toUserId, target.id)
          )
        );

      // Prepare the reply message
      let replyMessage = `${sender} smoochd ${target}! (${smoochCount.count} times total)`;
      
      // Add level up message if applicable
      if (newLevel > oldLevel) {
        replyMessage += `\n${sender} reached smoocher level ${newLevel}!  **(=˘ ³( ,,>ᴗ<,,) ~♡**`;
      }

      // Send the smooch message with the gif and count
      await interaction.reply({
        content: replyMessage,
        files: [gifPath]
      });
    });
  }
} 