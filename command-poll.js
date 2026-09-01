const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { COLORS } = require('./embed-helper');
const db = require('./db');

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('استطلاع')
    .setDescription('أنشئ استطلاع رأي بخيارات متعددة')
    .addStringOption(opt => opt.setName('سؤال').setDescription('سؤال الاستطلاع').setRequired(true))
    .addStringOption(opt => opt.setName('خيارات').setDescription('اكتب الخيارات مفصولة بفاصلة (,)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const question = interaction.options.getString('سؤال');
    const rawOptions = interaction.options.getString('خيارات');
    const options = rawOptions.split(',').map(o => o.trim()).filter(Boolean);

    if (options.length < 2 || options.length > 10) {
      return interaction.reply({ content: '❌ لازم تكتب بين 2 و 10 خيارات مفصولة بفاصلة.', ephemeral: true });
    }

    const emojis = NUMBER_EMOJIS.slice(0, options.length);
    const description = options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle(`📊 ${question}`)
      .setDescription(description)
      .setFooter({ text: `بدأه ${interaction.user.tag}` })
      .setTimestamp();

    const sentMessage = await interaction.reply({ embeds: [embed], fetchReply: true });
    for (const emoji of emojis) await sentMessage.react(emoji);

    await db.createPoll({
      guildId: interaction.guild.id,
      messageId: sentMessage.id,
      channelId: interaction.channel.id,
      question, options, emojis,
      authorId: interaction.user.id
    });
  }
};
