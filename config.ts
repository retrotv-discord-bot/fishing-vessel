import dotenv from "dotenv";

dotenv.config();

const { BOT_TOKEN, BOT_ID, GUILD_ID } = process.env;

if (!BOT_TOKEN || !BOT_ID || !GUILD_ID) {
    throw new Error("Missing environment variables");
}

export const config = {
    BOT_TOKEN,
    BOT_ID,
    GUILD_ID,
};
