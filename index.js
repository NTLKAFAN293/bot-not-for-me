import discord
from discord.ext import commands
from dotenv import load_dotenv
import os

# تحميل بيانات .env
load_dotenv()
TOKEN = os.getenv("DISCORD_TOKEN")

intents = discord.Intents.default()
intents.guilds = True
intents.messages = True
intents.message_content = True
intents.guild_messages = True

bot = commands.Bot(command_prefix="+", intents=intents)

@bot.event
async def on_ready():
    print(f"✅ تم تسجيل الدخول كبوت: {bot.user}")

@bot.command()
async def حذف(ctx, *, category_name: str):
    category = discord.utils.get(ctx.guild.categories, name=category_name)
    if not category:
        await ctx.send("❌ لم يتم العثور على كاتاجوري بهذا الاسم.")
        return
    
    deleted = 0
    for channel in category.channels:
        try:
            await channel.delete()
            deleted += 1
        except Exception as e:
            await ctx.send(f"⚠️ لم استطع حذف {channel.name} - {e}")
    
    await ctx.send(f"✅ تم حذف {deleted} روم/رومات من الكاتاجوري `{category_name}`")

bot.run(TOKEN)
