const { PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const db = require('./db');
const { successEmbed, errorEmbed, COLORS } = require('./embed-helper');
const { confirmWithReaction } = require('./reaction-confirm');
const { logAction } = require('./log-helper');

module.exports = {
  'سجل_عضو': {
    permission: PermissionFlagsBits.ModerateMembers,
    label: 'إدارة الإنذارات',
    deleteInvoke: false,
    async execute(message) {
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اذكر العضو. مثال: `سجل_عضو @فلان`')] });

      const memberDoc = await db.getMember(message.guild.id, target.id);

      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setAuthor({ name: target.user.tag, iconURL: target.user.displayAvatarURL() })
        .addFields(
          { name: '📅 انضم للسيرفر', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:F>`, inline: true },
          { name: '🆕 أنشئ حسابه', value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:F>`, inline: true },
          { name: '🎭 الرتب', value: target.roles.cache.filter(r => r.name !== '@everyone').map(r => r.name).join(', ') || 'بدون رتب' },
          { name: '💬 عدد الرسائل', value: `${memberDoc.messageCount}`, inline: true },
          { name: '⭐ المستوى', value: `${memberDoc.level}`, inline: true },
          { name: '⚠️ عدد الإنذارات', value: `${memberDoc.warnings.length}`, inline: true },
          { name: '🔇 مكتوم حالياً؟', value: target.isCommunicationDisabled() ? '✅ نعم' : '❌ لا', inline: true }
        )
        .setThumbnail(target.user.displayAvatarURL())
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    }
  },

  'نسخة_احتياطية': {
    permission: PermissionFlagsBits.Administrator,
    label: 'الإدارة الكاملة',
    async execute(message) {
      const roles = message.guild.roles.cache
        .filter(r => r.name !== '@everyone')
        .map(r => ({ name: r.name, color: r.color, permissions: r.permissions.bitfield.toString(), position: r.position, hoist: r.hoist, mentionable: r.mentionable }));

      const channels = message.guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildCategory)
        .map(c => ({ name: c.name, type: c.type, position: c.position, parentName: c.parent?.name || null, topic: c.topic || '' }));

      const backupId = await db.createBackup(message.guild.id, message.author.id, { roles, channels });
      await message.reply({ embeds: [successEmbed('تم الحفظ', `النسخة الاحتياطية جاهزة: **${roles.length}** رتبة، **${channels.length}** قناة.\nمعرف النسخة: \`${backupId}\``)] });
      await logAction(message, { emoji: '💾', title: 'إنشاء نسخة احتياطية', target: null, reason: `#${backupId}` });
    }
  },

  'استعادة': {
    permission: PermissionFlagsBits.Administrator,
    label: 'الإدارة الكاملة',
    async execute(message, args) {
      const backupId = args[0];
      let row;

      try {
        row = backupId ? await db.getBackupById(backupId) : await db.getLatestBackup(message.guild.id);
      } catch {
        return message.reply({ embeds: [errorEmbed('خطأ', 'معرف النسخة الاحتياطية غير صحيح.')] });
      }

      if (!row) return message.reply({ embeds: [errorEmbed('غير موجود', 'ما فيه نسخة احتياطية محفوظة لهذا السيرفر.')] });
      const backup = row.data;

      const confirmed = await confirmWithReaction(
        message,
        `راح يتم إنشاء **${backup.roles.length}** رتبة و **${backup.channels.length}** قناة من النسخة الاحتياطية (بدون حذف الموجود حالياً).`,
        15
      );
      if (!confirmed) return message.channel.send({ embeds: [errorEmbed('تم الإلغاء', 'ما تمت الاستعادة.')] });

      for (const r of backup.roles) {
        const existing = message.guild.roles.cache.find(role => role.name === r.name);
        if (!existing) {
          await message.guild.roles.create({ name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable }).catch(() => {});
        }
      }

      const categoryMap = {};
      const categories = backup.channels.filter(c => c.type === ChannelType.GuildCategory);
      const textChannels = backup.channels.filter(c => c.type === ChannelType.GuildText);

      for (const cat of categories) {
        const existing = message.guild.channels.cache.find(c => c.name === cat.name && c.type === ChannelType.GuildCategory);
        categoryMap[cat.name] = existing || await message.guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory }).catch(() => null);
      }

      for (const ch of textChannels) {
        const existing = message.guild.channels.cache.find(c => c.name === ch.name && c.type === ChannelType.GuildText);
        if (existing) continue;
        await message.guild.channels.create({
          name: ch.name, type: ChannelType.GuildText, topic: ch.topic,
          parent: ch.parentName ? categoryMap[ch.parentName]?.id : undefined
        }).catch(() => {});
      }

      await message.channel.send({ embeds: [successEmbed('تم الانتهاء', 'الاستعادة خلصت بنجاح.')] });
      await logAction(message, { emoji: '♻️', title: 'استعادة نسخة احتياطية', target: null });
    }
  }
};
