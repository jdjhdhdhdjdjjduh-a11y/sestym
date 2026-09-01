const { PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const db = require('./db');
const { createComparisonCard } = require('./compare-card');
const { errorEmbed } = require('./embed-helper');

module.exports = {
  'مقارنة': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'الاستخدام العام',
    deleteInvoke: false,
    async execute(message) {
      const mentioned = message.mentions.members;
      if (mentioned.size < 2) {
        return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اذكر عضوين. مثال: `مقارنة @فلان @علان`')] });
      }

      const [memberA, memberB] = [...mentioned.values()];

      const [docA, docB] = await Promise.all([
        db.getMember(message.guild.id, memberA.id),
        db.getMember(message.guild.id, memberB.id)
      ]);

      const buffer = await createComparisonCard({ memberA, memberB, docA, docB });
      const attachment = new AttachmentBuilder(buffer, { name: 'compare.png' });

      await message.reply({ files: [attachment] });
    }
  }
};
