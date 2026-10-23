import dotenv from "dotenv";

dotenv.config({ quiet: true });

let { BOT_TOKEN, APPLICATION_ID, PUBLIC_KEY, GUILD_ID, PREFIX } = process.env;

if (!BOT_TOKEN || !APPLICATION_ID) {
    throw new Error("Missing environment variables");
}

GUILD_ID ??= "";
PREFIX ??= "!";

export const config = {
    BOT_TOKEN,
    APPLICATION_ID,
    PUBLIC_KEY,
    GUILD_ID,
    PREFIX,
};
