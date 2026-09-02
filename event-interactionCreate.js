const { errorEmbed } = require('./embed-helper');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // ------- أوامر السلاش -------
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(`❌ خطأ بتنفيذ أمر السلاش "${interaction.commandName}":`, err);
        const payload = { embeds: [errorEmbed('صار خطأ', 'تعذر تنفيذ الأمر، حاول مرة ثانية.')], ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      }
      return;
    }

    // ------- القائمة التفاعلية لأمر مساعدة -------
    if (interaction.isStringSelectMenu() && interaction.customId === 'help-category-select') {
      const { getCategoryEmbed, buildSelectRow } = require('./text-help');
      const embed = getCategoryEmbed(interaction.values[0]);
      if (embed) await interaction.update({ embeds: [embed], components: [buildSelectRow()] });
      return;
    }

    // ------- أزرار التحكم بالموسيقى -------
    if (interaction.isButton() && interaction.customId.startsWith('music_')) {
      await handleMusicButton(interaction);
      return;
    }

    // ------- زر "مشاهدة سوا" (بأمر فيلم / مسلسل) -------
    if (interaction.isButton() && interaction.customId === 'cinema_watch_together') {
      await handleWatchTogetherButton(interaction);
      return;
    }

    // ------- زر "الحلقات" (بأمر مسلسل) -------
    if (interaction.isButton() && interaction.customId.startsWith('cinema_episodes_')) {
      await handleEpisodesButton(interaction);
      return;
    }

    // ------- قائمة اختيار الموسم -------
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('cinema_season_select_')) {
      await handleSeasonSelect(interaction);
      return;
    }
  }
};

const WATCH_TOGETHER_APP_ID = '880218394199220334';

async function handleWatchTogetherButton(interaction) {
  const { errorEmbed, successEmbed } = require('./embed-helper');
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    return interaction.reply({ embeds: [errorEmbed('غير ممكن', 'لازم تكون بروم صوتي أول عشان تفعّل مشاهدة سوا.')], ephemeral: true });
  }
  try {
    const { InviteTargetType } = require('discord.js');
    const invite = await voiceChannel.createInvite({
      targetType: InviteTargetType.EmbeddedApplication,
      targetApplication: WATCH_TOGETHER_APP_ID,
      maxAge: 86_400
    });
    await interaction.reply({ embeds: [successEmbed('جاهزين للمشاهدة سوا 🎬', `اضغطوا الرابط وابدأوا: ${invite.url}`)] });
  } catch (err) {
    console.error('❌ خطأ بزر مشاهدة سوا:', err?.message || err);
    await interaction.reply({ embeds: [errorEmbed('تعذر التفعيل', 'تأكد إن البوت عنده صلاحية "إنشاء دعوة" بهذا الروم الصوتي.')], ephemeral: true });
  }
}

async function handleEpisodesButton(interaction) {
  const { errorEmbed } = require('./embed-helper');
  const { buildSeasonSelectRow } = require('./text-cinema');
  const tvId = interaction.customId.replace('cinema_episodes_', '');

  try {
    const { isConfigured, searchTitle } = require('./movie-api');
    // نجيب عدد المواسم عن طريق التفاصيل مباشرة (بدون بحث ثاني) باستخدام fetch مباشر
    const details = await fetch(`https://api.themoviedb.org/3/tv/${tvId}?api_key=${process.env.TMDB_API_KEY}&language=ar`).then(r => r.json());
    const seasonCount = details?.number_of_seasons || 1;

    await interaction.reply({
      content: 'اختر الموسم اللي تبي تشوف حلقاته 👇',
      components: [buildSeasonSelectRow(tvId, seasonCount)],
      ephemeral: true
    });
  } catch (err) {
    console.error('❌ خطأ بزر الحلقات:', err?.message || err);
    await interaction.reply({ embeds: [errorEmbed('صار خطأ', 'تعذر جلب مواسم هذا المسلسل حالياً.')], ephemeral: true });
  }
}

