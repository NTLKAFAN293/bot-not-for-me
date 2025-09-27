// index.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cron = require('node-cron');

const TOKEN = process.env.TOKEN;
if (!TOKEN) { console.error('❌ TOKEN not defined. Set TOKEN in .env or environment variables.'); process.exit(1); }

const START_CHANNEL_ID = '1421293986315767920';
const END_CHANNEL_ID   = '1421294259499434015';
const AFFECTED_ROLES = [
  '1421182208084938762',
  '1421302761320087602',
  '1421198260718010430',
  '1421198204724056114',
  '1421197949999775885',
  '1421198131768463380',
  '1421197902679773327',
  '1421256623204204734',
  '1421256918839857308',
  '1421256690367725608',
  '1421256800270946426',
  '1421256872828207114'
];

const DATA_FILE = path.resolve(__dirname, 'shiftData.json');
const DEFAULT_DATA = {
  shiftEmbedSent: false,
  shiftStarted: false,
  startMessageId: null,
  endMessageId: null,
  lastActionBy: null,
  lastActionAt: null
};
const SHIFT_CRON = '0 5 * * *'; // UTC 05:00

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
}
function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } 
  catch { fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2)); return { ...DEFAULT_DATA }; }
}
function saveData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

async function setRoleViewPermission(channel, roleId, canView) {
  try { await channel.permissionOverwrites.edit(roleId, { ViewChannel: canView }); } 
  catch (err) { console.warn(`⚠️ Could not edit perms for role ${roleId} in channel ${channel.id}:`, err.message); }
}

async function sendEmbedIfNotExist(channelId, type, data) {
  const guild = client.guilds.cache.first();
  if (!guild) return null;
  const ch = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(()=>null);
  if (!ch) return null;

  const msgId = type==='start' ? data.startMessageId : data.endMessageId;
  let msg = null;
  if (msgId) msg = await ch.messages.fetch(msgId).catch(()=>null);
  if (msg) return msg; // already exists

  const embed = new EmbedBuilder()
    .setTitle(type==='start' ? '⏰ Work Shift Started' : '📤 End Shift')
    .setDescription(type==='start' ? 'Press the button below to clock in.' : 'Press the button below to end your shift.')
    .setColor(type==='start' ? 'Green' : 'Red')
    .setFooter({ text: 'Company HR System' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(type==='start' ? 'start_shift' : 'end_shift')
      .setLabel(type==='start' ? '📥 Start Shift' : '📤 End Shift')
      .setStyle(type==='start' ? ButtonStyle.Success : ButtonStyle.Danger)
  );

  msg = await ch.send({ embeds: [embed], components: [row] });
  if (type==='start') data.startMessageId = msg.id;
  else data.endMessageId = msg.id;
  data.shiftEmbedSent = type==='start';
  saveData(data);
  return msg;
}

async function hideAllChannels(guild, data) {
  for (const ch of guild.channels.cache.values()) {
    for (const roleId of AFFECTED_ROLES) await setRoleViewPermission(ch, roleId, false);
  }
  data.shiftStarted = false;
  saveData(data);
}

async function showAllChannels(guild, data) {
  for (const ch of guild.channels.cache.values()) {
    for (const roleId of AFFECTED_ROLES) await setRoleViewPermission(ch, roleId, true);
  }
  data.shiftStarted = true;
  saveData(data);
}

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  ensureDataFile();
  const data = loadData();
  const guild = client.guilds.cache.first();
  if (!guild) return console.error('❌ No guild found.');

  await guild.channels.fetch().catch(()=>{});
  await sendEmbedIfNotExist(START_CHANNEL_ID, 'start', data);
  await sendEmbedIfNotExist(END_CHANNEL_ID, 'end', data);

  // cron to hide channels daily
  cron.schedule(SHIFT_CRON, async () => {
    const d = loadData();
    await hideAllChannels(guild, d);
    await sendEmbedIfNotExist(START_CHANNEL_ID, 'start', d);
    await sendEmbedIfNotExist(END_CHANNEL_ID, 'end', d);
  }, { timezone: 'UTC' });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  const member = interaction.member;
  if (!member) return interaction.reply({ content: '❌ Could not identify you.', ephemeral: true });

  const hasRole = AFFECTED_ROLES.some(rid => member.roles.cache.has(rid));
  if (!hasRole) return interaction.reply({ content: '⛔ You are not in the affected roles.', ephemeral: true });

  const data = loadData();
  if (interaction.customId === 'start_shift') {
    await showAllChannels(interaction.guild, data);
    data.lastActionBy = member.user.id;
    data.lastActionAt = new Date().toISOString();
    saveData(data);
    await interaction.reply({ content: '✅ You have clocked in — channels restored.', ephemeral: true });
  } else if (interaction.customId === 'end_shift') {
    await hideAllChannels(interaction.guild, data);
    data.lastActionBy = member.user.id;
    data.lastActionAt = new Date().toISOString();
    saveData(data);
    await sendEmbedIfNotExist(START_CHANNEL_ID, 'start', data);
    await interaction.reply({ content: '👋 You ended the shift — channels hidden.', ephemeral: true });
  } else {
    await interaction.reply({ content: '❓ Unknown button.', ephemeral: true });
  }
});

process.on('unhandledRejection', (reason, p) => { console.error('Unhandled Rejection at:', p, 'reason:', reason); });
process.on('uncaughtException', (err) => { console.error('Uncaught Exception thrown:', err); });

client.login(TOKEN).catch(err => { console.error('❌ Login failed:', err); process.exit(1); });
