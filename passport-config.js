const passport = require('passport');
const { Strategy: DiscordStrategy } = require('passport-discord');

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
  clientID: process.env.CLIENT_ID?.trim(),
  clientSecret: process.env.CLIENT_SECRET?.trim(),
  callbackURL: process.env.CALLBACK_URL?.trim(),
  scope: ['identify', 'guilds']
}, async (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

// يطبع الرابط الفعلي المستخدم وقت التشغيل - يساعد بمقارنته حرف بحرف مع ديسكورد لو صار خطأ redirect_uri
console.log(`🔗 CALLBACK_URL المستخدم فعلياً: "${process.env.CALLBACK_URL?.trim()}"`);

module.exports = passport;
