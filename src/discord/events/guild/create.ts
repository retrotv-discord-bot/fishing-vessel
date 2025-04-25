import { Events } from "discord.js";

import { deployCommands } from "../../commands/slash/deploy-commands";
import Event from "../../../types/event";

export default new Event({
    name: Events.GuildCreate,
    once: true,
    async execute(guild) {
        await deployCommands({ guildId: guild.id });
    },
});
