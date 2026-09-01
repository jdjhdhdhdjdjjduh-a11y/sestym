require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const passport = require('./passport-config');
const db = require('./db');

const app = express();

// فحص المتغيرات الأساسية أول شي - لو أي وحدة ناقصة نطبع تحذير واضح باللوقز بدل خطأ عام غامض
const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'CLIENT_SECRET', 'CALLBACK_URL', 'MONGODB_URI', 'SESSION_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`❌ متغيرات ناقصة بـ Variables: ${missingVars.join(', ')}`);
  console.error('❌ الموقع ما راح يشتغل صح لين تضيفهم. راجع README.md');
}

db.initTables()
  .then(() => console.log('✅ الموقع متصل بقاعدة البيانات (MongoDB)'))
  .catch(err => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

// كل ملفات EJS موجودة بنفس مجلد المشروع (مافي مجلد views منفصل)
app.set('view engine', 'ejs');
app.set('views', __dirname);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// نقدم ملف الـ CSS بس عبر مسار محدد (بدون فتح كل المجلد كـ static عشان ما ينكشف السيرفر.js أو .env)
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/toast.js', (req, res) => res.sendFile(path.join(__dirname, 'toast.js')));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    dbName: process.env.MONGODB_DB_NAME || 'discord_bot',
    collectionName: 'sessions'
  }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', require('./route-auth'));
app.use('/dashboard', require('./route-dashboard'));
app.use('/dashboard', require('./route-stats'));
app.use('/dashboard', require('./route-warnings'));
app.use('/commands', require('./route-commands'));
app.use('/api', require('./route-api'));

app.get('/', (req, res) => res.render('view-home', { user: req.user }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ الموقع شغال على المنفذ ${PORT}`));
