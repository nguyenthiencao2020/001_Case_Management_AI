// ════════════════════════════════════════════════════════════
// UTILS — Các hàm tiện ích dùng chung (không có side effects)
// ════════════════════════════════════════════════════════════

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const formatMd = t => esc(t).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

function clean(v) {
  if (!v) return '';
  let r = String(v).replace(/\[Cần thu thập thêm\]/gi, '').replace(/\/\//g, '').replace(/\s*[—\-\/|]\s*[—\-\/|]?\s*/g, ' ').replace(/^[\s—\-\/|]+|[\s—\-\/|]+$/g, '').trim();
  if (/^(Lớp|Năm|Trường|Tại)\s*$/i.test(r)) return '';
  return r;
}

function cf(v) {
  const s = String(v || '');
  if (!s || s.includes('[Cần thu thập thêm]') || s === '//') return '';
  return s.trim();
}

function robustJSON(raw) {
  let t = (raw || '').trim()
    .replace(/^```json\s*/im, '').replace(/\s*```\s*$/im, '')
    .replace(/^```\s*/im, '').replace(/\s*```\s*$/im, '').trim();
  try { return JSON.parse(t); } catch (e) {}
  const s = t.indexOf('{');
  if (s < 0) throw new Error('No JSON found');
  let depth = 0, inStr = false, esc2 = false;
  for (let i = s; i < t.length; i++) {
    const c = t[i];
    if (esc2) { esc2 = false; continue; }
    if (c === '\\' && inStr) { esc2 = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(t.slice(s, i + 1)); } catch (e) { throw new Error('JSON parse error: ' + e.message); }
    }
  }
  throw new Error('Incomplete JSON');
}

function fmtDate(v) {
  if (!v || typeof v !== 'string') return String(v || '');
  v = v.trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) return v;
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[3].padStart(2, '0') + '/' + m[2].padStart(2, '0') + '/' + m[1];
  m = v.match(/^(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})$/);
  if (m) return m[1].padStart(2, '0') + '/' + m[2].padStart(2, '0') + '/' + m[3];
  m = v.match(/^(\d{1,2})\s+(\d{1,2})\s+(\d{4})$/);
  if (m) return m[1].padStart(2, '0') + '/' + m[2].padStart(2, '0') + '/' + m[3];
  m = v.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return m[3].padStart(2, '0') + '/' + m[2].padStart(2, '0') + '/' + m[1];
  m = v.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return '01/' + m[1].padStart(2, '0') + '/' + m[2];
  m = v.match(/[Tt]háng\s+(\d{1,2})[\/\-](\d{4})/);
  if (m) return '01/' + m[1].padStart(2, '0') + '/' + m[2];
  m = v.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return '01/' + m[2].padStart(2, '0') + '/' + m[1];
  m = v.match(/^(\d{1,2})\s+(\d{4})$/);
  if (m) return '01/' + m[1].padStart(2, '0') + '/' + m[2];
  m = v.match(/^(\d{1,2})-(\d{4})$/);
  if (m) return '01/' + m[1].padStart(2, '0') + '/' + m[2];
  m = v.match(/[Tt]háng\s+(\d{1,2})\s+(\d{4})/);
  if (m) return '01/' + m[1].padStart(2, '0') + '/' + m[2];
  m = v.match(/(\d{1,2})[\s\/\-](\d{1,2})[\s\/\-](\d{4})/);
  if (m) return m[1].padStart(2, '0') + '/' + m[2].padStart(2, '0') + '/' + m[3];
  return v;
}

function fmtVN(iso) {
  const d = new Date(iso || Date.now());
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

let notifTimer;
function showNotif(msg, type = 'ok') {
  const el = document.getElementById('notif');
  el.textContent = msg;
  el.className = 'notif notif-' + type;
  el.style.display = 'block';
  if (notifTimer) clearTimeout(notifTimer);
  notifTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// ════════════════════════════════════════════════════════════
// DEEP MERGE — Sống còn: không ghi đè dữ liệu cũ bằng rỗng
// ════════════════════════════════════════════════════════════

const FIELD_MERGE_KEYS = new Set(['danh_gia', 'vang_gia', 'ket_thuc', 'chuyen_gui', 'tien_trinh']);

function deepMergeFields(target, source) {
  if (!source || typeof source !== 'object') return target;
  const result = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    const sv = source[key];
    if (sv === '' || sv === null || sv === undefined) continue;
    if (typeof sv === 'string' && /\[Cần thu thập thêm\]|\/\/|^Không rõ$/i.test(sv)) continue;
    result[key] = sv;
  }
  return result;
}

function deepMerge(target, source) {
  if (source === null || source === undefined) return target;
  if (target === null || target === undefined) {
    return typeof source === 'object' && !Array.isArray(source) ? deepMerge({}, source) : source;
  }
  if (Array.isArray(source)) {
    if (!source.length) return target;
    if (!Array.isArray(target) || !target.length) return source;
    return target;
  }
  if (typeof source === 'object') {
    const result = Object.assign({}, target);
    for (const key of Object.keys(source)) {
      const sv = source[key];
      const tv = target[key];
      if (sv === '' || sv === null || sv === undefined) continue;
      if (typeof sv === 'string' && /\[Cần thu thập thêm\]|\/\/|^Không rõ$/i.test(sv)) continue;
      if (typeof sv === 'object' && !Array.isArray(sv)) {
        result[key] = FIELD_MERGE_KEYS.has(key) ? deepMergeFields(tv || {}, sv) : deepMerge(tv || {}, sv);
      } else if (Array.isArray(sv)) {
        result[key] = (Array.isArray(tv) && tv.length > 0) ? tv : sv;
      } else {
        result[key] = sv;
      }
    }
    return result;
  }
  return (source !== '' && source !== null && source !== undefined) ? source : target;
}
