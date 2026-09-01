const { EmbedBuilder } = require('discord.js');
const db = require('./db');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    const settings = await db.getSettings(member.guild.id);
    if (!settings.logs.enabled || !settings.logs.events.memberLeave || !settings.logs.channelId) return;

    const channel = member.guild.channels.cache.get(settings.logs.channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('📤 عضو غادر السيرفر')
      .setDescription(`${member.user.tag} (<@${member.id}>)`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }
};
