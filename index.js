// index.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  Events, 
  REST, 
  Routes, 
  SlashCommandBuilder 
} = require('discord.js');
const ms = require('ms');

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error('❌ TOKEN not set in .env (use TOKEN=...)');
  process.exit(1);
}

const DATA_PATH = path.resolve(__dirname, 'log-config.json');
function readConfig() {
  try {
    if (!fs.existsSync(DATA_PATH)) return {};
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8') || '{}');
  } catch (e) {
    return {};
  }
}
function writeConfig(obj) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(obj, null, 2));
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// persistent simple storage for giveaways (in-memory) and config
const giveaways = new Map(); // messageId => { guildId, channelId, prize, winnersCount, endsAt, participants:Set }
let config = readConfig(); // { logChannelId: '...' }

// Helper: safe fetch log channel
async function getLogChannel() {
  try {
    if (!config.logChannelId) return null;
    const ch = await client.channels.fetch(config.logChannelId).catch(()=>null);
    return ch || null;
  } catch {
    return null;
  }
}

// Safe send to log channel
async function sendLogEmbed(embed) {
  try {
    const logCh = await getLogChannel();
    if (!logCh) return;
    await logCh.send({ embeds: [embed] }).catch(()=>{});
  } catch (e) {
    console.warn('⚠️ sendLogEmbed error', e?.message || e);
  }
}

// Register slash commands (global, short delay to propagate)
const rest = new REST({ version: '10' }).setToken(TOKEN);
async function registerCommands(clientId) {
  const commands = [
    new SlashCommandBuilder()
      .setName('setlog')
      .setDescription('تحديد روم اللوق (Logs)')
      .addChannelOption(opt => opt.setName('الروم').setDescription('اختر قناة اللوق').setRequired(true))
      .toJSON(),
    new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('ابدأ Giveaway جديد')
      .addStringOption(opt => opt.setName('العنوان').setDescription('وصف/الجائزة').setRequired(true))
      .addIntegerOption(opt => opt.setName('الفائزون').setDescription('عدد الفائزين').setRequired(true))
      .addStringOption(opt => opt.setName('المدة').setDescription('مدة مثل 1d أو 1h أو 30m').setRequired(true))
      .toJSON()
  ];
  try {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('📡 تم تسجيل أوامر السلاش (/setlog, /giveaway)');
  } catch (e) {
    console.error('❌ فشل تسجيل الأوامر:', e?.message || e);
  }
}

// Ready
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands(client.user.id);
  // reload config
  config = readConfig();
});

