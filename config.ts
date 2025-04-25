import dotenv from "dotenv";

dotenv.config();

let { BOT_TOKEN, BOT_ID, GUILD_ID, PREFIX } = process.env;

if (!BOT_TOKEN || !BOT_ID || !GUILD_ID || !PREFIX) {
    throw new Error("Missing environment variables");
}

if (!PREFIX) {
    PREFIX = "!";
}

export const config = {
    BOT_TOKEN,
    BOT_ID,
    GUILD_ID,
    PREFIX,
};
