const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { COLORS } = require('./embed-helper');

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days) parts.push(`${days} يوم`);
  if (hours) parts.push(`${hours} ساعة`);
  if (minutes) parts.push(`${minutes} دقيقة`);
  return parts.join('، ') || 'أقل من دقيقة';
}

module.exports = {
  'معلومات': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'الاستخدام العام',
    deleteInvoke: false,
    async execute(message) {
      const client = message.client;
      const uptime = formatUptime(client.uptime);
      const ping = Math.round(client.ws.ping);

      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
        .addFields(
          { name: '⏱️ مدة التشغيل', value: uptime, inline: true },
          { name: '📡 سرعة الاستجابة', value: `${ping}ms`, inline: true },
          { name: '🌐 عدد السيرفرات', value: `${client.guilds.cache.size}`, inline: true },
          { name: '👥 عدد الأعضاء الكلي', value: `${client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0)}`, inline: true }
        )
        .setFooter({ text: 'اكتب مساعدة لعرض كل الأوامر' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    }
  }
};
