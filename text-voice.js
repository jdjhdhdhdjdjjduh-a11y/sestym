const { PermissionFlagsBits, ChannelType } = require('discord.js');
const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');
const { successEmbed, errorEmbed } = require('./embed-helper');
const { canTarget } = require('./moderation-guards');
const { logAction } = require('./log-helper');

module.exports = {
  // ------- دخول البوت للروم الصوتي (يضل فيه لحاله باستمرار) -------
  'دخول': {
    permission: PermissionFlagsBits.ManageGuild,
    label: 'انضمام البوت للروم الصوتي',
    async execute(message) {
      const voiceChannel = message.member?.voice?.channel;

      if (!voiceChannel) {
        return message.reply({ embeds: [errorEmbed('غير ممكن', 'يجب أن تكون متواجدًا في روم صوتي أولاً!')] });
      }

      try {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: message.guild.id,
          adapterCreator: message.guild.voiceAdapterCreator,
          selfDeaf: true,
          selfMute: false
        });

        // لو صار قطع اتصال مفاجئ (مشكلة شبكة أو إعادة تشغيل مؤقتة من ديسكورد)،
        // يحاول البوت يرجع من نفسه بدل ما يطلع نهائي بدون داعي
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
          try {
            await Promise.race([
              entersState(connection, VoiceConnectionStatus.Signalling, 5000),
              entersState(connection, VoiceConnectionStatus.Connecting, 5000)
            ]);
          } catch {
            connection.destroy();
          }
        });

        await entersState(connection, VoiceConnectionStatus.Ready, 20000);
        await message.reply({ embeds: [successEmbed('تم الانضمام', `دخلت **${voiceChannel.name}** وراح أضل فيها باستمرار (ما أطلع لو انت طلعت أو طلع الكل).`)] });
      } catch (error) {
        console.error('Voice Join Error:', error);
        await message.reply({ embeds: [errorEmbed('فشل الاتصال', 'تأكد إن البوت عنده صلاحية Connect بهذا الروم.')] });
      }
    }
  },

  // ------- خروج البوت من الروم الصوتي -------
  'خروج': {
    permission: PermissionFlagsBits.ManageGuild,
    label: 'خروج البوت من الروم الصوتي',
    async execute(message) {
      const connection = getVoiceConnection(message.guild.id);

      if (!connection) {
        return message.reply({ embeds: [errorEmbed('غير متصل', 'البوت ليس متواجدًا في أي روم صوتي حاليًا!')] });
      }

      connection.destroy();
      await message.reply({ embeds: [successEmbed('تم الخروج', 'طلعت من الروم الصوتي.')] });
    }
  },

  'سحب_صوت': {
    permission: PermissionFlagsBits.MoveMembers,
    label: 'إدارة الأعضاء الصوتيين',
    async execute(message) {
      const target = message.mentions.members.first();
      if (!target || !target.voice.channel) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اذكر عضو موجود بروم صوتي. مثال: `سحب_صوت @فلان`')] });
      if (!(await canTarget(message, target))) return;

      await target.voice.disconnect();
      await message.reply({ embeds: [successEmbed('تم الإخراج', `**${target.user.tag}** انطرد من الروم الصوتي.`)] });
      await logAction(message, { emoji: '🔊', title: 'إخراج من الصوت', target: target.user });
    }
  },

  'نقل_صوت': {
    permission: PermissionFlagsBits.MoveMembers,
    label: 'إدارة الأعضاء الصوتيين',
    async execute(message, args) {
      const target = message.mentions.members.first();
      const channelName = args.slice(1).join(' ');
      if (!target || !target.voice.channel || !channelName) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `نقل_صوت @فلان اسم-الروم-الصوتي`')] });

      const voiceChannel = message.guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name === channelName);
      if (!voiceChannel) return message.reply({ embeds: [errorEmbed('غير موجود', 'ما لقيت روم صوتي بهذا الاسم.')] });

      await target.voice.setChannel(voiceChannel);
      await message.reply({ embeds: [successEmbed('تم النقل', `**${target.user.tag}** انتقل لروم **${voiceChannel.name}**`)] });
    }
  },

  'كتم_صوت': {
    permission: PermissionFlagsBits.MuteMembers,
    label: 'كتم الصوت',
    async execute(message) {
      const target = message.mentions.members.first();
      if (!target || !target.voice.channel) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اذكر عضو موجود بروم صوتي.')] });
      if (!(await canTarget(message, target))) return;

      await target.voice.setMute(true);
      await message.reply({ embeds: [successEmbed('تم الكتم', `صوت **${target.user.tag}** انكتم بالروم.`)] });
      await logAction(message, { emoji: '🔇', title: 'كتم صوتي', target: target.user });
    }
  },

  'فك_كتم_صوت': {
    permission: PermissionFlagsBits.MuteMembers,
    label: 'كتم الصوت',
    async execute(message) {
      const target = message.mentions.members.first();
      if (!target || !target.voice.channel) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اذكر عضو موجود بروم صوتي.')] });

      await target.voice.setMute(false);
      await message.reply({ embeds: [successEmbed('تم فك الكتم', `صوت **${target.user.tag}** رجع طبيعي.`)] });
    }
  },

  'قفل_الروم_الصوتي': {
    permission: PermissionFlagsBits.ManageChannels,
    label: 'إدارة القنوات',
    async execute(message, args) {
      const channelName = args.join(' ');
      const voiceChannel = channelName
        ? message.guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name === channelName)
        : message.member.voice.channel;

      if (!voiceChannel) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'حدد اسم الروم أو كن داخل روم صوتي وقت كتابة الأمر.')] });

      await voiceChannel.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: false });
      await message.reply({ embeds: [successEmbed('تم القفل', `الروم الصوتي **${voiceChannel.name}** صار مقفول للدخول.`)] });
    }
  }
};
