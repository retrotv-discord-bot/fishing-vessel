import { ChatInputCommandInteraction, MessageComponentInteraction } from "discord.js";

export async function getUserDisplayName(
    interaction: ChatInputCommandInteraction | MessageComponentInteraction,
    id: string,
): Promise<string> {
    const member = await interaction.guild?.members.fetch(id).catch(() => null);
    return member?.displayName ?? "";

    // TO-DO: 서버를 나간 유저도 추가할 것
    // const user = await client.users.fetch(userId);
    // const name = member?.displayName ?? user.displayName;
}
