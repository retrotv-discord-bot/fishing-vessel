import { ApplicationCommandType, ContextMenuCommandBuilder } from "discord.js";

import ContextMenuCommand from "../../../../types/context-menu-command";

export default new ContextMenuCommand({
    data: new ContextMenuCommandBuilder().setName("유저 정보").setType(ApplicationCommandType.User),
    async execute(interaction): Promise<void> {
        if (!interaction.isUserContextMenuCommand()) {
            return;
        }
        const user = interaction.targetUser;

        await interaction.reply({
            embeds: [
                {
                    image: { url: user.displayAvatarURL() },
                    color: 0x0099ff,
                    title: `${user.username}`,
                    description: "유저 정보",
                },
            ],
            ephemeral: true,
        });
    },
});
