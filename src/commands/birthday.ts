import { DateTime } from "luxon";
import type { ButtonInteraction, ModalSubmitInteraction, CommandInteraction, User } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, TextChannel, ApplicationCommandOptionType } from "discord.js";
import { ButtonComponent, Discord, ModalComponent, Slash, SlashOption } from "discordx";
import { users } from "../database/schema.js";
import { db } from "../database/database.js";
import { eq } from "drizzle-orm";

@Discord()
export class BirthdayCommands {
  @Slash({
    description: "Adds the birthday setup button to the channel",
    defaultMemberPermissions: ["Administrator"]
  })
  async addbirthdaybutton(interaction: CommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = interaction.channel as TextChannel;
    await channel.send({
      content: "To set your birthday, we need to know your birthday and timezone.\nIf you're unsure about your timezone, you can find it here : https://zones.arilyn.cc\n\nClick this button to set your birthday 🎂 :",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("set-birthday-start")
            .setLabel("Set Birthday")
            .setStyle(ButtonStyle.Primary)
        ),
      ],
    });

    await interaction.editReply({
      content: "Birthday button created!"
    });
  }

  @ButtonComponent({ id: "set-birthday-start" })
  async handleSetBirthdayButton(interaction: ButtonInteraction) {
    const modal = new ModalBuilder().setCustomId("birthday-timezone-modal").setTitle("Set Your Birthday & Timezone");

    const birthdayInput = new TextInputBuilder()
      .setCustomId("birthday-input")
      .setLabel("Enter your birthday (DD/MM/YYYY)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("31/12/1990")
      .setRequired(true);

    const hourInput = new TextInputBuilder()
      .setCustomId("hour-input")
      .setLabel("Enter birth hour (optional, 24h format)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("14:30 (leave empty for midnight)")
      .setRequired(false);

    const timezoneInput = new TextInputBuilder()
      .setCustomId("timezone-input")
      .setLabel("Enter your timezone")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Europe/Paris (Find your timezone at zones.arilyn.cc)")
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(birthdayInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(hourInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(timezoneInput)
    );

    await interaction.showModal(modal);
  }

  @ModalComponent({ id: "birthday-timezone-modal" })
  async handleBirthdayTimezoneModal(interaction: ModalSubmitInteraction) {
    const birthdayStr = interaction.fields.getTextInputValue("birthday-input");
    const hourInput = interaction.fields.getTextInputValue("hour-input");
    
    // Format the hour string to ensure it's in HH:MM format
    const hourStr = hourInput ? hourInput.includes(':') ? 
      hourInput.padStart(5, '0') : // Pad if it's like "4:00" to "04:00"
      `${hourInput.padStart(2, '0')}:00` : // Add :00 if just hour number
      "00:00"; // Default to midnight

    const timezone = interaction.fields.getTextInputValue("timezone-input").trim();

    // Validate timezone
    if (!DateTime.local().setZone(timezone).isValid) {
      await interaction.reply({
        content: "Invalid timezone. Please use a valid timezone identifier (e.g., Europe/Paris, America/New_York).",
        flags: 1 << 6
      });
      return;
    }

    // Validate birthday format
    const birthdayRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = birthdayStr.match(birthdayRegex);
    if (!match) {
      await interaction.reply({
        content: "Invalid date format. Please use DD/MM/YYYY format.",
        flags: 1 << 6
      });
      return;
    }

    const [, day, month, year] = match;

    // Update hour format validation to handle padded values
    const hourRegex = /^([0-9]{2}):([0-5][0-9])$/;
    if (!hourStr.match(hourRegex)) {
      await interaction.reply({
        content: "Invalid hour format. Please use HH:MM format (24h), e.g., 04:00 or 14:30",
        flags: 1 << 6
      });
      return;
    }

    // Convert user input to a DateTime object
    const userDateTime = DateTime.fromFormat(
      `${day}/${month}/${year} ${hourStr}`,
      "dd/MM/yyyy HH:mm",
      { zone: timezone }
    );

    // Ensure the date is valid and not in the future
    if (!userDateTime.isValid || userDateTime > DateTime.now()) {
      await interaction.reply({
        content: "Please enter a valid date that is not in the future.",
        flags: 1 << 6
      });
      return;
    }

    // Convert to UTC timestamp (in seconds for Discord)
    const timestamp = Math.floor(userDateTime.toSeconds());
    const preview = `Your birthday will be set to: <t:${timestamp}:F>`;

    const confirmButton = new ButtonBuilder()
      .setCustomId(`confirm-birthday|${timestamp}|${timezone}`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
      .setCustomId("cancel-birthday")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger);

    await interaction.reply({
      content: `${preview}\nIs this correct?`,
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton)],
      flags: 1 << 6
    });
  }

  @ButtonComponent({ id: /^confirm-birthday\|\d+\|.*$/ })
  async handleConfirmBirthday(interaction: ButtonInteraction) {
    try {
      const [_, timestampStr, timezone] = interaction.customId.split("|");
      const timestamp = parseInt(timestampStr);
      
      const birthdayDateTime = DateTime.fromSeconds(timestamp)
        .setZone(timezone);

      if (!birthdayDateTime.isValid) {
        console.error('Invalid datetime:', birthdayDateTime.invalidReason);
        throw new Error('Invalid datetime');
      }

      // Save to database
      await db
        .insert(users)
        .values({
          userId: interaction.user.id,
          birthday: birthdayDateTime.toJSDate(),
          timezone: timezone,
        })
        .onConflictDoUpdate({
          target: users.userId,
          set: {
            birthday: birthdayDateTime.toJSDate(),
            timezone: timezone,
            updatedAt: DateTime.utc().toJSDate(),
          },
        });

      await interaction.update({
        content: "Your birthday and timezone have been saved! ✨",
        components: [],
      });
    } catch (error) {
      console.error('Error saving birthday:', error);
      await interaction.update({
        content: "Sorry, there was an error saving your birthday. Please try again later.",
        components: [],
      });
    }
  }

  @ButtonComponent({ id: "cancel-birthday" })
  async handleCancelBirthday(interaction: ButtonInteraction) {
    await interaction.update({
      content: "Birthday setting cancelled.",
      components: [],
    });
  }

  @Slash({ description: "View your saved birthday" })
  async viewbirthday(interaction: CommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      // Get user's birthday from database
      const userProfile = await db
        .select()
        .from(users)
        .where(({ userId }) => eq(userId,interaction.user.id))
        .limit(1);

      if (!userProfile.length) {
        await interaction.editReply({
          content: "You haven't set your birthday yet! Use the birthday setup button to set it!"
        });
        return;
      }

      const profile = userProfile[0];
      if (!profile.birthday || !profile.timezone) {
        throw new Error('Missing birthday data');
      }
      
      const birthday = DateTime.fromJSDate(profile.birthday)
        .setZone(profile.timezone);

      if (!birthday.isValid) {
        throw new Error('Invalid stored datetime');
      }

      const timestamp = Math.floor(birthday.toSeconds());
      await interaction.editReply({
        content: `Your birthday is set to: <t:${timestamp}:F>\nTimezone: ${profile.timezone}`
      });
    } catch (error) {
      console.error('Error fetching birthday:', error);
      await interaction.editReply({
        content: "Sorry, there was an error fetching your birthday."
      });
    }
  }

  @Slash({
    description: "Set a user's birthday",
    defaultMemberPermissions: ["Administrator"]
  })
  async setbirthday(
    @SlashOption({
      name: "user",
      description: "The user to set birthday for",
      required: true,
      type: ApplicationCommandOptionType.User
    }) user: User,
    @SlashOption({
      name: "birthday",
      description: "The birthday (DD/MM/YYYY)",
      required: true,
      type: ApplicationCommandOptionType.String
    }) birthday: string,
    @SlashOption({
      name: "timezone",
      description: "The timezone (e.g., Europe/Paris)",
      required: true,
      type: ApplicationCommandOptionType.String
    }) timezone: string,
    @SlashOption({
      name: "hour",
      description: "The hour (HH:MM)",
      required: false,
      type: ApplicationCommandOptionType.String
    }) hour: string,
    interaction: CommandInteraction
  ) {
    try {
      // Format the hour string to ensure it's in HH:MM format
      const hourStr = hour ? hour.includes(':') ? 
        hour.padStart(5, '0') : // Pad if it's like "4:00" to "04:00"
        `${hour.padStart(2, '0')}:00` : // Add :00 if just hour number
        "00:00"; // Default to midnight

      const timezoneStr = timezone.trim();
  
      // Validate timezone
      if (!DateTime.local().setZone(timezoneStr).isValid) {
        await interaction.reply({
          content: "Invalid timezone. Please use a valid timezone identifier (e.g., Europe/Paris, America/New_York).",
          flags: 1 << 6
        });
        return;
      }
  
      // Validate birthday format
      const birthdayRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
      const match = birthday.match(birthdayRegex);
      if (!match) {
        await interaction.reply({
          content: "Invalid date format. Please use DD/MM/YYYY format.",
          flags: 1 << 6
        });
        return;
      }
  
      const [, day, month, year] = match;
  
      // Update hour format validation to handle padded values
      const hourRegex = /^([0-9]{2}):([0-5][0-9])$/;
      if (!hourStr.match(hourRegex)) {
        await interaction.reply({
          content: "Invalid hour format. Please use HH:MM format (24h), e.g., 04:00 or 14:30",
          flags: 1 << 6
        });
        return;
      }
  
      // Convert user input to a DateTime object
      const userDateTime = DateTime.fromFormat(
        `${day}/${month}/${year} ${hourStr}`,
        "dd/MM/yyyy HH:mm",
        { zone: timezoneStr }
      );
  
      // Ensure the date is valid and not in the future
      if (!userDateTime.isValid || userDateTime > DateTime.now()) {
        await interaction.reply({
          content: "Please enter a valid date that is not in the future.",
          flags: 1 << 6
        });
        return;
      }

      await db
        .insert(users)
        .values({
          userId: user.id,
          birthday: userDateTime.toJSDate(),
          timezone: timezoneStr,
        })
        .onConflictDoUpdate({
          target: users.userId,
          set: {
            birthday: userDateTime.toJSDate(),
            timezone: timezoneStr,
            updatedAt: new Date(),
          },
        });

      await interaction.reply({
        content: `Timezone for <@${user.id}> has been set to: ${timezoneStr} ✨`,
        flags: 1 << 6
      });
    } catch (error) {
      console.error('Error setting timezone:', error);
      await interaction.reply({
        content: "Sorry, there was an error setting the timezone. Please try again later.",
        flags: 1 << 6
      });
    }
  }

  @Slash({
    description: "Check a user's birthday (Admin only)",
    defaultMemberPermissions: ["Administrator"]
  })
  async checkbirthday(
    @SlashOption({
      name: "user",
      description: "The user to check birthday for",
      required: true,
      type: ApplicationCommandOptionType.User
    }) user: User,
    interaction: CommandInteraction
  ) {
    try {
      // Get user's birthday from database
      const userProfile = await db
        .select()
        .from(users)
        .where(({ userId }) => eq(userId, user.id))
        .limit(1);

      if (!userProfile.length) {
        await interaction.reply({
          content: `<@${user.id}> hasn't set their birthday yet.`,
          flags: 1 << 6
        });
        return;
      }

      const profile = userProfile[0];
      if (!profile.birthday || !profile.timezone) {
        throw new Error('Missing birthday data');
      }
      
      const birthday = DateTime.fromJSDate(profile.birthday)
        .setZone(profile.timezone);

      if (!birthday.isValid) {
        throw new Error('Invalid stored datetime');
      }

      const timestamp = Math.floor(birthday.toSeconds());
      await interaction.reply({
        content: `Birthday for <@${user.id}>:\nDate: <t:${timestamp}:F>\nTimezone: ${profile.timezone}`,
        flags: 1 << 6
      });
    } catch (error) {
      console.error('Error fetching birthday:', error);
      await interaction.reply({
        content: "Sorry, there was an error fetching the birthday information.",
        flags: 1 << 6
      });
    }
  }
}