// ----------------- Interaction handlers -----------------
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Slash commands
    if (interaction.isChatInputCommand && interaction.isChatInputCommand()) {
      const cmd = interaction.commandName;
      if (cmd === 'setlog') {
        // quick reply
        const channel = interaction.options.getChannel('الروم');
        if (!channel) {
          return interaction.reply({ content: '⚠️ الرجاء اختيار روم صالح.', flags: 64 });
        }
        config.logChannelId = channel.id;
        writeConfig(config);
        return interaction.reply({ content: `✅ تم تعيين روم اللوق إلى: ${channel}`, flags: 64 });
      }

      if (cmd === 'giveaway') {
        const title = interaction.options.getString('العنوان');
        const winnersCount = interaction.options.getInteger('الفائزون');
        const durationStr = interaction.options.getString('المدة');

        const durationMs = ms(durationStr);
        if (!durationMs || durationMs <= 0) {
          return interaction.reply({ content: '❌ صيغة المدة غير صحيحة. استخدم أمثلة مثل `1d`, `2h`, `30m`.', flags: 64 });
        }
        if (winnersCount <= 0) {
          return interaction.reply({ content: '❌ عدد الفائزين يجب أن يكون رقمًا أكبر من 0.', flags: 64 });
        }

        // Build embed (Arabic, attractive)
        const endsAt = Date.now() + durationMs;
        const embed = new EmbedBuilder()
          .setTitle(`🎁 ${title}`)
          .setDescription(`⏳ **ينتهي بعد:** <t:${Math.floor(endsAt/1000)}:R>\n👑 **بواسطة:** ${interaction.user}\n🏆 **عدد الفائزين:** **${winnersCount}**`)
          .setColor('#00B894')
          .setTimestamp();

        const btn = new ButtonBuilder()
          .setCustomId('enter_giveaway')
          .setLabel('🎉 اشترك')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(btn);

        // reply and fetch message
        const sent = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true, flags: 64 });

        // store giveaway
        giveaways.set(sent.id, {
          guildId: interaction.guildId,
          channelId: sent.channelId,
          prize: title,
          winnersCount,
          endsAt,
          participants: new Set()
        });

        // schedule end
        setTimeout(async () => {
          try {
            const g = giveaways.get(sent.id);
            if (!g) return;
            const arr = Array.from(g.participants);
            if (arr.length === 0) {
              // edit message to show ended with no participants
              try { await sent.edit({ embeds: [EmbedBuilder.from(embed).setTitle(`🛑 انتهى: ${title}`).setDescription('لم يشترك أحد في السحب.')], components: [] }); } catch {}
              // log event
              await sendLogEmbed(new EmbedBuilder().setTitle('🎲 Giveaway انتهى بدون مشاركين').setDescription(`**${title}**`).setColor('Orange').setTimestamp());
              giveaways.delete(sent.id);
              return;
            }
            // pick winners
            const winners = [];
            const pool = arr.slice();
            while (winners.length < Math.min(g.winnersCount, pool.length)) {
              const idx = Math.floor(Math.random() * pool.length);
              winners.push(pool.splice(idx,1)[0]);
            }

            const mentions = winners.map(id => `<@${id}>`).join(', ');
            const endEmbed = EmbedBuilder.from(embed)
              .setTitle(`🎉 انتهى السحب: ${title}`)
              .setDescription(`الفائزون: ${mentions}\nتم الإرسال إلى الخاص أيضًا.`)
              .setColor('#FFD700');

            try { await sent.edit({ embeds: [endEmbed], components: [] }); } catch {}

            // announce in channel
            const ch = await client.channels.fetch(g.channelId).catch(()=>null);
            if (ch) {
              ch.send({ content: `🎉 مبروك ${mentions} لقد فزتم بـ **${g.prize}**!` }).catch(()=>{});
            }

            // DM winners
            for (const wid of winners) {
              try {
                const user = await client.users.fetch(wid);
                await user.send(`🎊 مبروك! لقد فزت بـ **${g.prize}** في سيرفر: **${interaction.guild.name}**\nالروم: <#${g.channelId}>`).catch(()=>{});
              } catch {}
            }

            // log to log channel if set
            await sendLogEmbed(new EmbedBuilder()
              .setTitle('🏆 Giveaway انتهى')
              .setDescription(`**${g.prize}**\nالفائزون: ${mentions}\nالخادم: **${interaction.guild.name}**`)
              .setColor('Green')
              .setTimestamp()
            );

            giveaways.delete(sent.id);
          } catch (e) {
            console.error('❌ giveaway end error', e);
          }
        }, durationMs);

        return; // finished /giveaway
      }
    }

    // Button interactions (enter giveaway)
    if (interaction.isButton && interaction.isButton()) {
      if (interaction.customId === 'enter_giveaway') {
        // quick ack to avoid unknown interaction
        try {
          // fetch giveaway
          const g = giveaways.get(interaction.message.id);
          if (!g) return interaction.reply({ content: '⚠️ هذه المسابقة انتهت أو غير موجودة.', flags: 64 });

          if (g.participants.has(interaction.user.id)) {
            return interaction.reply({ content: '✅ أنت مشترك بالفعل!', flags: 64 });
          }

          g.participants.add(interaction.user.id);
          return interaction.reply({ content: '🎟️ تم تسجيل مشاركتك في السحب!', flags: 64 });
        } catch (e) {
          console.warn('⚠️ button handler error', e);
          try { return interaction.reply({ content: '❌ حدث خطأ أثناء الاشتراك.', flags: 64 }); } catch {}
        }
      }
    }
  } catch (err) {
    console.error('❌ interaction handler error:', err);
    try { if (interaction && !interaction.replied) await interaction.reply({ content: '❌ حدث خطأ داخل البوت.', flags: 64 }); } catch {}
  }
});

