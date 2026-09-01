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
    }
  }
};

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
