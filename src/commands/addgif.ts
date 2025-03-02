import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction, ApplicationCommandOptionType, AttachmentBuilder } from "discord.js";
import fs from "fs";
import path from "path";
import https from "https";

@Discord()
export class AddGifCommand {
  private readonly validFolders = ["bonk", "boop"] as const;

  @Slash({
    description: "Add a GIF to bonk or boop folder",
  })
  async addgif(
    @SlashOption({
      name: "folder",
      description: "The folder to add the GIF to (bonk/boop)",
      required: true,
      type: ApplicationCommandOptionType.String
    }) folder: "bonk" | "boop",
    @SlashOption({
      name: "url",
      description: "The URL of the GIF to add",
      required: true,
      type: ApplicationCommandOptionType.String
    }) url: string,
    @SlashOption({
      name: "name",
      description: "The name to save the GIF as (without extension, uses original filename if not specified)",
      required: false,
      type: ApplicationCommandOptionType.String
    }) name: string | undefined,
    interaction: CommandInteraction
  ) {
    try {
      // Validate folder
      if (!this.validFolders.includes(folder)) {
        await interaction.reply({
          content: `Invalid folder. Must be one of: ${this.validFolders.join(", ")}`,
          ephemeral: true
        });
        return;
      }

      // Validate URL
      if (!url.toLowerCase().endsWith('.gif')) {
        await interaction.reply({
          content: "The URL must point to a GIF file.",
          ephemeral: true
        });
        return;
      }

      // Get filename from URL if name is not provided
      let sanitizedName: string;
      if (name) {
        sanitizedName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      } else {
        // Extract filename from URL and remove .gif extension
        const urlFilename = new URL(url).pathname.split('/').pop() || 'unnamed';
        sanitizedName = urlFilename.replace(/\.gif$/i, '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      }
      const filename = `${sanitizedName}.gif`;
      
      // Get the assets folder path
      const assetsFolder = path.join(
        path.dirname(new URL(import.meta.url).pathname),
        "../../assets",
        folder
      );

      // Check if file already exists
      if (fs.existsSync(path.join(assetsFolder, filename))) {
        await interaction.reply({
          content: `A GIF with the name "${filename}" already exists in the ${folder} folder.`,
          ephemeral: true
        });
        return;
      }

      // Defer the reply as downloading might take some time
      await interaction.deferReply({ ephemeral: true });

      // Download and save the GIF
      const filePath = path.join(assetsFolder, filename);
      await new Promise((resolve, reject) => {
        https.get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download GIF: ${response.statusCode}`));
            return;
          }

          const fileStream = fs.createWriteStream(filePath);
          response.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            resolve(true);
          });

          fileStream.on('error', (err) => {
            fs.unlink(filePath, () => {}); // Delete the file if there was an error
            reject(err);
          });
        }).on('error', reject);
      });

      // Send success message
      await interaction.editReply({
        content: `Successfully added "${filename}" to the ${folder} folder! ✨`,
      });

    } catch (error) {
      console.error('Error adding GIF:', error);
      const message = interaction.deferred ? 
        interaction.editReply.bind(interaction) : 
        interaction.reply.bind(interaction);
      
      await message({
        content: "Sorry, there was an error adding the GIF. Please try again later.",
        ephemeral: true
      });
    }
  }
} 