require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ms = require('ms');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error('❌ Missing TOKEN in .env');
  process.exit(1);
}

const activeGiveaways = new Map();

client.on('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (!message.content.startsWith('#giv') || message.author.bot) return;

  const content = message.content.slice(5).trim();
  const parts = content.split('!');
  if (parts.length < 2) return message.reply('❌ Wrong format. Use: `#giv <title> <winners>w !<time>`');

  const [titleAndWinners, timeStr] = parts;
  const time = ms(timeStr.trim());
  if (!time) return message.reply('❌ Invalid time format. Use something like `1d`, `5m`, etc.');

  const titleParts = titleAndWinners.trim().split(' ');
  const lastPart = titleParts.pop();
  const winners = parseInt(lastPart.toLowerCase().replace('w', ''));
  const title = titleParts.join(' ');
  if (isNaN(winners) || winners < 1) return message.reply('❌ Invalid winners count. Use like `2w`');

  await message.delete();

  const endTime = Date.now() + time;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(`🕒 Ends in: <t:${Math.floor(endTime / 1000)}:R>\n👤 Started by: <@${message.author.id}>\n🏆 Winners: **${winners}**`)
    .setColor('Blue')
    .setFooter({ text: `Giveaway ends at` })
    .setTimestamp(endTime);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('enter_giveaway')
      .setLabel('🎉 Join Giveaway')
      .setStyle(ButtonStyle.Primary)
  );

  const sent = await message.channel.send({ embeds: [embed], components: [row] });

  const participants = new Set();

  activeGiveaways.set(sent.id, {
    messageId: sent.id,
    channelId: sent.channel.id,
    guildId: sent.guild.id,
    startedBy: message.author.id,
    prize: title,
    winners,
    endsAt: endTime,
    participants
  });

  setTimeout(async () => {
    const giveaway = activeGiveaways.get(sent.id);
    if (!giveaway) return;

    const all = Array.from(giveaway.participants);
    if (all.length === 0) {
      await sent.reply(`😢 No one joined the giveaway for **${title}**.`);
      activeGiveaways.delete(sent.id);
      return;
    }

    const selected = [];
    while (selected.length < winners && all.length > 0) {
      const index = Math.floor(Math.random() * all.length);
      selected.push(all.splice(index, 1)[0]);
    }

    const channel = await client.channels.fetch(giveaway.channelId);
    await channel.send({
      content: `🎉 Congratulations ${selected.map(u => `<@${u}>`).join(', ')}! You won **${giveaway.prize}**!\nStarted by: <@${giveaway.startedBy}>`
    });

    for (const userId of selected) {
      try {
        const user = await client.users.fetch(userId);
        await user.send(`🎊 Congratulations! You won **${giveaway.prize}** in the server: ${channel.guild.name}!\nCheck the channel: <#${giveaway.channelId}>`);
      } catch (e) {
        console.warn(`⚠️ Couldn't DM ${userId}`);
      }
    }

    activeGiveaways.delete(sent.id);
  }, time);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== 'enter_giveaway') return;

  const giveaway = activeGiveaways.get(interaction.message.id);
  if (!giveaway) return interaction.reply({ content: '❌ Giveaway has ended or invalid.', ephemeral: true });

  giveaway.participants.add(interaction.user.id);
  await interaction.reply({ content: '✅ You have joined the giveaway!', ephemeral: true });
});

client.login(TOKEN);
