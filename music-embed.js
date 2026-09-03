const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS } = require('./embed-helper');

// لافا لينك يعطي المدة والموضع بالميلي ثانية
function formatTime(ms) {
  const seconds = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function progressBar(currentMs, totalMs, size = 18) {
  if (!totalMs || totalMs <= 0) return '🔴 **مباشر / مدة غير معروفة**';
  const ratio = Math.min(currentMs / totalMs, 1);
  const filled = Math.round(ratio * size);
  const bar = '▬'.repeat(filled) + '🔘' + '▬'.repeat(Math.max(size - filled, 0));
  return `\`${formatTime(currentMs)}\` ${bar} \`${formatTime(totalMs)}\``;
}

function repeatModeLabel(mode) {
  return mode === 'queue' ? '🔁 تكرار الطابور' : mode === 'track' ? '🔂 تكرار الأغنية' : '➡️ بدون تكرار';
}

// track هو كائن Track من لافا لينك: track.info.{title,author,duration,uri,artworkUrl}
function buildNowPlayingEmbed(player, track) {
  const requester = track.requester?.tag || track.requester?.username || 'غير معروف';
  const hasFilters = Object.values(player.filterManager?.filters || {}).some(v => v === true);
  const nextTrack = player.queue.tracks[0];

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setAuthor({ name: '🎧  يشتغل الآن بالروم الصوتي' })
    .setTitle(`🎵  ${track.info.title || 'مقطع بدون اسم'}`)
    .setURL(track.info.uri || null)
    .setThumbnail(track.info.artworkUrl || null)
    .setDescription(
      `**${track.info.author || 'فنان غير معروف'}**\n\n` +
      progressBar(player.position, track.info.duration) +
      `\n\n\`\`\`\n` +
      `👤 طلبها      ${requester}\n` +
      `🔊 الصوت      ${player.volume}%\n` +
      `📃 بالطابور   ${player.queue.tracks.length} أغنية\n` +
      `🔁 التكرار    ${repeatModeLabel(player.repeatMode).replace(/^[^\s]+\s/, '')}\n` +
      `🎚️ المصدر    ${track.info.sourceName || 'غير معروف'}${hasFilters ? ' (فلتر مفعّل)' : ''}\n` +
      `\`\`\``
    );

  if (nextTrack) {
    embed.addFields({ name: '⏭️ التالي بالطابور', value: `${nextTrack.info.title}`, inline: false });
  }

  return embed.setFooter({ text: 'استخدم الأزرار تحت للتحكم بالتشغيل' });
}

function buildAddedEmbed(track, player) {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setDescription(`✅ انضافت للطابور: **${track.info.title}**\nالمركز: #${player.queue.tracks.length} — المدة: ${formatTime(track.info.duration)}`)
    .setThumbnail(track.info.artworkUrl || null);
}

function buildRow1(player) {
  const paused = !!player?.paused;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_previous').setEmoji('⏮️').setLabel('السابقة').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_playpause').setEmoji(paused ? '▶️' : '⏸️').setLabel(paused ? 'تشغيل' : 'إيقاف مؤقت').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setLabel('التالية').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setLabel('إيقاف').setStyle(ButtonStyle.Danger)
  );
}

function buildRow2(player) {
  const modeEmoji = player?.repeatMode === 'queue' ? '🔁' : player?.repeatMode === 'track' ? '🔂' : '➡️';
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_seek_back').setEmoji('⏪').setLabel('رجوع 10ث').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_volume_down').setEmoji('🔉').setLabel('خفض الصوت').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_loop').setEmoji(modeEmoji).setLabel('التكرار').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_volume_up').setEmoji('🔊').setLabel('رفع الصوت').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_seek_forward').setEmoji('⏩').setLabel('تقديم 10ث').setStyle(ButtonStyle.Secondary)
  );
}

function buildRow3() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_shuffle').setEmoji('🔀').setLabel('عشوائي').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_queue').setEmoji('📃').setLabel('الطابور').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_restart').setEmoji('🔄').setLabel('من البداية').setStyle(ButtonStyle.Secondary)
  );
}

function buildControlRows(player) {
  return [buildRow1(player), buildRow2(player), buildRow3()];
}

module.exports = { formatTime, progressBar, buildNowPlayingEmbed, buildAddedEmbed, buildControlRows };
