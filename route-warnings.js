const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureGuildAdmin } = require('./auth-middleware');
const db = require('./db');
const { getUserInfo } = require('./discord-api');

router.get('/:guildId/warnings', ensureAuthenticated, ensureGuildAdmin, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const membersWithWarnings = await db.getMembersWithWarnings(guildId);

    // نجيب اسم وصورة كل عضو من ديسكورد (بحد أقصى 30 عضو تفاديًا لضغط الطلبات)
    const enriched = await Promise.all(
      membersWithWarnings.slice(0, 30).map(async m => {
        const userInfo = await getUserInfo(m.userId).catch(() => null);
        return { ...m, username: userInfo?.username || 'عضو غير معروف', avatar: userInfo?.avatar || null };
      })
    );

    res.render('view-warnings', {
      user: req.user,
      guild: req.currentGuild,
      members: enriched,
      cleared: req.query.cleared
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('صار خطأ بجلب الإنذارات.');
  }
});

router.post('/:guildId/warnings/clear-one', ensureAuthenticated, ensureGuildAdmin, async (req, res) => {
  const { userId, index } = req.body;
  await db.clearOneWarning(req.params.guildId, userId, parseInt(index));
  res.redirect(`/dashboard/${req.params.guildId}/warnings?cleared=1`);
});

router.post('/:guildId/warnings/clear-all', ensureAuthenticated, ensureGuildAdmin, async (req, res) => {
  const { userId } = req.body;
  await db.clearAllWarningsFor(req.params.guildId, userId);
  res.redirect(`/dashboard/${req.params.guildId}/warnings?cleared=1`);
});

module.exports = router;
