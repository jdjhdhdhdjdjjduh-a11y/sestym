const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureGuildAdmin } = require('./auth-middleware');
const db = require('./db');
const { getGuildChannels, getGuildRoles } = require('./discord-api');
const { isOnline } = require('./bot-status');

const MANAGE_GUILD = 0x20;

router.get('/', ensureAuthenticated, (req, res) => {
  const manageableGuilds = req.user.guilds.filter(g => g.owner || (g.permissions & MANAGE_GUILD) === MANAGE_GUILD);
  res.render('view-dashboard', { user: req.user, guilds: manageableGuilds, botOnline: isOnline() });
});

router.get('/:guildId', ensureAuthenticated, ensureGuildAdmin, async (req, res) => {
  try {
    const settings = await db.getSettings(req.params.guildId);
    const channels = await getGuildChannels(req.params.guildId);
    const roles = await getGuildRoles(req.params.guildId);

    res.render('view-guild-settings', {
      user: req.user,
      guild: req.currentGuild,
      settings, channels, roles,
      saved: req.query.saved,
      botOnline: isOnline()
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('صار خطأ بجلب بيانات السيرفر. تأكد إن البوت موجود فيه.');
  }
});

module.exports = router;
