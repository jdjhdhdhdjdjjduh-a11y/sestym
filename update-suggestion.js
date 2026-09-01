const { EmbedBuilder } = require('discord.js');
const db = require('./db');

function buildVoteBar(up, down) {
  const total = up + down;
  if (total === 0) return '⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ (0%) — لا أصوات بعد';

  const percent = Math.round((up / total) * 100);
  const filledBlocks = Math.round(percent / 10);
  const bar = '🟩'.repeat(filledBlocks) + '⬜'.repeat(10 - filledBlocks);

  return `${bar} (${percent}%) — 👍 ${up} | 👎 ${down}`;
}

async function updateSuggestionEmbed(message, suggestion) {
  const settings = await db.getSettings(message.guild.id);

  const upReaction = message.reactions.cache.get(settings.suggestions.upvoteEmoji);
  const downReaction = message.reactions.cache.get(settings.suggestions.downvoteEmoji);

  const up = Math.max((upReaction?.count || 1) - 1, 0);
  const down = Math.max((downReaction?.count || 1) - 1, 0);

  await db.updateSuggestionVotes(message.id, up, down);

  const oldEmbed = message.embeds[0];
  if (!oldEmbed) return;

  const newEmbed = EmbedBuilder.from(oldEmbed).setFields({ name: 'النتيجة', value: buildVoteBar(up, down) });
  await message.edit({ embeds: [newEmbed] }).catch(() => {});
}

module.exports = { updateSuggestionEmbed, buildVoteBar };
