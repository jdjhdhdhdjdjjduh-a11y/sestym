const { createWorker } = require('tesseract.js');

// نبني الـ Worker مرة وحدة بس ونعيد استخدامه (بناؤه من الصفر كل مرة بطيء جدًا)
let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng+ara').catch(err => {
      workerPromise = null; // نسمح بإعادة المحاولة لاحقًا لو فشل أول مرة
      throw err;
    });
  }
  return workerPromise;
}

async function extractTextFromImage(imageUrl) {
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(imageUrl);
    return data.text || '';
  } catch (err) {
    console.error('❌ خطأ بقراءة النص من الصورة (OCR):', err.message);
    return '';
  }
}

module.exports = { extractTextFromImage };
