require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error('❌ TOKEN is missing in .env file!');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.first();
  if (!guild) return console.error('❌ No guilds found.');

  try {
    const bans = await guild.bans.fetch();
    if (bans.size === 0) return console.log('👼 No users are banned.');

    console.log(`🔓 Attempting to unban ${bans.size} user(s)...`);

    for (const [userId, banInfo] of bans) {
      await guild.members.unban(userId).catch(err => {
        console.warn(`⚠️ Failed to unban ${userId}:`, err.message);
      });
    }

    console.log('✅ All unbans completed!');
  } catch (err) {
    console.error('❌ Error while unbanning:', err);
  }
});

client.login(TOKEN);
