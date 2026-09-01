const {
  PermissionFlagsBits, EmbedBuilder, ChannelType, InviteTargetType,
  GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel
} = require('discord.js');
const { errorEmbed, successEmbed, COLORS } = require('./embed-helper');
const { isConfigured, searchTitle } = require('./movie-api');

// نشاطية "نشاهد سوا" الرسمية بديسكورد (YouTube Together) - آيدي عام موثق
const WATCH_TOGETHER_APP_ID = '880218394199220334';

function buildTitleEmbed(item, emoji) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`${emoji} ${item.title}`)
    .setURL(item.tmdbUrl)
    .setDescription(item.overview);

  if (item.posterUrl) embed.setThumbnail(item.posterUrl);
  if (item.originalTitle && item.originalTitle !== item.title) {
    embed.addFields({ name: 'الاسم الأصلي', value: item.originalTitle, inline: true });
  }
  if (item.rating) embed.addFields({ name: '⭐ التقييم', value: `${item.rating}/10`, inline: true });
  if (item.releaseDate) embed.addFields({ name: '📅 الإصدار', value: item.releaseDate, inline: true });
  if (item.runtime) embed.addFields({ name: '⏱️ المدة', value: `${item.runtime} دقيقة`, inline: true });
  if (item.genres) embed.addFields({ name: '🎭 التصنيف', value: item.genres });

  return embed;
}

// يفهم "بعد X دقيقة" / "بعد X ساعة" / وقت مباشر "21:30"
function parseArabicSchedule(text) {
  const now = new Date();

  let m = text.match(/بعد\s+(\d+)\s*(دقيقة|دقايق|دقائق)/);
  if (m) return new Date(now.getTime() + parseInt(m[1]) * 60_000);

  m = text.match(/بعد\s+(\d+)\s*(ساعة|ساعات)/);
  if (m) return new Date(now.getTime() + parseInt(m[1]) * 3_600_000);

  if (/بعد\s+ساعتين/.test(text)) return new Date(now.getTime() + 2 * 3_600_000);
  if (/بعد\s+ساعة/.test(text)) return new Date(now.getTime() + 3_600_000);

  m = text.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const target = new Date(now);
    target.setHours(parseInt(m[1]), parseInt(m[2]), 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1); // لو الوقت فات اليوم، نخليه بكرة
    return target;
  }

  return null;
}

