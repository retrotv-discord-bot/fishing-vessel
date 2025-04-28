import { AutocompleteInteraction, ChatInputCommandInteraction, Events, MessageFlags } from "discord.js";
import Event from "../../../types/event";

export default new Event({
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = client.slashCommands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                if (command.execute) {
                    await command.execute(interaction);
                }
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        content: "There was an error while executing this command!",
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    await interaction.reply({
                        content: "There was an error while executing this command!",
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }
        } else if (interaction.isAutocomplete()) {
            const command = client.slashCommands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                if (command.autocomplete) {
                    await command.autocomplete(interaction);
                }
            } catch (error) {
                console.error(error);
            }
        }
    },
});
