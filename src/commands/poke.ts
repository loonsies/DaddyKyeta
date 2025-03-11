import { Discord, Slash, SlashOption } from "discordx";
import { SlashCommandBuilder } from "discord.js";
import { db } from "../database/database.js";
import { users, pokeInteractions } from "../database/schema.js";
import { eq, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { and } from "drizzle-orm";
import { calculateLevel, calculateXpForLevel, XP_PER_BONK as XP_PER_POKE } from "../utils/levelUtils.js";
import { CommandInteraction, ApplicationCommandOptionType, User, MessageFlags } from "discord.js";

export const command = new SlashCommandBuilder()
  .setName("poke")
  .setDescription("Poke another user!")
  .addUserOption(option =>
    option
      .setName("target")
      .setDescription("The user to poke")
      .setRequired(true)
  );

@Discord()
export class PokeCommands {
  @Slash({ description: "Poke another user!" })
  async poke(
    @SlashOption({
      name: "target",
      description: "The user to poke",
      required: true,
      type: ApplicationCommandOptionType.User
    }) target: User,
    interaction: CommandInteraction
  ) {
    const sender = interaction.user;

    // Don't allow self-poking
    if (target.id === sender.id) {
      return interaction.reply({
        content: "You can't poke yourself!",
        flags: MessageFlags.Ephemeral
      });
    }

    // Get random poke gif
    const pokeFolder = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "../../assets/poke"
    );
    const pokeGifs = fs.readdirSync(pokeFolder);
    const randomGif = pokeGifs[Math.floor(Math.random() * pokeGifs.length)];
    const gifPath = path.join(pokeFolder, randomGif);

    // Update database for both users
    await db.transaction(async (tx) => {
      // Get sender's current XP
      const [currentStats] = await tx
        .select({ pokeXp: users.pokeXp })
        .from(users)
        .where(eq(users.userId, sender.id));

      const oldLevel = currentStats ? calculateLevel(currentStats.pokeXp) : 0;
      const newXp = (currentStats?.pokeXp || 0) + XP_PER_POKE;
      const newLevel = calculateLevel(newXp);

      // Update sender's stats
      await tx
        .insert(users)
        .values({
          userId: sender.id,
          pokeXp: XP_PER_POKE,
          pokesSent: 1,
        })
        .onConflictDoUpdate({
          target: [users.userId],
          set: {
            pokeXp: sql`${users.pokeXp} + ${XP_PER_POKE}`,
            pokesSent: sql`${users.pokesSent} + 1`,
            updatedAt: new Date(),
          },
        });

      // Update target's stats
      await tx
        .insert(users)
        .values({
          userId: target.id,
          pokesReceived: 1,
        })
        .onConflictDoUpdate({
          target: [users.userId],
          set: {
            pokesReceived: sql`${users.pokesReceived} + 1`,
            updatedAt: new Date(),
          },
        });

      // Update interaction count
      await tx
        .insert(pokeInteractions)
        .values({
          fromUserId: sender.id,
          toUserId: target.id,
        })
        .onConflictDoUpdate({
          target: [pokeInteractions.fromUserId, pokeInteractions.toUserId],
          set: {
            count: sql`${pokeInteractions.count} + 1`,
            lastPokeAt: new Date(),
          },
        });

      // Get the updated interaction count
      const [pokeCount] = await tx
        .select({ count: pokeInteractions.count })
        .from(pokeInteractions)
        .where(
          and(
            eq(pokeInteractions.fromUserId, sender.id),
            eq(pokeInteractions.toUserId, target.id)
          )
        );

      // Prepare the reply message
      let replyMessage = `${sender} poked ${target}! (${pokeCount.count} times total)`;
      
      // Add level up message if applicable
      if (newLevel > oldLevel) {
        replyMessage += `\n${sender} reached poker level ${newLevel}!  *(˙༥˙(*👈`;
      }

      // Send the poke message with the gif and count
      await interaction.reply({
        content: replyMessage,
        files: [gifPath]
      });
    });
  }
} 