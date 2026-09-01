const { PermissionFlagsBits, ChannelType } = require('discord.js');
const { successEmbed, errorEmbed } = require('./embed-helper');
const { confirmWithReaction } = require('./reaction-confirm');
const { logAction } = require('./log-helper');

module.exports = {
  'قفل': {
    permission: PermissionFlagsBits.ManageChannels,
    label: 'إدارة القنوات',
    async execute(message) {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
      await message.channel.send({ embeds: [successEmbed('تم القفل', 'ما أحد يقدر يكتب بهذي القناة الحين.')] });
    }
  },

  'فتح': {
    permission: PermissionFlagsBits.ManageChannels,
    label: 'إدارة القنوات',
    async execute(message) {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
      await message.channel.send({ embeds: [successEmbed('تم الفتح', 'القناة رجعت مفتوحة للكتابة.')] });
    }
  },

  'قفل_الكل': {
    permission: PermissionFlagsBits.ManageChannels,
    label: 'إدارة القنوات',
    async execute(message) {
      const textChannels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
      let failed = 0;
      for (const channel of textChannels.values()) {
        await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }).catch(() => { failed++; });
      }
      const desc = failed > 0
        ? `تم قفل ${textChannels.size - failed} من ${textChannels.size} قناة (${failed} فشلت، غالبًا نقص صلاحية بقناة معينة).`
        : `تم قفل ${textChannels.size} قناة بالسيرفر (وضع الطوارئ).`;
      await message.channel.send({ embeds: [successEmbed('تم القفل الجماعي', desc)] });
      await logAction(message, { emoji: '🔒', title: 'قفل كل القنوات', target: null });
    }
  },

  'فتح_الكل': {
    permission: PermissionFlagsBits.ManageChannels,
    label: 'إدارة القنوات',
    async execute(message) {
      const textChannels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
      let failed = 0;
      for (const channel of textChannels.values()) {
        await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null }).catch(() => { failed++; });
      }
      const desc = failed > 0
        ? `تم فتح ${textChannels.size - failed} من ${textChannels.size} قناة (${failed} فشلت).`
        : `تم فتح ${textChannels.size} قناة بالسيرفر.`;
      await message.channel.send({ embeds: [successEmbed('تم الفتح الجماعي', desc)] });
    }
  },

  'انشاء_قناة': {
    permission: PermissionFlagsBits.ManageChannels,
    label: 'إدارة القنوات',
    async execute(message, args) {
      const name = args.join('-');
      if (!name) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `انشاء_قناة اسم-القناة`')] });

      try {
        const channel = await message.guild.channels.create({ name, type: ChannelType.GuildText });
        await message.reply({ embeds: [successEmbed('تم الإنشاء', `القناة <#${channel.id}> جاهزة.`)] });
      } catch {
        await message.reply({ embeds: [errorEmbed('فشل الإنشاء', 'تأكد إن اسم القناة صالح (بدون رموز غريبة) وإن البوت عنده صلاحية Manage Channels.')] });
      }
    }
  },

  'حذف_قناة': {
    permission: PermissionFlagsBits.ManageChannels,
    label: 'إدارة القنوات',
    async execute(message) {
      const confirmed = await confirmWithReaction(message, `متأكد تبي تحذف قناة **#${message.channel.name}** نهائيًا؟`);
      if (!confirmed) return message.channel.send({ embeds: [errorEmbed('تم الإلغاء', 'ما تم حذف القناة.')] });

      const channelName = message.channel.name;
      await logAction(message, { emoji: '🗑️', title: 'حذف قناة', target: null, reason: `#${channelName}` });
      await message.channel.delete().catch(() => {});
    }
  },

  'تسمية_قناة': {
    permission: PermissionFlagsBits.ManageChannels,
    label: 'إدارة القنوات',
    async execute(message, args) {
      const name = args.join('-');
      if (!name) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `تسمية_قناة الاسم-الجديد`')] });

      try {
        await message.channel.setName(name);
        await message.reply({ embeds: [successEmbed('تم التغيير', `اسم القناة صار **${name}**`)] });
      } catch {
        await message.reply({ embeds: [errorEmbed('فشل التغيير', 'تأكد إن الاسم صالح، وإنك ما تعدل أكثر من مرتين خلال 10 دقائق (قيد من ديسكورد).')] });
      }
    }
  },

  'تصنيف': {
    permission: PermissionFlagsBits.ManageChannels,
    label: 'إدارة القنوات',
    async execute(message, args) {
      const name = args.join(' ');
      if (!name) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `تصنيف اسم-الفئة`')] });

      const category = await message.guild.channels.create({ name, type: ChannelType.GuildCategory });
      await message.reply({ embeds: [successEmbed('تم الإنشاء', `الفئة **${category.name}** جاهزة.`)] });
    }
  },

  'بطء': {
    permission: PermissionFlagsBits.ManageChannels,
    label: 'إدارة القنوات',
    async execute(message, args) {
      const seconds = parseInt(args[0]);
      if (!seconds || seconds < 1 || seconds > 21600) {
        return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اكتب رقم بالثواني بين 1 و21600. مثال: `بطء 10`')] });
      }

      await message.channel.setRateLimitPerUser(seconds);
      await message.reply({ embeds: [successEmbed('تم التفعيل', `🐢 السلومود صار ${seconds} ثانية بهذي القناة.`)] });
    }
  },

  'بطء_الغاء': {
    permission: PermissionFlagsBits.ManageChannels,
    label: 'إدارة القنوات',
    async execute(message) {
      await message.channel.setRateLimitPerUser(0);
      await message.reply({ embeds: [successEmbed('تم الإلغاء', 'السلومود انلغى بهذي القناة.')] });
    }
  },

  'نقل_قناة': {
    permission: PermissionFlagsBits.ManageChannels,
    label: 'إدارة القنوات',
    async execute(message, args) {
      const categoryName = args.join(' ');
      const category = message.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === categoryName);
      if (!category) return message.reply({ embeds: [errorEmbed('غير موجود', 'ما لقيت تصنيف بهذا الاسم.')] });

      await message.channel.setParent(category.id);
      await message.reply({ embeds: [successEmbed('تم النقل', `القناة صارت تحت تصنيف **${category.name}**`)] });
    }
  }
};
