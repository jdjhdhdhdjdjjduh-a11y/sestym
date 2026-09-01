const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { successEmbed, errorEmbed, COLORS } = require('./embed-helper');

module.exports = {
  'اعلان': {
    permission: PermissionFlagsBits.ManageMessages,
    label: 'إدارة الرسائل',
    async execute(message, args) {
      const text = args.join(' ');
      if (!text) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `اعلان نص الإعلان`')] });

      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('📢 إعلان')
        .setDescription(text)
        .setFooter({ text: `بواسطة ${message.author.tag}` })
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
      await message.delete().catch(() => {});
    }
  },

  'الدعوات': {
    permission: PermissionFlagsBits.ManageGuild,
    label: 'إدارة السيرفر',
    deleteInvoke: false,
    async execute(message) {
      const invites = await message.guild.invites.fetch();
      if (invites.size === 0) return message.reply({ embeds: [errorEmbed('ما فيه شي', 'ما فيه روابط دعوة فعالة حالياً.')] });

      const list = invites.map(inv => `**${inv.code}** — بواسطة ${inv.inviter?.tag || 'غير معروف'} — استُخدم ${inv.uses} مرة`).join('\n');
      const embed = new EmbedBuilder().setColor(COLORS.info).setTitle('🔗 روابط الدعوة الفعالة').setDescription(list.slice(0, 4000));
      await message.reply({ embeds: [embed] });
    }
  },

  'حذف_دعوة': {
    permission: PermissionFlagsBits.ManageGuild,
    label: 'إدارة السيرفر',
    async execute(message, args) {
      const code = args[0];
      if (!code) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `حذف_دعوة الكود`')] });

      const invites = await message.guild.invites.fetch();
      const invite = invites.get(code);
      if (!invite) return message.reply({ embeds: [errorEmbed('غير موجود', 'ما لقيت دعوة بهذا الكود.')] });

      await invite.delete();
      await message.reply({ embeds: [successEmbed('تم الحذف', `الدعوة **${code}** انحذفت.`)] });
    }
  },

  'تغيير_اسم_السيرفر': {
    permission: PermissionFlagsBits.ManageGuild,
    label: 'إدارة السيرفر',
    async execute(message, args) {
      const name = args.join(' ');
      if (!name) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `تغيير_اسم_السيرفر الاسم-الجديد`')] });

      await message.guild.setName(name);
      await message.reply({ embeds: [successEmbed('تم التغيير', `اسم السيرفر صار **${name}**`)] });
    }
  },

  'تغيير_شعار_السيرفر': {
    permission: PermissionFlagsBits.ManageGuild,
    label: 'إدارة السيرفر',
    async execute(message) {
      const attachment = message.attachments.first();
      if (!attachment) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'أرفق صورة مع الرسالة وسوي الأمر `تغيير_شعار_السيرفر` بنفس الرسالة.')] });

      try {
        await message.guild.setIcon(attachment.url);
        await message.reply({ embeds: [successEmbed('تم التغيير', 'شعار السيرفر اتحدث.')] });
      } catch {
        await message.reply({ embeds: [errorEmbed('فشل التغيير', 'تأكد إن الصورة بصيغة مدعومة (PNG/JPG) وحجمها أقل من 10 ميجا.')] });
      }
    }
  }
};
