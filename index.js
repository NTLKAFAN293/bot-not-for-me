require("dotenv").config();
const { Client, GatewayIntentBits, SlashCommandBuilder, Collection } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// نخزن الأوامر هنا
client.commands = new Collection();

// تعريف أمر السلاش
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

// نضيف الأمر لمجموعة الأوامر
client.commands.set(copyPermsCommand.data.name, copyPermsCommand);

client.once("ready", () => {
  console.log("الــبــوت شــغــال تــمــام");
});

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

client.login(process.env.TOKEN);
