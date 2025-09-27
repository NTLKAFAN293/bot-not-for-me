require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const cron = require('node-cron');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const START_CHANNEL = '1421293986315767920';
const END_CHANNEL = '1421294259499434015';
const AFFECTED_ROLES = ['1421182208084938762', '1421172625673289803'];
const DATA_FILE = 'shiftData.json';

let shiftData = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : { shiftEmbedSent: false, shiftStarted: false };

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(shiftData, null, 2));
}

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.first();

  if (!shiftData.shiftEmbedSent) {
    await sendStartEmbed(guild);
  }

  // كل يوم الساعة 5:00 AM بتوقيت سيرفر Render (UTC)
  cron.schedule('0 5 * * *', async () => {
    console.log('🔒 Hiding channels at 5:00 AM');
    await hideAllChannels(guild);
    await sendStartEmbed(guild);
  });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  const guild = interaction.guild;
  const member = interaction.member;

  if (!AFFECTED_ROLES.some(role => member.roles.cache.has(role))) return;

  if (interaction.customId === 'start_shift') {
    await showAllChannels(guild, member);
    await interaction.reply({ content: '✅ You have started your shift. Welcome back!', ephemeral: true });
  }

  if (interaction.customId === 'end_shift') {
    await hideAllChannels(guild);
    await interaction.reply({ content: '👋 You have ended your shift. See you later!', ephemeral: true });
    await sendStartEmbed(guild); // رجّع روم البصمة فقط
  }
});

async function sendStartEmbed(guild) {
  const channel = guild.channels.cache.get(START_CHANNEL);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('🕘 Start Your Shift')
    .setDescription('Please clock in by pressing the button below.')
    .setColor('Green');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('start_shift')
      .setLabel('📥 Clock In')
      .setStyle(ButtonStyle.Success)
  );

  await channel.send({ embeds: [embed], components: [row] });
  shiftData.shiftEmbedSent = true;
  shiftData.shiftStarted = true;
  saveData();
}

async function sendEndEmbed(guild) {
  const channel = guild.channels.cache.get(END_CHANNEL);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('🕔 End Your Shift')
    .setDescription('Click below to clock out.')
    .setColor('Red');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('end_shift')
      .setLabel('📤 Clock Out')
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

async function hideAllChannels(guild) {
  const roles = AFFECTED_ROLES.map(id => guild.roles.cache.get(id));
  guild.channels.cache.forEach(channel => {
    roles.forEach(role => {
      if (role && channel.permissionsFor(role)?.has(PermissionsBitField.Flags.ViewChannel)) {
        channel.permissionOverwrites.edit(role, { ViewChannel: false }).catch(() => {});
      }
    });
  });
  shiftData.shiftStarted = false;
  shiftData.shiftEmbedSent = false;
  saveData();
}

async function showAllChannels(guild, member) {
  const roles = AFFECTED_ROLES.map(id => guild.roles.cache.get(id));
  guild.channels.cache.forEach(channel => {
    roles.forEach(role => {
      if (role && member.roles.cache.has(role.id)) {
        channel.permissionOverwrites.edit(role, { ViewChannel: true }).catch(() => {});
      }
    });
  });
}

// تسجيل الدخول
client.login(process.env.TOKEN);
