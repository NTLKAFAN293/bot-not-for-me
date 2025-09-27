// index.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const cron = require('node-cron');

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error('❌ TOKEN is not defined. Set TOKEN in .env or environment variables.');
  process.exit(1);
}

// CONFIG - عدِّل لو احتجت
const START_CHANNEL_ID = '1421293986315767920'; // روم بداية الدوام (بصمة الدخول)
const END_CHANNEL_ID   = '1421294259499434015'; // روم إنهاء الدوام
const AFFECTED_ROLES = ['1421182208084938762', '1421172625673289803']; // الرتب المتأثرة
const DATA_FILE = path.resolve(__dirname, 'shiftData.json');
const SHIFT_CRON = '0 5 * * *'; // كل يوم 05:00 UTC - عدِّل لو بدك توقيت ثاني

// DEFAULT DATA
const DEFAULT_DATA = {
  shiftEmbedSent: false,
  shiftStarted: false,
  startMessageId: null,
  endMessageId: null,
  lastActionBy: null,
  lastActionAt: null
};

// ensure data file exists
function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
      console.log('✅ Created data file:', DATA_FILE);
    }
  } catch (err) {
    console.error('❌ Error ensuring data file:', err);
  }
}

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('❌ Error loading data file, recreating default:', err);
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
    return { ...DEFAULT_DATA };
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('❌ Error saving data file:', err);
  }
}

// Create client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// Utilities to safely edit channel perms
async function setRoleViewPermission(channel, roleId, canView) {
  try {
    // ensure overwrite exists or edit it
    await channel.permissionOverwrites.edit(roleId, { ViewChannel: canView });
  } catch (err) {
    // ignore permission errors but log them
    console.warn(`⚠️ Could not edit perms for role ${roleId} in channel ${channel.id}:`, err.message);
  }
}

