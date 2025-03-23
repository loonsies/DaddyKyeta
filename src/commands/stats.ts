import { Discord, Slash, SlashOption } from "discordx";
import { SlashCommandBuilder } from "discord.js";
import { db } from "../database/database.js";
import { users, bonkInteractions, boopInteractions, biteInteractions, patInteractions, pokeInteractions, smoochInteractions } from "../database/schema.js";
import { sql } from "drizzle-orm";
import { CommandInteraction, EmbedBuilder, ApplicationCommandOptionType, User } from "discord.js";
import { INTERACTION_TYPES, InteractionType, INTERACTION_EMOJIS } from "../data/interactions.js";

const interactionTables = {
  bonk: bonkInteractions,
  boop: boopInteractions,
  bite: biteInteractions,
  pat: patInteractions,
  poke: pokeInteractions,
  smooch: smoochInteractions
} as const;

export const command = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("Show interaction statistics")
  .addUserOption(option =>
    option
      .setName("target")
      .setDescription("The user to show stats for (defaults to yourself)")
      .setRequired(false)
  );

@Discord()
export class StatsCommands {
  @Slash({ description: "Show interaction statistics" })
  async stats(
    @SlashOption({
      name: "target",
      description: "The user to show stats for (defaults to yourself)",
      required: false,
      type: ApplicationCommandOptionType.User
    }) target: User | undefined,
    interaction: CommandInteraction
  ) {
    await interaction.deferReply();

    const userId = target?.id || interaction.user.id;
    const targetUser = target || interaction.user;

    // Get user's stats
    const userStats = await db.select({
      bonksSent: users.bonksSent,
      boopsSent: users.boopsSent,
      bitesSent: users.bitesSent,
      patsSent: users.patsSent,
      pokesSent: users.pokesSent,
      smoochsSent: users.smoochsSent,
      bonksReceived: users.bonksReceived,
      boopsReceived: users.boopsReceived,
      bitesReceived: users.bitesReceived,
      patsReceived: users.patsReceived,
      pokesReceived: users.pokesReceived,
      smoochsReceived: users.smoochsReceived,
    })
    .from(users)
    .where(sql`${users.userId} = ${userId}`)
    .limit(1);

    // Get favorite targets for each interaction type
    const favoriteTargets = await Promise.all(
      INTERACTION_TYPES.map(async (type) => {
        const table = interactionTables[type];
        const result = await db
          .select({
            toUserId: table.toUserId,
            count: table.count,
          })
          .from(table)
          .where(sql`${table.fromUserId} = ${userId}`)
          .orderBy(sql`${table.count} DESC`)
          .limit(1);
        
        return {
          type,
          target: result[0] ? await interaction.client.users.fetch(result[0].toUserId) : null,
          count: result[0]?.count || 0
        };
      })
    );

    // Create embed for the stats
    const embed = new EmbedBuilder()
      .setTitle(`📊 Statistics for ${targetUser.toString()}`)
      .setColor("#00FF00")
      .setTimestamp();

    // Add fields for sent and received counts
    const stats = userStats[0] || {};
    for (const type of INTERACTION_TYPES) {
      const sentKey = `${type}sSent` as keyof typeof stats;
      const receivedKey = `${type}sReceived` as keyof typeof stats;
      const favorite = favoriteTargets.find(t => t.type === type);

      embed.addFields({
        name: `${type.charAt(0).toUpperCase() + type.slice(1)}s ${INTERACTION_EMOJIS[type]}`,
        value: `Sent: ${stats[sentKey] || 0}\nReceived: ${stats[receivedKey] || 0}\nMost used on: ${favorite?.target ? `${favorite.target.toString()} (${favorite.count} times)` : 'Nobody yet'}`,
        inline: true
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
} 