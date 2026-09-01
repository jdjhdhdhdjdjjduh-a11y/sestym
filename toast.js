// يعرض رسالة Toast منبثقة تختفي تلقائيًا بعد كم ثانية
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// يفحص لو الرابط فيه ?saved= أو ?cleared= ويطلع Toast تلقائي بدل البانر الثابت
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);

  if (params.get('saved')) {
    showToast('✅ تم الحفظ بنجاح', 'success');
    window.history.replaceState({}, '', window.location.pathname);
  }
  if (params.get('cleared')) {
    showToast('✅ تم تحديث الإنذارات بنجاح', 'success');
    window.history.replaceState({}, '', window.location.pathname);
  }
  if (params.get('error')) {
    showToast('❌ صار خطأ، تأكد من الرابط أو حاول مرة ثانية', 'error');
    window.history.replaceState({}, '', window.location.pathname);
  }
});
