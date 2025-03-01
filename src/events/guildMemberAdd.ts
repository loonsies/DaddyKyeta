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
            console.log(member)
            console.log(await member.roles)


            const unknownRoleId = process.env.UNKNOWN_ROLE_ID;
            if (!unknownRoleId) {
                console.error("UNKNOWN_ROLE_ID not found in environment variables");
                return;
            }

            await member.roles.add(unknownRoleId);
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