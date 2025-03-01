import type { ButtonInteraction, ChatInputCommandInteraction, CommandInteraction, ModalSubmitInteraction, User } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, TextChannel } from "discord.js";
import { ButtonComponent, ContextMenu, Discord, ModalComponent, Slash, SlashOption } from "discordx";
import { DateTime } from "luxon";
import { users } from "../database/schema.js";
import { db } from "../database/database.js";
import { ApplicationCommandOptionType } from "discord.js";
import { eq } from "drizzle-orm";
import { ApplicationCommandType, UserContextMenuCommandInteraction } from "discord.js";

@Discord()
export class TimezoneCommands {
  @Slash({
    description: "Adds the timezone setup button to the channel",
    defaultMemberPermissions: ["Administrator"]
  })
  async addtimezonebutton(interaction: CommandInteraction) {
    const channel = interaction.channel as TextChannel;
    await channel.send({
      content: "To set your timezone, click the button below.\nIf you're unsure about your timezone, you can find it here : https://zones.arilyn.cc\n Click this button to set your timezone 🕑 :",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("set-timezone-start")
            .setLabel("Set Timezone")
            .setStyle(ButtonStyle.Primary)
        ),
      ],
    });

    await interaction.reply({
      content: "Timezone button created!",
      flags: MessageFlags.Ephemeral,
    });
  }

  @ButtonComponent({ id: "set-timezone-start" })
  async handleSetTimezoneButton(interaction: ButtonInteraction) {
    const modal = new ModalBuilder()
      .setCustomId("timezone-modal")
      .setTitle("Set Your Timezone");

    const timezoneInput = new TextInputBuilder()
      .setCustomId("timezone-input")
      .setLabel("Enter your timezone")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Europe/Paris (Find your timezone at zones.arilyn.cc)")
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(timezoneInput)
    );

    await interaction.showModal(modal);
  }

  @ModalComponent({ id: "timezone-modal" })
  async handleTimezoneModal(interaction: ModalSubmitInteraction) {
    const timezone = interaction.fields.getTextInputValue("timezone-input").trim();

    // Validate timezone
    if (!DateTime.local().setZone(timezone).isValid) {
      await interaction.reply({
        content: "Invalid timezone. Please use a valid timezone identifier (e.g., Europe/Paris, America/New_York).\nFind your timezone at https://zones.arilyn.cc",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await db
        .insert(users)
        .values({
          userId: interaction.user.id,
          timezone: timezone,
        })
        .onConflictDoUpdate({
          target: users.userId,
          set: {
            timezone: timezone,
            updatedAt: new Date(),
          },
        });

      await interaction.reply({
        content: `Your timezone has been set to: ${timezone} ✨`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error('Error saving timezone:', error);
      await interaction.reply({
        content: "Sorry, there was an error saving your timezone. Please try again later.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  @Slash({
    description: "Set a user's timezone",
    defaultMemberPermissions: ["Administrator"]
  })
  async settimezone(
    @SlashOption({
      name: "user",
      description: "The user to set timezone for",
      required: true,
      type: ApplicationCommandOptionType.User
    }) user: User,
    @SlashOption({
      name: "timezone",
      description: "The timezone (e.g., Europe/Paris)",
      required: true,
      type: ApplicationCommandOptionType.String
    }) timezone: string,
    interaction: CommandInteraction
  ) {
    try {
      // Validate timezone
      if (!DateTime.local().setZone(timezone).isValid) {
        await interaction.reply({
          content: "Invalid timezone. Please use a valid timezone identifier (e.g., Europe/Paris, America/New_York).",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await db
        .insert(users)
        .values({
          userId: user.id,
          timezone: timezone,
        })
        .onConflictDoUpdate({
          target: users.userId,
          set: {
            timezone: timezone,
            updatedAt: new Date(),
          },
        });

      await interaction.reply({
        content: `Timezone for <@${user.id}> has been set to: ${timezone} ✨`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error('Error setting timezone:', error);
      await interaction.reply({
        content: "Sorry, there was an error setting the timezone. Please try again later.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  @Slash({
    description: "Show current time for a user"
  })
  async time(
    @SlashOption({
      name: "user",
      description: "The user to show time for",
      required: true,
      type: ApplicationCommandOptionType.User
    }) targetUser: User,
    interaction: CommandInteraction
  ) {
    try {
      const userTimezone = await db
        .select({ timezone: users.timezone })
        .from(users)
        .where(eq(users.userId, targetUser.id))
        .then(rows => rows[0]?.timezone);

      if (!userTimezone) {
        await interaction.reply({
          content: `<@${targetUser.id}> hasn't set their timezone yet. They can set it using the timezone setup button!`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const userTime = DateTime.now().setZone(userTimezone);
      
      await interaction.reply({
        content: `<@${targetUser.id}>'s local time: **${userTime.toLocaleString(DateTime.DATETIME_FULL)} (${userTime.toFormat('HH:mm')})** *(${userTimezone})*`,
        flags: MessageFlags.Ephemeral,
      });

    } catch (error) {
      console.error('Error fetching timezone:', error);
      await interaction.reply({
        content: "Sorry, there was an error fetching the timezone. Please try again later.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  @ContextMenu({
    name: "Show Local Time",
    type: ApplicationCommandType.User,
  })
  async userTimeContext(interaction: UserContextMenuCommandInteraction) {
    try {
      const userTimezone = await db
        .select({ timezone: users.timezone })
        .from(users)
        .where(eq(users.userId, interaction.targetId))
        .then(rows => rows[0]?.timezone);

      if (!userTimezone) {
        await interaction.reply({
          content: `<@${interaction.targetId}> hasn't set their timezone yet. They can set it using the timezone setup button!`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const userTime = DateTime.now().setZone(userTimezone);
      
      await interaction.reply({
        content: `<@${interaction.targetId}>'s local time: **${userTime.toLocaleString(DateTime.DATETIME_FULL)} (${userTime.toFormat('HH:mm')})** *(${userTimezone})*`,
        flags: MessageFlags.Ephemeral,
      });

    } catch (error) {
      console.error('Error fetching timezone:', error);
      await interaction.reply({
        content: "Sorry, there was an error fetching the timezone. Please try again later.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}