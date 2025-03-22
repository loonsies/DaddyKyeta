import { Discord, Slash, SlashOption } from "discordx";
import { SlashCommandBuilder } from "discord.js";
import { db } from "../database/database.js";
import { users } from "../database/schema.js";
import { sql } from "drizzle-orm";
import { ApplicationCommandOptionType, CommandInteraction, EmbedBuilder } from "discord.js";
import { INTERACTION_TYPES, InteractionType, INTERACTION_TITLES } from "../data/interactions.js";

const sentColumns = {
  bonk: users.bonksSent,
  boop: users.boopsSent,
  bite: users.bitesSent,
  pat: users.patsSent,
  poke: users.pokesSent,
  smooch: users.smoochsSent,
} as const;

export const command = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Show the leaderboard for a specific interaction type")
  .addStringOption(option =>
    option
      .setName("type")
      .setDescription("The interaction type to show leaderboard for")
      .setRequired(true)
      .addChoices(
        ...INTERACTION_TYPES.map(type => ({ name: type, value: type }))
      )
  );

@Discord()
export class LeaderboardCommands {
  @Slash({ description: "Show the leaderboard for a specific interaction type" })
  async leaderboard(
    @SlashOption({
      name: "type",
      description: "The interaction type to show leaderboard for",
      required: true,
      type: ApplicationCommandOptionType.String
    })
    type: InteractionType,
    interaction: CommandInteraction
  ) {
    await interaction.deferReply();

    const results = await db.select({
      userId: users.userId,
      count: sentColumns[type]
    })
    .from(users)
    .where(sql`${sentColumns[type]} > 0`)
    .orderBy(sql`${sentColumns[type]} DESC`)
    .limit(3);

    // Create embed for the leaderboard
    const embed = new EmbedBuilder()
      .setTitle(`🏆 Top ${INTERACTION_TITLES[type]}s`)
      .setColor("#FFD700")
      .setTimestamp();

    if (results.length === 0) {
      embed.setDescription(`No ${type}s have been sent yet!`);
    } else {
      // Add fields for each user
      const medals = ["🥇", "🥈", "🥉"];
      for (let i = 0; i < results.length; i++) {
        const user = await interaction.client.users.fetch(results[i].userId);
        embed.addFields({
          name: `${medals[i]} ${user}`,
          value: `${results[i].count} ${type}s sent`,
          inline: false
        });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  }
} 