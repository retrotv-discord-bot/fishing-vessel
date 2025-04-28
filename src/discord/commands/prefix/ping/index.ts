import { Message } from "discord.js";
import PrefixCommand from "../../../../types/prefix-command";

export default new PrefixCommand({
    name: "ping",
    description: "Ping the bot to check if it's alive",
    aliases: ["핑"],
    async execute(message: Message) {
        await message.reply("pong");
    },
});
