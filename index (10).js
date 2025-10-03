require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const Database = require('better-sqlite3');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

const ALLOWED_GUILD_ID = '1375876425416052799';

const db = new Database('bot.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS vacation_managers (
        guild_id TEXT NOT NULL,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (guild_id, type, value)
    );

    CREATE TABLE IF NOT EXISTS resignation_roles (
        guild_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        PRIMARY KEY (guild_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS log_channels (
        guild_id TEXT NOT NULL,
        log_type TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        PRIMARY KEY (guild_id, log_type)
    );

    CREATE TABLE IF NOT EXISTS timeout_commands (
        guild_id TEXT NOT NULL,
        command TEXT NOT NULL,
        PRIMARY KEY (guild_id, command)
    );

    CREATE TABLE IF NOT EXISTS warning_commands (
        guild_id TEXT NOT NULL,
        command TEXT NOT NULL,
        PRIMARY KEY (guild_id, command)
    );

    CREATE TABLE IF NOT EXISTS vacation_messages (
        guild_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        manager_user_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        PRIMARY KEY (guild_id, request_id, manager_user_id)
    );

    CREATE TABLE IF NOT EXISTS ticket_settings (
        guild_id TEXT PRIMARY KEY,
        category_id TEXT,
        support_role_id TEXT,
        log_channel_id TEXT,
        ticket_counter INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ticket_points (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        points REAL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS ticket_transcripts (
        ticket_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        transcript_data TEXT NOT NULL,
        created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        warned_by TEXT NOT NULL,
        reason TEXT NOT NULL,
        timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_warnings (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        count INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id, date)
    );

    CREATE TABLE IF NOT EXISTS embed_buttons (
        guild_id TEXT NOT NULL,
        button_id TEXT NOT NULL,
        message TEXT NOT NULL,
        PRIMARY KEY (guild_id, button_id)
    );
`);

const commands = [
    new SlashCommandBuilder()
        .setName('نسخ-صلاحيات')
        .setDescription('نــســخ صــلاحــيــات روم لــروم ثــانــي')
        .addChannelOption(option =>
            option.setName('من')
                .setDescription('الــروم الــي بــتــنــســخ مــنــه')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('الى')
                .setDescription('الــروم الــي بــتــنــســخ لــه')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('ارسال-ايمبد')
        .setDescription('ارســال ايــمــبــد لــروم مــعــيــن')
        .addChannelOption(option =>
            option.setName('الروم')
                .setDescription('الــروم الــي بــتــرســل فــيــه')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('الوصف')
                .setDescription('وصــف الــرســالــة')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('العنوان')
                .setDescription('عــنــوان الــرســالــة')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('اجازات')
        .setDescription('ارســال ايــمــبــد طــلــبــات الإجــازات')
        .addChannelOption(option =>
            option.setName('الروم')
                .setDescription('الــروم الــي بــتــرســل فــيــه')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('الوصف')
                .setDescription('وصــف الــرســالــة')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('العنوان')
                .setDescription('عــنــوان الــرســالــة')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('استقالة')
        .setDescription('ارســال ايــمــبــد طــلــبــات الاســتــقــالــة')
        .addChannelOption(option =>
            option.setName('الروم')
                .setDescription('الــروم الــي بــتــرســل فــيــه')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('الوصف')
                .setDescription('وصــف الــرســالــة')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('العنوان')
                .setDescription('عــنــوان الــرســالــة')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('اضافة-مسؤول-اجازات')
        .setDescription('اضــافــة مــســؤول طــلــبــات الإجــازات')
        .addUserOption(option =>
            option.setName('الشخص')
                .setDescription('الــشــخــص الــي بــيــراجــع الــطــلــبــات')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('الرتبة')
                .setDescription('الــرتــبــة الــي بــتــراجــع الــطــلــبــات')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('حذف-مسؤول-اجازات')
        .setDescription('حــذف مــســؤول مــن مــراجــعــة طــلــبــات الإجــازات')
        .addUserOption(option =>
            option.setName('الشخص')
                .setDescription('الــشــخــص الــي بــتــحــذفــه')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('الرتبة')
                .setDescription('الــرتــبــة الــي بــتــحــذفــهــا')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('اضافة-رتبة-استقالة')
        .setDescription('اضــافــة رتــبــة تــنــحــذف عــنــد الاســتــقــالــة')
        .addRoleOption(option =>
            option.setName('الرتبة')
                .setDescription('الــرتــبــة الــي بــتــنــحــذف')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('حذف-رتبة-استقالة')
        .setDescription('حــذف رتــبــة مــن قــائــمــة الاســتــقــالــة')
        .addRoleOption(option =>
            option.setName('الرتبة')
                .setDescription('الــرتــبــة الــي بــتــحــذفــهــا')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('قائمة-مسؤولين-اجازات')
        .setDescription('عــرض قــائــمــة الــمــســؤولــيــن عــن الإجــازات')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('قائمة-رتب-استقالة')
        .setDescription('عــرض قــائــمــة الــرتــب الــي تــنــحــذف بــالاســتــقــالــة')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('تعيين-لوق')
        .setDescription('تــعــيــيــن روم لــوق مــعــيــن')
        .addStringOption(option =>
            option.setName('النوع')
                .setDescription('نــوع الــلــوق')
                .setRequired(true)
                .addChoices(
                    { name: 'الرومات', value: 'channels' },
                    { name: 'البان', value: 'bans' },
                    { name: 'الفويس', value: 'voice' },
                    { name: 'الرتب', value: 'roles' },
                    { name: 'الصور', value: 'images' },
                    { name: 'الرسائل', value: 'messages' },
                    { name: 'التايم اوت', value: 'timeout' },
                    { name: 'التحذيرات', value: 'warnings' }
                ))
        .addChannelOption(option =>
            option.setName('الروم')
                .setDescription('روم الــلــوق')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('اضافة-امر-تايم-اوت')
        .setDescription('اضــافــة امــر جــديــد لــلــتــايــم اوت')
        .addStringOption(option =>
            option.setName('الامر')
                .setDescription('الأمــر الــجــديــد (مــثــال: اســكــت)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('حذف-امر-تايم-اوت')
        .setDescription('حــذف امــر مــن الــتــايــم اوت')
        .addStringOption(option =>
            option.setName('الامر')
                .setDescription('الأمــر الــمــراد حــذفــه')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('اضافة-امر-تحذير')
        .setDescription('اضــافــة امــر جــديــد لــلــتــحــذيــر')
        .addStringOption(option =>
            option.setName('الامر')
                .setDescription('الأمــر الــجــديــد (مــثــال: انــذار)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('حذف-امر-تحذير')
        .setDescription('حــذف امــر مــن الــتــحــذيــر')
        .addStringOption(option =>
            option.setName('الامر')
                .setDescription('الأمــر الــمــراد حــذفــه')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('ايمبد')
        .setDescription('إنــشــاء ايــمــبــد مــع أزرار')
        .addChannelOption(option =>
            option.setName('الروم')
                .setDescription('الــروم الــي بــتــرســل فــيــه')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('العنوان')
                .setDescription('عــنــوان الإيــمــبــد')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('الوصف')
                .setDescription('وصــف الإيــمــبــد')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('الصورة')
                .setDescription('رابــط الــصــورة (اخــتــيــاري)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('نوع_الازرار')
                .setDescription('نــوع الأزرار')
                .setRequired(true)
                .addChoices(
                    { name: 'زر واحد', value: 'single' },
                    { name: 'عدة أزرار', value: 'multiple' }
                ))
        .addStringOption(option =>
            option.setName('اسماء_الازرار')
                .setDescription('أســمــاء الأزرار (افــصــل بــيــنــهــم بــفــاصــلــة)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('تكت')
        .setDescription('إعــداد نــظــام الــتــكــتــات')
        .addChannelOption(option =>
            option.setName('الروم')
                .setDescription('الــروم الــي بــتــرســل فــيــه رســالــة الــتــكــت')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('العنوان')
                .setDescription('عــنــوان الإيــمــبــد')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('الوصف')
                .setDescription('وصــف الإيــمــبــد')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('نوع_الازرار')
                .setDescription('نــوع الأزرار')
                .setRequired(true)
                .addChoices(
                    { name: 'زر واحد', value: 'single' },
                    { name: 'عدة أزرار', value: 'multiple' }
                ))
        .addStringOption(option =>
            option.setName('اسماء_الازرار')
                .setDescription('أســمــاء الأزرار (افــصــل بــيــنــهــم بــفــاصــلــة)')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('الكاتاجوري')
                .setDescription('الــكــاتــاجــوري الــي تــنــفــتــح فــيــه الــتــكــتــات')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('رتبة_الدعم')
                .setDescription('رتــبــة الــدعــم')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('روم_اللوق')
                .setDescription('روم لــوق الــنــقــاط')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('الصورة')
                .setDescription('رابــط الــصــورة (اخــتــيــاري)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('ضريبة')
        .setDescription('إرســال إيــمــبــد نــظــام الــضــريــبــة')
        .addChannelOption(option =>
            option.setName('الروم')
                .setDescription('الــروم الــي بــتــرســل فــيــه')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('العنوان')
                .setDescription('عــنــوان الإيــمــبــد')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('الوصف')
                .setDescription('وصــف الإيــمــبــد')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('الصورة')
                .setDescription('رابــط الــصــورة (اخــتــيــاري)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

client.once('ready', async () => {
    console.log(`بـــوت جـــاهـــز: ${client.user.tag}`);
    
    try {
        const guild = await client.guilds.fetch(ALLOWED_GUILD_ID);
        await guild.commands.set(commands);
        console.log('الأوامـــر تـــم تـــســـجـــيـــلـــهـــا بـــنـــجـــاح');
    } catch (error) {
        console.error('خـــطـــأ فـــي تـــســـجـــيـــل الأوامـــر:', error);
    }
});

client.on('guildCreate', async (guild) => {
    if (guild.id !== ALLOWED_GUILD_ID) {
        try {
            const owner = await guild.fetchOwner();
            await owner.send('تـــحـــاول تـــســـرق الـــبــوت يــســـراق دز مالك دخل');
        } catch (error) {
            console.error('مــا قــدرت ارســل رســالــة لــصــاحــب الــســيــرفــر:', error);
        }
        await guild.leave();
    }
});

client.on('interactionCreate', async (interaction) => {

    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'نسخ-صلاحيات') {
            const fromChannel = interaction.options.getChannel('من');
            const toChannel = interaction.options.getChannel('الى');

            if (!fromChannel || !toChannel) {
                return interaction.reply({ content: 'لــازم تــخــتــار روم صــح', ephemeral: true });
            }

            if (fromChannel.type !== toChannel.type) {
                return interaction.reply({ content: 'لــازم الــرومــات تــكــون نــفــس الــنــوع', ephemeral: true });
            }

            try {
                const permissions = fromChannel.permissionOverwrites.cache;
                await toChannel.permissionOverwrites.set(permissions);
                await interaction.reply({ content: `تــم نــســخ الــصــلاحــيــات مــن <#${fromChannel.id}> لـــ <#${toChannel.id}>`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ وانــا انــســخ الــصــلاحــيــات', ephemeral: true });
            }
        }

        if (commandName === 'ارسال-ايمبد') {
            const channel = interaction.options.getChannel('الروم');
            const description = interaction.options.getString('الوصف');
            const title = interaction.options.getString('العنوان');

            const embed = new EmbedBuilder()
                .setDescription(description)
                .setColor('#5865F2');

            if (title) {
                embed.setTitle(title);
            }

            try {
                await channel.send({ embeds: [embed] });
                await interaction.reply({ content: 'تــم ارســال الــرســالــة بــنــجــاح', ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'مــا قــدرت ارســل الــرســالــة', ephemeral: true });
            }
        }

        if (commandName === 'اجازات') {
            const channel = interaction.options.getChannel('الروم');
            const description = interaction.options.getString('الوصف');
            const title = interaction.options.getString('العنوان');

            const embed = new EmbedBuilder()
                .setDescription(description)
                .setColor('#5865F2');

            if (title) {
                embed.setTitle(title);
            }

            const button = new ButtonBuilder()
                .setCustomId('طلب_اجازة')
                .setLabel('طـــلـــب إجـــازة')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(button);

            try {
                await channel.send({ embeds: [embed], components: [row] });
                await interaction.reply({ content: 'تــم ارســال رســالــة الإجــازات', ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'مــا قــدرت ارســل الــرســالــة', ephemeral: true });
            }
        }

        if (commandName === 'استقالة') {
            const channel = interaction.options.getChannel('الروم');
            const description = interaction.options.getString('الوصف');
            const title = interaction.options.getString('العنوان');

            const embed = new EmbedBuilder()
                .setDescription(description)
                .setColor('#5865F2');

            if (title) {
                embed.setTitle(title);
            }

            const button = new ButtonBuilder()
                .setCustomId('استقالة')
                .setLabel('اســتــقــالــة')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(button);

            try {
                await channel.send({ embeds: [embed], components: [row] });
                await interaction.reply({ content: 'تــم ارســال رســالــة الاســتــقــالــة', ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'مــا قــدرت ارســل الــرســالــة', ephemeral: true });
            }
        }

        if (commandName === 'اضافة-مسؤول-اجازات') {
            const user = interaction.options.getUser('الشخص');
            const role = interaction.options.getRole('الرتبة');

            if (!user && !role) {
                return interaction.reply({ content: 'لــازم تــخــتــار شــخــص او رتــبــة', ephemeral: true });
            }

            try {
                if (user) {
                    const stmt = db.prepare('INSERT OR IGNORE INTO vacation_managers (guild_id, type, value) VALUES (?, ?, ?)');
                    stmt.run(interaction.guildId, 'user', user.id);
                }
                if (role) {
                    const stmt = db.prepare('INSERT OR IGNORE INTO vacation_managers (guild_id, type, value) VALUES (?, ?, ?)');
                    stmt.run(interaction.guildId, 'role', role.id);
                }
                await interaction.reply({ content: 'تــم اضــافــة الــمــســؤول بــنــجــاح', ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ', ephemeral: true });
            }
        }

        if (commandName === 'حذف-مسؤول-اجازات') {
            const user = interaction.options.getUser('الشخص');
            const role = interaction.options.getRole('الرتبة');

            if (!user && !role) {
                return interaction.reply({ content: 'لــازم تــخــتــار شــخــص او رتــبــة', ephemeral: true });
            }

            try {
                if (user) {
                    const stmt = db.prepare('DELETE FROM vacation_managers WHERE guild_id = ? AND type = ? AND value = ?');
                    stmt.run(interaction.guildId, 'user', user.id);
                }
                if (role) {
                    const stmt = db.prepare('DELETE FROM vacation_managers WHERE guild_id = ? AND type = ? AND value = ?');
                    stmt.run(interaction.guildId, 'role', role.id);
                }
                await interaction.reply({ content: 'تــم حــذف الــمــســؤول بــنــجــاح', ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ', ephemeral: true });
            }
        }

        if (commandName === 'اضافة-رتبة-استقالة') {
            const role = interaction.options.getRole('الرتبة');

            try {
                const stmt = db.prepare('INSERT OR IGNORE INTO resignation_roles (guild_id, role_id) VALUES (?, ?)');
                stmt.run(interaction.guildId, role.id);
                await interaction.reply({ content: `تــم اضــافــة رتــبــة ${role.name} لــقــائــمــة الاســتــقــالــة`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ', ephemeral: true });
            }
        }

        if (commandName === 'حذف-رتبة-استقالة') {
            const role = interaction.options.getRole('الرتبة');

            try {
                const stmt = db.prepare('DELETE FROM resignation_roles WHERE guild_id = ? AND role_id = ?');
                stmt.run(interaction.guildId, role.id);
                await interaction.reply({ content: `تــم حــذف رتــبــة ${role.name} مــن قــائــمــة الاســتــقــالــة`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ', ephemeral: true });
            }
        }

        if (commandName === 'قائمة-مسؤولين-اجازات') {
            try {
                const stmt = db.prepare('SELECT type, value FROM vacation_managers WHERE guild_id = ?');
                const managers = stmt.all(interaction.guildId);

                if (managers.length === 0) {
                    return interaction.reply({ content: 'مــا فــي مــســؤولــيــن مــضــافــيــن', ephemeral: true });
                }

                let list = '**قــائــمــة الــمــســؤولــيــن عــن الإجــازات:**\n\n';
                for (const manager of managers) {
                    if (manager.type === 'user') {
                        list += `👤 <@${manager.value}>\n`;
                    } else if (manager.type === 'role') {
                        list += `🎭 <@&${manager.value}>\n`;
                    }
                }

                await interaction.reply({ content: list, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ', ephemeral: true });
            }
        }

        if (commandName === 'قائمة-رتب-استقالة') {
            try {
                const stmt = db.prepare('SELECT role_id FROM resignation_roles WHERE guild_id = ?');
                const roles = stmt.all(interaction.guildId);

                if (roles.length === 0) {
                    return interaction.reply({ content: 'مــا فــي رتــب مــضــافــة', ephemeral: true });
                }

                let list = '**قــائــمــة الــرتــب الــي تــنــحــذف بــالاســتــقــالــة:**\n\n';
                for (const role of roles) {
                    list += `🎭 <@&${role.role_id}>\n`;
                }

                await interaction.reply({ content: list, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ', ephemeral: true });
            }
        }

        if (commandName === 'تعيين-لوق') {
            const logType = interaction.options.getString('النوع');
            const channel = interaction.options.getChannel('الروم');

            try {
                const stmt = db.prepare('INSERT OR REPLACE INTO log_channels (guild_id, log_type, channel_id) VALUES (?, ?, ?)');
                stmt.run(interaction.guildId, logType, channel.id);
                await interaction.reply({ content: `تــم تــعــيــيــن <#${channel.id}> لــلــوق ${logType}`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ', ephemeral: true });
            }
        }

        if (commandName === 'اضافة-امر-تايم-اوت') {
            const command = interaction.options.getString('الامر').toLowerCase();

            try {
                const stmt = db.prepare('INSERT OR IGNORE INTO timeout_commands (guild_id, command) VALUES (?, ?)');
                stmt.run(interaction.guildId, command);
                await interaction.reply({ content: `تــم اضــافــة الأمــر: ${command}`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ', ephemeral: true });
            }
        }

        if (commandName === 'حذف-امر-تايم-اوت') {
            const command = interaction.options.getString('الامر').toLowerCase();

            try {
                const stmt = db.prepare('DELETE FROM timeout_commands WHERE guild_id = ? AND command = ?');
                stmt.run(interaction.guildId, command);
                await interaction.reply({ content: `تــم حــذف الأمــر: ${command}`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ', ephemeral: true });
            }
        }

        if (commandName === 'اضافة-امر-تحذير') {
            const command = interaction.options.getString('الامر').toLowerCase();

            try {
                const stmt = db.prepare('INSERT OR IGNORE INTO warning_commands (guild_id, command) VALUES (?, ?)');
                stmt.run(interaction.guildId, command);
                await interaction.reply({ content: `تــم اضــافــة الأمــر: ${command}`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ', ephemeral: true });
            }
        }

        if (commandName === 'حذف-امر-تحذير') {
            const command = interaction.options.getString('الامر').toLowerCase();

            try {
                const stmt = db.prepare('DELETE FROM warning_commands WHERE guild_id = ? AND command = ?');
                stmt.run(interaction.guildId, command);
                await interaction.reply({ content: `تــم حــذف الأمــر: ${command}`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ', ephemeral: true });
            }
        }

        if (commandName === 'ايمبد') {
            const channel = interaction.options.getChannel('الروم');
            const title = interaction.options.getString('العنوان');
            const description = interaction.options.getString('الوصف');
            const image = interaction.options.getString('الصورة');
            const buttonType = interaction.options.getString('نوع_الازرار');
            const buttonNames = interaction.options.getString('اسماء_الازرار').split('،').map(n => n.trim());

            try {
                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor('#5865F2');

                if (image) {
                    embed.setImage(image);
                }

                const buttons = [];
                for (let i = 0; i < buttonNames.length; i++) {
                    buttons.push(
                        new ButtonBuilder()
                            .setCustomId(`custom_button_${interaction.guildId}_${Date.now()}_${i}`)
                            .setLabel(buttonNames[i])
                            .setStyle(ButtonStyle.Primary)
                    );
                }

                const menuButton = new ButtonBuilder()
                    .setCustomId(`show_buttons_${Date.now()}`)
                    .setLabel('📋 عــرض الأزرار')
                    .setStyle(ButtonStyle.Secondary);

                const menuRow = new ActionRowBuilder().addComponents(menuButton);

                const msg = await channel.send({ embeds: [embed], components: [menuRow] });

                // حفظ الأزرار في قاعدة البيانات مؤقتاً
                const buttonData = JSON.stringify(buttons.map(b => ({ customId: b.data.custom_id, label: b.data.label })));
                
                await interaction.reply({ content: 'تــم إرســال الإيــمــبــد بــنــجــاح! الآن يــمــكــنــك تــعــيــيــن رســائــل الأزرار', ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ', ephemeral: true });
            }
        }

        if (commandName === 'تكت') {
            const channel = interaction.options.getChannel('الروم');
            const title = interaction.options.getString('العنوان');
            const description = interaction.options.getString('الوصف');
            const image = interaction.options.getString('الصورة');
            const buttonType = interaction.options.getString('نوع_الازرار');
            const buttonNames = interaction.options.getString('اسماء_الازرار').split(',').map(n => n.trim());
            const category = interaction.options.getChannel('الكاتاجوري');
            const supportRole = interaction.options.getRole('رتبة_الدعم');
            const logChannel = interaction.options.getChannel('روم_اللوق');

            if (category.type !== ChannelType.GuildCategory) {
                return interaction.reply({ content: 'لــازم تــخــتــار كــاتــاجــوري', ephemeral: true });
            }

            try {
                const stmt = db.prepare('INSERT OR REPLACE INTO ticket_settings (guild_id, category_id, support_role_id, log_channel_id) VALUES (?, ?, ?, ?)');
                stmt.run(interaction.guildId, category.id, supportRole.id, logChannel.id);

                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor('#5865F2');

                if (image) {
                    embed.setImage(image);
                }

                const buttons = [];
                for (let i = 0; i < buttonNames.length; i++) {
                    buttons.push(
                        new ButtonBuilder()
                            .setCustomId(`open_ticket_${i}`)
                            .setLabel(buttonNames[i])
                            .setStyle(ButtonStyle.Primary)
                    );
                }

                const rows = [];
                if (buttonType === 'single') {
                    rows.push(new ActionRowBuilder().addComponents(buttons[0]));
                } else {
                    for (let i = 0; i < buttons.length; i += 5) {
                        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
                    }
                }

                await channel.send({ embeds: [embed], components: rows });
                await interaction.reply({ content: 'تــم إعــداد نــظــام الــتــكــتــات بــنــجــاح', ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ', ephemeral: true });
            }
        }

        if (commandName === 'ضريبة') {
            const channel = interaction.options.getChannel('الروم');
            const title = interaction.options.getString('العنوان');
            const description = interaction.options.getString('الوصف');
            const image = interaction.options.getString('الصورة');

            try {
                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor('#5865F2');

                if (image) {
                    embed.setImage(image);
                }

                const taxButton = new ButtonBuilder()
                    .setCustomId('open_tax_calculator')
                    .setLabel('حــســاب الــضــريــبــة')
                    .setStyle(ButtonStyle.Primary);

                const row = new ActionRowBuilder().addComponents(taxButton);

                await channel.send({ embeds: [embed], components: [row] });
                await interaction.reply({ content: 'تــم إرســال نــظــام الــضــريــبــة بــنــجــاح', ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ', ephemeral: true });
            }
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'طلب_اجازة') {
            const modal = new ModalBuilder()
                .setCustomId('modal_طلب_اجازة')
                .setTitle('طـــلـــب إجـــازة');

            const reasonInput = new TextInputBuilder()
                .setCustomId('سبب_الاجازة')
                .setLabel('ســبــب طــلــب الإجــازة')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const daysInput = new TextInputBuilder()
                .setCustomId('ايام_الاجازة')
                .setLabel('ايــام الإجــازة (ارقــام فــقــط)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const row1 = new ActionRowBuilder().addComponents(reasonInput);
            const row2 = new ActionRowBuilder().addComponents(daysInput);

            modal.addComponents(row1, row2);

            await interaction.showModal(modal);
        }

        if (interaction.customId === 'استقالة') {
            const modal = new ModalBuilder()
                .setCustomId('modal_استقالة')
                .setTitle('اســتــقــالــة');

            const reasonInput = new TextInputBuilder()
                .setCustomId('سبب_الاستقالة')
                .setLabel('لــمــاذا تــريــد ان تــســتــقــيــل؟')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(reasonInput);

            modal.addComponents(row);

            await interaction.showModal(modal);
        }

        if (interaction.customId.startsWith('قبول_اجازة_')) {
            const parts = interaction.customId.split('_');
            const guildId = parts[2];
            const userId = parts[3];
            const days = parts[4];
            const messageId = parts[5]; // معرف فريد للرسالة

            try {
                await interaction.deferReply();
                
                const guild = await client.guilds.fetch(guildId);
                const member = await guild.members.fetch(userId);
                const newNickname = `إجــازة ${days} يــوم`;
                
                await member.setNickname(newNickname);

                const embed = EmbedBuilder.from(interaction.message.embeds[0]);
                embed.setColor('#00FF00');
                embed.addFields({ name: 'الــحــالــة', value: `✅ تــم الــقــبــول بــواســطــة <@${interaction.user.id}>` });

                // تحديث جميع رسائل المسؤولين
                const stmt = db.prepare('SELECT manager_user_id, message_id FROM vacation_messages WHERE guild_id = ? AND request_id = ?');
                const messages = stmt.all(guildId, messageId);
                
                for (const msg of messages) {
                    try {
                        const managerUser = await client.users.fetch(msg.manager_user_id);
                        const dmChannel = await managerUser.createDM();
                        const message = await dmChannel.messages.fetch(msg.message_id);
                        await message.edit({ embeds: [embed], components: [] });
                    } catch (err) {
                        console.error('خطأ في تحديث رسالة:', err);
                    }
                }

                await member.send(`تــم قــبــول طــلــب اجــازتــك لــمــدة ${days} يــوم`).catch(() => {});

                await interaction.editReply({ content: 'تــم قــبــول الــطــلــب' });
                
                // حذف السجلات
                const deleteStmt = db.prepare('DELETE FROM vacation_messages WHERE guild_id = ? AND request_id = ?');
                deleteStmt.run(guildId, messageId);
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: 'صــار خــطــأ' }).catch(() => {});
            }
        }

        if (interaction.customId.startsWith('رفض_اجازة_')) {
            const parts = interaction.customId.split('_');
            const guildId = parts[2];
            const userId = parts[3];
            const messageId = parts[4]; // معرف فريد للرسالة

            try {
                await interaction.deferReply();
                
                const guild = await client.guilds.fetch(guildId);
                const member = await guild.members.fetch(userId);

                const embed = EmbedBuilder.from(interaction.message.embeds[0]);
                embed.setColor('#FF0000');
                embed.addFields({ name: 'الــحــالــة', value: `❌ تــم الــرفــض بــواســطــة <@${interaction.user.id}>` });

                // تحديث جميع رسائل المسؤولين
                const stmt = db.prepare('SELECT manager_user_id, message_id FROM vacation_messages WHERE guild_id = ? AND request_id = ?');
                const messages = stmt.all(guildId, messageId);
                
                for (const msg of messages) {
                    try {
                        const managerUser = await client.users.fetch(msg.manager_user_id);
                        const dmChannel = await managerUser.createDM();
                        const message = await dmChannel.messages.fetch(msg.message_id);
                        await message.edit({ embeds: [embed], components: [] });
                    } catch (err) {
                        console.error('خطأ في تحديث رسالة:', err);
                    }
                }

                await member.send('تــم رفــض طــلــب اجــازتــك').catch(() => {});

                await interaction.editReply({ content: 'تــم رفــض الــطــلــب' });
                
                // حذف السجلات
                const deleteStmt = db.prepare('DELETE FROM vacation_messages WHERE guild_id = ? AND request_id = ?');
                deleteStmt.run(guildId, messageId);
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: 'صــار خــطــأ' }).catch(() => {});
            }
        }

        if (interaction.customId.startsWith('تأكيد_استقالة_نعم_')) {
            const parts = interaction.customId.split('_');
            const userId = parts[3];
            const guildId = parts[4];

            if (interaction.user.id !== userId) {
                return interaction.reply({ content: 'هــذا الــزر مــو الــك', ephemeral: true });
            }

            try {
                const guild = await client.guilds.fetch(guildId);
                const member = await guild.members.fetch(userId);
                const stmt = db.prepare('SELECT role_id FROM resignation_roles WHERE guild_id = ?');
                const rolesToRemove = stmt.all(guildId);

                for (const roleData of rolesToRemove) {
                    const role = guild.roles.cache.get(roleData.role_id);
                    if (role && member.roles.cache.has(role.id)) {
                        await member.roles.remove(role);
                    }
                }

                await interaction.update({ content: 'تــم تــقــديــم اســتــقــالــتــك وحــذف رتــبــك الإداريــة', components: [] });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ', ephemeral: true });
            }
        }

        if (interaction.customId.startsWith('تأكيد_استقالة_لا_')) {
            const userId = interaction.customId.split('_')[3];

            if (interaction.user.id !== userId) {
                return interaction.reply({ content: 'هــذا الــزر مــو الــك', ephemeral: true });
            }

            await interaction.update({ content: 'تــم الــغــاء طــلــب الاســتــقــالــة', components: [] });
        }

        if (interaction.customId.startsWith('open_ticket_')) {
            const stmt = db.prepare('SELECT * FROM ticket_settings WHERE guild_id = ?');
            const settings = stmt.get(interaction.guildId);

            if (!settings) {
                return interaction.reply({ content: 'مــا تــم إعــداد نــظــام الــتــكــتــات', ephemeral: true });
            }

            try {
                const updateStmt = db.prepare('UPDATE ticket_settings SET ticket_counter = ticket_counter + 1 WHERE guild_id = ?');
                updateStmt.run(interaction.guildId);

                const counterStmt = db.prepare('SELECT ticket_counter FROM ticket_settings WHERE guild_id = ?');
                const counter = counterStmt.get(interaction.guildId).ticket_counter;

                const category = interaction.guild.channels.cache.get(settings.category_id);
                const supportRole = interaction.guild.roles.cache.get(settings.support_role_id);

                const ticketChannel = await interaction.guild.channels.create({
                    name: `ticket-${counter}`,
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        {
                            id: interaction.user.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                        },
                        {
                            id: supportRole.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                        }
                    ]
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setDescription(`مــرحــبــاً <@${interaction.user.id}>!\nفــريــق الــدعــم ســيــرد عــلــيــك قــريــبــاً`)
                    .setColor('#5865F2');

                const menuButton = new ButtonBuilder()
                    .setCustomId(`show_ticket_menu_${ticketChannel.id}`)
                    .setLabel('📋 قــائــمــة الــخــيــارات')
                    .setStyle(ButtonStyle.Secondary);

                const menuRow = new ActionRowBuilder().addComponents(menuButton);

                await ticketChannel.send({ embeds: [welcomeEmbed], components: [menuRow] });

                await interaction.reply({ content: `تــم فــتــح تــكــت: <#${ticketChannel.id}>`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ', ephemeral: true });
            }
        }

        if (interaction.customId.startsWith('show_ticket_menu_')) {
            const ticketId = interaction.customId.split('_')[3];

            const claimButton = new ButtonBuilder()
                .setCustomId(`claim_ticket_${ticketId}`)
                .setLabel('اســتــلام الــتــكــت')
                .setStyle(ButtonStyle.Success);

            const supportButton = new ButtonBuilder()
                .setCustomId(`support_ticket_${ticketId}`)
                .setLabel('طــلــب دعــم')
                .setStyle(ButtonStyle.Primary);

            const callButton = new ButtonBuilder()
                .setCustomId(`call_support_${ticketId}`)
                .setLabel('دعــوة الــدعــم')
                .setStyle(ButtonStyle.Secondary);

            const closeButton = new ButtonBuilder()
                .setCustomId(`close_ticket_${ticketId}`)
                .setLabel('قــفــل')
                .setStyle(ButtonStyle.Danger);

            const row1 = new ActionRowBuilder().addComponents(claimButton, supportButton);
            const row2 = new ActionRowBuilder().addComponents(callButton, closeButton);

            await interaction.reply({ content: 'الــخــيــارات الــمــتــاحــة:', components: [row1, row2], ephemeral: true });
        }

        if (interaction.customId.startsWith('show_buttons_')) {
            const messageId = interaction.message.id;
            const originalButtons = interaction.message.components[0].components;
            
            // إنشاء الأزرار المخصصة من البيانات المحفوظة
            await interaction.reply({ content: 'اســتــخــدم /تــعــيــيــن-زر لــتــحــديــد رســالــة كــل زر', ephemeral: true });
        }

        if (interaction.customId.startsWith('claim_ticket_')) {
            const ticketId = interaction.customId.split('_')[2];
            const ticket = interaction.guild.channels.cache.get(ticketId);

            const stmt = db.prepare('SELECT support_role_id FROM ticket_settings WHERE guild_id = ?');
            const settings = stmt.get(interaction.guildId);

            if (!interaction.member.roles.cache.has(settings.support_role_id)) {
                return interaction.reply({ content: 'مــا عــنــدك رتــبــة الــدعــم', ephemeral: true });
            }

            if (ticket.name.includes('-claimed')) {
                return interaction.reply({ content: 'الــتــكــت مــســتــلــم مــن قــبــل', ephemeral: true });
            }

            try {
                await ticket.setName(`${ticket.name}-claimed`);

                // حفظ معرف المستلم في الصلاحيات
                await ticket.permissionOverwrites.edit(interaction.user.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ManageChannels: true // علامة للمستلم
                });

                const supportRole = interaction.guild.roles.cache.get(settings.support_role_id);
                const members = interaction.guild.members.cache.filter(m => 
                    m.roles.cache.has(supportRole.id) && m.id !== interaction.user.id
                );

                for (const [, member] of members) {
                    await ticket.permissionOverwrites.edit(member.id, {
                        SendMessages: false
                    });
                }

                await ticket.send(`تــم اســتــلام الــتــكــت بــواســطــة <@${interaction.user.id}>`);
                
                // تحديث الرسالة لإخفاء زر الاستلام
                const claimButton = new ButtonBuilder()
                    .setCustomId(`claim_ticket_${ticketId}`)
                    .setLabel('اســتــلام الــتــكــت')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true);

                const supportButton = new ButtonBuilder()
                    .setCustomId(`support_ticket_${ticketId}`)
                    .setLabel('طــلــب دعــم')
                    .setStyle(ButtonStyle.Primary);

                const callButton = new ButtonBuilder()
                    .setCustomId(`call_support_${ticketId}`)
                    .setLabel('دعــوة الــدعــم')
                    .setStyle(ButtonStyle.Secondary);

                const closeButton = new ButtonBuilder()
                    .setCustomId(`close_ticket_${ticketId}`)
                    .setLabel('قــفــل')
                    .setStyle(ButtonStyle.Danger);

                const row1 = new ActionRowBuilder().addComponents(claimButton, supportButton);
                const row2 = new ActionRowBuilder().addComponents(callButton, closeButton);

                await interaction.message.edit({ components: [row1, row2] });
                await interaction.reply({ content: 'تــم اســتــلام الــتــكــت', ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'صــار خــطــأ', ephemeral: true });
            }
        }

        if (interaction.customId.startsWith('call_support_')) {
            const stmt = db.prepare('SELECT support_role_id FROM ticket_settings WHERE guild_id = ?');
            const settings = stmt.get(interaction.guildId);

            await interaction.channel.send(`<@&${settings.support_role_id}> تــم طــلــب الــدعــم!`);
            await interaction.reply({ content: 'تــم اســتــدعــاء الــدعــم', ephemeral: true });
        }

        if (interaction.customId.startsWith('support_ticket_')) {
            const ticketId = interaction.customId.split('_')[2];
            const ticket = interaction.guild.channels.cache.get(ticketId);

            if (!ticket.name.includes('-claimed')) {
                return interaction.reply({ content: 'لــازم يــتــم اســتــلام الــتــكــت اولاً', ephemeral: true });
            }

            const claimedBy = ticket.permissionOverwrites.cache.find(p => 
                p.type === 1 && p.allow.has(PermissionFlagsBits.SendMessages) && p.id !== ticket.guild.ownerId
            );

            if (!claimedBy) {
                return interaction.reply({ content: 'مــا لــقــيــت مــســتــلــم الــتــكــت', ephemeral: true });
            }

            const supportEmbed = new EmbedBuilder()
                .setTitle('طــلــب دعــم مــســتــلــم')
                .setDescription(`**الــمــســتــلــم:** <@${claimedBy.id}>\n**الــســبــب:** دعــم إضــافــي`)
                .setColor('#FFA500')
                .setTimestamp();

            const acceptButton = new ButtonBuilder()
                .setCustomId(`accept_support_${ticketId}_${interaction.user.id}`)
                .setLabel('قــبــول')
                .setStyle(ButtonStyle.Success);

            const rejectButton = new ButtonBuilder()
                .setCustomId(`reject_support_${ticketId}_${interaction.user.id}`)
                .setLabel('رفــض')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(acceptButton, rejectButton);

            try {
                const claimer = await interaction.guild.members.fetch(claimedBy.id);
                await claimer.send({ embeds: [supportEmbed], components: [row] });
                await interaction.reply({ content: 'تــم ارســال الــطــلــب', ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'مــا قــدرت ارســل لــلــمــســتــلــم', ephemeral: true });
            }
        }

        if (interaction.customId.startsWith('accept_support_')) {
            const parts = interaction.customId.split('_');
            const ticketId = parts[2];
            const requesterId = parts[3];

            const ticket = interaction.guild.channels.cache.get(ticketId);

            try {
                await ticket.permissionOverwrites.edit(requesterId, {
                    ViewChannel: true,
                    SendMessages: true
                });

                await ticket.send(`تــم قــبــول دعــم <@${requesterId}>`);
                await interaction.update({ content: 'تــم قــبــول الــطــلــب', components: [] });
            } catch (error) {
                console.error(error);
                await interaction.update({ content: 'صــار خــطــأ', components: [] });
            }
        }

        if (interaction.customId.startsWith('reject_support_')) {
            const parts = interaction.customId.split('_');
            const ticketId = parts[2];
            const requesterId = parts[3];

            const ticket = interaction.guild.channels.cache.get(ticketId);

            try {
                await ticket.send(`تــم رفــض دعــم <@${requesterId}>`);
                await interaction.update({ content: 'تــم رفــض الــطــلــب', components: [] });
            } catch (error) {
                console.error(error);
                await interaction.update({ content: 'صــار خــطــأ', components: [] });
            }
        }

        if (interaction.customId.startsWith('close_ticket_')) {
            const ticketId = interaction.customId.split('_')[2];
            const ticket = interaction.guild.channels.cache.get(ticketId);

            if (!ticket.name.includes('-claimed')) {
                return interaction.reply({ content: 'لــازم يــتــم اســتــلام الــتــكــت اولاً', ephemeral: true });
            }

            const stmt = db.prepare('SELECT support_role_id, log_channel_id FROM ticket_settings WHERE guild_id = ?');
            const settings = stmt.get(interaction.guildId);

            if (!interaction.member.roles.cache.has(settings.support_role_id)) {
                return interaction.reply({ content: 'مــا عــنــدك صــلاحــيــة', ephemeral: true });
            }

            await interaction.reply('ســيــتــم قــفــل الــتــكــت بــعــد 5 ثــوانــي...');

            setTimeout(async () => {
                try {
                    const messages = await ticket.messages.fetch({ limit: 100 });
                    const transcript = messages.reverse().map(m => 
                        `[${m.createdAt.toLocaleString('ar-SA')}] ${m.author.tag}: ${m.content}`
                    ).join('\n');

                    const transcriptId = `transcript_${ticket.id}_${Date.now()}`;
                    const insertStmt = db.prepare('INSERT INTO ticket_transcripts (ticket_id, guild_id, transcript_data, created_at) VALUES (?, ?, ?, ?)');
                    insertStmt.run(transcriptId, interaction.guildId, transcript, Date.now());

                    const claimedBy = ticket.permissionOverwrites.cache.find(p => 
                        p.type === 1 && p.allow.has(PermissionFlagsBits.ManageChannels) && p.id !== ticket.guild.ownerId
                    );

                    if (claimedBy) {
                        const pointsStmt = db.prepare('INSERT OR IGNORE INTO ticket_points (guild_id, user_id, points) VALUES (?, ?, 0)');
                        pointsStmt.run(interaction.guildId, claimedBy.id);

                        const updateStmt = db.prepare('UPDATE ticket_points SET points = points + 1 WHERE guild_id = ? AND user_id = ?');
                        updateStmt.run(interaction.guildId, claimedBy.id);

                        const getStmt = db.prepare('SELECT points FROM ticket_points WHERE guild_id = ? AND user_id = ?');
                        const points = getStmt.get(interaction.guildId, claimedBy.id).points;

                        const logChannel = interaction.guild.channels.cache.get(settings.log_channel_id);
                        if (logChannel) {
                            const logEmbed = new EmbedBuilder()
                                .setTitle('تــم قــفــل تــكــت')
                                .setDescription(`**الــمــســتــلــم:** <@${claimedBy.id}>\n**الــنــقــاط الــحــالــيــة:** ${points}`)
                                .setColor('#00FF00')
                                .setTimestamp();

                            await logChannel.send({ embeds: [logEmbed] });
                        }
                    }

                    await ticket.delete();
                } catch (error) {
                    console.error(error);
                }
            }, 5000);
        }

        if (interaction.customId === 'open_tax_calculator') {
            const modal = new ModalBuilder()
                .setCustomId('tax_modal')
                .setTitle('حــســاب الــضــريــبــة');

            const amountInput = new TextInputBuilder()
                .setCustomId('tax_amount')
                .setLabel('الــمــبــلــغ (مــثــال: 50k, 5m, 1b)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(amountInput);
            modal.addComponents(row);

            await interaction.showModal(modal);
        }

        if (interaction.customId.startsWith('switch_to_robux_')) {
            const amount = interaction.customId.split('_')[3];
            
            // حساب ضريبة الروبوكس (30%)
            const cleanAmount = parseFloat(amount);
            const robuxTax = Math.ceil(cleanAmount / 0.7);
            
            const embed = new EmbedBuilder()
                .setTitle('ضــريــبــة روبــوكــس الــمــابــات <:1000060493:1423612938761011240>')
                .setDescription(`\`\`${robuxTax.toLocaleString()}\`\``)
                .setColor('#00FF00')
                .setTimestamp();

            const backButton = new ButtonBuilder()
                .setCustomId(`switch_to_probot_${amount}`)
                .setEmoji('<:1000060494:1423612911066157118>')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(backButton);

            await interaction.update({ embeds: [embed], components: [row] });
        }

        if (interaction.customId.startsWith('switch_to_probot_')) {
            const amount = interaction.customId.split('_')[3];
            
            // حساب ضريبة البروبوت (5%)
            const cleanAmount = parseFloat(amount);
            const probotTax = Math.ceil(cleanAmount / 0.95);
            const mediatorTax = Math.ceil(probotTax / 0.95);
            
            const embed = new EmbedBuilder()
                .setTitle('حــســاب الــضــريــبــة')
                .addFields(
                    { name: 'ضــريــبــة الــبــروبــوت <:1000060494:1423612911066157118>', value: `\`\`${probotTax.toLocaleString()}\`\`` },
                    { name: 'ضــريــبــة الــوســيــط <a:1000060667:1423613980760477737>', value: `\`\`${mediatorTax.toLocaleString()}\`\`` }
                )
                .setColor('#5865F2')
                .setTimestamp();

            const robuxButton = new ButtonBuilder()
                .setCustomId(`switch_to_robux_${amount}`)
                .setEmoji('<:1000060493:1423612938761011240>')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(robuxButton);

            await interaction.update({ embeds: [embed], components: [row] });
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_طلب_اجازة') {
            const reason = interaction.fields.getTextInputValue('سبب_الاجازة');
            const days = interaction.fields.getTextInputValue('ايام_الاجازة');

            if (!/^\d+$/.test(days)) {
                return interaction.reply({ content: 'لــازم تــكــتــب ارقــام فــقــط بــخــانــة الأيــام', ephemeral: true });
            }

            const stmt = db.prepare('SELECT type, value FROM vacation_managers WHERE guild_id = ?');
            const managers = stmt.all(interaction.guildId);

            if (managers.length === 0) {
                return interaction.reply({ content: 'مــا فــي مــســؤولــيــن مــضــافــيــن، كــلــم الأدمــن', ephemeral: true });
            }

            const requestId = `${interaction.guildId}_${interaction.user.id}_${Date.now()}`;

            const embed = new EmbedBuilder()
                .setTitle('طــلــب إجــازة جــديــد')
                .setColor('#FFA500')
                .addFields(
                    { name: 'الــشــخــص', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'الــمــدة', value: `${days} يــوم`, inline: true },
                    { name: 'الــســبــب', value: reason }
                )
                .setTimestamp();

            const acceptButton = new ButtonBuilder()
                .setCustomId(`قبول_اجازة_${interaction.guildId}_${interaction.user.id}_${days}_${requestId}`)
                .setLabel('قـــبـــول')
                .setStyle(ButtonStyle.Success);

            const rejectButton = new ButtonBuilder()
                .setCustomId(`رفض_اجازة_${interaction.guildId}_${interaction.user.id}_${requestId}`)
                .setLabel('رفـــض')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(acceptButton, rejectButton);

            const insertStmt = db.prepare('INSERT INTO vacation_messages (guild_id, request_id, manager_user_id, message_id) VALUES (?, ?, ?, ?)');

            for (const manager of managers) {
                try {
                    if (manager.type === 'user') {
                        const user = await client.users.fetch(manager.value);
                        const msg = await user.send({ embeds: [embed], components: [row] });
                        insertStmt.run(interaction.guildId, requestId, user.id, msg.id);
                    } else if (manager.type === 'role') {
                        const members = interaction.guild.members.cache.filter(m => m.roles.cache.has(manager.value));
                        for (const [, member] of members) {
                            try {
                                const msg = await member.send({ embeds: [embed], components: [row] });
                                insertStmt.run(interaction.guildId, requestId, member.id, msg.id);
                            } catch (err) {
                                console.error('خطأ في إرسال رسالة:', err);
                            }
                        }
                    }
                } catch (error) {
                    console.error('مــا قــدرت ارســل لــلــمــســؤول:', error);
                }
            }

            await interaction.reply({ content: 'تــم ارســال طــلــبــك لــلــمــســؤولــيــن', ephemeral: true });
        }

        if (interaction.customId === 'modal_استقالة') {
            const reason = interaction.fields.getTextInputValue('سبب_الاستقالة');

            const embed = new EmbedBuilder()
                .setDescription(`**هــل انــت مــتــأكــد مــن تــقــديــم اســتــقــالــتــك؟**\n\nســوف يــتــم حــذف جــمــيــع رتــبــك الإداريــة اذا ضــغــطــت نــعــم\n\n**الــســبــب:** ${reason}`)
                .setColor('#FFA500');

            const yesButton = new ButtonBuilder()
                .setCustomId(`تأكيد_استقالة_نعم_${interaction.user.id}_${interaction.guildId}`)
                .setLabel('نــعــم')
                .setStyle(ButtonStyle.Danger);

            const noButton = new ButtonBuilder()
                .setCustomId(`تأكيد_استقالة_لا_${interaction.user.id}`)
                .setLabel('لا')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(yesButton, noButton);

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        if (interaction.customId === 'tax_modal') {
            const input = interaction.fields.getTextInputValue('tax_amount').toLowerCase().trim();
            
            // تحويل الاختصارات إلى أرقام
            let amount = 0;
            if (input.endsWith('k')) {
                amount = parseFloat(input.slice(0, -1)) * 1000;
            } else if (input.endsWith('m')) {
                amount = parseFloat(input.slice(0, -1)) * 1000000;
            } else if (input.endsWith('b')) {
                amount = parseFloat(input.slice(0, -1)) * 1000000000;
            } else {
                amount = parseFloat(input);
            }

            if (isNaN(amount) || amount <= 0) {
                return interaction.reply({ content: 'الــرجــاء إدخــال رقــم صــحــيــح', ephemeral: true });
            }

            // حساب ضريبة البروبوت (5%)
            const probotTax = Math.ceil(amount / 0.95);
            const mediatorTax = Math.ceil(probotTax / 0.95);

            const embed = new EmbedBuilder()
                .setTitle('حــســاب الــضــريــبــة')
                .addFields(
                    { name: 'ضــريــبــة الــبــروبــوت <:1000060494:1423612911066157118>', value: `\`\`${probotTax.toLocaleString()}\`\`` },
                    { name: 'ضــريــبــة الــوســيــط <a:1000060667:1423613980760477737>', value: `\`\`${mediatorTax.toLocaleString()}\`\`` }
                )
                .setColor('#5865F2')
                .setTimestamp();

            const robuxButton = new ButtonBuilder()
                .setCustomId(`switch_to_robux_${amount}`)
                .setEmoji('<:1000060493:1423612938761011240>')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(robuxButton);

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }
    }
});

// نظام اللوقات
async function sendLog(guildId, logType, embed) {
    try {
        const stmt = db.prepare('SELECT channel_id FROM log_channels WHERE guild_id = ? AND log_type = ?');
        const result = stmt.get(guildId, logType);
        
        if (result) {
            const guild = await client.guilds.fetch(guildId);
            const channel = await guild.channels.fetch(result.channel_id);
            if (channel) {
                await channel.send({ embeds: [embed] });
            }
        }
    } catch (error) {
        console.error('خــطــأ فــي ارســال الــلــوق:', error);
    }
}

// لوق الرومات
client.on('channelCreate', async (channel) => {
    if (!channel.guild) return;
    
    const embed = new EmbedBuilder()
        .setTitle('📝 روم جــديــد')
        .setColor('#00FF00')
        .addFields(
            { name: 'الاســم', value: channel.name, inline: true },
            { name: 'الــنــوع', value: channel.type.toString(), inline: true },
            { name: 'الــمــعــرف', value: channel.id, inline: true }
        )
        .setTimestamp();
    
    await sendLog(channel.guild.id, 'channels', embed);
});

client.on('channelDelete', async (channel) => {
    if (!channel.guild) return;
    
    const embed = new EmbedBuilder()
        .setTitle('🗑️ روم مــحــذوف')
        .setColor('#FF0000')
        .addFields(
            { name: 'الاســم', value: channel.name, inline: true },
            { name: 'الــنــوع', value: channel.type.toString(), inline: true },
            { name: 'الــمــعــرف', value: channel.id, inline: true }
        )
        .setTimestamp();
    
    await sendLog(channel.guild.id, 'channels', embed);
});

client.on('channelUpdate', async (oldChannel, newChannel) => {
    if (!newChannel.guild) return;
    
    const changes = [];
    if (oldChannel.name !== newChannel.name) {
        changes.push({ name: 'الاســم', value: `${oldChannel.name} ← ${newChannel.name}` });
    }
    
    // فحص تعديل الصلاحيات
    const oldPerms = oldChannel.permissionOverwrites.cache;
    const newPerms = newChannel.permissionOverwrites.cache;
    
    if (oldPerms.size !== newPerms.size || !oldPerms.equals(newPerms)) {
        changes.push({ name: 'الــصــلاحــيــات', value: 'تــم تــعــديــل الــصــلاحــيــات' });
    }
    
    if (changes.length > 0) {
        const embed = new EmbedBuilder()
            .setTitle('✏️ تــعــديــل روم')
            .setColor('#FFA500')
            .addFields(changes)
            .addFields({ name: 'الــمــعــرف', value: newChannel.id })
            .setTimestamp();
        
        await sendLog(newChannel.guild.id, 'channels', embed);
    }
});

// لوق البان
client.on('guildBanAdd', async (ban) => {
    const embed = new EmbedBuilder()
        .setTitle('🔨 بــان جــديــد')
        .setColor('#FF0000')
        .addFields(
            { name: 'الــعــضــو', value: `${ban.user.tag}`, inline: true },
            { name: 'الــمــعــرف', value: ban.user.id, inline: true }
        )
        .setTimestamp();
    
    await sendLog(ban.guild.id, 'bans', embed);
});

client.on('guildBanRemove', async (ban) => {
    const embed = new EmbedBuilder()
        .setTitle('✅ فــك بــان')
        .setColor('#00FF00')
        .addFields(
            { name: 'الــعــضــو', value: `${ban.user.tag}`, inline: true },
            { name: 'الــمــعــرف', value: ban.user.id, inline: true }
        )
        .setTimestamp();
    
    await sendLog(ban.guild.id, 'bans', embed);
});

// لوق الفويس
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!newState.guild) return;
    
    let embed;
    
    if (!oldState.channel && newState.channel) {
        embed = new EmbedBuilder()
            .setTitle('🎤 دــخــول فــويــس')
            .setColor('#00FF00')
            .addFields(
                { name: 'الــعــضــو', value: `<@${newState.member.id}>`, inline: true },
                { name: 'الــروم', value: `<#${newState.channel.id}>`, inline: true }
            )
            .setTimestamp();
    } else if (oldState.channel && !newState.channel) {
        embed = new EmbedBuilder()
            .setTitle('👋 خــروج مــن فــويــس')
            .setColor('#FF0000')
            .addFields(
                { name: 'الــعــضــو', value: `<@${oldState.member.id}>`, inline: true },
                { name: 'الــروم', value: `<#${oldState.channel.id}>`, inline: true }
            )
            .setTimestamp();
    } else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        embed = new EmbedBuilder()
            .setTitle('🔄 انــتــقــال بــيــن رومــات الــفــويــس')
            .setColor('#FFA500')
            .addFields(
                { name: 'الــعــضــو', value: `<@${newState.member.id}>`, inline: true },
                { name: 'مــن', value: `<#${oldState.channel.id}>`, inline: true },
                { name: 'إلــى', value: `<#${newState.channel.id}>`, inline: true }
            )
            .setTimestamp();
    }
    
    if (embed) {
        await sendLog(newState.guild.id, 'voice', embed);
    }
});

// لوق الرتب - إضافة وإزالة من أعضاء
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
    
    if (addedRoles.size > 0) {
        const embed = new EmbedBuilder()
            .setTitle('➕ إضــافــة رتــبــة')
            .setColor('#00FF00')
            .addFields(
                { name: 'الــعــضــو', value: `<@${newMember.id}>`, inline: true },
                { name: 'الــرتــب', value: addedRoles.map(r => `<@&${r.id}>`).join(', ') }
            )
            .setTimestamp();
        
        await sendLog(newMember.guild.id, 'roles', embed);
    }
    
    if (removedRoles.size > 0) {
        const embed = new EmbedBuilder()
            .setTitle('➖ إزالــة رتــبــة')
            .setColor('#FF0000')
            .addFields(
                { name: 'الــعــضــو', value: `<@${newMember.id}>`, inline: true },
                { name: 'الــرتــب', value: removedRoles.map(r => `<@&${r.id}>`).join(', ') }
            )
            .setTimestamp();
        
        await sendLog(newMember.guild.id, 'roles', embed);
    }
});

// لوق الرتب - إنشاء رتبة جديدة
client.on('roleCreate', async (role) => {
    const embed = new EmbedBuilder()
        .setTitle('🆕 إنــشــاء رتــبــة جــديــدة')
        .setColor('#00FF00')
        .addFields(
            { name: 'الاســم', value: role.name, inline: true },
            { name: 'الــمــعــرف', value: role.id, inline: true }
        )
        .setTimestamp();
    
    await sendLog(role.guild.id, 'roles', embed);
});

// لوق الرتب - حذف رتبة
client.on('roleDelete', async (role) => {
    const embed = new EmbedBuilder()
        .setTitle('🗑️ حــذف رتــبــة')
        .setColor('#FF0000')
        .addFields(
            { name: 'الاســم', value: role.name, inline: true },
            { name: 'الــمــعــرف', value: role.id, inline: true }
        )
        .setTimestamp();
    
    await sendLog(role.guild.id, 'roles', embed);
});

// لوق الرسائل
client.on('messageDelete', async (message) => {
    if (!message.guild || message.author.bot) return;
    
    const embed = new EmbedBuilder()
        .setTitle('🗑️ رســالــة مــحــذوفــة')
        .setColor('#FF0000')
        .addFields(
            { name: 'الــكــاتــب', value: `<@${message.author.id}>`, inline: true },
            { name: 'الــروم', value: `<#${message.channel.id}>`, inline: true },
            { name: 'الــمــحــتــوى', value: message.content || 'لا يــوجــد مــحــتــوى نــصــي' }
        )
        .setTimestamp();
    
    if (message.attachments.size > 0) {
        embed.addFields({ name: 'مــرفــقــات', value: `${message.attachments.size} مــلــف` });
    }
    
    await sendLog(message.guild.id, 'messages', embed);
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!newMessage.guild || newMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return;
    
    const embed = new EmbedBuilder()
        .setTitle('✏️ تــعــديــل رســالــة')
        .setColor('#FFA500')
        .addFields(
            { name: 'الــكــاتــب', value: `<@${newMessage.author.id}>`, inline: true },
            { name: 'الــروم', value: `<#${newMessage.channel.id}>`, inline: true },
            { name: 'قــبــل', value: oldMessage.content || 'لا يــوجــد' },
            { name: 'بــعــد', value: newMessage.content || 'لا يــوجــد' }
        )
        .setTimestamp();
    
    await sendLog(newMessage.guild.id, 'messages', embed);
});

// نظام الرسائل النصية للتايم اوت والتحذير
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    const msgArgs = message.content.split(' ');
    const msgCommand = msgArgs[0].toLowerCase();

    // فك التايم اوت
    if (msgCommand === 'تشغيل') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('مــا عــنــدك صــلاحــيــات');
        }

        const member = message.mentions.members.first();
        if (!member) return message.reply('مــنــشــن الــشــخــص');

        try {
            await member.timeout(null);
            await message.reply(`تــم فــك الــتــايــم عــن <@${member.id}> <:1000060658:1423580120551264347> !`);
        } catch (error) {
            console.error(error);
            await message.reply('صــار خــطــأ');
        }
        return;
    }

    // عرض التحذيرات
    if (msgCommand === 'تحذيرات') {
        const member = message.mentions.members.first();
        if (!member) return message.reply('مــنــشــن الــشــخــص');

        try {
            const stmt = db.prepare('SELECT warned_by, reason, timestamp FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC');
            const warnings = stmt.all(message.guild.id, member.id);

            if (warnings.length === 0) {
                return message.reply(`<@${member.id}> مــا عــنــده تــحــذيــرات`);
            }

            const embed = new EmbedBuilder()
                .setTitle(`تــحــذيــرات ${member.user.username}`)
                .setColor('#FF0000')
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();

            for (const warning of warnings) {
                const date = new Date(warning.timestamp).toLocaleString('ar-SA');
                embed.addFields({
                    name: `بــواســطــة: <@${warning.warned_by}>`,
                    value: `**الــســبــب:** ${warning.reason}\n**الــتــاريــخ:** ${date}`
                });
            }

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await message.reply('صــار خــطــأ');
        }
        return;
    }
    
    // فحص الشعار في التكتات
    if (message.channel.name && message.channel.name.startsWith('ticket-')) {
        const logos = ['𝗦𝗧𝗜', '𝐒𝐓𝐈', '𝑺𝑻𝑰', '𝘚𝘛𝘐', '𝙎𝙏𝙄'];
        
        if (logos.includes(message.content.trim())) {
            try {
                const currentNick = message.member.nickname || message.author.username;
                const logo = message.content.trim();
                
                // إزالة الشعار القديم إن وجد
                let baseName = currentNick;
                for (const l of logos) {
                    if (currentNick.startsWith(l + ' ')) {
                        baseName = currentNick.substring(l.length + 1);
                        break;
                    }
                }
                
                const newNick = `${logo} ${baseName}`;
                await message.member.setNickname(newNick);
                
                await message.delete();
                await message.channel.send(`تــم تــعــيــيــن الــشــعــار لـــ <@${message.author.id}>`).then(m => {
                    setTimeout(() => m.delete(), 3000);
                });
            } catch (error) {
                console.error(error);
            }
            return;
        }
    }
    
    // نظام المساعدة
    if (message.content.startsWith('#مساعدة')) {
        const helpParts = message.content.toLowerCase().split(' ');
        const helpType = helpParts.slice(1).join(' ');
        
        if (helpType.includes('تايم') || helpType.includes('timeout') || helpType.includes('اوت')) {
            const stmt = db.prepare('SELECT command FROM timeout_commands WHERE guild_id = ?');
            const commands = stmt.all(message.guild.id);
            
            let commandsList = commands.length > 0 ? commands.map(c => `\`${c.command}\``).join(' أو ') : '`تايم-اوت` أو `timeout`';
            
            const embed = new EmbedBuilder()
                .setTitle('📋 مــســاعــدة الــتــايــم اوت')
                .setDescription('**أوامــر الــتــشــغــيــل:**\n\n' +
                    `${commandsList} @شخص 1d - يــوم واحــد\n` +
                    `${commandsList} @شخص 2h - ســاعــتــيــن\n` +
                    `${commandsList} @شخص 30m - 30 دقــيــقــة\n\n` +
                    '**الــوحــدات الــمــتــاحــة:**\n' +
                    '`d` = يــوم\n' +
                    '`h` = ســاعــة\n' +
                    '`m` = دقــيــقــة')
                .setColor('#5865F2');
            
            return message.reply({ embeds: [embed] });
        }
        
        if (helpType.includes('تحذير') || helpType.includes('warning')) {
            const stmt = db.prepare('SELECT command FROM warning_commands WHERE guild_id = ?');
            const commands = stmt.all(message.guild.id);
            
            let commandsList = commands.length > 0 ? commands.map(c => `\`${c.command}\``).join(' أو ') : '`تحذير` أو `warning`';
            
            const embed = new EmbedBuilder()
                .setTitle('📋 مــســاعــدة الــتــحــذيــر')
                .setDescription('**أوامــر الــتــشــغــيــل:**\n\n' +
                    `${commandsList} @شخص السبب\n\n` +
                    '**مــثــال:**\n' +
                    `${commands.length > 0 ? `\`${commands[0].command}\`` : '`تحذير`'} @user عــدم تــفــاعــل`)
                .setColor('#5865F2');
            
            return message.reply({ embeds: [embed] });
        }
        
        return;
    }
    
    // التايم اوت
    const timeoutStmt = db.prepare('SELECT command FROM timeout_commands WHERE guild_id = ?');
    const timeoutCommands = timeoutStmt.all(message.guild.id);
    const hasTimeoutCmd = timeoutCommands.some(c => c.command.toLowerCase() === msgCommand);
    
    if (hasTimeoutCmd || msgCommand === 'تايم-اوت' || msgCommand === 'timeout') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('مــا عــنــدك صــلاحــيــات');
        }
        
        const member = message.mentions.members.first();
        if (!member) return message.reply('مــنــشــن الــشــخــص');
        
        const duration = msgArgs[2];
        if (!duration) return message.reply('حــدد الــمــدة (مــثــال: 1d, 2h, 30m)');
        
        const timeMatch = duration.match(/^(\d+)([dhm])$/);
        if (!timeMatch) return message.reply('صــيــغــة خــاطــئــة! اســتــخــدم: 1d, 2h, 30m');
        
        const [, amount, unit] = timeMatch;
        let ms;
        
        switch (unit) {
            case 'd': ms = parseInt(amount) * 24 * 60 * 60 * 1000; break;
            case 'h': ms = parseInt(amount) * 60 * 60 * 1000; break;
            case 'm': ms = parseInt(amount) * 60 * 1000; break;
        }
        
        try {
            await member.timeout(ms, `بــواســطــة ${message.author.tag}`);
            
            const embed = new EmbedBuilder()
                .setTitle('⏰ تــايــم اوت')
                .setColor('#FFA500')
                .addFields(
                    { name: 'الــمــســؤول', value: `<@${message.author.id}>`, inline: true },
                    { name: 'الــعــضــو', value: `<@${member.id}>`, inline: true },
                    { name: 'الــمــدة', value: '<:1000060648:1423560973486260377>', inline: true }
                )
                .setTimestamp();
            
            await sendLog(message.guild.id, 'timeout', embed);
            await message.reply(`تــم اعــطــاء <@${member.id}> تــايــم اوت <:1000060648:1423560973486260377>`);
        } catch (error) {
            console.error(error);
            await message.reply('صــار خــطــأ');
        }
    }
    
    // التحذير
    const warningStmt = db.prepare('SELECT command FROM warning_commands WHERE guild_id = ?');
    const warningCommands = warningStmt.all(message.guild.id);
    const hasWarningCmd = warningCommands.some(c => c.command.toLowerCase() === msgCommand);
    
    if (hasWarningCmd || msgCommand === 'تحذير' || msgCommand === 'warning') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('مــا عــنــدك صــلاحــيــات');
        }
        
        const member = message.mentions.members.first();
        if (!member) return message.reply('مــنــشــن الــشــخــص');
        
        const reason = msgArgs.slice(2).join(' ') || 'لا يــوجــد ســبــب';

        try {
            // حفظ التحذير
            const insertWarning = db.prepare('INSERT INTO warnings (guild_id, user_id, warned_by, reason, timestamp) VALUES (?, ?, ?, ?, ?)');
            insertWarning.run(message.guild.id, member.id, message.author.id, reason, Date.now());

            // التحقق من التحذيرات اليومية
            const today = new Date().toISOString().split('T')[0];
            const dailyStmt = db.prepare('SELECT count FROM daily_warnings WHERE guild_id = ? AND user_id = ? AND date = ?');
            const dailyWarning = dailyStmt.get(message.guild.id, member.id, today);

            let warningCount = 0;
            if (dailyWarning) {
                warningCount = dailyWarning.count;
                const updateDaily = db.prepare('UPDATE daily_warnings SET count = count + 1 WHERE guild_id = ? AND user_id = ? AND date = ?');
                updateDaily.run(message.guild.id, member.id, today);
            } else {
                const insertDaily = db.prepare('INSERT INTO daily_warnings (guild_id, user_id, date, count) VALUES (?, ?, ?, 1)');
                insertDaily.run(message.guild.id, member.id, today);
            }

            // تطبيق التايم اوت بناءً على عدد التحذيرات
            if (warningCount > 0) {
                const timeoutMinutes = warningCount * 5;
                const timeoutMs = timeoutMinutes * 60 * 1000;
                await member.timeout(timeoutMs, `تــحــذيــر رقــم ${warningCount + 1} الــيــوم`);
                
                const embed = new EmbedBuilder()
                    .setTitle('⚠️ تــحــذيــر')
                    .setColor('#FF0000')
                    .addFields(
                        { name: 'الــمــســؤول', value: `<@${message.author.id}>`, inline: true },
                        { name: 'الــعــضــو', value: `<@${member.id}>`, inline: true },
                        { name: 'الــســبــب', value: reason },
                        { name: 'الــتــايــم اوت', value: `${timeoutMinutes} دقــيــقــة (تــحــذيــر رقــم ${warningCount + 1})` }
                    )
                    .setTimestamp();
                
                await sendLog(message.guild.id, 'warnings', embed);
                await message.reply(`تــم تــحــذيــر <@${member.id}> <:1000060634:1423430323080794273> ! (تــايــم اوت ${timeoutMinutes} دقــيــقــة)`);
            } else {
                const embed = new EmbedBuilder()
                    .setTitle('⚠️ تــحــذيــر')
                    .setColor('#FF0000')
                    .addFields(
                        { name: 'الــمــســؤول', value: `<@${message.author.id}>`, inline: true },
                        { name: 'الــعــضــو', value: `<@${member.id}>`, inline: true },
                        { name: 'الــســبــب', value: reason }
                    )
                    .setTimestamp();
                
                await sendLog(message.guild.id, 'warnings', embed);
                await message.reply(`تــم تــحــذيــر <@${member.id}> <:1000060634:1423430323080794273> !`);
            }
        } catch (error) {
            console.error(error);
            await message.reply('صــار خــطــأ');
        }
    }
});

// إعداد Express server
const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
    res.send('البوت يعمل بنجاح! ✅');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`السيرفر يعمل على المنفذ ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
