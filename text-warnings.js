const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('./db');
const { successEmbed, errorEmbed, COLORS } = require('./embed-helper');

module.exports = {
  'تحذير': {
    permission: PermissionFlagsBits.ModerateMembers,
    label: 'إدارة الإنذارات',
    async execute(message, args) {
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اذكر العضو. مثال: `تحذير @فلان السبب`')] });

      const reason = args.slice(1).join(' ') || 'غير محدد';
      const memberDoc = await db.getMember(message.guild.id, target.id);
      memberDoc.warnings.push({ reason, moderatorId: message.author.id, date: new Date().toISOString() });
      await db.saveMember(message.guild.id, target.id, memberDoc);

      await message.reply({ embeds: [successEmbed('تم التحذير', `**${target.user.tag}** حصل على إنذار رقم **${memberDoc.warnings.length}**\n**السبب:** ${reason}`)] });
    }
  },

  'تحذيرات': {
    permission: PermissionFlagsBits.ModerateMembers,
    label: 'إدارة الإنذارات',
    deleteInvoke: false,
    async execute(message) {
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اذكر العضو. مثال: `تحذيرات @فلان`')] });

      const memberDoc = await db.getMember(message.guild.id, target.id);
      if (memberDoc.warnings.length === 0) {
        return message.reply({ embeds: [successEmbed('سجل نظيف', `**${target.user.tag}** ما عنده أي إنذارات.`)] });
      }

      const list = memberDoc.warnings.map((w, i) =>
        `**${i + 1}.** ${w.reason} — <t:${Math.floor(new Date(w.date).getTime() / 1000)}:R>`
      ).join('\n');

      const embed = new EmbedBuilder()
        .setColor(COLORS.warn)
        .setAuthor({ name: `إنذارات ${target.user.tag}`, iconURL: target.user.displayAvatarURL() })
        .setDescription(list)
        .setFooter({ text: `${memberDoc.warnings.length} إنذار بالمجموع` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    }
  },

  'شيل': {
    permission: PermissionFlagsBits.ModerateMembers,
    label: 'إدارة الإنذارات',
    async execute(message, args) {
      const target = message.mentions.members.first();
      const index = parseInt(args[1]) - 1;
      if (!target || isNaN(index)) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `شيل @فلان 1` (رقم الإنذار)')] });

      const memberDoc = await db.getMember(message.guild.id, target.id);
      if (!memberDoc.warnings[index]) return message.reply({ embeds: [errorEmbed('غير موجود', 'ما فيه إنذار بهذا الرقم.')] });

      memberDoc.warnings.splice(index, 1);
      await db.saveMember(message.guild.id, target.id, memberDoc);
      await message.reply({ embeds: [successEmbed('تم الحذف', `انحذف الإنذار رقم ${index + 1} من **${target.user.tag}**`)] });
    }
  },

  'شيل_الكل': {
    permission: PermissionFlagsBits.ModerateMembers,
    label: 'إدارة الإنذارات',
    async execute(message) {
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اذكر العضو. مثال: `شيل_الكل @فلان`')] });

      const memberDoc = await db.getMember(message.guild.id, target.id);
      memberDoc.warnings = [];
      await db.saveMember(message.guild.id, target.id, memberDoc);

      await message.reply({ embeds: [successEmbed('تم التصفير', `انمسحت كل إنذارات **${target.user.tag}**`)] });
    }
  }
};
