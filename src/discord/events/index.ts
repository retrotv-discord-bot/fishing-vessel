import type Event from "../../types/event";

import clientReady from "./client/ready";
import guildCreate from "./guild/create";
import interactionCreate from "./interaction/create";
import messageCreate from "./message/create";

export const events: Event[] = [clientReady, guildCreate, interactionCreate, messageCreate];
