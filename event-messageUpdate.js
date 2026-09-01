const { EmbedBuilder } = require('discord.js');
const db = require('./db');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const settings = await db.getSettings(newMessage.guild.id);
    if (!settings.logs.enabled || !settings.logs.events.messageEdit || !settings.logs.channelId) return;

    const channel = newMessage.guild.channels.cache.get(settings.logs.channelId);
    if (!channel || channel.id === newMessage.channel.id) return;

    const embed = new EmbedBuilder()
      .setColor('#FEE75C')
      .setTitle('✏️ تم تعديل رسالة')
      .addFields(
        { name: 'العضو', value: `<@${newMessage.author.id}>`, inline: true },
        { name: 'القناة', value: `<#${newMessage.channel.id}>`, inline: true },
        { name: 'قبل', value: oldMessage.content?.slice(0, 500) || '*فارغ*' },
        { name: 'بعد', value: newMessage.content?.slice(0, 500) || '*فارغ*' }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }
};
