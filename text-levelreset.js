const { PermissionFlagsBits } = require('discord.js');
const db = require('./db');
const { successEmbed, errorEmbed } = require('./embed-helper');
const { confirmWithReaction } = require('./reaction-confirm');
const { logAction } = require('./log-helper');

module.exports = {
  'اعاده_تعيين_المستويات': {
    permission: PermissionFlagsBits.Administrator,
    label: 'الإدارة الكاملة',
    async execute(message, args) {
      const target = message.mentions.members.first();
      const isAll = args[0] === 'الكل';

      if (!target && !isAll) {
        return message.reply({
          embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `اعاده_تعيين_المستويات @عضو` لعضو معين، أو `اعاده_تعيين_المستويات الكل` لتصفير كل السيرفر دفعة وحدة.')]
        });
      }

      if (isAll) {
        const confirmed = await confirmWithReaction(
          message,
          '⚠️ راح يصفّر XP والمستوى وعدد الرسائل **لكل أعضاء السيرفر بدون استثناء**. هذا إجراء ما يترجع.'
        );
        if (!confirmed) return message.channel.send({ embeds: [errorEmbed('تم الإلغاء', 'ما تم شي.')] });

        await db.resetAllLeveling(message.guild.id);
        await message.channel.send({ embeds: [successEmbed('تم التصفير', 'كل بيانات المستويات بالسيرفر رجعت للصفر.')] });
        await logAction(message, { emoji: '♻️', title: 'تصفير كل المستويات', target: null });
        return;
      }

      const confirmed = await confirmWithReaction(message, `متأكد تبي تصفّر XP والمستوى لـ **${target.user.tag}**؟`);
      if (!confirmed) return message.channel.send({ embeds: [errorEmbed('تم الإلغاء', 'ما تم شي.')] });

      await db.resetMemberLeveling(message.guild.id, target.id);
      await message.channel.send({ embeds: [successEmbed('تم التصفير', `بيانات **${target.user.tag}** رجعت للصفر.`)] });
      await logAction(message, { emoji: '♻️', title: 'تصفير مستوى عضو', target: target.user });
    }
  }
};
