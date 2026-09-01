const { EmbedBuilder } = require('discord.js');
const db = require('./db');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (!message.guild || message.author?.bot) return;

    const settings = await db.getSettings(message.guild.id);
    if (!settings.logs.enabled || !settings.logs.events.messageDelete || !settings.logs.channelId) return;

    const channel = message.guild.channels.cache.get(settings.logs.channelId);
    if (!channel || channel.id === message.channel.id) return;

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🗑️ تم حذف رسالة')
      .addFields(
        { name: 'العضو', value: `<@${message.author?.id ?? 'غير معروف'}>`, inline: true },
        { name: 'القناة', value: `<#${message.channel.id}>`, inline: true },
        { name: 'المحتوى', value: message.content?.slice(0, 1000) || '*لا يوجد نص (صورة/ملف)*' }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }
};
