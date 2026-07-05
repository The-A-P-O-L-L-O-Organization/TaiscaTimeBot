import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error("DISCORD_TOKEN is required in .env");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("time")
    .setDescription("Show current in-game time"),

  new SlashCommandBuilder()
    .setName("setrate")
    .setDescription("Set in-game years per day")
    .addNumberOption((opt) =>
      opt.setName("years").setDescription("In-game years per day").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("settime")
    .setDescription("Manually set the in-game year")
    .addNumberOption((opt) =>
      opt.setName("years").setDescription("Year number").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pause time progression"),

  new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resume time progression"),

  new SlashCommandBuilder()
    .setName("reset")
    .setDescription("Reset time to year 0 and pause"),

  new SlashCommandBuilder()
    .setName("maintenance")
    .setDescription("Override system for authorized user")
    .addStringOption((opt) =>
      opt
        .setName("mode")
        .setDescription("Turn override on or off")
        .setRequired(true)
        .addChoices(
          { name: "on", value: "on" },
          { name: "off", value: "off" },
        ),
    )
    .addStringOption((opt) =>
      opt.setName("code").setDescription("The override code from the logs").setRequired(false),
    ),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

try {
  console.log("Registering slash commands...");
  const data = await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: commands });
  console.log(`Registered ${(data as unknown[]).length} commands.`);
} catch (err) {
  console.error("Failed to register commands:", err);
  process.exit(1);
}
