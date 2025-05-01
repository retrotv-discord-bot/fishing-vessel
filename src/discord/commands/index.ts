import ContextMenuCommand from "../../templates/context-menu-command";
import PrefixCommand from "../../templates/prefix-command";
import SlashCommand from "../../templates/slash-command";
import contextUserinfo from "./context-menu/userinfo";
import slashPing from "./slash/ping";
import prefixPing from "./prefix/ping";

export const contextMenuCommands: ContextMenuCommand[] = [contextUserinfo];
export const slashCommands: SlashCommand[] = [slashPing];
export const prefixCommands: PrefixCommand[] = [prefixPing];
