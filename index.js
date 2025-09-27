require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, SlashCommandBuilder, Collection } = require('discord.js');
const ms = require('ms');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.once('clientReady', () => {
    console.log(`✅ تم تسجيل الدخول كبوت: ${client.user.tag}`);
});

// ================== Giveaway ==================
client.commands = new Collection();

client.commands.set('giveaway', new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('ابدأ Giveaway جديد')
    .addStringOption(option => option.setName('الوصف').setDescription('وصف الجيف أواي').setRequired(true))
    .addStringOption(option => option.setName('الوقت').setDescription('مدة السحب 1d/1h/1m').setRequired(true))
    .addIntegerOption(option => option.setName('عدد_الفائزين').setDescription('عدد الفائزين').setRequired(true))
);

// ================== Logs Channel ==================
let logChannelId;

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'setlog') {
        logChannelId = interaction.options.getChannel('الروم').id;
        await interaction.reply({ content: '📡 تم تحديد روم اللوق!', ephemeral: true });
    }

    if (interaction.commandName === 'giveaway') {
        const الوصف = interaction.options.getString('الوصف');
        const الوقت = interaction.options.getString('الوقت');
        const عدد = interaction.options.getInteger('عدد_الفائزين');

        const embed = new EmbedBuilder()
            .setTitle(الوصف)
            .setDescription(`ينتهي بعد: ${الوقت}\nتم البدء بواسطة: ${interaction.user}\nعدد الفائزين: ${عدد}`)
            .setColor('Blue')
            .setFooter({ text: 'اضغط على الزر للمشاركة' });

        const button = new ButtonBuilder()
            .setCustomId('join_giveaway')
            .setLabel('شارك')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const collector = msg.createMessageComponentCollector({ time: ms(الوقت) });
        const participants = new Set();

        collector.on('collect', i => {
            participants.add(i.user.id);
            i.reply({ content: '✅ تم تسجيلك في السحب!', ephemeral: true });
        });

        collector.on('end', async () => {
            const winners = Array.from(participants).sort(() => 0.5 - Math.random()).slice(0, عدد);
            winners.forEach(async userId => {
                const user = await client.users.fetch(userId);
                interaction.channel.send(`🎉 مبروك ${user}! لقد فزت بالـ Giveaway!`);
                user.send(`مبروك لقد فزت بالـ Giveaway في السيرفر: ${interaction.guild.name}`);
            });
        });
    }
});

// ================== Message Delete Log ==================
client.on('messageDelete', async message => {
    if (!logChannelId) return;
    const embed = new EmbedBuilder()
        .setTitle('🗑️ تم حذف رسالة')
        .addFields(
            { name: 'من', value: message.author?.tag || 'مجهول', inline: true },
            { name: 'المحتوى', value: message.content || 'لا يوجد نص', inline: false },
            { name: 'الروم', value: message.channel.name, inline: true },
            { name: 'الوقت', value: new Date().toLocaleString(), inline: true }
        )
        .setColor('Red');
    client.channels.cache.get(logChannelId)?.send({ embeds: [embed] });
});

// ================== Member Ban/Timeout Log ==================
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!logChannelId) return;
    // تحقق من التايم آوت
    if (oldMember.communicationDisabledUntil !== newMember.communicationDisabledUntil) {
        const embed = new EmbedBuilder()
            .setTitle('⏱️ تم إعطاء تايم آوت')
            .setDescription(`${newMember.user.tag} تم وضعه في تايم آوت`)
            .addFields({ name: 'المدة', value: newMember.communicationDisabledUntil ? newMember.communicationDisabledUntil.toLocaleString() : 'تم رفع التايم آوت', inline: true })
            .setColor('Orange');
        client.channels.cache.get(logChannelId)?.send({ embeds: [embed] });
    }
});

client.on('guildBanAdd', async (guild, user) => {
    if (!logChannelId) return;
    const embed = new EmbedBuilder()
        .setTitle('⛔ تم حظر عضو')
        .setDescription(`${user.tag} تم حظره من السيرفر`)
        .setColor('DarkRed')
        .setTimestamp();
    client.channels.cache.get(logChannelId)?.send({ embeds: [embed] });
});

client.on('guildBanRemove', async (guild, user) => {
    if (!logChannelId) return;
    const embed = new EmbedBuilder()
        .setTitle('✅ تم رفع الحظر')
        .setDescription(`${user.tag} تم رفع الحظر عنه`)
        .setColor('Green')
        .setTimestamp();
    client.channels.cache.get(logChannelId)?.send({ embeds: [embed] });
});

// تسجيل دخول باستخدام .env
client.login(process.env.TOKEN);
