import { Discord, On, Client } from "discordx";
import { GuildMember } from "discord.js";

@Discord()
export class GuildMemberAddEvent {
    @On({ event: "guildMemberAdd" })
    async onMemberJoin(member: GuildMember, client: Client) {
        try {
            if (!member) {
                console.error("Member object is undefined");
                return;
            }

            // Debug logging to understand the member object structure
            console.log("Member object:", {
                id: member.id,
                guildId: member.guild?.id,
                roles: member.roles,
                isPartial: member.partial
            });

            // Check if roles manager exists
            if (!member.roles?.cache) {
                console.error("Member roles manager is undefined");
                return;
            }

            const unknownRoleId = process.env.UNKNOWN_ROLE_ID;
            if (!unknownRoleId) {
                console.error("UNKNOWN_ROLE_ID not found in environment variables");
                return;
            }

            // Ensure the member is fetched before trying to modify roles
            const fetchedMember = await member.fetch();
            await fetchedMember.roles.add(unknownRoleId);
        } catch (error) {
            console.error("Error in onMemberJoin:", {
                error,
                memberExists: !!member,
                memberId: member?.id,
                guildId: member?.guild?.id,
                unknownRoleId: process.env.UNKNOWN_ROLE_ID,
                clientReady: client?.isReady(),
                guildsAvailable: client?.guilds?.cache?.size
            });
        }
    }
} 