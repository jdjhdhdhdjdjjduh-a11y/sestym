const crypto = require('crypto');
const { checkFileHashVirusTotal } = require('./virustotal');

// امتدادات ملفات قابلة للتنفيذ - خطيرة خصوصًا لو جات من حساب جديد
const DANGEROUS_EXTENSIONS = ['.exe', '.bat', '.scr', '.cmd', '.msi', '.vbs', '.jar', '.ps1', '.com', '.pif', '.jse', '.wsf'];
const NEW_ACCOUNT_DAYS = 7;
const MAX_SCAN_SIZE = 50 * 1024 * 1024; // 50 ميجا - أكبر من كذا نتخطى الفحص (توفير موارد)

// يرجع: { verdict: 'clean' | 'malware' | 'quarantine' | 'skip', sha256?, malicious? }
async function scanAttachment(attachment, authorCreatedTimestamp) {
  if (attachment.size > MAX_SCAN_SIZE) return { verdict: 'skip' };

  const name = attachment.name.toLowerCase();
  const dotIndex = name.lastIndexOf('.');
  const ext = dotIndex === -1 ? '' : name.slice(dotIndex);

  let sha256;
  try {
    const res = await fetch(attachment.url);
    const buffer = Buffer.from(await res.arrayBuffer());
    sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  } catch {
    return { verdict: 'skip' }; // فشل تحميل الملف - نتخطاه بدل ما نمنع رسالة العضو بدون سبب واضح
  }

  const vtResult = await checkFileHashVirusTotal(sha256).catch(() => null);
  if (vtResult && vtResult.malicious > 0) {
    return { verdict: 'malware', sha256, malicious: vtResult.malicious };
  }

  const accountAgeDays = (Date.now() - authorCreatedTimestamp) / 86400000;
  const isNewAccount = accountAgeDays < NEW_ACCOUNT_DAYS;
  const isDangerousExt = DANGEROUS_EXTENSIONS.includes(ext);

  if (isDangerousExt && isNewAccount) {
    return { verdict: 'quarantine', sha256 };
  }

  return { verdict: 'clean', sha256 };
}

module.exports = { scanAttachment, DANGEROUS_EXTENSIONS };
