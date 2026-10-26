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

// 여러 유저의 표시 이름을 병렬로 조회 (입력 순서 유지)
export async function getUsersDisplayName(
    interaction: ChatInputCommandInteraction | MessageComponentInteraction,
    ids: string[],
): Promise<string[]> {
    return await Promise.all(ids.map((id) => getUserDisplayName(interaction, id)));
}
