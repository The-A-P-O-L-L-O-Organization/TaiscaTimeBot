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
  return state;
}

function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  return interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator) ?? false;
}

async function announceYear(year: number): Promise<void> {
  try {
    const channel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);
    if (channel && "send" in channel) {
      await (channel as { send: (msg: string) => unknown }).send(`The new year has begun! It is now Year ${year}.`);
    }
  } catch (err) {
    console.error("Failed to send year announcement:", err);
  }
}

async function processTick(): Promise<void> {
  if (state.paused) return;

  const oldYear = Math.floor(state.totalYears);
  state.totalYears += state.rateYears;
  const newYear = Math.floor(state.totalYears);

  if (newYear > state.lastAnnouncedYear) {
    state.lastAnnouncedYear = newYear;
    saveState(state);
    await announceYear(newYear);
  } else {
    saveState(state);
  }
}

function getMsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return midnight.getTime() - now.getTime();
}

function scheduleNextTick(): void {
  const delay = getMsUntilMidnight();
  setTimeout(async () => {
    await processTick();
    scheduleNextTick();
  }, delay);
}

async function handleTime(interaction: ChatInputCommandInteraction): Promise<void> {
  const result = calculateTime(getState());
  await interaction.reply(formatTime(result));
}

async function handleSetRate(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: "You need Administrator permission.", ephemeral: true });
    return;
  }
  const years = interaction.options.getNumber("years", true);

  const s = getState();
  s.rateYears = years;
  s.lastAnnouncedYear = Math.floor(s.totalYears);
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

  s.totalYears = years;
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
  saveState(s);
  await interaction.reply("Time progression paused. Midnight ticks will not advance time.");
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
  s.paused = false;
  saveState(s);
  await interaction.reply("Time progression resumed. Next midnight tick will advance time.");
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

  scheduleNextTick();

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
