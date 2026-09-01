const textVoice = require('./text-voice');
const textModeration = require('./text-moderation');
const textWarnings = require('./text-warnings');
const textMessages = require('./text-messages');
const textRoles = require('./text-roles');
const textChannels = require('./text-channels');
const textServer = require('./text-server');
const textEmoji = require('./text-emoji');
const textMisc = require('./text-misc');
const textHelp = require('./text-help');
const textProfile = require('./text-profile');
const textInfo = require('./text-info');
const textMyStats = require('./text-mystats');
const textCompare = require('./text-compare');
const textGuildInfo = require('./text-guildinfo');
const textLevelReset = require('./text-levelreset');
const textEditMember = require('./text-editmember');
const textMusic = require('./text-music');
const textCinema = require('./text-cinema');

module.exports = {
  ...textVoice,
  ...textModeration,
  ...textWarnings,
  ...textMessages,
  ...textRoles,
  ...textChannels,
  ...textServer,
  ...textEmoji,
  ...textMisc,
  ...textHelp,
  ...textProfile,
  ...textInfo,
  ...textMyStats,
  ...textCompare,
  ...textGuildInfo,
  ...textLevelReset,
  ...textEditMember,
  ...textMusic,
  ...textCinema
};
