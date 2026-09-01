// بما إن البوت والموقع يشتغلون بنفس العملية، نخزن مرجع الـ client هنا
// عشان مسارات الموقع تقدر تتأكد هل البوت متصل بديسكورد فعليًا أو لا
let client = null;

function setClient(c) { client = c; }
function isOnline() { return !!(client && client.isReady()); }

module.exports = { setClient, isOnline };
