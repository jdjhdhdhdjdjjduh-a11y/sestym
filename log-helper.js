const { EmbedBuilder } = require('discord.js');
const db = require('./db');
const { COLORS } = require('./embed-helper');

// يسجل أي إجراء إداري بقناة اللوق (لو مفعّلة بإعدادات السيرفر)
async function logAction(message, { emoji, title, target, reason, color }) {
  try {
    const settings = await db.getSettings(message.guild.id);
    if (!settings.logs.enabled || !settings.logs.channelId) return;

    const channel = message.guild.channels.cache.get(settings.logs.channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(color || COLORS.warn)
      .setTitle(`${emoji} ${title}`)
      .addFields(
        { name: 'بواسطة', value: `<@${message.author.id}>`, inline: true },
        { name: 'الهدف', value: target ? `<@${target.id || target}>` : '—', inline: true }
      )
      .setTimestamp();

    if (reason) embed.addFields({ name: 'السبب', value: reason });

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('❌ خطأ بتسجيل اللوق:', err.message);
  }
}

module.exports = { logAction };
