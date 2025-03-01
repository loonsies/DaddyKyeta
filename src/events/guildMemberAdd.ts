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

            // Get the guild from the client using guildId
            const guild = client.guilds.cache.get(member.guild?.id || '');
            if (!guild) {
                console.error(`Guild not found for member ${member.id}`);
                return;
            }

            // Fetch a fresh instance of the member
            const fetchedMember = await guild.members.fetch(member.id);
            if (!fetchedMember) {
                console.error("Could not fetch member");
                return;
            }

            const unknownRoleId = process.env.UNKNOWN_ROLE_ID;
            if (!unknownRoleId) {
                console.error("UNKNOWN_ROLE_ID not found in environment variables");
                return;
            }

            await fetchedMember.roles.add(unknownRoleId);
            console.log(`Added unknown role to new member ${fetchedMember.id} in guild ${guild.name}`);
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