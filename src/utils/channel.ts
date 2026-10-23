import type { ChatInputCommandInteraction, Client } from "discord.js";

export function getChannelNameByChatInputCommandInteraction(interaction: ChatInputCommandInteraction): string {
    const channel = interaction.channel && "name" in interaction.channel ? interaction.channel : null;
    return channel?.name ? channel.name : "불명";
}

export async function getChannelNameByClientAndId(client: Client, channelId: string): Promise<string> {
    try {
        const channel = await client.channels.fetch(channelId);
        return channel && "name" in channel && channel.name ? channel.name : "불명";
    } catch {
        return "불명";
    }
}
