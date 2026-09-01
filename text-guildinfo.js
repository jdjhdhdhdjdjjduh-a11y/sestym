const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { COLORS } = require('./embed-helper');

module.exports = {
  'معلومات_السيرفر': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'الاستخدام العام',
    deleteInvoke: false,
    async execute(message) {
      const guild = message.guild;
      const owner = await guild.fetchOwner().catch(() => null);

      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setAuthor({ name: guild.name, iconURL: guild.iconURL() || undefined })
        .setThumbnail(guild.iconURL({ size: 256 }) || null)
        .addFields(
          { name: '👑 المالك', value: owner ? owner.user.tag : 'غير معروف', inline: true },
          { name: '📅 تاريخ الإنشاء', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
          { name: '👥 عدد الأعضاء', value: `${guild.memberCount.toLocaleString('en-US')}`, inline: true },
          { name: '💎 مستوى البوست', value: `المستوى ${guild.premiumTier} (${guild.premiumSubscriptionCount || 0} بوست)`, inline: true },
          { name: '📁 عدد القنوات', value: `${guild.channels.cache.size.toLocaleString('en-US')}`, inline: true },
          { name: '🎭 عدد الرتب', value: `${guild.roles.cache.size.toLocaleString('en-US')}`, inline: true },
          { name: '😀 عدد الايموجيات', value: `${guild.emojis.cache.size.toLocaleString('en-US')}`, inline: true },
          { name: '🔒 مستوى التحقق', value: `${guild.verificationLevel}`, inline: true }
        )
        .setTimestamp();

      if (guild.bannerURL()) embed.setImage(guild.bannerURL({ size: 512 }));

      await message.reply({ embeds: [embed] });
    }
  }
};