module.exports = {
  'فيلم': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'السينما',
    deleteInvoke: false,
    async execute(message, args) {
      if (!isConfigured()) {
        return message.reply({ embeds: [errorEmbed('غير مفعّل', 'لازم تضيف `TMDB_API_KEY` بمتغيرات البيئة أول (مجاني من themoviedb.org).')] });
      }
      const query = args.join(' ').trim();
      if (!query) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `فيلم اسم الفيلم`')] });

      try {
        const movie = await searchTitle(query, 'movie');
        if (!movie) return message.reply({ embeds: [errorEmbed('ما لقيت شي', `ما لقيت فيلم بإسم "${query}"`)] });
        await message.reply({ embeds: [buildTitleEmbed(movie, '🎬')] });
      } catch (err) {
        console.error('❌ خطأ بأمر فيلم:', err?.message || err);
        await message.reply({ embeds: [errorEmbed('صار خطأ', 'تعذر جلب معلومات الفيلم حالياً.')] });
      }
    }
  },

  'مسلسل': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'السينما',
    deleteInvoke: false,
    async execute(message, args) {
      if (!isConfigured()) {
        return message.reply({ embeds: [errorEmbed('غير مفعّل', 'لازم تضيف `TMDB_API_KEY` بمتغيرات البيئة أول (مجاني من themoviedb.org).')] });
      }
      const query = args.join(' ').trim();
      if (!query) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `مسلسل اسم المسلسل`')] });

      try {
        const show = await searchTitle(query, 'tv');
        if (!show) return message.reply({ embeds: [errorEmbed('ما لقيت شي', `ما لقيت مسلسل بإسم "${query}"`)] });
        await message.reply({ embeds: [buildTitleEmbed(show, '📺')] });
      } catch (err) {
        console.error('❌ خطأ بأمر مسلسل:', err?.message || err);
        await message.reply({ embeds: [errorEmbed('صار خطأ', 'تعذر جلب معلومات المسلسل حالياً.')] });
      }
    }
  },

  'نشاهد_سوا': {
    permission: PermissionFlagsBits.CreateInstantInvite,
    label: 'السينما',
    deleteInvoke: false,
    async execute(message) {
      const voiceChannel = message.member?.voice?.channel;
      if (!voiceChannel) return message.reply({ embeds: [errorEmbed('غير ممكن', 'لازم تكون بروم صوتي أول عشان تفعّل نشاهد سوا.')] });

      try {
        const invite = await voiceChannel.createInvite({
          targetType: InviteTargetType.EmbeddedApplication,
          targetApplication: WATCH_TOGETHER_APP_ID,
          maxAge: 86_400
        });
        await message.reply({ embeds: [successEmbed('جاهزين للمشاهدة سوا 🎬', `اضغطوا الرابط وابدأوا: ${invite.url}`)] });
      } catch (err) {
        console.error('❌ خطأ بإنشاء دعوة نشاهد سوا:', err?.message || err);
        await message.reply({ embeds: [errorEmbed('تعذر التفعيل', 'تأكد إن البوت عنده صلاحية "إنشاء دعوة" (Create Invite) بهذا الروم الصوتي.')] });
      }
    }
  },

  'ليلة_سينما': {
    permission: PermissionFlagsBits.ManageEvents,
    label: 'السينما',
    deleteInvoke: false,
    async execute(message, args) {
      const full = args.join(' ');
      const parts = full.split(' في ');
      if (parts.length < 2 || !parts[0].trim()) {
        return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `ليلة_سينما اسم الفيلم في 21:30` أو `ليلة_سينما اسم الفيلم في بعد ساعتين`')] });
      }

      const movieName = parts[0].trim();
      const startTime = parseArabicSchedule(parts[1].trim());
      if (!startTime) {
        return message.reply({ embeds: [errorEmbed('ما فهمت الوقت', 'جرب صيغة زي `21:30` أو `بعد ساعتين` أو `بعد 30 دقيقة`')] });
      }

      let movie = null;
      if (isConfigured()) movie = await searchTitle(movieName, 'movie').catch(() => null);

      try {
        const voiceChannel = await message.guild.channels.create({
          name: `🎬 سينما - ${movieName}`.slice(0, 100),
          type: ChannelType.GuildVoice
        });

        const event = await message.guild.scheduledEvents.create({
          name: `🎬 ليلة سينما: ${movieName}`.slice(0, 100),
          scheduledStartTime: startTime,
          privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
          entityType: GuildScheduledEventEntityType.Voice,
          channel: voiceChannel.id,
          description: (movie?.overview || `تجمع مشاهدة: ${movieName}`).slice(0, 950)
        }).catch(err => { console.error('❌ خطأ بإنشاء الحدث:', err?.message || err); return null; });

        const ts = Math.floor(startTime.getTime() / 1000);
        const embed = new EmbedBuilder()
          .setColor(COLORS.info)
          .setTitle(`🎬 ليلة سينما: ${movie?.title || movieName}`)
          .setDescription(movie?.overview || 'استعدوا لليلة سينما حلوة! 🍿')
          .addFields(
            { name: '🕒 الوقت', value: `<t:${ts}:F> (<t:${ts}:R>)` },
            { name: '🔊 الروم', value: `${voiceChannel}` }
          );

        if (movie?.posterUrl) embed.setThumbnail(movie.posterUrl);
        if (movie?.rating) embed.addFields({ name: '⭐ التقييم', value: `${movie.rating}/10`, inline: true });
        if (event) {
          embed.addFields({ name: '📅 اشترك بالحدث', value: `[اضغط هنا عشان ديسكورد يذكرك بالوقت تلقائي](https://discord.com/events/${message.guild.id}/${event.id})` });
        }

        await message.channel.send({
          content: '@here 🍿 ليلة سينما جاية!',
          embeds: [embed],
          allowedMentions: { parse: ['everyone'] }
        });
      } catch (err) {
        console.error('❌ خطأ بإنشاء ليلة السينما:', err?.message || err);
        await message.reply({ embeds: [errorEmbed('تعذر الإنشاء', 'تأكد إن البوت عنده صلاحية "إدارة القنوات" و"إدارة الأحداث" بالسيرفر.')] });
      }
    }
  }
};
