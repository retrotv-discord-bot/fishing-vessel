import { AutocompleteInteraction, BaseInteraction, ButtonInteraction, ChatInputCommandInteraction, Events, MessageFlags } from "discord.js";
import Event from "../../../templates/event";
import VesselService from "../../../services/vessel.service";
import AlreadyEmbarkedError from "../../../errors/already-embarked.error";
import OvercapacityError from "../../../errors/overcapacity.error";
import VesselNotExistsError from "../../../errors/vessel-not-exists.error";
import { privateReply } from "../../../utils/reply";

const vesselService = new VesselService();

/**
 * 봇이 상호작용을 수신했을 때 발생하는 이벤트
 * Event that occurs when the bot receives an interaction
 */
export default new Event({
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction: BaseInteraction) {
        if (interaction.isChatInputCommand()) {
            await chatInputCommand(interaction);
        } else if (interaction.isAutocomplete()) {
            await autocomplete(interaction);
        } else if (interaction.isContextMenuCommand()) {
            const command = client.contextMenuCommands.get(interaction.commandName);

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
        } else if (interaction.isButton()) {
            await buttonCommand(interaction);
        }
    },
});

async function chatInputCommand(interaction: ChatInputCommandInteraction) {
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
}

async function autocomplete(interaction: AutocompleteInteraction) {
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

async function buttonCommand(interaction: ButtonInteraction) {
    const buttonCustomId = interaction.customId;
    if (buttonCustomId.startsWith("embark_")) {
        try {
            await vesselService.embark(interaction);
        } catch (error: unknown) {
            const errors = [VesselNotExistsError, AlreadyEmbarkedError, OvercapacityError];
            if (error instanceof Error && errors.some((E) => error instanceof E)) {
                return privateReply(interaction, error.message);
            } else {
                return privateReply(interaction, "어선 승선에 실패했습니다.");
            }
        }
    }
}
