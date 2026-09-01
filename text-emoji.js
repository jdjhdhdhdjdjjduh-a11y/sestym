const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { successEmbed, errorEmbed, COLORS } = require('./embed-helper');

module.exports = {
  'اضافة_ايموجي': {
    permission: PermissionFlagsBits.ManageGuildExpressions,
    label: 'إدارة الايموجي',
    async execute(message, args) {
      const imageUrl = args[0] || message.attachments.first()?.url;
      const name = (args[1] || 'ايموجي_جديد').replace(/[^a-zA-Z0-9_]/g, '_'); // ديسكورد ما يقبل أسماء بالعربي أو رموز
      if (!imageUrl) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `اضافة_ايموجي [رابط الصورة] [الاسم]` أو أرفق صورة')] });

      try {
        const emoji = await message.guild.emojis.create({ attachment: imageUrl, name });
        await message.reply({ embeds: [successEmbed('تمت الإضافة', `الايموجي ${emoji} انضاف بنجاح.`)] });
      } catch {
        await message.reply({ embeds: [errorEmbed('فشلت الإضافة', 'تأكد إن الرابط صورة صالحة (PNG/JPG/GIF) وحجمها أقل من 256 كيلوبايت، وإن السيرفر ما وصل الحد الأقصى للايموجيات.')] });
      }
    }
  },

  'حذف_ايموجي': {
    permission: PermissionFlagsBits.ManageGuildExpressions,
    label: 'إدارة الايموجي',
    async execute(message, args) {
      const name = args[0];
      if (!name) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `حذف_ايموجي اسم-الايموجي`')] });

      const emoji = message.guild.emojis.cache.find(e => e.name === name);
      if (!emoji) return message.reply({ embeds: [errorEmbed('غير موجود', 'ما لقيت ايموجي بهذا الاسم.')] });

      await emoji.delete();
      await message.reply({ embeds: [successEmbed('تم الحذف', `الايموجي **${name}** انحذف.`)] });
    }
  },

  'قائمة_الايموجي': {
    permission: PermissionFlagsBits.ManageGuildExpressions,
    label: 'إدارة الايموجي',
    deleteInvoke: false,
    async execute(message) {
      const emojis = message.guild.emojis.cache;
      if (emojis.size === 0) return message.reply({ embeds: [errorEmbed('ما فيه شي', 'ما فيه ايموجيات مخصصة بالسيرفر.')] });

      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('😀 ايموجيات السيرفر')
        .setDescription(emojis.map(e => `${e} \`${e.name}\``).join(' '))
        .setFooter({ text: `${emojis.size} ايموجي بالمجموع` });

      await message.reply({ embeds: [embed] });
    }
  }
};
