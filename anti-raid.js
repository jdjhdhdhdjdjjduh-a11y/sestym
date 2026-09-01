const { EmbedBuilder, ChannelType } = require('discord.js');
const { getGuildSettings } = require('./config-cache');
const { COLORS } = require('./embed-helper');

// نتتبع أوقات انضمام الأعضاء بالذاكرة (مو بقاعدة البيانات - نحتاج سرعة فائقة هنا)
const joinTimestamps = new Map(); // guildId -> [{ time }]
const lockedGuilds = new Set();   // يمنع تكرار القفل المتتالي أثناء نفس موجة الهجوم

// يرجع true لو صار فيضان وتعامل معه (يعني وقف معالجة الترحيب العادية لهذا العضو)
async function handleMemberJoinRaidCheck(member) {
  const settings = await getGuildSettings(member.guild.id);
  const raid = settings.security?.antiRaid;
  if (!raid || !raid.enabled) return false;

  const guildId = member.guild.id;
  const now = Date.now();
  const windowMs = (raid.timeWindowSeconds || 10) * 1000;

  const list = joinTimestamps.get(guildId) || [];
  list.push(now);
  const recent = list.filter(t => now - t <= windowMs);
  joinTimestamps.set(guildId, recent);

  if (recent.length < (raid.maxJoins || 5)) return false;

  // صار فيضان انضمام - نطبق القفل الطارئ (مرة وحدة بس لكل موجة، مو لكل عضو جديد بالفيضان)
  if (!lockedGuilds.has(guildId)) {
    lockedGuilds.add(guildId);
    await lockdownGuild(member.guild);
    await notifyRaid(member.guild, settings, recent.length);
    setTimeout(() => lockedGuilds.delete(guildId), 5 * 60 * 1000); // فك القفل التلقائي بعد 5 دقايق كحد أقصى
  }

  // العضو الحالي جزء من موجة الفيضان - نطبق عليه الإجراء المحدد
  try {
    if (raid.action === 'ban') await member.ban({ reason: 'Anti-Raid: انضمام جماعي مشبوه' });
    else await member.kick('Anti-Raid: انضمام جماعي مشبوه');
  } catch (err) {
    console.error('❌ فشل تطبيق إجراء Anti-Raid:', err.message);
  }

  return true;
}

async function lockdownGuild(guild) {
  const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
  for (const channel of textChannels.values()) {
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }).catch(() => {});
  }
}

async function notifyRaid(guild, settings, count) {
  const channelId = settings.security.logChannelId;
  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(COLORS.error)
    .setTitle('🚨 تنبيه Anti-Raid')
    .setDescription(
      `رُصد انضمام **${count}** عضو خلال فترة قصيرة جدًا — احتمال هجوم منظم (Raid).\n` +
      `تم **قفل كل قنوات السيرفر تلقائيًا** كإجراء احترازي.\n\n` +
      `استخدم الأمر \`فتح_الكل\` يدويًا بعد ما تتأكد إن الوضع آمن.`
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { handleMemberJoinRaidCheck };
