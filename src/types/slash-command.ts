import type {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

export default class SlashCommand {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
    execute?: (interaction: ChatInputCommandInteraction) => Promise<void> | void;
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<void> | void;

    constructor(options: {
        data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
        execute?: (interaction: ChatInputCommandInteraction) => Promise<void> | void;
        autocomplete?: (interaction: AutocompleteInteraction) => Promise<void> | void;
    }) {
        if (options.execute) {
            this.execute = options.execute;
        } else if (options.autocomplete) {
            this.autocomplete = options.autocomplete;
        } else {
            throw new Error("No execute function provided");
        }

        this.data = options.data;
    }
}
