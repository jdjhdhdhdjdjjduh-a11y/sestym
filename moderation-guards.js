const { errorEmbed } = require('./embed-helper');

// يتأكد إن الهدف يصلح يُستهدف بأمر إداري: مو نفس الكاتب، مو البوت، ومو رتبته أعلى من الكاتب
// يرجع true لو الأمر يقدر يكمل، أو false + يرسل رسالة خطأ مناسبة لو لا
async function canTarget(message, target) {
  if (!target) return true; // بعض الأوامر ما تحتاج فحص (زي فك_حظر بالآيدي)

  if (target.id === message.author.id) {
    await message.reply({ embeds: [errorEmbed('غير مسموح', 'ما تقدر تستخدم هذا الأمر على نفسك.')] });
    return false;
  }

  if (target.id === message.guild.members.me.id) {
    await message.reply({ embeds: [errorEmbed('غير مسموح', 'ما تقدر تستخدم هذا الأمر على البوت نفسه 😅')] });
    return false;
  }

  // صاحب السيرفر معفى من فحص الرتب (هو أعلى الكل أصلاً)
  if (message.guild.ownerId === message.author.id) return true;

  const executorTopRole = message.member.roles.highest;
  const targetTopRole = target.roles.highest;

  if (targetTopRole.position >= executorTopRole.position) {
    await message.reply({ embeds: [errorEmbed('غير مسموح', `رتبة **${target.user.tag}** (${targetTopRole.name}) أعلى من رتبتك أو تساويها — ما تقدر تستهدفه.`)] });
    return false;
  }

  return true;
}

module.exports = { canTarget };
