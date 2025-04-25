import { REST, Routes } from "discord.js";
import { config } from "../../../../config";
import { slashCommands } from "../../commands";

const commandsData = Object.values(slashCommands).map((command) => command.data);

const rest = new REST({ version: "10" }).setToken(config.BOT_TOKEN);

(async () => {
    try {
        console.log("Started refreshing application (/) commands.");

        await rest.put(Routes.applicationGuildCommands(config.BOT_ID, config.GUILD_ID), {
            body: commandsData,
        });

        console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error(error);
    }
})();
