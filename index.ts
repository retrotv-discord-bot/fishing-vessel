import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import SlashCommand from "./src/types/slash-command";
import PrefixCommand from "./src/types/prefix-command";

import { slashCommands, prefixCommands } from "./src/discord/commands";
import { events } from "./src/discord/events";
import { config } from "./config";

declare global {
    // prettier-ignore
    var client: Client & { // NOSONAR
        slashCommands: Collection<string, SlashCommand>;
        prefixCommands: Collection<string, PrefixCommand>;
    };
}

global.client = Object.assign(
    new Client({
        intents: [GatewayIntentBits.Guilds],
        partials: [Partials.Channel],
    }),
    {
        slashCommands: new Collection<string, SlashCommand>(),
        prefixCommands: new Collection<string, PrefixCommand>(),
    },
);

// 슬래시 명령어 불러오기
slashCommands.forEach((command) => {
    global.client.slashCommands.set(command.data.name, command);
});

// prefix 명령어 불러오기
prefixCommands.forEach((command) => {
    global.client.prefixCommands.set(command.name, command);
});

// 이벤트 불러오기
events.forEach((event) => {
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
});

client.login(config.BOT_TOKEN);
