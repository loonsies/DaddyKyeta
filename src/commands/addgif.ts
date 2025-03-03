import { Discord, Slash, SlashOption } from "discordx";
import { CommandInteraction, ApplicationCommandOptionType, MessageFlags } from "discord.js";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import ffmpeg from 'fluent-ffmpeg';
import { unlink } from 'fs/promises';

@Discord()
export class AddGifCommand {
  private readonly validFolders = ["bonk", "boop"] as const;
  private readonly validExtensions = [".gif", ".mp4", ".webp"] as const;
  private readonly maxSizeBytes = 10 * 1024 * 1024; // 10MB in bytes
  
  private async convertToWebp(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('webp')
        .addOutputOptions(['-vcodec', 'libwebp', '-lossless', '0', '-quality', '100', '-loop', '0'])
        .save(outputPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err));
    });
  }

  @Slash({
    description: "Add a GIF/MP4 to bonk or boop folder (Admin only)",
    defaultMemberPermissions: ["Administrator"]
  })
  async addgif(
    @SlashOption({
      name: "folder",
      description: "The folder to add the file to (bonk/boop)",
      required: true,
      type: ApplicationCommandOptionType.String
    }) folder: "bonk" | "boop",
    @SlashOption({
      name: "url",
      description: "The URL of the GIF/MP4/WEBM to add",
      required: true,
      type: ApplicationCommandOptionType.String
    }) url: string,
    @SlashOption({
      name: "name",
      description: "The name to save the file as (without extension, uses original filename if not specified)",
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
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // Validate URL extension
      const urlLower = url.toLowerCase();
      const extension = this.validExtensions.find(ext => urlLower.endsWith(ext));
      if (!extension) {
        await interaction.reply({
          content: `The URL must point to one of these file types: ${this.validExtensions.join(", ")}`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // Get filename from URL if name is not provided
      let sanitizedName: string;
      if (name) {
        sanitizedName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      } else {
        // Extract filename from URL and remove extension
        const urlFilename = new URL(url).pathname.split('/').pop() || 'unnamed';
        sanitizedName = urlFilename.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      }
      const filename = `${sanitizedName}${extension}`;
      
      // Get the assets folder path
      const assetsFolder = path.join(
        path.dirname(new URL(import.meta.url).pathname),
        "../../assets",
        folder
      );

      // Check if file already exists
      if (fs.existsSync(path.join(assetsFolder, filename))) {
        await interaction.reply({
          content: `A file with the name "${filename}" already exists in the ${folder} folder.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // Defer the reply as downloading might take some time
      await interaction.deferReply({ ephemeral: true });

      // Download and save the file
      const filePath = path.join(assetsFolder, filename);
      const finalFilePath = extension === '.mp4' 
        ? path.join(assetsFolder, `${sanitizedName}.webp`)
        : filePath;

      await new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        let downloadedBytes = 0;

        protocol.get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download file: ${response.statusCode}`));
            return;
          }

          // Check Content-Length if available
          const contentLength = response.headers['content-length'];
          if (contentLength && parseInt(contentLength) > this.maxSizeBytes) {
            reject(new Error(`File size exceeds 10MB limit`));
            return;
          }

          const fileStream = fs.createWriteStream(filePath);

          response.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (downloadedBytes > this.maxSizeBytes) {
              fileStream.destroy();
              fs.unlink(filePath, () => {});
              reject(new Error(`File size exceeds 10MB limit`));
            }
          });

          response.pipe(fileStream);

          fileStream.on('finish', async () => {
            fileStream.close();
            if (extension === '.mp4') {
              try {
                await this.convertToWebp(filePath, finalFilePath);
                await unlink(filePath); // Delete the original MP4 file
              } catch (err) {
                await unlink(filePath).catch(() => {}); // Cleanup on error
                reject(err);
                return;
              }
            }
            resolve(true);
          });

          fileStream.on('error', (err) => {
            fs.unlink(filePath, () => {}); // Delete the file if there was an error
            reject(err);
          });
        }).on('error', reject);
      });

      // Send success message with the final filename
      const finalFilename = path.basename(finalFilePath);
      await interaction.editReply({
        content: `Successfully added "${finalFilename}" to the ${folder} folder! ✨`,
      });

    } catch (error) {
      console.error('Error adding file:', error);
      const message = interaction.deferred ? 
        interaction.editReply.bind(interaction) : 
        interaction.reply.bind(interaction);
      
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      await message({
        content: `Sorry, there was an error adding the file: ${errorMessage}. Please try again.`,
        ephemeral: true
      });
    }
  }
} 