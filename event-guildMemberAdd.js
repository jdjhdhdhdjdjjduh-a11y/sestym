const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('./db');
const { createWelcomeCard } = require('./welcome-card');
const { handleMemberJoinRaidCheck } = require('./anti-raid');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    // ===== نظام مكافحة الانضمام السريع (Anti-Raid) - أول شي قبل أي معالجة ثانية =====
    const wasRaid = await handleMemberJoinRaidCheck(member).catch(err => {
      console.error('❌ خطأ بنظام Anti-Raid:', err.message);
      return false;
    });
    if (wasRaid) return; // العضو انطرد/انحظر كجزء من الفيضان - ما نكمل بمعالجة الترحيب العادية

    const settings = await db.getSettings(member.guild.id);

    // إنشاء سجل العضو بقاعدة البيانات
    await db.getMember(member.guild.id, member.id);
    await db.incrementDailyNewMember(member.guild.id);

    // 1) الرول التلقائي
    if (settings.autoRole.enabled && settings.autoRole.roleId) {
      try {
        const role = member.guild.roles.cache.get(settings.autoRole.roleId);
        if (role) await member.roles.add(role);
      } catch (err) {
        console.error('❌ خطأ بإعطاء الرول التلقائي:', err.message);
      }
    }

    // 2) رسالة الترحيب
    if (settings.welcome.enabled && settings.welcome.channelId) {
      const channel = member.guild.channels.cache.get(settings.welcome.channelId);
      if (!channel) return;

      const text = settings.welcome.message
        .replace('{user}', `<@${member.id}>`)
        .replace('{server}', member.guild.name);

      if (settings.welcome.withImage) {
        try {
          const buffer = await createWelcomeCard(member);
          const attachment = new AttachmentBuilder(buffer, { name: 'welcome.png' });
          await channel.send({ content: text, files: [attachment] });
        } catch (err) {
          console.error('❌ خطأ بصورة الترحيب:', err.message);
          await channel.send({ content: text });
        }
      } else {
        const embed = new EmbedBuilder()
          .setColor('#57F287')
          .setDescription(text)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp();
        await channel.send({ embeds: [embed] });
      }
    }
  }
};
