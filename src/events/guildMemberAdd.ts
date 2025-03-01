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

            if (!member.guild) {
                console.error("Member guild is undefined");
                return;
            }

            // Fetch a fresh instance of the member
            const fetchedMember = await member.guild.members.fetch(member.id);
            if (!fetchedMember) {
                console.error("Could not fetch member");
                return;
            }

            if (!fetchedMember.roles) {
                console.error("Fetched member roles object is undefined");
                return;
            }

            const unknownRoleId = process.env.UNKNOWN_ROLE_ID;
            if (!unknownRoleId) {
                console.error("UNKNOWN_ROLE_ID not found in environment variables");
                return;
            }

            await fetchedMember.roles.add(unknownRoleId);
            console.log(`Added unknown role to new member ${fetchedMember.id}`);
        } catch (error) {
            console.error("Error in onMemberJoin:", {
                error,
                memberExists: !!member,
                guildExists: !!member?.guild,
                memberId: member?.id,
                guildId: member?.guild?.id,
                unknownRoleId: process.env.UNKNOWN_ROLE_ID
            });
        }
    }
} 