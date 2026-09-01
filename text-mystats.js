const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('./db');
const { xpForLevel } = require('./xp-util');
const { COLORS, errorEmbed } = require('./embed-helper');

// يبني خط تقدم نصي بسيط
function progressBar(current, total, size = 12) {
  const percent = Math.min(current / total, 1);
  const filled = Math.round(percent * size);
  return '🟩'.repeat(filled) + '⬜'.repeat(size - filled) + ` ${Math.round(percent * 100)}%`;
}

module.exports = {
  'احصائياتي': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'الاستخدام العام',
    deleteInvoke: false,
    async execute(message) {
      const memberDoc = await db.getMember(message.guild.id, message.author.id);

      if (memberDoc.xp === 0 && memberDoc.messageCount === 0) {
        return message.reply({ embeds: [errorEmbed('ما فيه بيانات', 'ما عندك أي نشاط مسجل لين الحين، أو نظام المستويات مو مفعّل بهذا السيرفر.')] });
      }

      // نسبة تقدمك مقارنة ببقية السيرفر
      const higherRanked = await db.countMembersAbove(message.guild.id, memberDoc.xp);
      const totalTracked = await db.countMembersAbove(message.guild.id, -1); // كل الأعضاء المسجلين (xp >= 0)
      const percentile = totalTracked > 1 ? Math.round(((totalTracked - 1 - higherRanked) / (totalTracked - 1)) * 100) : 100;

      // تقدير زمني تقريبي للمستوى الجاي بناءً على معدل نشاطك
      const xpNeeded = xpForLevel(memberDoc.level + 1);
      const daysSinceJoin = Math.max(1, (Date.now() - new Date(memberDoc.joinedAt).getTime()) / 86400000);
      const avgXpPerDay = memberDoc.xp / daysSinceJoin;
      const remainingXp = Math.max(xpNeeded - getXpIntoCurrentLevel(memberDoc), 0);
      const etaDays = avgXpPerDay > 0 ? Math.ceil(remainingXp / avgXpPerDay) : null;

      let etaText = 'ما نقدر نحسبها لين الحين (نشاط قليل)';
      if (etaDays !== null) {
        if (etaDays <= 0) etaText = 'قريب جدًا! 🔥';
        else if (etaDays === 1) etaText = 'يوم واحد تقريبًا';
        else if (etaDays <= 30) etaText = `~${etaDays} يوم تقريبًا`;
        else etaText = `~${Math.round(etaDays / 30)} شهر تقريبًا`;
      }

      const currentLevelProgress = getXpIntoCurrentLevel(memberDoc);
      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setAuthor({ name: `إحصائيات ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .addFields(
          { name: '⭐ المستوى الحالي', value: `${memberDoc.level}`, inline: true },
          { name: '💬 الرسائل', value: memberDoc.messageCount.toLocaleString('en-US'), inline: true },
          { name: '📊 الترتيب', value: `أنشط من **${percentile}%** من الأعضاء`, inline: true },
          { name: '⏳ الوقت المتوقع للمستوى الجاي', value: etaText },
          { name: `التقدم للمستوى ${memberDoc.level + 1}`, value: progressBar(currentLevelProgress, xpNeeded) }
        )
        .setFooter({ text: `${memberDoc.xp.toLocaleString('en-US')} XP بالمجموع` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    }
  }
};

// يحسب كم XP دخلت بالمستوى الحالي (مو الكلي)
function getXpIntoCurrentLevel(memberDoc) {
  let remaining = memberDoc.xp;
  for (let lvl = 0; lvl < memberDoc.level; lvl++) {
    remaining -= xpForLevel(lvl + 1);
  }
  return Math.max(remaining, 0);
}