// ----------------- Logging events -----------------

client.on('messageDelete', async (message) => {
  try {
    if (!message) return;
    const embed = new EmbedBuilder()
      .setTitle('🗑️ تم حذف رسالة')
      .addFields(
        { name: 'المرسل', value: message.author?.tag || 'مجهول', inline: true },
        { name: 'القناة', value: message.channel ? `<#${message.channel.id}>` : 'غير معروف', inline: true },
        { name: 'المحتوى', value: message.content?.slice(0, 1024) || 'لا يوجد نص' }
      )
      .setColor('Red')
      .setTimestamp();
    await sendLogEmbed(embed);
  } catch (e) { console.warn('⚠️ messageDelete log error', e?.message || e); }
});

client.on('messageUpdate', async (oldMsg, newMsg) => {
  try {
    if (!oldMsg || !newMsg) return;
    if (oldMsg.content === newMsg.content) return; // ignore embeds/reactions only edits
    const embed = new EmbedBuilder()
      .setTitle('✏️ تم تعديل رسالة')
      .addFields(
        { name: 'المرسل', value: oldMsg.author?.tag || 'مجهول', inline: true },
        { name: 'القناة', value: oldMsg.channel ? `<#${oldMsg.channel.id}>` : 'غير معروف', inline: true },
        { name: 'قبل', value: oldMsg.content?.slice(0, 1024) || 'لا يوجد' },
        { name: 'بعد', value: newMsg.content?.slice(0, 1024) || 'لا يوجد' }
      )
      .setColor('Orange')
      .setTimestamp();
    await sendLogEmbed(embed);
  } catch (e) { console.warn('⚠️ messageUpdate log error', e?.message || e); }
});

// Note: guildBanAdd signature may vary; using guildBanAdd with single param (ban) is supported in v14 events
client.on('guildBanAdd', async (ban) => {
  try {
    const embed = new EmbedBuilder()
      .setTitle('🔨 تم حظر عضو')
      .setDescription(`${ban.user.tag} (${ban.user.id})`)
      .addFields({ name: 'الخادم', value: ban.guild?.name || 'غير معروف' })
      .setColor('DarkRed')
      .setTimestamp();
    await sendLogEmbed(embed);
  } catch (e) { console.warn('⚠️ guildBanAdd log error', e?.message || e); }
});

client.on('guildBanRemove', async (ban) => {
  try {
    const embed = new EmbedBuilder()
      .setTitle('✅ تم رفع الحظر')
      .setDescription(`${ban.user.tag} (${ban.user.id})`)
      .addFields({ name: 'الخادم', value: ban.guild?.name || 'غير معروف' })
      .setColor('Green')
      .setTimestamp();
    await sendLogEmbed(embed);
  } catch (e) { console.warn('⚠️ guildBanRemove log error', e?.message || e); }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    // timeout changes
    const oldUntil = oldMember?.communicationDisabledUntilTimestamp || null;
    const newUntil = newMember?.communicationDisabledUntilTimestamp || null;
    if (oldUntil !== newUntil) {
      const embed = new EmbedBuilder()
        .setTitle('⛓️ تغيير حالة التايم آوت')
        .setDescription(`${newMember.user.tag}`)
        .addFields(
          { name: 'القديم', value: oldUntil ? `<t:${Math.floor(oldUntil/1000)}> (UTC)` : 'لا يوجد', inline: true },
          { name: 'الجديد', value: newUntil ? `<t:${Math.floor(newUntil/1000)}> (UTC)` : 'تم إزالته', inline: true }
        )
        .setColor('Blurple')
        .setTimestamp();
      await sendLogEmbed(embed);
    }
  } catch (e) { console.warn('⚠️ guildMemberUpdate log error', e?.message || e); }
});

// catch-all to prevent crash
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// login
client.login(TOKEN).catch(err => {
  console.error('❌ Login failed:', err);
  process.exit(1);
});
