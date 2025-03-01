import { Discord, On } from "discordx";
import { GuildMember } from "discord.js";

@Discord()
export class GuildMemberAddEvent {
    @On({ event: "guildMemberAdd" })
    async onMemberJoin(member: GuildMember) {
        try {
            const unknownRoleId = process.env.UNKNOWN_ROLE_ID;
            if (!unknownRoleId) {
                console.error("UNKNOWN_ROLE_ID not found in environment variables");
                return;
            }

            await member.roles.add(unknownRoleId);
            console.log(`Added unknown role to new member ${member.user.tag}`);
        } catch (error) {
            console.error(`Error adding role to new member ${member.user.tag}:`, error);
        }
    }
} 