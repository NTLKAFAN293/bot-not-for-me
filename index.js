require("dotenv").config();
const { Client, GatewayIntentBits, SlashCommandBuilder, Collection } = require("discord.js");
const express = require("express");

// Express عشان يبقى شغال في Render
const app = express();
app.get("/", (req, res) => res.send("الــبــوت شــغــال ✅"));
app.listen(3000, () => console.log("Web server running..."));

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

// أمر نسخ الصلاحيات
const copyPermsCommand = {
  data: new SlashCommandBuilder()
    .setName("نسخ-صلاحيات")
    .setDescription("يــنــســخ صــلاحــيــات روم ويحــطــهــا فــي روم ثــانــي")
    .addChannelOption(option =>
      option.setName("من")
        .setDescription("اخــتــار الــروم الــي تــبــي تــنــســخ مــنــه")
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName("الى")
        .setDescription("اخــتــار الــروم الــي تــبــي تــنــســخ فــيــه")
        .setRequired(true)
    ),
  async execute(interaction) {
    const fromChannel = interaction.options.getChannel("من");
    const toChannel = interaction.options.getChannel("الى");

    if (!fromChannel || !toChannel) {
      return interaction.reply("||لـــازم تــخــتــار روم صــح يــنــقــل مــعــك||");
    }

    try {
      await toChannel.permissionOverwrites.set(fromChannel.permissionOverwrites.cache);

      await interaction.reply({
        content: "```diff\n+ نــســخــت الــصــلاحــيــات مــن " + fromChannel.name + " الــى " + toChannel.name + " تــمــام\n```",
        ephemeral: false
      });

    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "> صــار خــطــا مــا قــدرت انــســخ",
        ephemeral: true
      });
    }
  }
};

// نحط الأمر في الكولكشن
client.commands.set(copyPermsCommand.data.name, copyPermsCommand);

client.once("ready", () => {
  console.log("الــبــوت شــغــال تــمــام ✅");
});

// تنفيذ الأوامر
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: "صـــار خــطــا", ephemeral: true });
  }
});

// لما أحد يضيف البوت
client.on("guildCreate", async guild => {
  try {
    const owner = await guild.fetchOwner();
    if (owner) {
      owner.send("يــســراق تــحــاول تــســرق الــبــوت 😡");
    }
  } catch (err) {
    console.error("مــا قــدرت ارســل فــالــخــاص:", err);
  }
});

client.login(process.env.TOKEN);
