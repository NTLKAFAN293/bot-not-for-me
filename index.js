require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, Routes, REST, Events } = require('discord.js');
const ms = require('ms');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

let logChannelId = null;
const configPath = './log-config.json';

if (fs.existsSync(configPath)) {
  const data = JSON.parse(fs.readFileSync(configPath));
  logChannelId = data.logChannelId || null;
}

client.once(Events.ClientReady, () => {
  console.log(`✅ تم تسجيل الدخول كبوت: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // GIVEAWAY
  if (message.content.startsWith('#giv')) {
    const args = message.content.slice(5).trim().split('!');
    if (args.length < 2) return message.reply('❌ الصيغة غير صحيحة. مثال: `#giv جيف اوي 50 الف كردت) 1w ! 1d`');

    const content = args[0].split(')');
    const title = content[0].trim();
    const winnersPart = content[1].trim();
    const timePart = args[1].trim();
    const duration = ms(timePart);
    if (!duration || isNaN(parseInt(winnersPart))) return message.reply('❌ تأكد من كتابة عدد الفائزين والوقت بشكل صحيح.');

    const endsAt = Date.now() + duration;

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`🎁 ${title}`)
      .setDescription(`⏳ **ينتهي بعد:** <t:${Math.floor(endsAt / 1000)}:R>\n👑 **تم البدء بواسطة:** ${message.author}\n🎉 **عدد الفائزين:** ${winnersPart}`)
      .setFooter({ text: `ID: ${message.author.id}` })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId('join_giveaway')
      .setLabel('🎉 شارك في السحب')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);
    const giveawayMessage = await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete();

    const participants = new Set();
    const collector = giveawayMessage.createMessageComponentCollector({ time: duration });

    collector.on('collect', async i => {
      if (i.customId === 'join_giveaway') {
        participants.add(i.user.id);
        await i.reply({ content: '✅ تم تسجيل مشاركتك في السحب!', ephemeral: true });
      }
    });

    collector.on('end', async () => {
      const ids = [...participants];
      if (ids.length === 0) {
        return message.channel.send('😢 لم يشارك أحد في السحب.');
      }

      const winnersCount = Math.min(parseInt(winnersPart), ids.length);
      const winners = [];

      while (winners.length < winnersCount) {
        const winnerId = ids.splice(Math.floor(Math.random() * ids.length), 1)[0];
        winners.push(`<@${winnerId}>`);
      }

      await message.channel.send(`🎉 مبروك ${winners.join(', ')}! لقد فزتم بـ **${title}**!\n📩 تم إرسال رسالة خاصة لكل فائز.`);

      winners.forEach(async winner => {
        try {
          const user = await client.users.fetch(winner.replace(/[<@>]/g, ''));
          user.send(`🎉 مبروك! لقد فزت بـ **${title}** في السيرفر **${message.guild.name}**!\nالروم: <#${message.channel.id}>`);
        } catch (e) {
          console.error(`❌ فشل إرسال رسالة لـ ${winner}:`, e);
        }
      });
    });
  }
});

// ================== LOGGING ==================

client.on('messageDelete', async message => {
  if (!logChannelId || message.author?.bot) return;
  const logChannel = await client.channels.fetch(logChannelId);
  const embed = new EmbedBuilder()
    .setTitle('🗑️ تم حذف رسالة')
    .setDescription(`**المستخدم:** ${message.author}\n**القناة:** <#${message.channel.id}>\n**الرسالة:**\n\`\`\`${message.content}\`\`\``)
    .setColor('Red')
    .setTimestamp();
  logChannel.send({ embeds: [embed] });
});

client.on('messageUpdate', async (oldMsg, newMsg) => {
  if (!logChannelId || oldMsg.content === newMsg.content || oldMsg.author?.bot) return;
  const logChannel = await client.channels.fetch(logChannelId);
  const embed = new EmbedBuilder()
    .setTitle('✏️ تم تعديل رسالة')
    .setDescription(`**المستخدم:** ${oldMsg.author}\n**القناة:** <#${oldMsg.channel.id}>`)
    .addFields(
      { name: 'قبل:', value: `\`\`\`${oldMsg.content}\`\`\`` },
      { name: 'بعد:', value: `\`\`\`${newMsg.content}\`\`\`` }
    )
    .setColor('Orange')
    .setTimestamp();
  logChannel.send({ embeds: [embed] });
});

client.on('guildBanAdd', async (ban) => {
  if (!logChannelId) return;
  const logChannel = await client.channels.fetch(logChannelId);
  const embed = new EmbedBuilder()
    .setTitle('🔨 تم حظر عضو')
    .setDescription(`**المستخدم:** ${ban.user.tag} (${ban.user.id})`)
    .setColor('DarkRed')
    .setTimestamp();
  logChannel.send({ embeds: [embed] });
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (!logChannelId) return;
  if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
    const logChannel = await client.channels.fetch(logChannelId);
    const embed = new EmbedBuilder()
      .setTitle('⏳ تم توقيت عضو (تايم آوت)')
      .setDescription(`**العضو:** ${newMember}\n**ينتهي:** <t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:R>`)
      .setColor('Blurple')
      .setTimestamp();
    logChannel.send({ embeds: [embed] });
  }
});

// ============= سلاش كوماند لتحديد روم اللوق =============

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'setlog') {
    const channel = interaction.options.getChannel('channel');
    logChannelId = channel.id;
    fs.writeFileSync(configPath, JSON.stringify({ logChannelId }));
    await interaction.reply({ content: `✅ تم تعيين روم اللوق على: ${channel}`, ephemeral: true });
  }
});

// ============ تسجيل أمر سلاش ============
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
client.on('ready', async () => {
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      {
        body: [
          new SlashCommandBuilder()
            .setName('setlog')
            .setDescription('تعيين روم تسجيل الأحداث (Logs)')
            .addChannelOption(option =>
              option.setName('channel').setDescription('اختر الروم').setRequired(true)
            )
            .toJSON()
        ]
      }
    );
    console.log('📡 تم تسجيل أمر /setlog بنجاح.');
  } catch (err) {
    console.error(err);
  }
});

client.login(process.env.TOKEN);
