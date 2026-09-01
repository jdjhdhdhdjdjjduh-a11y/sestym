const { PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const db = require('./db');
const { createProfileCard } = require('./profile-card');
const { errorEmbed } = require('./embed-helper');

module.exports = {
  'بروفايل': {
    permission: PermissionFlagsBits.SendMessages, // متاح لكل عضو - يشوف بروفايله أو بروفايل غيره
    label: 'الاستخدام العام',
    deleteInvoke: false,
    async execute(message) {
      const targetUser = message.mentions.users.first() || message.author;

      let member;
      try {
        member = await message.guild.members.fetch(targetUser.id);
      } catch {
        return message.reply({ embeds: [errorEmbed('غير موجود', 'ما لقيت هذا العضو بالسيرفر.')] });
      }

      const memberDoc = await db.getMember(message.guild.id, targetUser.id);
      const higherRanked = await db.countMembersAbove(message.guild.id, memberDoc.xp);
      const rank = higherRanked + 1;

      const highestRole = member.roles.highest.id !== message.guild.id ? member.roles.highest.name : null;

      const buffer = await createProfileCard({ member, memberDoc, rank, roleName: highestRole });
      const attachment = new AttachmentBuilder(buffer, { name: 'profile.gif' });

      await message.reply({ files: [attachment] });
    }
  }
};
