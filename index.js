require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const ms = require('ms');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.once(Events.ClientReady, () => {
  console.log(`✅ تم تسجيل الدخول كبوت: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.content.startsWith('#giv')) return;

  const args = message.content.slice(5).trim().split('!');
  if (args.length < 2) return message.reply('❌ الصيغة غير صحيحة. مثال: `#giv جيف اوي 50 الف كردت) 1w ! 1d`');

  const content = args[0].split(')');
  const title = content[0].trim(); // الجائزة
  const winnersPart = content[1].trim(); // عدد الفائزين
  const timePart = args[1].trim(); // الوقت

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

  const giveawayMessage = await message.channel.send({
    embeds: [embed],
    components: [row]
  });

  await message.delete(); // حذف رسالة الأمر

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

    // إرسال رسالة خاصة
    winners.forEach(async winner => {
      try {
        const user = await client.users.fetch(winner.replace(/[<@>]/g, ''));
        user.send(`🎉 مبروك! لقد فزت بـ **${title}** في السيرفر **${message.guild.name}**!\nالروم: <#${message.channel.id}>`);
      } catch (e) {
        console.error(`❌ فشل إرسال رسالة لـ ${winner}:`, e);
      }
    });
  });
});

client.login(process.env.TOKEN);
