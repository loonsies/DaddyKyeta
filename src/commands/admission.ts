import type { ButtonInteraction, CommandInteraction, ModalSubmitInteraction } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, TextChannel } from "discord.js";
import { ButtonComponent, Discord, ModalComponent, Slash } from "discordx";

if (!process.env.ADMISSIONS_CHANNEL_ID || !process.env.UNKNOWN_ROLE_ID || !process.env.MEMBER_ROLE_ID || !process.env.GUEST_ROLE_ID) {
  throw new Error("Missing required environment variables for admission system");
}

@Discord()
export class AdmissionCommands {
  @Slash({
    description: "Adds the admission message with buttons to the channel",
    defaultMemberPermissions: ["Administrator"]
  })
  async addadmissionmessage(interaction: CommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = interaction.channel as TextChannel;
    await channel.send({
      content: "Welcome to the Wrath FC discord server! ✨\nOnly members and FC Friends are allowed here.\nInto which category would you fit into?",
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("admission-member")
            .setLabel("Wrath member")
            .setEmoji("😈")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("admission-friend")
            .setLabel("FC Friend")
            .setEmoji("👋")
            .setStyle(ButtonStyle.Secondary)
        ),
      ],
    });

    await interaction.editReply({
      content: "Admission message created!"
    });
  }

  @ButtonComponent({ id: "admission-member" })
  async handleMemberButton(interaction: ButtonInteraction) {
    await this.showIngameNameModal(interaction, "member");
  }

  @ButtonComponent({ id: "admission-friend" })
  async handleFriendButton(interaction: ButtonInteraction) {
    await this.showIngameNameModal(interaction, "friend");
  }

  private async showIngameNameModal(interaction: ButtonInteraction, type: "member" | "friend") {
    const modal = new ModalBuilder()
      .setCustomId(`admission-modal-${type}`)
      .setTitle("Enter Your In-Game Name");

    const nameInput = new TextInputBuilder()
      .setCustomId("ingame-name")
      .setLabel("What is your in-game name?")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter your character name")
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput)
    );

    await interaction.showModal(modal);
  }

  @ModalComponent({ id: /^admission-modal-(member|friend)$/ })
  async handleAdmissionModal(interaction: ModalSubmitInteraction) {
    const type = interaction.customId.includes("member") ? "member" : "friend";
    const inGameName = interaction.fields.getTextInputValue("ingame-name");

    // Send confirmation to user
    await interaction.reply({
      content: "Your application has been successfully sent! Please wait for staff review.",
      flags: MessageFlags.Ephemeral,
    });

    // Send application to admissions channel
    const admissionsChannel = await interaction.client.channels.fetch(process.env.ADMISSIONS_CHANNEL_ID!) as TextChannel;
    if (!admissionsChannel) {
      console.error("Admissions channel not found!");
      return;
    }

    const typeLabel = type === "member" ? "Wrath member" : "FC Friend";
    await admissionsChannel.send({
      content: `New application from <@${interaction.user.id}> (ID: ${interaction.user.id})\n`
        + `Type: ${typeLabel}\n`
        + `In-game name: ${inGameName}`,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`admission-accept-${type}-${interaction.user.id}`)
            .setLabel("Accept")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`admission-decline-${interaction.user.id}`)
            .setLabel("Decline")
            .setStyle(ButtonStyle.Danger)
        ),
      ],
    });
  }

  @ButtonComponent({ id: /^admission-accept-(member|friend)-\d+$/ })
  async handleAcceptButton(interaction: ButtonInteraction) {
    const parts = interaction.customId.split("-");
    const type = parts[2];
    const userId = parts[3];
    
    const member = await interaction.guild?.members.fetch(userId);
    
    if (!member) {
      await interaction.reply({
        content: "Error: Member not found",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      // Remove unknown role
      await member.roles.remove(process.env.UNKNOWN_ROLE_ID!);
      
      // Add appropriate role
      const roleId = type === "member" ? process.env.MEMBER_ROLE_ID! : process.env.GUEST_ROLE_ID!;
      await member.roles.add(roleId);

      // Update the message
      await interaction.message.edit({
        content: `${interaction.message.content}\n\n✅ Accepted by <@${interaction.user.id}>`,
        components: [], // Remove the buttons
      });

      await interaction.reply({
        content: "Application accepted and roles updated!",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("Error updating roles:", error);
      await interaction.reply({
        content: "Error updating roles. Please check permissions and try again.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  @ButtonComponent({ id: /^admission-decline-\d+$/ })
  async handleDeclineButton(interaction: ButtonInteraction) {
    const modal = new ModalBuilder()
      .setCustomId(`decline-reason-${interaction.customId.split("-")[2]}`)
      .setTitle("Decline Application");

    const reasonInput = new TextInputBuilder()
      .setCustomId("decline-reason")
      .setLabel("Reason for declining")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Enter the reason for declining this application")
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
    );

    await interaction.showModal(modal);
  }

  @ModalComponent({ id: /^decline-reason-\d+$/ })
  async handleDeclineModal(interaction: ModalSubmitInteraction) {
    const userId = interaction.customId.split("-")[2];
    const reason = interaction.fields.getTextInputValue("decline-reason");

    try {
      // Send DM to user
      const user = await interaction.client.users.fetch(userId);
      await user.send({
        content: `Your application to join Wrath FC has been declined.\nReason: ${reason}`
      });

      // Update the message
      await interaction.message?.edit({
        content: `${interaction.message.content}\n\n❌ Declined by <@${interaction.user.id}>\nReason: ${reason}`,
        components: [], // Remove the buttons
      });

      await interaction.reply({
        content: "Application declined and user notified.",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("Error handling decline:", error);
      await interaction.reply({
        content: "Error processing decline. The user might have DMs disabled.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
} 