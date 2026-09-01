const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('./embed-helper');

// يحاول يرسل DM للعضو، وما يهتم لو فشل (خاصه مقفول عادة شي شائع)
async function notifyMember(user, { guildName, action, reason, duration }) {
  try {
    const embed = new EmbedBuilder()
      .setColor(COLORS.warn)
      .setTitle(`⚠️ ${action}`)
      .setDescription(`صار عليك إجراء بسيرفر **${guildName}**`)
      .addFields({ name: 'السبب', value: reason || 'غير محدد' });

    if (duration) embed.addFields({ name: 'المدة', value: duration });

    await user.send({ embeds: [embed] });
  } catch {
    // الخاص مقفول أو فيه حظر بينهم - نتجاهل بصمت
  }
}

module.exports = { notifyMember };
