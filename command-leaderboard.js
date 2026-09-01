const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS } = require('./embed-helper');
const db = require('./db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('المتصدرين')
    .setDescription('اعرض أفضل 10 أعضاء حسب المستوى والنشاط'),

  async execute(interaction) {
    await interaction.deferReply();

    const topMembers = await db.getAllMembersSorted(interaction.guild.id, 10);
    if (topMembers.length === 0) return interaction.editReply('لا يوجد بيانات كافية بعد.');

    const medals = ['🥇', '🥈', '🥉'];
    const lines = await Promise.all(topMembers.map(async (m, i) => {
      const user = await interaction.client.users.fetch(m.userId).catch(() => null);
      const name = user ? user.username : 'عضو غير معروف';
      const prefix = medals[i] || `${i + 1}.`;
      return `${prefix} **${name}** — المستوى ${m.level} (${m.xp.toLocaleString('en-US')} XP)`;
    }));

    const embed = new EmbedBuilder()
      .setColor(COLORS.warn)
      .setTitle(`🏆 المتصدرين بسيرفر ${interaction.guild.name}`)
      .setDescription(lines.join('\n'))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
