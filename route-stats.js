const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureGuildAdmin } = require('./auth-middleware');
const db = require('./db');
const { getGuildInfo } = require('./discord-api');
const { isOnline } = require('./bot-status');

router.get('/:guildId/stats', ensureAuthenticated, ensureGuildAdmin, async (req, res) => {
  try {
    const guildId = req.params.guildId;

    const [guildInfo, aggregate, suggestionStats, topMembers, dailyActivity] = await Promise.all([
      getGuildInfo(guildId).catch(() => null),
      db.getGuildAggregateStats(guildId),
      db.getGuildSuggestionStats(guildId),
      db.getAllMembersSorted(guildId, 10),
      db.getDailyActivity(guildId, 14)
    ]);

    res.render('view-stats', {
      user: req.user,
      guild: req.currentGuild,
      guildInfo,
      aggregate,
      suggestionStats,
      topMembers,
      dailyActivity,
      botOnline: isOnline()
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('صار خطأ بجلب الإحصائيات. تأكد إن البوت موجود بالسيرفر.');
  }
});

module.exports = router;
