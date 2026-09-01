const whois = require('whois');
const { promisify } = require('util');
const { checkUrlVirusTotal } = require('./virustotal');
const { findImpersonatedBrand, extractDomain } = require('./security-utils');

const whoisLookup = promisify(whois.lookup);
const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+)/gi;

// يتبع أي إعادة توجيه (زي bit.ly) ويرجع الرابط النهائي الحقيقي
async function unshorten(url) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(6000) });
    return res.url || url;
  } catch {
    return url; // فشل الوصول - نكمل الفحص على الرابط الأصلي
  }
}

// يفحص عمر النطاق عبر WHOIS - يرجع true لو النطاق أحدث من الحد المسموح
async function isDomainTooNew(domain, minDays) {
  try {
    const raw = await Promise.race([
      whoisLookup(domain),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000))
    ]);

    const match = raw.match(/Creation Date:\s*(.+)/i) || raw.match(/created:\s*(.+)/i) || raw.match(/Registered on:\s*(.+)/i);
    if (!match) return null; // ما قدرنا نجيب تاريخ الإنشاء - نتجاهل هذا الفحص بس، ما نمنع الرابط

    const createdDate = new Date(match[1].trim());
    if (isNaN(createdDate.getTime())) return null;

    const ageDays = (Date.now() - createdDate.getTime()) / 86400000;
    return ageDays < minDays;
  } catch {
    return null; // فشل الاستعلام (تايم اوت أو سيرفر واتس مسكر) - نتجاهل بدل ما نوقف كل شي
  }
}

// الدالة الرئيسية: تفحص أي نص (رسالة عادية أو نص مستخرج من صورة) وترجع أول تهديد تلقاه
async function scanTextForThreats(text, security) {
  const conf = security?.linkScanner;
  if (!conf || !conf.enabled || !text) return null;

  const matches = text.match(URL_REGEX);
  if (!matches) return null;

  for (const rawUrl of matches) {
    const finalUrl = await unshorten(rawUrl);
    const domain = extractDomain(finalUrl);
    if (!domain) continue;

    // النطاقات المسموحة (Whitelist) تمر مباشرة بدون أي فحص إضافي
    const isWhitelisted = (conf.whitelist || []).some(w => domain === w || domain.endsWith('.' + w));
    if (isWhitelisted) continue;

    // 1) كشف التصيد الشبيه بالاسم (زي d1scord.com)
    const impersonated = findImpersonatedBrand(domain);
    if (impersonated) {
      return { url: finalUrl, domain, reason: `رابط تصيد محتمل - شكله شبيه بـ "${impersonated}"` };
    }

    // 2) فحص VirusTotal
    if (conf.checkVirusTotal) {
      const vt = await checkUrlVirusTotal(finalUrl);
      if (vt && vt.malicious > 0) {
        return { url: finalUrl, domain, reason: `مؤكد كرابط ضار عبر VirusTotal (${vt.malicious} محرك رصده)` };
      }
    }

    // 3) فحص عمر النطاق
    if (conf.checkDomainAge) {
      const tooNew = await isDomainTooNew(domain, conf.minDomainAgeDays || 14);
      if (tooNew) {
        return { url: finalUrl, domain, reason: `نطاق جديد جدًا (أقل من ${conf.minDomainAgeDays || 14} يوم)` };
      }
    }
  }

  return null; // ما فيه شي مشبوه بكل الروابط
}

module.exports = { scanTextForThreats };
