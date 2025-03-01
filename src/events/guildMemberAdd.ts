import { Discord, On } from "discordx";
import { GuildMember } from "discord.js";

@Discord()
export class GuildMemberAddEvent {
    @On({ event: "guildMemberAdd" })
    async onMemberJoin(member: GuildMember) {
        try {
            if (!member) {
                console.error("Member object is undefined");
                return;
            }

            if (!member.roles) {
                console.error("Member roles object is undefined");
                return;
            }

            const unknownRoleId = process.env.UNKNOWN_ROLE_ID;
            if (!unknownRoleId) {
                console.error("UNKNOWN_ROLE_ID not found in environment variables");
                return;
            }

            await member.roles.add(unknownRoleId);
            console.log(`Added unknown role to new member ${member.id}`);
        } catch (error) {
            console.error("Error in onMemberJoin:", {
                error,
                memberExists: !!member,
                rolesExists: !!(member?.roles),
                memberId: member?.id,
                guildId: member?.guild?.id,
                memberPermissions: member?.permissions?.toArray(),
                unknownRoleId: process.env.UNKNOWN_ROLE_ID
            });
        }
    }
} 