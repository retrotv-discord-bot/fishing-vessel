import { Message } from "discord.js";

export default class PrefixCommand {
    name: string;
    description: string;
    execute: (message: Message) => Promise<void> | void;
    prefix?: string;

    constructor(object: {
        name: string;
        description: string;
        execute: (message: Message) => Promise<void> | void;
        prefix?: string;
    }) {
        this.name = object.name;
        this.description = object.description;
        this.execute = object.execute;
        this.prefix = object.prefix ?? "!";
    }
}
