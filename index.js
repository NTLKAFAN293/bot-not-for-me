// index.js
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, InteractionType } = require("discord.js");
const ms = require("ms");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

let logChannelId = null; // سيتغير بواسطة /setlog

client.once("ready", () => {
  console.log(`✅ تم تسجيل الدخول كبوت: ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "setlog") {
    logChannelId = interaction.options.getChannel("channel").id;
    await interaction.reply({ content: `📡 تم تحديد روم اللوق!`, ephemeral: true });
  }
});

// Listen for #giv messages
client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("#giv")) return;
  if (message.author.bot) return;

  const args = message.content.slice(4).trim().split(" ");
  const prize = args.slice(0, args.length - 2).join(" ");
  const winnersCount = parseInt(args[args.length - 2].replace("w", ""));
  const time = args[args.length - 1].replace("!", "");

  const giveawayEmbed = new EmbedBuilder()
    .setTitle(prize)
    .setDescription(`ينتهي بعد: ${time}\nتم البدء بواسطة: ${message.author}\nعدد الفائزين: ${winnersCount}`)
    .setColor("Purple")
    .setTimestamp();

  const participateButton = new ButtonBuilder()
    .setCustomId("participate")
    .setLabel("شارك في الجيف اواي")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(participateButton);

  const giveawayMessage = await message.channel.send({ embeds: [giveawayEmbed], components: [row] });
  await message.delete();

  const participants = new Set();

  const filter = (i) => i.customId === "participate";
  const collector = giveawayMessage.createMessageComponentCollector({ filter, time: ms(time) });

  collector.on("collect", (i) => {
    participants.add(i.user.id);
    i.reply({ content: "تم تسجيلك للمشاركة!", ephemeral: true });
  });

  collector.on("end", async () => {
    const allParticipants = Array.from(participants);
    if (allParticipants.length === 0) return;

    const winners = [];
    for (let i = 0; i < winnersCount; i++) {
      if (allParticipants.length === 0) break;
      const winner = allParticipants.splice(Math.floor(Math.random() * allParticipants.length), 1)[0];
      winners.push(winner);
    }

    const winnersMentions = winners.map((id) => `<@${id}>`).join(", ");

    const endEmbed = new EmbedBuilder()
      .setTitle("انتهى الجيف اواي!")
      .setDescription(`الفائزين: ${winnersMentions}`)
      .setColor("Green")
      .setTimestamp();

    await giveawayMessage.edit({ embeds: [endEmbed], components: [] });

    for (const winnerId of winners) {
      const winnerUser = await client.users.fetch(winnerId);
      winnerUser.send(`🎉 مبروك لقد فزت بـ **${prize}** في السيرفر **${message.guild.name}**!`);
    }
  });
});

// Message Delete & Edit Logs
client.on("messageDelete", async (msg) => {
  if (!logChannelId) return;
  const channel = await client.channels.fetch(logChannelId);
  const embed = new EmbedBuilder()
    .setTitle("🗑️ تم حذف رسالة")
    .addFields(
      { name: "الرسالة", value: msg.content || "لا توجد محتوى" },
      { name: "المرسل", value: `${msg.author}` },
      { name: "الروم", value: `${msg.channel}` },
    )
    .setColor("Red")
    .setTimestamp();
  channel.send({ embeds: [embed] });
});

client.on("messageUpdate", async (oldMsg, newMsg) => {
  if (!logChannelId) return;
  const channel = await client.channels.fetch(logChannelId);
  const embed = new EmbedBuilder()
    .setTitle("✏️ تم تعديل رسالة")
    .addFields(
      { name: "الرسالة القديمة", value: oldMsg.content || "لا توجد محتوى" },
      { name: "الرسالة الجديدة", value: newMsg.content || "لا توجد محتوى" },
      { name: "المرسل", value: `${oldMsg.author}` },
      { name: "الروم", value: `${oldMsg.channel}` },
    )
    .setColor("Orange")
    .setTimestamp();
  channel.send({ embeds: [embed] });
});

// Bot Token
client.login(process.env.TOKEN);
