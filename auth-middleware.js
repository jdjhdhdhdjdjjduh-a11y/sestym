function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/');
}

function ensureGuildAdmin(req, res, next) {
  const guildId = req.params.guildId;
  const guild = req.user.guilds.find(g => g.id === guildId);

  if (!guild) return res.status(403).send('ما أنت عضو بهذا السيرفر');

  const MANAGE_GUILD = 0x20;
  const hasPermission = guild.owner || (guild.permissions & MANAGE_GUILD) === MANAGE_GUILD;

  if (!hasPermission) return res.status(403).send('ما عندك صلاحية إدارة هذا السيرفر');

  req.currentGuild = guild;
  next();
}

module.exports = { ensureAuthenticated, ensureGuildAdmin };
