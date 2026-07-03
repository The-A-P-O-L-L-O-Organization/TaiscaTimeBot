import "dotenv/config";
import { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { loadState, saveState, type BotState } from "./storage.js";
import { calculateTime, formatTime } from "./timekeeper.js";

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error("DISCORD_TOKEN is required in .env");
  process.exit(1);
}

const ANNOUNCEMENT_CHANNEL_ID = "1520917412046700606";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let state: BotState;

function getState(): BotState {
  if (state.baseRealTimestamp === 0) {
    state.baseRealTimestamp = Date.now();
    saveState(state);
  }
  return state;
}

function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  return interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator) ?? false;
}

async function checkYearTick(): Promise<void> {
  const s = getState();
  const now = Date.now();
  const totalYears = calculateTime(s, now).totalYears;
  const year = Math.floor(totalYears);

  if (year > s.lastAnnouncedYear) {
    s.lastAnnouncedYear = year;
    saveState(s);
    try {
      const channel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);
      if (channel && "send" in channel) {
        await (channel as { send: (msg: string) => unknown }).send(`The new year has begun! It is now Year ${year}.`);
      }
    } catch (err) {
      console.error("Failed to send year announcement:", err);
    }
  }
}

async function handleTime(interaction: ChatInputCommandInteraction): Promise<void> {
  const s = getState();
  const result = calculateTime(s, Date.now());
  await interaction.reply(formatTime(result));
}

async function handleSetRate(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: "You need Administrator permission.", ephemeral: true });
    return;
  }
  const years = interaction.options.getNumber("years", true);

  const s = getState();
  const now = Date.now();
  const current = calculateTime(s, now);

  s.baseInGameYears = current.totalYears;
  s.baseRealTimestamp = now;
  s.rateYears = years;
  s.totalPausedMs = 0;
  s.pausedAtMs = 0;
  s.paused = false;
  s.lastAnnouncedYear = Math.floor(current.totalYears);
  saveState(s);

  await interaction.reply(`Rate set to ${years} years per day.`);
}

async function handleSetTime(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: "You need Administrator permission.", ephemeral: true });
    return;
  }
  const years = interaction.options.getNumber("years", true);
  const s = getState();

  s.baseInGameYears = years;
  s.baseRealTimestamp = Date.now();
  s.totalPausedMs = 0;
  s.pausedAtMs = 0;
  s.paused = false;
  s.lastAnnouncedYear = Math.floor(years);
  saveState(s);

  await interaction.reply(`Time set to year ${Math.floor(years)}.`);
}

async function handlePause(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: "You need Administrator permission.", ephemeral: true });
    return;
  }
  const s = getState();
  if (s.paused) {
    await interaction.reply("Time is already paused.");
    return;
  }
  s.paused = true;
  s.pausedAtMs = Date.now();
  saveState(s);
  await interaction.reply("Time progression paused.");
}

async function handleResume(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: "You need Administrator permission.", ephemeral: true });
    return;
  }
  const s = getState();
  if (!s.paused) {
    await interaction.reply("Time is already running.");
    return;
  }
  s.totalPausedMs += Date.now() - s.pausedAtMs;
  s.pausedAtMs = 0;
  s.paused = false;
  saveState(s);
  await interaction.reply("Time progression resumed.");
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
].map((c) => c.toJSON());

client.once("ready", async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  state = loadState();
  console.log("State loaded:", JSON.stringify(state, null, 2));

  setInterval(checkYearTick, 10000);

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
    console.log("Slash commands registered.");
  } catch (err) {
    console.error("Failed to register commands:", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case "time":
        await handleTime(interaction);
        break;
      case "setrate":
        await handleSetRate(interaction);
        break;
      case "settime":
        await handleSetTime(interaction);
        break;
      case "pause":
        await handlePause(interaction);
        break;
      case "resume":
        await handleResume(interaction);
        break;
    }
  } catch (err) {
    console.error("Error handling command:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (!interaction.replied) {
      await interaction.reply({ content: `Error: ${msg}`, ephemeral: true });
    }
  }
});

client.login(TOKEN);
