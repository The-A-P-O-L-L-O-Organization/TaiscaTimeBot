import "dotenv/config";
import { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { loadState, saveState, type BotState } from "./storage.js";
import { calculateTime, formatTime } from "./timekeeper.js";
import {
  isAuthorizedUser,
  hasOverride,
  generateCode,
  validateCode,
  deactivate,
} from "./override.js";

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error("DISCORD_TOKEN is required in .env");
  process.exit(1);
}

const ANNOUNCEMENT_CHANNEL_ID = "1520917412046700606";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const MS_PER_DAY = 86400000;

let state: BotState;

function getState(): BotState {
  if (state.baseRealTimestamp === 0) {
    state.baseRealTimestamp = Date.now();
    saveState(state);
  }
  return state;
}

function catchUpMissedMidnights(): void {
  if (state.paused) return;

  const now = Date.now();
  const baseDay = Date.UTC(
    new Date(state.baseRealTimestamp).getUTCFullYear(),
    new Date(state.baseRealTimestamp).getUTCMonth(),
    new Date(state.baseRealTimestamp).getUTCDate(),
  );
  const today = Date.UTC(
    new Date(now).getUTCFullYear(),
    new Date(now).getUTCMonth(),
    new Date(now).getUTCDate(),
  );

  if (today > baseDay) {
    const daysMissed = Math.floor((today - baseDay) / MS_PER_DAY);
    if (daysMissed > 0) {
      state.baseInGameYears += daysMissed * state.rateYears;
      state.baseRealTimestamp = today;
      console.log(`Caught up ${daysMissed} missed midnights. Total years now: ${state.baseInGameYears}`);
      saveState(state);
    }
  }
}

function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  if (hasOverride(interaction.user.id)) return true;
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

function getMsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return midnight.getTime() - now.getTime();
}

function scheduleNextMidnight(): void {
  const delay = getMsUntilMidnight();
  console.log(`Next midnight tick in ${Math.round(delay / 1000)}s`);
  setTimeout(midnightTick, delay);
}

async function midnightTick(): Promise<void> {
  if (state.paused) {
    console.log("Midnight tick skipped — bot is paused.");
    scheduleNextMidnight();
    return;
  }

  const now = Date.now();
  const current = calculateTime(state, now);
  const year = Math.floor(current.totalYears);

  const todayMidnight = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());

  state.baseInGameYears = current.totalYears;
  state.baseRealTimestamp = todayMidnight;

  if (year > state.lastAnnouncedYear) {
    state.lastAnnouncedYear = year;
    saveState(state);
    console.log(`Midnight tick: Year ${year}`);
    await announceYear(year);
  } else {
    saveState(state);
  }

  scheduleNextMidnight();
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

async function handleMaintenance(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  if (!isAuthorizedUser(userId)) {
    await interaction.reply({ content: "You are not authorized to use this command.", ephemeral: true });
    return;
  }

  const mode = interaction.options.getString("mode", true);
  const code = interaction.options.getString("code");

  if (mode === "off") {
    if (hasOverride(userId)) {
      deactivate(userId);
      await interaction.reply({ content: "Override mode deactivated.", ephemeral: true });
    } else {
      await interaction.reply({ content: "Override mode is not currently active.", ephemeral: true });
    }
    return;
  }

  if (code) {
    const result = validateCode(userId, code);
    await interaction.reply({ content: result.message, ephemeral: true });
    return;
  }

  generateCode(userId);
  await interaction.reply({
    content:
      "Override code generated and logged to console.\n\n" +
      "Check the Docker logs for the code, then run:\n" +
      "`/maintenance code:<your-code>`\n\n" +
      "The code expires in 5 minutes.",
    ephemeral: true,
  });
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

client.once("ready", async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  state = loadState();
  console.log("State loaded:", JSON.stringify(state, null, 2));

  if (state.baseRealTimestamp === 0) {
    state.baseRealTimestamp = Date.now();
    saveState(state);
  }

  catchUpMissedMidnights();
  scheduleNextMidnight();

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
      case "maintenance":
        await handleMaintenance(interaction);
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