async function handleSeasonSelect(interaction) {
  const { errorEmbed } = require('./embed-helper');
  const { buildEpisodesEmbed, getSeasonEpisodes } = require('./text-cinema');
  const tvId = interaction.customId.replace('cinema_season_select_', '');
  const seasonNumber = interaction.values[0];

  try {
    const seasonData = await getSeasonEpisodes(tvId, seasonNumber);
    await interaction.update({ content: null, embeds: [buildEpisodesEmbed(seasonData, seasonNumber)], components: interaction.message.components });
  } catch (err) {
    console.error('❌ خطأ بجلب حلقات الموسم:', err?.message || err);
    await interaction.reply({ embeds: [errorEmbed('صار خطأ', 'تعذر جلب حلقات هذا الموسم حالياً.')], ephemeral: true });
  }
}

async function handleMusicButton(interaction) {
  const { buildNowPlayingEmbed, buildControlRows } = require('./music-embed');
  const { errorEmbed, successEmbed } = require('./embed-helper');

  const lavalink = interaction.client.lavalink;
  const player = lavalink?.getPlayer(interaction.guildId);
  if (!player) {
    return interaction.reply({ embeds: [errorEmbed('انتهت الجلسة', 'ما فيه أغنية شغالة حالياً، هذا الكرت قديم.')], ephemeral: true });
  }

  const userChannel = interaction.member?.voice?.channel;
  if (!userChannel || userChannel.id !== player.voiceChannelId) {
    return interaction.reply({ embeds: [errorEmbed('غير ممكن', 'لازم تكون بنفس الروم الصوتي مع البوت عشان تتحكم.')], ephemeral: true });
  }

  try {
    switch (interaction.customId) {
      case 'music_previous': {
        const previous = await player.queue.shiftPrevious();
        if (previous) await player.play({ clientTrack: previous });
        break;
      }
      case 'music_playpause':
        player.paused ? await player.resume() : await player.pause();
        break;
      case 'music_skip':
        await player.skip(0, false);
        break;
      case 'music_stop':
        await player.destroy();
        return interaction.update({ embeds: [successEmbed('تم الإيقاف', '⏹️ وقفت الموسيقى وطلعت من الروم.')], components: [] });
      case 'music_shuffle':
        if (player.queue.tracks.length >= 3) await player.queue.shuffle();
        break;
      case 'music_seek_back':
        await player.seek(Math.max(player.position - 10_000, 0));
        break;
      case 'music_seek_forward': {
        const dur = player.queue.current?.info?.duration;
        await player.seek(dur ? Math.min(player.position + 10_000, dur - 1000) : player.position + 10_000);
        break;
      }
      case 'music_volume_down':
        await player.setVolume(Math.max(player.volume - 10, 0));
        break;
      case 'music_volume_up':
        await player.setVolume(Math.min(player.volume + 10, 150));
        break;
      case 'music_loop': {
        const order = ['off', 'track', 'queue'];
        await player.setRepeatMode(order[(order.indexOf(player.repeatMode) + 1) % order.length]);
        break;
      }
      case 'music_restart':
        await player.seek(0);
        break;
      case 'music_queue': {
        const list = player.queue.tracks.slice(0, 10).map((t, i) => `${i + 1}. ${t.info.title}`).join('\n');
        const current = player.queue.current ? `🎶 ${player.queue.current.info.title}\n` : '';
        return interaction.reply({ content: (current + list) || 'الطابور فاضي', ephemeral: true });
      }
    }

    const freshPlayer = lavalink.getPlayer(interaction.guildId);
    if (!freshPlayer?.queue.current) {
      return interaction.update({ embeds: [successEmbed('خلص التشغيل', '🎶 ما بقيت أغاني.')], components: [] });
    }

    const embed = buildNowPlayingEmbed(freshPlayer, freshPlayer.queue.current);
    const rows = buildControlRows(freshPlayer);
    await interaction.update({ embeds: [embed], components: rows });
  } catch (err) {
    console.error('❌ خطأ بزر الموسيقى:', err?.message || err);
    await interaction.reply({ embeds: [errorEmbed('صار خطأ', 'تعذر تنفيذ هذا الإجراء.')], ephemeral: true }).catch(() => {});
  }
}
