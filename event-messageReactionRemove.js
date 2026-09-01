const db = require('./db');
const { updateSuggestionEmbed } = require('./update-suggestion');

module.exports = {
  name: 'messageReactionRemove',
  async execute(reaction, user) {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

    const suggestion = await db.getSuggestion(reaction.message.id);
    if (suggestion) {
      await updateSuggestionEmbed(reaction.message, suggestion);
    }
  }
};
