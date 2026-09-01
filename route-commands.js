const express = require('express');
const router = express.Router();
const { CATEGORIES, SLASH_COMMANDS } = require('./text-help');

// صفحة عامة بدون تسجيل دخول - أي حد يقدر يشوفها ويرسلها لأعضاء السيرفر
router.get('/', (req, res) => {
  res.render('view-commands', { categories: CATEGORIES, slashCommands: SLASH_COMMANDS });
});

module.exports = router;
