const { PermissionFlagsBits } = require('discord.js');
const { parseDuration } = require('./text-parseDuration');
const { successEmbed, errorEmbed } = require('./embed-helper');
const { canTarget } = require('./moderation-guards');
const { logAction } = require('./log-helper');
const { confirmWithReaction } = require('./reaction-confirm');
const { notifyMember } = require('./dm-helper');

module.exports = {
  'دي': {
    permission: PermissionFlagsBits.KickMembers,
    label: 'طرد الأعضاء',
    async execute(message, args) {
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اذكر العضو المطلوب طرده. مثال: `دي @فلان السبب`')] });
      if (!(await canTarget(message, target))) return;
      if (!target.kickable) return message.reply({ embeds: [errorEmbed('ما أقدر', 'رتبة هذا العضو أعلى مني أو هو أونر السيرفر.')] });

      const reason = args.slice(1).join(' ') || 'غير محدد';
      await notifyMember(target.user, { guildName: message.guild.name, action: 'تم طردك', reason });
      await target.kick(reason);
      await message.reply({ embeds: [successEmbed('تم الطرد', `**${target.user.tag}** انطرد من السيرفر.\n**السبب:** ${reason}`)] });
      await logAction(message, { emoji: '👢', title: 'طرد عضو', target: target.user, reason });
    }
  },

  'اعدام': {
    permission: PermissionFlagsBits.BanMembers,
    label: 'حظر الأعضاء',
    async execute(message, args) {
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اذكر العضو المطلوب حظره. مثال: `اعدام @فلان السبب`')] });
      if (!(await canTarget(message, target))) return;
      if (!target.bannable) return message.reply({ embeds: [errorEmbed('ما أقدر', 'رتبة هذا العضو أعلى مني أو هو أونر السيرفر.')] });

      const reason = args.slice(1).join(' ') || 'غير محدد';
      const confirmed = await confirmWithReaction(message, `متأكد تبي تحظر **${target.user.tag}** نهائيًا؟\n**السبب:** ${reason}`);
      if (!confirmed) return message.channel.send({ embeds: [errorEmbed('تم الإلغاء', 'ما تم الحظر.')] });

      await notifyMember(target.user, { guildName: message.guild.name, action: 'تم حظرك', reason });
      await target.ban({ reason, deleteMessageSeconds: 60 * 60 * 24 });
      await message.channel.send({ embeds: [successEmbed('تم الحظر', `**${target.user.tag}** انحظر نهائيًا من السيرفر.\n**السبب:** ${reason}`)] });
      await logAction(message, { emoji: '🔨', title: 'حظر عضو', target: target.user, reason });
    }
  },

  'اعفاء': {
    permission: PermissionFlagsBits.BanMembers,
    label: 'حظر الأعضاء',
    async execute(message, args) {
      const userId = args[0]?.replace(/[<@!>]/g, '');
      if (!userId) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اكتب آيدي العضو. مثال: `اعفاء 123456789`')] });

      try {
        await message.guild.bans.remove(userId);
        await message.reply({ embeds: [successEmbed('تم فك الحظر', `العضو صاحب الآيدي \`${userId}\` صار يقدر يرجع للسيرفر.`)] });
        await logAction(message, { emoji: '🔓', title: 'فك حظر', target: userId });
      } catch {
        return message.reply({ embeds: [errorEmbed('غير محظور', 'هذا العضو مو محظور أصلاً، أو الآيدي غلط.')] });
      }
    }
  },

  'سجن': {
    permission: PermissionFlagsBits.BanMembers,
    label: 'حظر الأعضاء',
    async execute(message, args) {
      const target = message.mentions.members.first();
      const duration = parseDuration(args[1]);
      if (!target || !duration) {
        return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `سجن @عضو 10د السبب` (د=دقيقة، س=ساعة، ي=يوم — أو m/h/d بالإنجليزي)')] });
      }
      if (!(await canTarget(message, target))) return;
      if (!target.bannable) return message.reply({ embeds: [errorEmbed('ما أقدر', 'رتبة هذا العضو أعلى مني أو هو أونر السيرفر.')] });

      const reason = args.slice(2).join(' ') || 'غير محدد';
      const confirmed = await confirmWithReaction(message, `متأكد تبي تسجن **${target.user.tag}** مؤقتًا (${args[1]})؟\n**السبب:** ${reason}`);
      if (!confirmed) return message.channel.send({ embeds: [errorEmbed('تم الإلغاء', 'ما تم السجن.')] });

      await notifyMember(target.user, { guildName: message.guild.name, action: 'تم حظرك مؤقتًا', reason, duration: args[1] });
      await target.ban({ reason, deleteMessageSeconds: 60 * 60 * 24 });
      await message.channel.send({ embeds: [successEmbed('تم السجن المؤقت', `**${target.user.tag}** انحظر مؤقتًا وراح يرفع تلقائي بعد المدة.\n**السبب:** ${reason}`)] });
      await logAction(message, { emoji: '⛓️', title: 'حظر مؤقت', target: target.user, reason });

      setTimeout(async () => {
        try { await message.guild.bans.remove(target.id, 'انتهت مدة الحظر المؤقت'); } catch {}
      }, duration);
    }
  },

  'محي': {
    permission: PermissionFlagsBits.BanMembers,
    label: 'حظر الأعضاء',
    async execute(message, args) {
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اذكر العضو. مثال: `محي @فلان`')] });
      if (!(await canTarget(message, target))) return;
      if (!target.bannable) return message.reply({ embeds: [errorEmbed('ما أقدر', 'رتبة هذا العضو أعلى مني أو هو أونر السيرفر.')] });

      const reason = args.slice(1).join(' ') || 'سوفت بان - حذف رسائل';
      const confirmed = await confirmWithReaction(message, `متأكد تبي تسوي محي (سوفت بان) لـ **${target.user.tag}**؟`);
      if (!confirmed) return message.channel.send({ embeds: [errorEmbed('تم الإلغاء', 'ما تم شي.')] });

      await notifyMember(target.user, { guildName: message.guild.name, action: 'تم طردك (محي)', reason });
      await target.ban({ reason, deleteMessageSeconds: 60 * 60 * 24 * 2 });
      await message.guild.bans.remove(target.id, 'سوفت بان - رفع الحظر مباشرة');
      await message.channel.send({ embeds: [successEmbed('تم المحي', `**${target.user.tag}** انطرد وانمسحت رسائله بدون حظر دائم.`)] });
      await logAction(message, { emoji: '🧹', title: 'سوفت بان (محي)', target: target.user, reason });
    }
  },

  'لتمضرط': {
    permission: PermissionFlagsBits.ModerateMembers,
    label: 'كتم الأعضاء',
    async execute(message, args) {
      const target = message.mentions.members.first();
      const duration = parseDuration(args[1]) || 10 * 60 * 1000;
      if (!target) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اذكر العضو. مثال: `لتمضرط @فلان 10د السبب`')] });
      if (!(await canTarget(message, target))) return;

      const reason = args.slice(2).join(' ') || 'غير محدد';
      await notifyMember(target.user, { guildName: message.guild.name, action: 'تم كتمك', reason, duration: args[1] || '10 دقائق' });
      await target.timeout(duration, reason);
      await message.reply({ embeds: [successEmbed('تم الكتم', `**${target.user.tag}** انكتم مؤقتًا.\n**السبب:** ${reason}`)] });
      await logAction(message, { emoji: '🔇', title: 'كتم عضو', target: target.user, reason });
    }
  },

  'مضرط': {
    permission: PermissionFlagsBits.ModerateMembers,
    label: 'كتم الأعضاء',
    async execute(message) {
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اذكر العضو. مثال: `مضرط @فلان`')] });

      await target.timeout(null);
      await message.reply({ embeds: [successEmbed('تم فك الكتم', `**${target.user.tag}** صار يقدر يكتب ويتكلم عادي.`)] });
      await logAction(message, { emoji: '🔊', title: 'فك كتم', target: target.user });
    }
  },

  'دلع': {
    permission: PermissionFlagsBits.ManageNicknames,
    label: 'إدارة الأسماء المستعارة',
    async execute(message, args) {
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اذكر العضو. مثال: `دلع @فلان الاسم الجديد`')] });
      if (!(await canTarget(message, target))) return;

      const newName = args.slice(1).join(' ');
      await target.setNickname(newName || null);
      await message.reply({ embeds: [successEmbed('تم التغيير', `اسم **${target.user.tag}** صار **${newName || '(الافتراضي)'}**`)] });
    }
  }
};
