const { PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('./embed-helper');
const { canTarget } = require('./moderation-guards');
const { logAction } = require('./log-helper');
const { confirmWithReaction } = require('./reaction-confirm');

function findRole(guild, name) {
  return guild.roles.cache.find(r => r.name === name);
}

module.exports = {
  'اعطاء_رتبه': {
    permission: PermissionFlagsBits.ManageRoles,
    label: 'إدارة الرتب',
    async execute(message, args) {
      const target = message.mentions.members.first();
      const roleName = args.slice(1).join(' ');
      if (!target || !roleName) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `اعطاء_رتبه @فلان اسم-الرتبة`')] });
      if (!(await canTarget(message, target))) return;

      const role = findRole(message.guild, roleName);
      if (!role) return message.reply({ embeds: [errorEmbed('غير موجود', 'ما لقيت رتبة بهذا الاسم.')] });

      try {
        await target.roles.add(role);
        await message.reply({ embeds: [successEmbed('تم الإعطاء', `**${target.user.tag}** صار عنده رتبة **${role.name}**`)] });
        await logAction(message, { emoji: '🎭', title: 'إعطاء رتبة', target: target.user, reason: role.name });
      } catch {
        await message.reply({ embeds: [errorEmbed('فشل', 'رتبة البوت لازم تكون أعلى من هذي الرتبة عشان يقدر يعطيها.')] });
      }
    }
  },

  'سحب_رتبه': {
    permission: PermissionFlagsBits.ManageRoles,
    label: 'إدارة الرتب',
    async execute(message, args) {
      const target = message.mentions.members.first();
      const roleName = args.slice(1).join(' ');
      if (!target || !roleName) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `سحب_رتبه @فلان اسم-الرتبة`')] });
      if (!(await canTarget(message, target))) return;

      const role = findRole(message.guild, roleName);
      if (!role) return message.reply({ embeds: [errorEmbed('غير موجود', 'ما لقيت رتبة بهذا الاسم.')] });

      try {
        await target.roles.remove(role);
        await message.reply({ embeds: [successEmbed('تم السحب', `رتبة **${role.name}** انسحبت من **${target.user.tag}**`)] });
        await logAction(message, { emoji: '🎭', title: 'سحب رتبة', target: target.user, reason: role.name });
      } catch {
        await message.reply({ embeds: [errorEmbed('فشل', 'رتبة البوت لازم تكون أعلى من هذي الرتبة عشان يقدر يسحبها.')] });
      }
    }
  },

  'انشاء_رتبه': {
    permission: PermissionFlagsBits.ManageRoles,
    label: 'إدارة الرتب',
    async execute(message, args) {
      const colorArg = args[0]?.startsWith('#') ? args[0] : null;
      const name = (colorArg ? args.slice(1) : args).join(' ');
      if (!name) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `انشاء_رتبه #هيكس اسم-الرتبة` (اللون اختياري)')] });

      const validColor = colorArg && /^#[0-9A-Fa-f]{6}$/.test(colorArg) ? colorArg : undefined;

      try {
        const role = await message.guild.roles.create({ name, color: validColor });
        await message.reply({ embeds: [successEmbed('تم الإنشاء', `رتبة **${role.name}** جاهزة.${colorArg && !validColor ? '\n⚠️ كود اللون كان غير صحيح فتجاهلته (الصيغة الصح: `#RRGGBB`).' : ''}`)] });
        await logAction(message, { emoji: '➕', title: 'إنشاء رتبة', target: null, reason: role.name });
      } catch {
        await message.reply({ embeds: [errorEmbed('فشل الإنشاء', 'وصلت السيرفر للحد الأقصى لعدد الرتب (250 رتبة).')] });
      }
    }
  },

  'حذف_رتبه': {
    permission: PermissionFlagsBits.ManageRoles,
    label: 'إدارة الرتب',
    async execute(message, args) {
      const roleName = args.join(' ');
      const role = findRole(message.guild, roleName);
      if (!role) return message.reply({ embeds: [errorEmbed('غير موجود', 'ما لقيت رتبة بهذا الاسم.')] });

      const confirmed = await confirmWithReaction(message, `متأكد تبي تحذف رتبة **${role.name}** نهائيًا؟ (${role.members.size} عضو عندهم هذي الرتبة)`);
      if (!confirmed) return message.channel.send({ embeds: [errorEmbed('تم الإلغاء', 'ما تم حذف الرتبة.')] });

      try {
        const name = role.name;
        await role.delete();
        await message.channel.send({ embeds: [successEmbed('تم الحذف', `رتبة **${name}** انحذفت.`)] });
        await logAction(message, { emoji: '🗑️', title: 'حذف رتبة', target: null, reason: name });
      } catch {
        await message.channel.send({ embeds: [errorEmbed('فشل', 'رتبة البوت لازم تكون أعلى من هذي الرتبة عشان يقدر يحذفها.')] });
      }
    }
  },

  'اعطاء_رتبه_للكل': {
    permission: PermissionFlagsBits.ManageRoles,
    label: 'إدارة الرتب',
    async execute(message, args) {
      const roleName = args.join(' ');
      const role = findRole(message.guild, roleName);
      if (!role) return message.reply({ embeds: [errorEmbed('غير موجود', 'ما لقيت رتبة بهذا الاسم.')] });

      const confirmed = await confirmWithReaction(message, `متأكد تبي تعطي رتبة **${role.name}** لكل أعضاء السيرفر؟ (عملية قد تاخذ وقت على السيرفرات الكبيرة)`);
      if (!confirmed) return message.channel.send({ embeds: [errorEmbed('تم الإلغاء', 'ما تم شي.')] });

      const confirm = await message.channel.send({ embeds: [successEmbed('جاري التنفيذ', '⏳ يشتغل عليها...')] });
      const members = await message.guild.members.fetch();
      let count = 0;

      for (const member of members.values()) {
        if (!member.user.bot && !member.roles.cache.has(role.id)) {
          await member.roles.add(role).catch(() => {});
          count++;
        }
      }

      await confirm.edit({ embeds: [successEmbed('تم الانتهاء', `رتبة **${role.name}** انعطت لـ ${count} عضو.`)] });
      await logAction(message, { emoji: '🎭', title: 'إعطاء رتبة جماعي', target: null, reason: `${role.name} — ${count} عضو` });
    }
  }
};
