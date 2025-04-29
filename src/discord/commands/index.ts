import ContextMenuCommand from "../../types/context-menu-command";
import PrefixCommand from "../../types/prefix-command";
import SlashCommand from "../../types/slash-command";
import contextUserinfo from "./context-menu/userinfo";
import slashPing from "./slash/ping";
import prefixPing from "./prefix/ping";

export const contextMenuCommands: ContextMenuCommand[] = [contextUserinfo];
export const slashCommands: SlashCommand[] = [slashPing];
export const prefixCommands: PrefixCommand[] = [prefixPing];
