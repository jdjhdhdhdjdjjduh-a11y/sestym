const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS } = require('./embed-helper');
const db = require('./db');
const { buildVoteBar } = require('./update-suggestion');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('اقتراح')
    .setDescription('قدّم اقتراح جديد للسيرفر')
    .addStringOption(opt => opt.setName('نص').setDescription('اكتب اقتراحك').setRequired(true)),

  async execute(interaction) {
    const settings = await db.getSettings(interaction.guild.id);

    if (!settings.suggestions.enabled || !settings.suggestions.channelId) {
      return interaction.reply({ content: '❌ نظام الاقتراحات غير مفعّل حالياً.', ephemeral: true });
    }

    const channel = interaction.guild.channels.cache.get(settings.suggestions.channelId);
    if (!channel) return interaction.reply({ content: '❌ قناة الاقتراحات غير موجودة، بلغ الإدارة.', ephemeral: true });

    const content = interaction.options.getString('نص');

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
      .setDescription(content)
      .addFields({ name: 'النتيجة', value: buildVoteBar(0, 0) })
      .setFooter({ text: 'صوّت بالرياكشن تحت 👇' })
      .setTimestamp();

    const sentMessage = await channel.send({ embeds: [embed] });
    await sentMessage.react(settings.suggestions.upvoteEmoji);
    await sentMessage.react(settings.suggestions.downvoteEmoji);

    await db.createSuggestion({
      guildId: interaction.guild.id,
      messageId: sentMessage.id,
      channelId: channel.id,
      authorId: interaction.user.id,
      content
    });

    await interaction.reply({ content: `✅ تم إرسال اقتراحك بقناة <#${channel.id}>`, ephemeral: true });
  }
};
