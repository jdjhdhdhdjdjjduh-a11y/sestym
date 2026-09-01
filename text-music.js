const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { errorEmbed, successEmbed, infoEmbed, COLORS } = require('./embed-helper');
const { formatTime, buildNowPlayingEmbed, buildControlRows } = require('./music-embed');

// يقبل "90" (ثواني) أو "1:30" أو "1:02:10"
function parseTimeToSeconds(input) {
  if (!input) return null;
  if (/^\d+$/.test(input)) return parseInt(input);
  const parts = input.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function getPlayer(message) {
  return message.client.lavalink.getPlayer(message.guild.id);
}

// يتأكد إن العضو بنفس الروم الصوتي مع البوت قبل ما يتحكم بالتشغيل
function ensureSameVoice(message, player) {
  const userChannel = message.member?.voice?.channel;
  if (!userChannel || userChannel.id !== player.voiceChannelId) {
    message.reply({ embeds: [errorEmbed('غير ممكن', 'لازم تكون بنفس الروم الصوتي مع البوت عشان تتحكم بالتشغيل.')] });
    return false;
  }
  return true;
}

const FILTER_MAP = {
  'باص': 'bassboost',
  'نايت_كور': 'nightcore',
  'فيبورويف': 'vaporwave',
  'دوران': 'rotation',
  'رعشة': 'tremolo',
  'كاريوكي': 'karaoke'
};

module.exports = {
  'تشغيل': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'تشغيل الموسيقى',
    deleteInvoke: false,
    async execute(message, args) {
      const voiceChannel = message.member?.voice?.channel;
      if (!voiceChannel) return message.reply({ embeds: [errorEmbed('غير ممكن', 'لازم تكون بروم صوتي أول عشان تشغل أغنية.')] });

      const query = args.join(' ').trim();
      if (!query) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `تشغيل اسم الأغنية أو رابط` (يوتيوب / سبوتيفاي / ساوند كلاود / ديزر)')] });

      const lavalink = message.client.lavalink;

      try {
        let player = lavalink.getPlayer(message.guild.id);
        if (!player) {
          player = lavalink.createPlayer({
            guildId: message.guild.id,
            voiceChannelId: voiceChannel.id,
            textChannelId: message.channel.id,
            selfDeaf: true,
            volume: 100
          });
        }
        if (!player.connected) await player.connect();

        const res = await player.search({ query }, message.author);
        if (!res || !res.tracks?.length) {
          return message.reply({ embeds: [errorEmbed('ما لقيت شي', `ما لقيت أي نتيجة عن "${query}"`)] });
        }

        if (res.loadType === 'playlist') {
          player.queue.add(res.tracks);
          await message.reply({ embeds: [successEmbed('تمت الإضافة', `✅ انضافت قائمة تشغيل كاملة: **${res.tracks.length}** أغنية`)] });
        } else {
          player.queue.add(res.tracks[0]);
          if (player.playing) {
            await message.reply({ embeds: [successEmbed('انضافت للطابور', `✅ **${res.tracks[0].info.title}**`)] });
          }
        }

        if (!player.playing) await player.play();
      } catch (err) {
        console.error('❌ خطأ بأمر تشغيل:', err?.message || err);
        await message.reply({ embeds: [errorEmbed('تعذر التشغيل', 'ما قدرت أجيب هذا المقطع، تأكد من الرابط أو جرب اسم/مصدر ثاني.')] });
      }
    }
  },

  'ايقاف_مؤقت': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'التحكم بالموسيقى',
    async execute(message) {
      const player = getPlayer(message);
      if (!player) return message.reply({ embeds: [errorEmbed('لا شي يشتغل', 'ما فيه أغنية شغالة حالياً.')] });
      if (!ensureSameVoice(message, player)) return;
      if (player.paused) return message.reply({ embeds: [infoEmbed('متوقفة أصلاً', 'الأغنية متوقفة مسبقاً.')] });

      await player.pause();
      await message.reply({ embeds: [successEmbed('تم الإيقاف المؤقت', '⏸️ اكتب `استمرار` عشان ترجعها.')] });
    }
  },

  'استمرار': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'التحكم بالموسيقى',
    async execute(message) {
      const player = getPlayer(message);
      if (!player) return message.reply({ embeds: [errorEmbed('لا شي يشتغل', 'ما فيه أغنية بالطابور.')] });
      if (!ensureSameVoice(message, player)) return;
      if (!player.paused) return message.reply({ embeds: [infoEmbed('شغالة أصلاً', 'الأغنية شغالة مسبقاً.')] });

      await player.resume();
      await message.reply({ embeds: [successEmbed('استمر التشغيل', '▶️ رجعت الأغنية تشتغل.')] });
    }
  },

  'تخطي': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'التحكم بالموسيقى',
    async execute(message) {
      const player = getPlayer(message);
      if (!player) return message.reply({ embeds: [errorEmbed('لا شي يشتغل', 'ما فيه طابور تشغيل حالياً.')] });
      if (!ensureSameVoice(message, player)) return;

      const skipped = player.queue.current;
      await player.skip(0, false);
      await message.reply({ embeds: [successEmbed('تم التخطي', `⏭️ تخطينا: **${skipped?.info?.title || 'المقطع الحالي'}**`)] });
    }
  },

  'رجوع': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'التحكم بالموسيقى',
    async execute(message) {
      const player = getPlayer(message);
      if (!player) return message.reply({ embeds: [errorEmbed('لا شي يشتغل', 'ما فيه أغنية شغالة.')] });
      if (!ensureSameVoice(message, player)) return;

      const previous = await player.queue.shiftPrevious();
      if (!previous) return message.reply({ embeds: [errorEmbed('ما فيه أغنية سابقة', 'هذي أول أغنية بالجلسة الحالية.')] });

      await player.play({ clientTrack: previous });
      await message.reply({ embeds: [successEmbed('رجعنا للي قبلها', '⏮️ تم.')] });
    }
  },

  'صوت': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'التحكم بالموسيقى',
    async execute(message, args) {
      const player = getPlayer(message);
      if (!player) return message.reply({ embeds: [errorEmbed('لا شي يشتغل', 'ما فيه أغنية شغالة.')] });
      if (!ensureSameVoice(message, player)) return;

      const value = parseInt(args[0]);
      if (isNaN(value) || value < 0 || value > 150) {
        return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `صوت 0-150`، مثال: `صوت 80`')] });
      }
      await player.setVolume(value);

      if (value > 100) {
        return message.reply({ embeds: [successEmbed('تم ضبط الصوت', `🔊 مستوى الصوت الآن: **${value}%**\n⚠️ فوق 100% ممكن يصير تشويه خفيف بالأجزاء العالية من الأغنية (طبيعي، مو خلل).`)] });
      }
      await message.reply({ embeds: [successEmbed('تم ضبط الصوت', `🔊 مستوى الصوت الآن: **${value}%**`)] });
    }
  },

  'تقديم': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'التحكم بالموسيقى',
    async execute(message, args) {
      const player = getPlayer(message);
      if (!player) return message.reply({ embeds: [errorEmbed('لا شي يشتغل', 'ما فيه أغنية شغالة.')] });
      if (!ensureSameVoice(message, player)) return;

      const seconds = parseTimeToSeconds(args[0]);
      if (seconds === null) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `تقديم 30` أو `تقديم 1:20`')] });

      const duration = player.queue.current?.info?.duration;
      const targetMs = duration ? Math.min(player.position + seconds * 1000, duration - 1000) : player.position + seconds * 1000;
      await player.seek(Math.max(targetMs, 0));
      await message.reply({ embeds: [successEmbed('تم التقديم', `⏩ صرنا بالثانية ${formatTime(targetMs)}`)] });
    }
  },

  'ترجيع': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'التحكم بالموسيقى',
    async execute(message, args) {
      const player = getPlayer(message);
      if (!player) return message.reply({ embeds: [errorEmbed('لا شي يشتغل', 'ما فيه أغنية شغالة.')] });
      if (!ensureSameVoice(message, player)) return;

      const seconds = parseTimeToSeconds(args[0]);
      if (seconds === null) return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'الصيغة: `ترجيع 15` أو `ترجيع 0:30`')] });

      const targetMs = Math.max(player.position - seconds * 1000, 0);
      await player.seek(targetMs);
      await message.reply({ embeds: [successEmbed('تم الترجيع', `⏪ رجعنا للثانية ${formatTime(targetMs)}`)] });
    }
  },

  'الطابور': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'عرض الموسيقى',
    deleteInvoke: false,
    async execute(message) {
      const player = getPlayer(message);
      if (!player || (!player.queue.current && player.queue.tracks.length === 0)) {
        return message.reply({ embeds: [infoEmbed('الطابور فاضي', 'ما فيه أغاني بالطابور حالياً.')] });
      }

      const lines = [];
      if (player.queue.current) lines.push(`🎶 **يشتغل الآن:** ${player.queue.current.info.title} — ${formatTime(player.queue.current.info.duration)}`);
      player.queue.tracks.slice(0, 15).forEach((t, i) => lines.push(`**${i + 1}.** ${t.info.title} — ${formatTime(t.info.duration)}`));

      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('📃 طابور التشغيل')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `المجموع: ${player.queue.tracks.length + (player.queue.current ? 1 : 0)} أغنية${player.queue.tracks.length > 15 ? ' (معروض أول 15)' : ''}` });

      await message.reply({ embeds: [embed] });
    }
  },

  'خلط': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'التحكم بالموسيقى',
    async execute(message) {
      const player = getPlayer(message);
      if (!player) return message.reply({ embeds: [errorEmbed('لا شي يشتغل', 'ما فيه أغنية شغالة.')] });
      if (!ensureSameVoice(message, player)) return;
      if (player.queue.tracks.length < 3) return message.reply({ embeds: [errorEmbed('غير ممكن', 'لازم يكون فيه 3 أغاني عالأقل بالطابور عشان تخلطه.')] });

      await player.queue.shuffle();
      await message.reply({ embeds: [successEmbed('تم الخلط', '🔀 اتخلط ترتيب الطابور.')] });
    }
  },

  'تكرار': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'التحكم بالموسيقى',
    async execute(message) {
      const player = getPlayer(message);
      if (!player) return message.reply({ embeds: [errorEmbed('لا شي يشتغل', 'ما فيه أغنية شغالة.')] });
      if (!ensureSameVoice(message, player)) return;

      const order = ['off', 'track', 'queue'];
      const next = order[(order.indexOf(player.repeatMode) + 1) % order.length];
      await player.setRepeatMode(next);
      const labels = { off: '➡️ بدون تكرار', track: '🔂 تكرار الأغنية الحالية', queue: '🔁 تكرار كل الطابور' };
      await message.reply({ embeds: [successEmbed('تم تغيير وضع التكرار', labels[next])] });
    }
  },

  'ازالة': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'التحكم بالموسيقى',
    async execute(message, args) {
      const player = getPlayer(message);
      if (!player) return message.reply({ embeds: [errorEmbed('لا شي يشتغل', 'ما فيه طابور حالياً.')] });
      if (!ensureSameVoice(message, player)) return;

      const index = parseInt(args[0]);
      if (isNaN(index) || index <= 0 || index > player.queue.tracks.length) {
        return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'اكتب رقم صحيح من قائمة `الطابور` (بدون الأغنية الحالية).')] });
      }
      const removed = player.queue.tracks[index - 1];
      await player.queue.splice(index - 1, 1);
      await message.reply({ embeds: [successEmbed('تم الحذف', `🗑️ اتشالت من الطابور: **${removed.info.title}**`)] });
    }
  },

  'فلتر': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'فلاتر الصوت',
    deleteInvoke: false,
    async execute(message, args) {
      const player = getPlayer(message);
      if (!player) return message.reply({ embeds: [errorEmbed('لا شي يشتغل', 'ما فيه أغنية شغالة.')] });
      if (!ensureSameVoice(message, player)) return;

      const key = args[0];
      if (!key) {
        const active = [];
        if (player.filterManager.equalizerBands.length) active.push('باص');
        for (const [ar, en] of Object.entries(FILTER_MAP)) {
          if (ar !== 'باص' && player.filterManager.filters?.[en]) active.push(ar);
        }
        return message.reply({ embeds: [infoEmbed('فلاتر الصوت', `**المفعّل حاليًا:** ${active.length ? active.join(', ') : 'ولا فلتر'}\n**المتاح:** ${Object.keys(FILTER_MAP).join(' / ')}\n**الصيغة:** \`فلتر باص\` (يفعّل/يوقف) أو \`فلتر مسطح\` (يمسح الكل)`)] });
      }

      if (key === 'مسطح' || key === 'الغاء') {
        await player.filterManager.resetFilters();
        return message.reply({ embeds: [successEmbed('تم التصفير', '🎚️ رجع الصوت لوضعه الأصلي بدون أي فلتر (أعلى جودة ممكنة).')] });
      }

      if (!FILTER_MAP[key]) {
        return message.reply({ embeds: [errorEmbed('فلتر غير معروف', `الفلاتر المتاحة: ${Object.keys(FILTER_MAP).join(' / ')}`)] });
      }

      try {
        switch (key) {
          case 'باص':
            if (player.filterManager.equalizerBands.length) await player.filterManager.clearEQ();
            else await player.filterManager.setEQPreset('BassboostHigh');
            break;
          case 'نايت_كور': await player.filterManager.toggleNightcore(); break;
          case 'فيبورويف': await player.filterManager.toggleVaporwave(); break;
          case 'دوران': await player.filterManager.toggleRotation(); break;
          case 'رعشة': await player.filterManager.toggleTremolo(); break;
          case 'كاريوكي': await player.filterManager.toggleKaraoke(); break;
        }
        await message.reply({ embeds: [successEmbed('تم التحديث', `🎚️ فلتر **${key}** اتبدل. (ملاحظة: أي فلتر يحتاج إعادة ترميز بسيطة، عادي هذا)`)] });
      } catch (err) {
        console.error('❌ خطأ بفلتر الصوت:', err?.message || err);
        await message.reply({ embeds: [errorEmbed('تعذر التفعيل', 'هذا الفلتر غير مدعوم بسيرفر لافا لينك الحالي.')] });
      }
    }
  },

  'جودة': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'عرض الموسيقى',
    deleteInvoke: false,
    async execute(message) {
      const player = getPlayer(message);
      if (!player || !player.queue.current) return message.reply({ embeds: [errorEmbed('لا شي يشتغل', 'ما فيه أغنية شغالة حالياً.')] });

      const track = player.queue.current;
      const hasFilters = player.filterManager.equalizerBands.length > 0 || Object.values(player.filterManager.filters || {}).some(v => v === true);
      const modeText = hasFilters
        ? '🔧 معاد معالجتها بسبب فلتر مفعّل (استخدم `فلتر مسطح` للرجوع لأعلى جودة)'
        : '✨ بث مباشر بأعلى جودة متاحة من المصدر — سيرفر لافا لينك مخصص بالكامل لهذا (بدون مزاحمة أي عملية ثانية بالبوت)';

      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('🎧 معلومات الجودة')
        .addFields(
          { name: 'المقطع', value: track.info.title || 'غير معروف' },
          { name: 'المصدر', value: track.info.sourceName || 'غير معروف', inline: true },
          { name: 'المدة', value: formatTime(track.info.duration), inline: true },
          { name: 'وضع التشغيل', value: modeText }
        );

      await message.reply({ embeds: [embed] });
    }
  },

  'وقف': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'التحكم بالموسيقى',
    async execute(message) {
      const player = getPlayer(message);
      if (!player) return message.reply({ embeds: [errorEmbed('لا شي يشتغل', 'البوت مو شغال موسيقى أصلاً.')] });
      if (!ensureSameVoice(message, player)) return;

      await player.destroy();
      await message.reply({ embeds: [successEmbed('تم الإيقاف', '⏹️ وقفت الموسيقى وطلعت من الروم.')] });
    }
  },

  'الأغنية_الحالية': {
    permission: PermissionFlagsBits.SendMessages,
    label: 'عرض الموسيقى',
    deleteInvoke: false,
    async execute(message) {
      const player = getPlayer(message);
      if (!player || !player.queue.current) return message.reply({ embeds: [errorEmbed('لا شي يشتغل', 'ما فيه أغنية شغالة حالياً.')] });

      const embed = buildNowPlayingEmbed(player, player.queue.current);
      const rows = buildControlRows(player);
      await message.reply({ embeds: [embed], components: rows });
    }
  }
};
