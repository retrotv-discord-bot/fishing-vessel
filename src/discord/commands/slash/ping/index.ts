import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import SlashCommand from "../../../../types/slash-command";

export default new SlashCommand({
    data: new SlashCommandBuilder()
        .setName("ping")
        .setNameLocalizations({
            ko: "핑",
        })
        .setDescription("Ping the bot to check if it's alive")
        .setDescriptionLocalizations({
            ko: "봇이 살아있는지 확인하기 위해 핑을 보냅니다",
        }),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (interaction.options.getSubcommand() === "ping") {
            await interaction.reply("pong");
        }
    },
});
