const express = require('express');
const passport = require('./passport-config');
const router = express.Router();

router.get('/discord', passport.authenticate('discord'));

router.get('/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
  res.redirect('/dashboard');
});

router.get('/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

module.exports = router;
