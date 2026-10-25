import { ChatInputCommandInteraction, MessageComponentInteraction } from "discord.js";
import VesselNotExistsError from "../errors/vessel-not-exists.error";

export function getVesselName(interaction: ChatInputCommandInteraction | MessageComponentInteraction): string {
    let vesselName;
    if (interaction.isChatInputCommand()) {
        vesselName = interaction.options.getString("선명");
    } else if (interaction.isMessageComponent()) {
        vesselName = interaction.customId.replace("embark_", "");
    }

    if (!vesselName) {
        throw new VesselNotExistsError();
    }

    return vesselName;
}
