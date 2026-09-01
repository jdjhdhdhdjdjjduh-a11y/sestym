const { PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('./embed-helper');

// رسالة موحدة لو صار خطأ بالحذف الجماعي (غالبًا رسائل أقدم من 14 يوم - قيد من ديسكورد نفسه)
const BULK_DELETE_ERROR = 'فشل الحذف. غالبًا لأن فيه رسائل أقدم من 14 يوم — ديسكورد ما يسمح بحذفها جماعيًا (لازم تحذفها يدوي وحدة وحدة).';

module.exports = {
  'مسح': {
    permission: PermissionFlagsBits.ManageMessages,
    label: 'إدارة الرسائل',
    async execute(message, args) {
      const amount = parseInt(args[0]);
      if (!amount || amount < 1 || amount > 100) {
        return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اكتب رقم بين 1 و100. مثال: `مسح 20`')] });
      }

      try {
        const deleted = await message.channel.bulkDelete(amount + 1, true);
        const confirm = await message.channel.send({ embeds: [successEmbed('تم الحذف', `انحذفت ${deleted.size - 1} رسالة.`)] });
        setTimeout(() => confirm.delete().catch(() => {}), 4000);
      } catch {
        await message.channel.send({ embeds: [errorEmbed('تعذر الحذف', BULK_DELETE_ERROR)] });
      }
    }
  },

  'مسح_عضو': {
    permission: PermissionFlagsBits.ManageMessages,
    label: 'إدارة الرسائل',
    async execute(message, args) {
      const target = message.mentions.users.first();
      const amount = parseInt(args[1]) || 50;
      if (!target) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `مسح_عضو @فلان 30`')] });

      try {
        const messages = await message.channel.messages.fetch({ limit: 100 });
        const filtered = messages.filter(m => m.author.id === target.id).first(amount);
        if (filtered.length === 0) {
          return message.channel.send({ embeds: [errorEmbed('ما فيه شي', `ما لقيت رسائل حديثة لـ **${target.tag}** بهذي القناة.`)] });
        }
        await message.channel.bulkDelete(filtered, true);
        const confirm = await message.channel.send({ embeds: [successEmbed('تم الحذف', `انحذفت ${filtered.length} رسالة من **${target.tag}**.`)] });
        setTimeout(() => confirm.delete().catch(() => {}), 4000);
      } catch {
        await message.channel.send({ embeds: [errorEmbed('تعذر الحذف', BULK_DELETE_ERROR)] });
      }
    }
  },

  'مسح_يحتوي': {
    permission: PermissionFlagsBits.ManageMessages,
    label: 'إدارة الرسائل',
    async execute(message, args) {
      const keyword = args.join(' ').toLowerCase();
      if (!keyword) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `مسح_يحتوي كلمة`')] });

      try {
        const messages = await message.channel.messages.fetch({ limit: 100 });
        const filtered = messages.filter(m => m.content.toLowerCase().includes(keyword));
        if (filtered.size === 0) {
          return message.channel.send({ embeds: [errorEmbed('ما فيه شي', `ما لقيت رسائل حديثة تحتوي "${keyword}".`)] });
        }
        await message.channel.bulkDelete(filtered, true);
        const confirm = await message.channel.send({ embeds: [successEmbed('تم الحذف', `انحذفت ${filtered.size} رسالة تحتوي "${keyword}".`)] });
        setTimeout(() => confirm.delete().catch(() => {}), 4000);
      } catch {
        await message.channel.send({ embeds: [errorEmbed('تعذر الحذف', BULK_DELETE_ERROR)] });
      }
    }
  },

  'مسح_بوتات': {
    permission: PermissionFlagsBits.ManageMessages,
    label: 'إدارة الرسائل',
    async execute(message) {
      try {
        const messages = await message.channel.messages.fetch({ limit: 100 });
        const filtered = messages.filter(m => m.author.bot);
        if (filtered.size === 0) {
          return message.channel.send({ embeds: [errorEmbed('ما فيه شي', 'ما لقيت رسائل بوتات حديثة بهذي القناة.')] });
        }
        await message.channel.bulkDelete(filtered, true);
        const confirm = await message.channel.send({ embeds: [successEmbed('تم الحذف', `انحذفت ${filtered.size} رسالة من البوتات.`)] });
        setTimeout(() => confirm.delete().catch(() => {}), 4000);
      } catch {
        await message.channel.send({ embeds: [errorEmbed('تعذر الحذف', BULK_DELETE_ERROR)] });
      }
    }
  },

  'تثبيت': {
    permission: PermissionFlagsBits.ManageMessages,
    label: 'إدارة الرسائل',
    async execute(message) {
      const target = message.reference ? await message.channel.messages.fetch(message.reference.messageId) : null;
      if (!target) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'رد على الرسالة اللي تبي تثبتها واكتب `تثبيت`')] });

      try {
        await target.pin();
        await message.reply({ embeds: [successEmbed('تم التثبيت', 'الرسالة صارت مثبتة بالقناة.')] });
      } catch {
        await message.reply({ embeds: [errorEmbed('تعذر التثبيت', 'وصلنا الحد الأقصى لعدد الرسائل المثبتة بهذي القناة (50 رسالة).')] });
      }
    }
  },

  'الغاء_تثبيت': {
    permission: PermissionFlagsBits.ManageMessages,
    label: 'إدارة الرسائل',
    async execute(message) {
      const target = message.reference ? await message.channel.messages.fetch(message.reference.messageId) : null;
      if (!target) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'رد على الرسالة المثبتة واكتب `الغاء_تثبيت`')] });

      await target.unpin();
      await message.reply({ embeds: [successEmbed('تم إلغاء التثبيت', null)] });
    }
  }
};