// Send start embed (returns message id)
async function sendStartEmbed(guild, data) {
  try {
    const ch = guild.channels.cache.get(START_CHANNEL_ID) || await guild.channels.fetch(START_CHANNEL_ID).catch(()=>null);
    if (!ch) {
      console.warn('⚠️ Start channel not found:', START_CHANNEL_ID);
      return null;
    }

    const embed = new EmbedBuilder()
      .setTitle('⏰ Work Shift Started')
      .setDescription('Press the button below to clock in (Start Shift).')
      .setColor('Green')
      .setFooter({ text: 'Company HR System' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('start_shift')
        .setLabel('📥 Start Shift')
        .setStyle(ButtonStyle.Success)
    );

    const msg = await ch.send({ embeds: [embed], components: [row] });
    data.startMessageId = msg.id;
    data.shiftEmbedSent = true;
    data.shiftStarted = true;
    saveData(data);
    console.log('✅ Sent start embed:', msg.id);
    return msg.id;
  } catch (err) {
    console.error('❌ sendStartEmbed error:', err);
    return null;
  }
}

async function sendEndEmbed(guild, data) {
  try {
    const ch = guild.channels.cache.get(END_CHANNEL_ID) || await guild.channels.fetch(END_CHANNEL_ID).catch(()=>null);
    if (!ch) {
      console.warn('⚠️ End channel not found:', END_CHANNEL_ID);
      return null;
    }

    const embed = new EmbedBuilder()
      .setTitle('📤 End Shift')
      .setDescription('Press the button below to end your shift and lock channels.')
      .setColor('Red')
      .setFooter({ text: 'Company HR System' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('end_shift')
        .setLabel('📤 End Shift')
        .setStyle(ButtonStyle.Danger)
    );

    const msg = await ch.send({ embeds: [embed], components: [row] });
    data.endMessageId = msg.id;
    saveData(data);
    console.log('✅ Sent end embed:', msg.id);
    return msg.id;
  } catch (err) {
    console.error('❌ sendEndEmbed error:', err);
    return null;
  }
}

// Hide all channels for affected roles
async function hideAllChannels(guild, data) {
  console.log('🔒 Hiding channels for roles:', AFFECTED_ROLES);
  const roles = AFFECTED_ROLES.map(rid => guild.roles.cache.get(rid)).filter(Boolean);
  if (roles.length === 0) console.warn('⚠️ No affected roles found in guild cache.');

  for (const channel of guild.channels.cache.values()) {
    for (const role of roles) {
      // only try to edit if currently visible (best-effort)
      await setRoleViewPermission(channel, role.id, false);
    }
  }

  data.shiftStarted = false;
  data.shiftEmbedSent = false;
  saveData(data);
  console.log('🔒 Channels hidden and data updated.');
}

// Show channels again to affected roles (but only for those roles)
async function showAllChannels(guild, data) {
  console.log('🔓 Restoring channel view for roles:', AFFECTED_ROLES);
  const roles = AFFECTED_ROLES.map(rid => guild.roles.cache.get(rid)).filter(Boolean);

  for (const channel of guild.channels.cache.values()) {
    for (const role of roles) {
      await setRoleViewPermission(channel, role.id, true);
    }
  }

  data.shiftStarted = true;
  saveData(data);
  console.log('🔓 Channels restored and data saved.');
}

// Safe fetch message by id
async function fetchMessageIfExists(channel, messageId) {
  if (!messageId) return null;
  try {
    const ch = channel;
    if (!ch) return null;
    const msg = await ch.messages.fetch(messageId).catch(()=>null);
    return msg || null;
  } catch (err) {
    return null;
  }
}

// Ready handler
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  ensureDataFile();
  const data = loadData();

  // get a guild (we assume bot is in only one guild or first guild is correct)
  let guild = client.guilds.cache.first();
  if (!guild) {
    console.error('❌ No guilds in cache. Make sure the bot is invited to a server.');
    return;
  }

  // fetch channels to ensure cache populated
  await guild.channels.fetch().catch(()=>{});

  // ensure data file updated with defaults if missing keys
  Object.keys(DEFAULT_DATA).forEach(k => { if (!(k in data)) data[k] = DEFAULT_DATA[k]; });
  saveData(data);

  // If message ids exist, check if messages still exist; otherwise recreate them
  try {
    // START
    const startChannel = guild.channels.cache.get(START_CHANNEL_ID) || await guild.channels.fetch(START_CHANNEL_ID).catch(()=>null);
    if (!startChannel) console.warn('⚠️ Start channel not accessible.');

    let startMsg = startChannel ? await fetchMessageIfExists(startChannel, data.startMessageId) : null;
    if (!startMsg) {
      // send a new one
      await sendStartEmbed(guild, data);
    } else {
      console.log('ℹ️ Start embed exists with id', data.startMessageId);
    }

    // END
    const endChannel = guild.channels.cache.get(END_CHANNEL_ID) || await guild.channels.fetch(END_CHANNEL_ID).catch(()=>null);
    let endMsg = endChannel ? await fetchMessageIfExists(endChannel, data.endMessageId) : null;
    if (!endMsg) {
      await sendEndEmbed(guild, data);
    } else {
      console.log('ℹ️ End embed exists with id', data.endMessageId);
    }
  } catch (err) {
    console.error('❌ Error ensuring embeds exist:', err);
  }

  // schedule daily hide at SHIFT_CRON (UTC)
  try {
    cron.schedule(SHIFT_CRON, async () => {
      console.log('📆 CRON triggered - hiding channels now (SHIFT_CRON)');
      const d = loadData();
      await hideAllChannels(guild, d);
      // re-send start embed (so users always have it)
      await sendStartEmbed(guild, d);
      await sendEndEmbed(guild, d);
    }, { timezone: 'UTC' });
    console.log('⏱️ Cron scheduled:', SHIFT_CRON, '(UTC)');
  } catch (err) {
    console.error('❌ Cron scheduling error:', err);
  }
});

// Handle button interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  // load fresh data
  const data = loadData();
  const member = interaction.member;
  if (!member) {
    return interaction.reply({ content: '❌ Could not identify you.', ephemeral: true });
  }

  // check if member has any of affected roles
  const hasRole = AFFECTED_ROLES.some(rid => member.roles.cache.has(rid));
  if (!hasRole) {
    return interaction.reply({ content: '⛔ You are not in the affected roles.', ephemeral: true });
  }

  try {
    if (interaction.customId === 'start_shift') {
      // restore view perms for their roles
      await showAllChannels(interaction.guild, data);
      data.lastActionBy = member.user.id;
      data.lastActionAt = new Date().toISOString();
      saveData(data);
      await interaction.reply({ content: '✅ You have clocked in — channels restored.', ephemeral: true });
    } else if (interaction.customId === 'end_shift') {
      // hide channels for affected roles
      await hideAllChannels(interaction.guild, data);
      data.lastActionBy = member.user.id;
      data.lastActionAt = new Date().toISOString();
      saveData(data);
      // resend start embed so it's always available
      await sendStartEmbed(interaction.guild, data);
      await interaction.reply({ content: '👋 You ended the shift — channels hidden.', ephemeral: true });
    } else {
      await interaction.reply({ content: '❓ Unknown button.', ephemeral: true });
    }
  } catch (err) {
    console.error('❌ interaction error:', err);
    try { await interaction.reply({ content: '❌ Error processing your action.', ephemeral: true }); } catch(e){}
  }
});

// safety: prevent crashes on unhandled
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

// login
client.login(TOKEN).catch(err => {
  console.error('❌ Login failed:', err);
  process.exit(1);
});
