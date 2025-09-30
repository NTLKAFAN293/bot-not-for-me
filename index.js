const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config(); // لو حطيت التوكن في ملف .env

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ========= تعريف أوامر السلاش =========
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('يرد عليك بسرعة!'),

  new SlashCommandBuilder()
    .setName('say')
    .setDescription('يخلي البوت يكرر كلامك')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('الرسالة')
        .setRequired(true))
].map(cmd => cmd.toJSON());

// ========= تسجيل أوامر السلاش =========
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("🚀 Slash commands registered!");
  } catch (error) {
    console.error(error);
  }
});

// ========= تنفيذ أوامر السلاش =========
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('🏓 Pong!');
  }

  if (interaction.commandName === 'say') {
    const msg = interaction.options.getString('message');
    await interaction.reply(msg);
  }
});

// ========= أوامر كتابية =========
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // مثال: لما يكتب "سيف"
  if (message.content.includes("سيف")) {
    message.reply(`عمك يا ${message.author}`);
  }

  // مثال: أمر كتابي !help
  if (message.content === "!help") {
    message.reply("الأوامر المتاحة: /ping, /say, !help");
  }
});

// ========= تسجيل الدخول =========
client.login(process.env.TOKEN);
