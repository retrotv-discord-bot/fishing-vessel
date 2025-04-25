import PrefixCommand from "../../types/prefix-command";
import SlashCommand from "../../types/slash-command";
import slashPing from "./slash/ping";
import prefixPing from "./prefix/ping";

export const slashCommands: SlashCommand[] = [slashPing];
export const prefixCommands: PrefixCommand[] = [prefixPing];
