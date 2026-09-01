const { GlobalFonts } = require('@napi-rs/canvas');

// خط Cairo - نستخدم الملفات الأصلية (غير مقسومة حسب اللغة) من مستودع الخط نفسه
// السبب الحقيقي للمربعات: خطوط Fontsource مقسومة لملفين منفصلين (عربي / لاتيني)،
// وأي سطر نص يخلط عربي + أرقام إنجليزية (زي "المستوى 5") يُرسم بملف واحد بس،
// فإذا انتخب المحرك ملف العربي، ما يلقى شكل الأرقام الإنجليزية ويطلعها مربعات فاضية.
// الحل: ملف واحد فيه العربي والإنجليزي والأرقام مع بعض لكل وزن (Regular / Bold).
const FONT_TAG = 'CAIRO-UNIFIED-V4';
const COMMIT = '7030db78cca3a7a7d94f9071b3f35dad7447ae71';
const FILES = [
  `https://cdn.jsdelivr.net/gh/Gue3bara/Cairo@${COMMIT}/fonts/ttf/Cairo-Regular.ttf`,
  `https://cdn.jsdelivr.net/gh/Gue3bara/Cairo@${COMMIT}/fonts/ttf/Cairo-Bold.ttf`,
];

const fontBuffers = [];
let loaded = false;

async function loadArabicFont() {
  console.log(`ℹ️ [${FONT_TAG}] بدء تحميل خط Cairo الموحّد (عربي+إنجليزي بملف واحد)...`);

  if (loaded) return true;

  try {
    let allOk = true;

    for (const url of FILES) {
      const res = await fetch(url);
      console.log(`   → ${url} : HTTP ${res.status}`);
      if (!res.ok) {
        allOk = false;
        console.error(`   ❌ فشل تحميل ${url}`);
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      fontBuffers.push(buffer);
      const ok = GlobalFonts.register(buffer, 'Cairo');
      if (!ok) {
        allOk = false;
        console.error(`   ❌ فشل تسجيل ${url}`);
      } else {
        console.log(`   ✅ تسجّل: ${url} (${buffer.length} بايت)`);
      }
    }

    loaded = allOk;

    if (loaded) {
      console.log(`✅ [${FONT_TAG}] تم تحميل خط Cairo بنجاح - النصوص المختلطة (عربي + أرقام) راح تشتغل صح`);
    } else {
      console.error(`❌ [${FONT_TAG}] صار خلل بتحميل/تسجيل خط Cairo (شوف التفاصيل فوق)`);
    }
    return loaded;
  } catch (err) {
    console.error(`❌ [${FONT_TAG}] فشل تحميل خط Cairo:`, err.message);
    console.error('⚠️ النصوص بالصور (بروفايل، ترحيب، مقارنة) ما راح تظهر لين ما ينحل هذا');
    return false;
  }
}

module.exports = { loadArabicFont };
 
