// ════════════════════════════════════════════════════════════
// MAIN — App entry point
// Loaded after config.js, prompts.js, utils.js via plain <script> tags
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
// SUPABASE CONFIG
// ════════════════════════════════════════════════════════════
// ⚠️ ĐỔI 2 giá trị này thành project của bạn:
const SUPABASE_URL = 'https://mlhtvxoricudzstpzquh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SemT5e_eSp8FqkONPGTr0g_HWWtgRT2';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let _currentUser = null;

// ── STATE ──
let D = null;
let curMain = 'dash';
let curForm = 0;
let curCaseId = null;
let _draftCaseId = null;
let chatHistory = [];
let docxLib = null;
let currentStage = 1;

// ── AUTH ──
async function loginEmail() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-err');
  const btn = document.getElementById('login-btn');
  errEl.textContent = '';
  if (!email || !pass) { errEl.textContent = 'Vui lòng nhập email và mật khẩu'; return; }
  btn.disabled = true;
  btn.innerHTML = '<span class="login-spinner"></span>Đang đăng nhập...';
  try {
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    _onLogin(data.user);
  } catch(e) {
    errEl.textContent = e.message === 'Invalid login credentials'
      ? 'Email hoặc mật khẩu không đúng'
      : e.message || 'Lỗi đăng nhập';
    btn.disabled = false;
    btn.textContent = 'Đăng nhập';
  }
}

async function logoutUser() {
  document.getElementById('session-warn')?.classList.remove('show');
  await _supabase.auth.signOut();
  _currentUser = null; _cases = {};
  window._sessionReset?.();
  // ── Reset toàn bộ state ──
  _discardDraft();
  D = null; curCaseId = null; currentStage = 1; chatHistory = []; curForm = 0;
  // Input & chat
  document.getElementById('dash-notes').value = '';
  document.getElementById('dash-cc').textContent = '0 ký tự';
  document.getElementById('chat-msgs').innerHTML = '<div class="chat-empty"><div style="font-size:28px;margin-bottom:8px;">💬</div><div style="font-weight:600;">Chuyên gia CTXH sẵn sàng</div><div>Hỏi bất kỳ điều gì về CTXH hoặc nhập ghi chép để phân tích ca.</div></div>';
  const ci = document.getElementById('chat-input'); if (ci) ci.value = '';
  // Header
  document.getElementById('hdr-case-name').textContent = '';
  document.getElementById('hdr-case-date').textContent = '';
  const dl = document.getElementById('dash-case-label'); if (dl) dl.textContent = '';
  // Form panel
  document.getElementById('btn-fill').disabled = true;
  document.querySelectorAll('.fi-ck').forEach(el => el.remove());
  document.querySelectorAll('.form-item').forEach(el => { el.classList.remove('form-locked'); el.style.opacity = ''; el.title = ''; });
  const fp = document.getElementById('form-preview');
  if (fp) fp.innerHTML = '<div class="fv-placeholder"><div style="font-size:40px;margin-bottom:10px">📋</div><div style="font-weight:700;font-size:14px;margin-bottom:6px">Chưa có dữ liệu</div><div style="font-size:12px">Phân tích ghi chép để điền biểu mẫu tự động</div></div>';
  // Entries panel
  const ep = document.getElementById('entries-panel');
  if (ep) ep.innerHTML = '';
  // Cases tab
  document.getElementById('cases-list').innerHTML = '<div style="padding:24px;text-align:center;color:var(--t3);font-size:12px;">Chưa có ca nào</div>';
  document.getElementById('cases-main').innerHTML = '<div class="case-detail-empty"><div><div style="font-size:36px;margin-bottom:12px;">🗂</div><div style="font-size:14px;font-weight:600;margin-bottom:6px;">Chọn một ca để xem</div></div></div>';
  // Analysis tab
  const eo = document.getElementById('eval-output');
  if (eo) eo.innerHTML = '<div class="eval-placeholder"><div class="ep-icon">📝</div><div class="ep-title">Báo cáo Phân tích & Đánh giá Tổng hợp</div><div class="ep-sub">Nhấn nút bên trên để AI tạo báo cáo đánh giá toàn diện.</div></div>';
  const al = document.getElementById('analysis-left');
  if (al) al.innerHTML = '<div class="eval-placeholder" style="padding:32px 10px;"><div class="ep-icon">📊</div><div class="ep-title">Chưa có ca nào</div><div class="ep-sub">Mở một ca ở tab Dashboard để xem phân tích</div></div>';
  const fecMsgs = document.getElementById('fec-msgs');
  if (fecMsgs) fecMsgs.innerHTML = '<div class="fec-hint">VD: "sửa họ tên thành Nguyễn Văn A" · "bổ sung địa chỉ 123 Q.1"</div>';
  document.getElementById('chat-suggestions').style.display = 'none';
  // Stage / banners
  document.getElementById('closed-banner')?.classList.remove('show');
  updateStageUI();
  // Show login
  const lo = document.getElementById('login-overlay');
  lo.style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-err').textContent = '';
  const lb = document.getElementById('login-btn'); if (lb) { lb.disabled = false; lb.textContent = 'Đăng nhập'; }
  document.getElementById('user-bar').style.display = 'none';
}

function _onLogin(user) {
  _currentUser = user;
  window._sessionReset?.();
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('user-bar').style.display = 'flex';
  document.getElementById('user-email').textContent = user.email;
  // Load cases từ Supabase rồi hiển thị màn hình sạch — user chọn ca từ danh sách
  initStorage().then(() => {
    updateCasesCount();
    renderCaseList();
    // Reset dashboard về trạng thái sạch (không auto-load ca cũ)
    D = null; curCaseId = null; currentStage = 1; chatHistory = [];
    document.getElementById('dash-notes').value = '';
    document.getElementById('dash-cc').textContent = '0 ký tự';
    document.getElementById('btn-fill').disabled = true;
    document.getElementById('btn-send').disabled = false;
    document.getElementById('chat-input').disabled = false;
    document.getElementById('chat-msgs').innerHTML = '<div class="chat-empty"><div style="font-size:28px;margin-bottom:8px;">💬</div><div style="font-weight:600;margin-bottom:4px;">Chào mừng trở lại!</div><div>Chọn ca từ tab <strong>Danh sách ca</strong> hoặc nhấn <strong>+ Ca mới</strong> để bắt đầu.</div></div>';
    document.getElementById('hdr-case-name').textContent = '';
    document.getElementById('hdr-case-date').textContent = '';
    const dl = document.getElementById('dash-case-label'); if (dl) dl.textContent = '';
    const fp = document.getElementById('form-preview');
    if (fp) fp.innerHTML = '<div id="fv" class="fv"><div style="padding:60px 40px;text-align:center;color:var(--t3);"><div style="font-size:48px;margin-bottom:14px;opacity:.3;">📋</div><div style="font-weight:800;font-size:15px;margin-bottom:6px;color:var(--t2)">Chưa có dữ liệu</div><div style="font-size:12.5px;">Phân tích ghi chép trong tab <strong>Dashboard</strong> để điền form</div></div></div>';
    document.getElementById('closed-banner')?.classList.remove('show');
    updateStageUI();
    renderEntriesPanel();
    setTimeout(() => { checkStaleCases(); showNotifications(); }, 2000);
  });
}

// Check session on load
async function _checkSession() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (session?.user) {
    _onLogin(session.user);
  }
  // Listen for auth changes (Google redirect callback)
  _supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user && !_currentUser) {
      _onLogin(session.user);
    }
  });
}

// ════════════════════════════════════════════════════════════
// STORAGE v22 — Supabase per-case rows + files + notifications
// ════════════════════════════════════════════════════════════
let _cases = {};
let _tplOpen = false;

function loadCases() { return _cases; }

function saveCases(c) {
  _cases = JSON.parse(JSON.stringify(c));
  updateStaleBadge();
  if (_currentUser) {
    Object.values(_cases).forEach(cs => {
      const risk = cs.lastAnalysis?._report?.risk?.level || cs.lastAnalysis?._report?.risk_level || null;
      _supabase.from('cases_v2').upsert({
        id: cs.id, user_id: _currentUser.id, name: cs.name || 'Ca mới',
        status: cs.status || 'open', stage: cs.currentStage || 1,
        risk_level: ['Cao','Trung bình','Thấp'].includes(risk) ? risk : null,
        child_name: cs.lastAnalysis?.co_ban?.ho_ten || '',
        child_dob: cs.lastAnalysis?.co_ban?.ngay_sinh || '',
        data: cs, updated_at: cs.updatedAt || new Date().toISOString()
      }, { onConflict: 'id' }).then(({ error }) => {
        if (error) console.warn('Supabase save error:', error);
      });
    });
  }
}

function saveOneCase(caseId) {
  const cs = _cases[caseId];
  if (!cs) return;
  if (_currentUser) {
    const risk = cs.lastAnalysis?._report?.risk?.level || cs.lastAnalysis?._report?.risk_level || null;
    _supabase.from('cases_v2').upsert({
      id: cs.id, user_id: _currentUser.id, name: cs.name || 'Ca mới',
      status: cs.status || 'open', stage: cs.currentStage || 1,
      risk_level: ['Cao','Trung bình','Thấp'].includes(risk) ? risk : null,
      child_name: cs.lastAnalysis?.co_ban?.ho_ten || '',
      child_dob: cs.lastAnalysis?.co_ban?.ngay_sinh || '',
      data: cs, updated_at: cs.updatedAt || new Date().toISOString()
    }, { onConflict: 'id' }).then(({ error }) => {
      if (error) console.warn('Supabase save error:', error);
    });
  }
}

async function initStorage() {
  if (_currentUser) {
    try {
      const { data } = await _supabase.from('cases_v2')
        .select('id, data').eq('user_id', _currentUser.id)
        .order('updated_at', { ascending: false });
      if (data?.length) {
        _cases = {};
        data.forEach(row => { if (row.data) _cases[row.id] = row.data; });
      }
    } catch(e) { console.warn('Supabase load error:', e); }
  }
}

async function deleteCaseFromDB(caseId) {
  if (_currentUser) {
    await _supabase.from('cases_v2').delete().eq('id', caseId).eq('user_id', _currentUser.id);
  }
}

async function uploadCaseFile(caseId, file, stage, note) {
  if (!_currentUser) { showNotif('⚠️ Cần đăng nhập','warn'); return null; }
  const ext = file.name.split('.').pop();
  const path = `${_currentUser.id}/${caseId}/${Date.now()}.${ext}`;
  const { error } = await _supabase.storage.from('case-files').upload(path, file);
  if (error) { showNotif('❌ Upload lỗi: ' + error.message, 'err'); return null; }
  await _supabase.from('case_files').insert({
    case_id: caseId, user_id: _currentUser.id, file_name: file.name,
    file_path: path, file_size: file.size, file_type: file.type,
    stage: stage || currentStage, note: note || ''
  });
  showNotif('✅ Đã upload: ' + file.name);
  return path;
}

async function getCaseFiles(caseId) {
  if (!_currentUser) return [];
  const { data } = await _supabase.from('case_files')
    .select('*').eq('case_id', caseId).eq('user_id', _currentUser.id).order('created_at', { ascending: false });
  return data || [];
}

async function getFileUrl(filePath) {
  const { data } = await _supabase.storage.from('case-files').createSignedUrl(filePath, 3600);
  return data?.signedUrl || '';
}

async function deleteCaseFile(fileId, filePath) {
  await _supabase.storage.from('case-files').remove([filePath]);
  await _supabase.from('case_files').delete().eq('id', fileId);
}

async function loadNotifications() {
  if (!_currentUser) return [];
  const { data } = await _supabase.from('notifications')
    .select('*').eq('user_id', _currentUser.id).eq('is_read', false)
    .order('created_at', { ascending: false }).limit(20);
  return data || [];
}

async function markNotifRead(id) {
  await _supabase.from('notifications').update({ is_read: true }).eq('id', id);
}

async function loadCaseStats() {
  if (!_currentUser) return null;
  const { data } = await _supabase.from('case_stats')
    .select('*').eq('user_id', _currentUser.id).single();
  return data;
}

async function checkStaleCases() {
  if (!_currentUser) return;
  const now = new Date();
  Object.values(_cases).forEach(c => {
    if (c.status !== 'open') return;
    const days = Math.floor((now - new Date(c.updatedAt)) / 86400000);
    const risk = c.lastAnalysis?._report?.risk?.level || c.lastAnalysis?._report?.risk_level || '';
    if (risk === 'Cao' && days > 7) showNotif(`⚠️ Ca "${c.name}" rủi ro CAO — ${days} ngày chưa cập nhật!`, 'warn');
    else if (days > 14) showNotif(`📌 Ca "${c.name}" đã ${days} ngày chưa cập nhật`, 'warn');
  });
  updateStaleBadge();
}

function updateStaleBadge() {
  const now = new Date();
  let count = 0;
  Object.values(_cases).forEach(c => {
    if (c.status !== 'open') return;
    const days = Math.floor((now - new Date(c.updatedAt)) / 86400000);
    const risk = c.lastAnalysis?._report?.risk?.level || c.lastAnalysis?._report?.risk_level || '';
    if ((risk === 'Cao' && days > 7) || days > 14) count++;
  });
  const badge = document.getElementById('stale-count-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = '⚠️ ' + count;
    badge.style.display = 'inline';
    badge.title = count + ' ca lâu chưa cập nhật';
  } else {
    badge.style.display = 'none';
  }
}

function genCaseId() { return 'c_'+Date.now()+'_'+Math.random().toString(36).substr(2,4); }
// ════════════════════════════════════════════════════════════
// PRIVACY — ẩn danh hóa PII trước khi gửi AI
// ════════════════════════════════════════════════════════════
function maskPhonesInText(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/(\b0\d{9}\b|\+84\d{9}\b|\b0\d{2}[\s.-]\d{3}[\s.-]\d{4}\b)/g, '***');
}

function maskStringsInObj(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return maskPhonesInText(obj);
  if (Array.isArray(obj)) return obj.map(maskStringsInObj);
  if (typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = maskStringsInObj(obj[k]);
    return out;
  }
  return obj;
}

function pseudonymizeForAI(data) {
  if (!data) return data;
  const d = maskStringsInObj(JSON.parse(JSON.stringify(data)));
  // Tên trẻ
  if (d.co_ban) {
    if (d.co_ban.ho_ten) d.co_ban.ho_ten = 'Trẻ';
    if (d.co_ban.ngay_sinh) {
      const yr = String(d.co_ban.ngay_sinh).match(/\d{4}/);
      d.co_ban.ngay_sinh = yr ? yr[0] : 'N/A';
    }
    if (d.co_ban.dia_chi) {
      const parts = String(d.co_ban.dia_chi).split(',').map(s=>s.trim()).filter(Boolean);
      d.co_ban.dia_chi = parts[parts.length - 1] || d.co_ban.dia_chi;
    }
    if (d.co_ban.so_dien_thoai) d.co_ban.so_dien_thoai = '***';
    if (d.co_ban.cccd) d.co_ban.cccd = '***';
    if (d.co_ban.ma_so_bhxh) d.co_ban.ma_so_bhxh = '***';
  }
  // Người chăm sóc — giữ nguyên tên (cần cho phân tích), chỉ ẩn SĐT/CCCD
  if (d.gia_dinh?.nguoi_cham_soc) {
    const nc = d.gia_dinh.nguoi_cham_soc;
    if (nc.so_dien_thoai) nc.so_dien_thoai = '***';
    if (nc.cccd) nc.cccd = '***';
    if (nc.dia_chi) {
      const parts = String(nc.dia_chi).split(',').map(s=>s.trim()).filter(Boolean);
      nc.dia_chi = parts[parts.length - 1] || nc.dia_chi;
    }
  }
  // Thành viên gia đình — giữ nguyên tên (cần cho phân tích), chỉ ẩn SĐT/CCCD
  if (Array.isArray(d.gia_dinh?.thanh_vien)) {
    d.gia_dinh.thanh_vien = d.gia_dinh.thanh_vien.map(m => {
      if (!m) return m;
      if (m.so_dien_thoai) m.so_dien_thoai = '***';
      if (m.cccd) m.cccd = '***';
      if (m.dia_chi) {
        const parts = String(m.dia_chi).split(',').map(s=>s.trim()).filter(Boolean);
        m.dia_chi = parts[parts.length - 1] || m.dia_chi;
      }
      return m;
    });
  }
  return d;
}

// ════════════════════════════════════════════════════════════
// API CALLS — qua Cloudflare Worker proxy (không cần key phía client)
// ════════════════════════════════════════════════════════════
async function _fetchWithRetry(body, maxTok) {
  const TIMEOUT_MS = 45000;
  const MAX_RETRIES = 3;
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(GURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        if (res.status === 429) throw new Error('⏳ Rate limit — vui lòng thử lại sau ít phút');
        if (res.status >= 500) { lastErr = new Error(e.error?.message || 'Lỗi máy chủ ' + res.status); continue; }
        throw new Error(e.error?.message || 'API error ' + res.status);
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        lastErr = new Error('⏳ Yêu cầu quá thời gian — vui lòng thử lại');
      } else if (err.message === 'Failed to fetch') {
        lastErr = new Error('🌐 Không thể kết nối máy chủ — kiểm tra kết nối internet rồi thử lại');
      } else {
        lastErr = err;
      }
      // Don't retry 429 or client errors
      if (err.message.startsWith('⏳ Rate limit')) throw err;
    }
  }
  throw lastErr;
}

async function callAI(sysPrompt, userMsg, temp=0.2, maxTok=3000) {
  const body = JSON.stringify({
    model: 'llama-3.3-70b-versatile', temperature: temp, max_tokens: maxTok,
    messages: [{ role: 'system', content: sysPrompt + PRIVACY_PREFIX }, { role: 'user', content: userMsg }]
  });
  const res = await _fetchWithRetry(body, maxTok);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGroqChat(messages, temp=0.4) {
  const body = JSON.stringify({ model: 'llama-3.3-70b-versatile', temperature: temp, max_tokens: 1000, messages });
  const res = await _fetchWithRetry(body, 1000);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'Không có phản hồi.';
}

// ── RAG: lấy tài liệu liên quan từ Supabase pgvector ──
async function fetchRagContext(query) {
  try {
    const res = await fetch('/api/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.slice(0, 1000), top_k: 3 }),
    });
    if (!res.ok) return '';
    const { chunks } = await res.json();
    if (!chunks || !chunks.length) return '';
    const docs = chunks
      .filter(c => c.similarity > 0.3)
      .map(c => `[${c.source_file}]\n${c.content}`)
      .join('\n\n---\n\n');
    return docs ? `\n\n## Tài liệu tham khảo từ hệ thống kiến thức Thảo Đàn:\n${docs}\n` : '';
  } catch {
    return '';
  }
}

function changeAPIKey() {
  showNotif('ℹ️ API key được quản lý an toàn phía server — không cần nhập thủ công');
}

// ── STATS DASHBOARD ──
async function showStats() {
  const overlay = document.getElementById('stats-overlay');
  overlay.style.display = 'flex';
  const el = document.getElementById('stats-content');
  el.innerHTML = 'Đang tải...';
  
  // Calculate from local data
  const cases = Object.values(_cases);
  const open = cases.filter(c => c.status === 'open');
  const closed = cases.filter(c => c.status === 'closed');
  const riskHigh = cases.filter(c => {
    const r = c.lastAnalysis?._report?.risk?.level || c.lastAnalysis?._report?.risk_level;
    return r === 'Cao';
  });
  const riskMed = cases.filter(c => {
    const r = c.lastAnalysis?._report?.risk?.level || c.lastAnalysis?._report?.risk_level;
    return r === 'Trung bình';
  });
  const stages = [0,0,0,0,0,0];
  open.forEach(c => { stages[c.currentStage || 1]++; });
  
  // Stale cases (>14 days no update)
  const now = new Date();
  const stale = open.filter(c => {
    const days = Math.floor((now - new Date(c.updatedAt)) / 86400000);
    return days > 14;
  });

  const riskLow  = cases.filter(c => { const r = c.lastAnalysis?._report?.risk?.level || c.lastAnalysis?._report?.risk_level; return r === 'Thấp'; });
  const riskNone = cases.length - riskHigh.length - riskMed.length - riskLow.length;
  const stageLabels = ['','Tiếp cận','Vãng gia','Kế hoạch','Tiến trình','Kết thúc'];
  const stageColors = ['','#6366f1','#0ea5e9','#f59e0b','#10b981','#8b5cf6'];
  const maxStage = Math.max(1, ...stages.slice(1));
  const riskData = [
    { label:'Rủi ro cao',  val:riskHigh.length,  color:'#ef4444', bg:'#fef2f2' },
    { label:'Rủi ro TB',   val:riskMed.length,   color:'#f59e0b', bg:'#fffbeb' },
    { label:'Rủi ro thấp', val:riskLow.length,   color:'#22c55e', bg:'#f0fdf4' },
    { label:'Chưa p/tích', val:riskNone,          color:'#94a3b8', bg:'#f8fafc' },
  ];
  const maxRisk = Math.max(1, ...riskData.map(r => r.val));

  function bar(val, max, color, bg) {
    const pct = max > 0 ? Math.round(val / max * 100) : 0;
    return `<div style="background:${bg};border-radius:4px;height:8px;overflow:hidden;flex:1;"><div style="background:${color};height:100%;width:${pct}%;border-radius:4px;transition:width .4s ease;"></div></div>`;
  }

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-num">${cases.length}</div><div class="stat-label">Tổng ca</div></div>
      <div class="stat-card" style="background:#dbeafe;"><div class="stat-num" style="color:#1d4ed8;">${open.length}</div><div class="stat-label">Đang mở</div></div>
      <div class="stat-card"><div class="stat-num">${closed.length}</div><div class="stat-label">Đã đóng</div></div>
      <div class="stat-card risk-high"><div class="stat-num">${riskHigh.length}</div><div class="stat-label">Rủi ro cao</div></div>
      <div class="stat-card risk-med"><div class="stat-num">${riskMed.length}</div><div class="stat-label">Rủi ro TB</div></div>
      <div class="stat-card" style="background:#fef3c7;"><div class="stat-num" style="color:#92400e;">${stale.length}</div><div class="stat-label">Lâu chưa CN</div></div>
    </div>

    <div style="font-weight:700;font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.8px;margin:14px 0 8px;">📊 Ca đang mở theo giai đoạn</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;">
      ${[1,2,3,4,5].map(s => `
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:72px;font-size:10px;font-weight:600;color:${stageColors[s]};flex-shrink:0;">GĐ${s} ${stageLabels[s]}</div>
          ${bar(stages[s], maxStage, stageColors[s], '#f1f5f9')}
          <div style="width:20px;text-align:right;font-size:11px;font-weight:700;color:var(--text);flex-shrink:0;">${stages[s]}</div>
        </div>`).join('')}
    </div>

    <div style="font-weight:700;font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;">🎯 Phân bổ mức rủi ro</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;">
      ${riskData.map(r => `
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:82px;font-size:10px;font-weight:600;color:${r.color};flex-shrink:0;">${r.label}</div>
          ${bar(r.val, maxRisk, r.color, r.bg)}
          <div style="width:20px;text-align:right;font-size:11px;font-weight:700;color:var(--text);flex-shrink:0;">${r.val}</div>
        </div>`).join('')}
    </div>

    ${stale.length ? `<div style="font-weight:600;font-size:12px;margin-bottom:8px;color:#dc2626;">⚠️ Ca lâu chưa cập nhật (${stale.length}):</div>
    <div style="font-size:12px;">${stale.map(c => {
      const days = Math.floor((now - new Date(c.updatedAt)) / 86400000);
      const risk2 = c.lastAnalysis?._report?.risk?.level || c.lastAnalysis?._report?.risk_level || '';
      const dot = risk2 === 'Cao' ? '🔴' : risk2 === 'Trung bình' ? '🟡' : '⚪';
      return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd);font-size:11.5px;">`
        + `<span>${dot} ${esc(c.name)}</span>`
        + `<span style="color:#dc2626;font-weight:700;">${days} ngày · GĐ${c.currentStage||1}</span></div>`;
    }).join('')}</div>` : '<div style="color:#16a34a;font-size:12px;padding:6px 0;">✅ Tất cả ca đều được cập nhật đều đặn</div>'}
  `;
}

// ── NOTIFICATIONS ──
async function showNotifications() {
  const panel = document.getElementById('notif-panel');
  panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  if (panel.style.display === 'none') return;
  
  const list = document.getElementById('notif-list');
  const notifs = await loadNotifications();
  
  if (!notifs.length) {
    // Fallback: check stale cases locally
    const localNotifs = [];
    const now = new Date();
    Object.values(_cases).forEach(c => {
      if (c.status !== 'open') return;
      const days = Math.floor((now - new Date(c.updatedAt)) / 86400000);
      const risk = c.lastAnalysis?._report?.risk?.level || c.lastAnalysis?._report?.risk_level || '';
      if (risk === 'Cao' && days > 7) localNotifs.push({ type:'warning', message:`Ca "${c.name}" rủi ro CAO — ${days} ngày chưa cập nhật!`, created_at: c.updatedAt });
      else if (days > 14) localNotifs.push({ type:'reminder', message:`Ca "${c.name}" đã ${days} ngày chưa cập nhật`, created_at: c.updatedAt });
    });
    if (!localNotifs.length) { list.innerHTML = '<div class="notif-empty">🎉 Không có thông báo mới</div>'; return; }
    list.innerHTML = localNotifs.map(n => `<div class="notif-item ${n.type}">${n.message}<div class="notif-time">${fmtVN(n.created_at)}</div></div>`).join('');
    return;
  }
  
  list.innerHTML = notifs.map(n => `<div class="notif-item ${n.type}" onclick="markNotifRead('${n.id}');this.remove();">
    ${esc(n.message)}<div class="notif-time">${fmtVN(n.created_at)}</div>
  </div>`).join('');
  document.getElementById('notif-badge').style.display = 'flex';
  document.getElementById('notif-badge').textContent = notifs.length;
}

// ── FILE UPLOAD UI ──
function renderFileUpload(caseId) {
  return `<div class="file-upload-area" onclick="document.getElementById('file-input-${caseId}').click()">
    📎 Nhấn để upload ảnh/file (ảnh vãng gia, giấy tờ...)
    <input type="file" id="file-input-${caseId}" style="display:none" accept="image/*,.pdf,.doc,.docx" multiple onchange="handleFileUpload('${caseId}', this.files)">
  </div>
  <div id="file-list-${caseId}" class="file-list"></div>`;
}

async function handleFileUpload(caseId, files) {
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) { showNotif('⚠️ File ' + file.name + ' > 5MB — bỏ qua', 'warn'); continue; }
    showNotif('⏳ Đang upload: ' + file.name);
    await uploadCaseFile(caseId, file, currentStage, '');
  }
  refreshFileList(caseId);
}

async function refreshFileList(caseId) {
  const el = document.getElementById('file-list-' + caseId);
  if (!el) return;
  const files = await getCaseFiles(caseId);
  if (!files.length) { el.innerHTML = ''; return; }
  const items = await Promise.all(files.map(async f => {
    const isImg = f.file_type?.startsWith('image/');
    const url = await getFileUrl(f.file_path);
    const size = (f.file_size / 1024).toFixed(0) + 'KB';
    return `<div class="file-item">
      ${isImg ? `<img src="${url}" alt="">` : '<div style="width:40px;height:40px;background:var(--bg2);border-radius:6px;display:flex;align-items:center;justify-content:center;">📄</div>'}
      <div class="file-info"><div class="file-name">${esc(f.file_name)}</div><div class="file-meta">GĐ${f.stage} · ${size} · ${fmtVN(f.created_at)}</div></div>
      ${isImg ? `<a href="${url}" target="_blank" style="font-size:14px;">🔍</a>` : `<a href="${url}" target="_blank" style="font-size:14px;">⬇</a>`}
      <span class="file-del" onclick="if(confirm('Xóa file này?')){deleteCaseFile('${f.id}','${f.file_path}').then(()=>refreshFileList('${caseId}'))}">🗑</span>
    </div>`;
  }));
  el.innerHTML = items.join('');
}

// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
// ★★★ STAGE WIZARD — UI MANAGEMENT ★★★
// ════════════════════════════════════════════════════════════
function updateStageUI() {
  const cfg = STAGE_CONFIG[currentStage];
  if (!cfg) return;

  // Apply stage color theme to body
  document.body.setAttribute('data-stage', currentStage);

  // Stage pill
  const pillNum = document.getElementById('stage-pill-num');
  const pillLabel = document.getElementById('stage-pill-label');
  const stageLabels = ['','Tiếp cận ban đầu','Vãng gia & Đánh giá','Kế hoạch can thiệp','Tiến trình','Kết thúc ca'];
  if (pillNum) pillNum.textContent = currentStage;
  if (pillLabel) pillLabel.textContent = stageLabels[currentStage] || cfg.label;

  // Progress steps
  const _closedCase = curCaseId ? loadCases()[curCaseId] : null;
  const _caseIsClosed = _closedCase?.status === 'closed';
  const spRow = document.querySelector('.stage-progress-row');
  if (spRow) {
    const _shortNames = ['','Tiếp cận','Vãng gia','Kế hoạch','Tiến trình','Kết thúc'];
    spRow.innerHTML = '';
    for (let s = 1; s <= 5; s++) {
      const isDone = _caseIsClosed || s < currentStage;
      const isActive = s === currentStage && !_caseIsClosed;
      const div = document.createElement('div');
      div.className = `sp-step ${isDone ? 'done' : isActive ? 'active' : 'locked'}`;
      div.id = `sp-${s}`;
      div.innerHTML = `<div class="sp-step-num">${isDone ? '✓' : s}</div><div class="sp-step-lbl">${_shortNames[s]}</div>`;
      if (isDone && curCaseId) {
        div.title = `↩ Quay lại GĐ ${s}: ${_shortNames[s]}`;
        div.onclick = () => gotoStage(s);
      } else if (isActive) {
        div.title = `GĐ ${s} — đang hoạt động`;
      } else {
        div.title = `GĐ ${s} — chưa bắt đầu`;
      }
      spRow.appendChild(div);
    }
  }

  // Form chips
  const chipsEl = document.getElementById('stage-form-chips');
  if (chipsEl) {
    const stageChips = {
      1: [['Form 0',''], ['Form 1','']],
      2: [['Form 0','locked'],['Form 1','locked'],['Form 2',''],['Form 3a',''],['Form 3b','']],
      3: [['Form 0','locked'],['Form 1','locked'],['Form 2','locked'],['Form 3a','locked'],['Form 3b','locked'],['Form 4','']],
      4: [['Form 4','locked'],['Form 5',''],['Form 6',''],['Form 7','']],
      5: [['Form 8',''],['Form 9',''],['Báo cáo','']]
    };
    const chips = stageChips[currentStage] || [];
    chipsEl.innerHTML = chips.map(([lbl, cls]) =>
      `<span class="stage-form-chip${cls?' '+cls:''}">${lbl}</span>`
    ).join('');
  }

  // Complete button
  const btnComplete = document.getElementById('btn-complete-stage');
  const _curCase = curCaseId ? loadCases()[curCaseId] : null;
  const _isClosed = _curCase?.status === 'closed';
  if (btnComplete) {
    // GĐ5: chỉ cần có ca (không cần D) — GĐ1-4: phải có D (đã phân tích)
    const _canComplete = cfg.completable && !_isClosed &&
      (currentStage === 5 ? !!_curCase : !!D);
    if (_canComplete) {
      btnComplete.classList.add('show');
      btnComplete.style.display = 'inline-flex';
      btnComplete.textContent = currentStage < 5 ? `✓ Hoàn thành GĐ ${currentStage}` : '✓ Đóng ca';
    } else {
      btnComplete.classList.remove('show');
      btnComplete.style.display = 'none';
    }
  }

  // Rollback button — hiện khi stage > 1
  const btnRollback = document.getElementById('btn-rollback');
  if (btnRollback) {
    btnRollback.style.display = currentStage > 1 ? 'inline-flex' : 'none';
  }

  // Input/button text
  const hint = document.getElementById('stage-hint');
  const lbl = document.getElementById('input-label-text');
  const btn = document.getElementById('btn-analyze');
  const ta = document.getElementById('dash-notes');
  if (hint) {
    if (currentStage === 4 && D && Array.isArray(D.cap_nhat) && D.cap_nhat.length > 0) {
      hint.textContent = `Đã có ${D.cap_nhat.length} bản ghi tiến trình. Nhập ghi chép buổi mới để nối thêm (append) — không ghi đè dữ liệu cũ.`;
    } else {
      hint.textContent = cfg.hint;
    }
  }
  if (lbl) lbl.textContent = cfg.inputLabel;
  if (btn) {
    // Remove old append badge if any
    const old = btn.querySelector('.append-badge');
    if (old) old.remove();
    btn.textContent = cfg.btnText;
    if (currentStage === 4) {
      const b = document.createElement('span');
      b.className = 'append-badge';
      b.textContent = 'APPEND';
      btn.appendChild(b);
    }
  }
  if (ta) ta.placeholder = cfg.placeholder;

  // Refresh template panel if open
  if (_tplOpen) _renderTemplate();

  // Mark locked forms in sidebar
  cfg.lockedForms.forEach(fi => {
    const item = document.querySelector(`.form-item[data-fi="${fi}"]`);
    if (item) item.classList.add('form-locked');
  });

  // Header progress indicator
  const hdrProg = document.getElementById('hdr-progress');
  if (hdrProg && D) {
    hdrProg.style.display = 'block';
    const stageColors = {1:'#60a5fa',2:'#22d3ee',3:'#a78bfa',4:'#fbbf24',5:'#34d399'};
    for (let s = 1; s <= 5; s++) {
      const bar = document.getElementById('hpb-' + s);
      if (bar) {
        if (s < currentStage) bar.style.background = 'rgba(255,255,255,.5)';
        else if (s === currentStage) bar.style.background = stageColors[s] || '#fff';
        else bar.style.background = 'rgba(255,255,255,.15)';
      }
    }
    const progText = document.getElementById('hdr-prog-text');
    if (progText) progText.textContent = `GĐ ${currentStage}/5`;
  } else if (hdrProg) {
    hdrProg.style.display = 'none';
  }
  // Update chat suggestions
  renderSuggestions();
}

// ─── Stage preview panel ─────────────────────────────────────
function previewStage(s) {
  const panel = document.getElementById('stage-preview-panel');
  if (!panel) return;
  // Toggle off if same stage clicked again
  if (panel.style.display === 'block' && panel.dataset.stage === String(s)) {
    closeStagePreview(); return;
  }
  const cases = loadCases();
  const c = curCaseId ? cases[curCaseId] : null;
  const entries = (c?.entries || []).map((e, i) => ({...e, _idx: i})).filter(e => (e.stage||1) === s);
  const stageNames = ['','Tiếp cận ban đầu','Vãng gia & Đánh giá','Kế hoạch can thiệp','Tiến trình','Kết thúc ca'];

  if (!entries.length) {
    panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <span style="font-weight:700;font-size:13px;">GĐ ${s} — ${stageNames[s]||''}</span>
      <button onclick="closeStagePreview()" style="background:none;border:none;font-size:18px;color:var(--t3);cursor:pointer;padding:0;">✕</button>
    </div>
    <div style="color:var(--t3);font-size:13px;padding:12px 0;">Chưa có ghi chép nào cho giai đoạn này.</div>`;
    panel.dataset.stage = s; panel.style.display = 'block'; return;
  }

  const rows = [...entries].reverse().map(e => {
    const preview = (e.notes||'').substring(0, 280);
    const hasMore = (e.notes||'').length > 280;
    return `<div style="padding:10px 0;border-bottom:1px solid var(--bd);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-size:11px;color:var(--t3);">📅 ${fmtVN(e.date)}</span>
        <span style="flex:1"></span>
        <button onclick="loadEntryToEditor(${e._idx});closeStagePreview()"
          style="padding:4px 12px;background:var(--navy);color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">✏️ Sửa nội dung</button>
      </div>
      <div style="font-size:12px;color:var(--t1);white-space:pre-wrap;line-height:1.6;max-height:140px;overflow:hidden;">${esc(preview)}${hasMore?'<span style="color:var(--t3);">…</span>':''}</div>
    </div>`;
  }).join('');

  panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
    <span style="font-weight:700;font-size:13px;">GĐ ${s} — ${stageNames[s]||''} <span style="font-size:11px;color:var(--t3);font-weight:400;">(${entries.length} lần ghi chép)</span></span>
    <button onclick="closeStagePreview()" style="background:none;border:none;font-size:18px;color:var(--t3);cursor:pointer;padding:0;line-height:1;">✕</button>
  </div>${rows}`;
  panel.dataset.stage = s; panel.style.display = 'block';
}

function closeStagePreview() {
  const p = document.getElementById('stage-preview-panel');
  if (p) { p.style.display = 'none'; p.dataset.stage = ''; }
}

function completeStage() {
  if (!D) { showNotif('⚠️ Hãy phân tích ghi chép trước khi hoàn thành giai đoạn', 'warn'); return; }

  // ── GĐ 5: Đóng ca ──
  if (currentStage >= 5) {
    if (!curCaseId) { showNotif('⚠️ Không tìm thấy ca hiện tại', 'warn'); return; }
    const cName = (loadCases()[curCaseId]?.name) || 'ca này';
    showConfirm({
      icon: '✅',
      title: 'Xác nhận đóng ca?',
      body: `"${cName}" sẽ chuyển sang trạng thái Đã đóng.\nBạn vẫn có thể xem lại nhưng không thể chỉnh sửa tiếp.`,
      okText: 'Đóng ca',
      okClass: 'cmb-ok-orange',
      onConfirm() {
        const cases = loadCases();
        if (cases[curCaseId]) {
          cases[curCaseId].status = 'closed';
          cases[curCaseId].closedAt = new Date().toISOString();
          cases[curCaseId].updatedAt = new Date().toISOString();
          if (D) D._status = 'closed';
          if (!cases[curCaseId].followUpSchedule)
            cases[curCaseId].followUpSchedule = _genFollowUpSchedule(cases[curCaseId].closedAt);
          saveCases(cases);
        }
        // Reset dashboard về trạng thái sạch
        D = null; curCaseId = null; currentStage = 1; chatHistory = [];
        document.getElementById('dash-notes').value = '';
        document.getElementById('dash-cc').textContent = '0 ký tự';
        document.getElementById('btn-fill').disabled = true;
        document.getElementById('chat-msgs').innerHTML = '<div class="chat-empty"><div style="font-size:28px;margin-bottom:8px;">✅</div><div style="font-weight:600;margin-bottom:4px;">Đã đóng ca thành công</div><div>Chọn ca khác hoặc nhấn <strong>+ Ca mới</strong> để tiếp tục.</div></div>';
        document.getElementById('hdr-case-name').textContent = '';
        document.getElementById('hdr-case-date').textContent = '';
        const dl = document.getElementById('dash-case-label'); if (dl) dl.textContent = '';
        document.getElementById('closed-banner')?.classList.remove('show');
        const fp = document.getElementById('form-preview');
        if (fp) fp.innerHTML = '<div id="fv" class="fv"><div style="padding:60px 40px;text-align:center;color:var(--t3);"><div style="font-size:48px;margin-bottom:14px;opacity:.3;">✅</div><div style="font-weight:800;font-size:15px;margin-bottom:6px;color:var(--t2)">Ca đã đóng</div><div style="font-size:12.5px;">Chọn ca khác từ <strong>Danh sách ca</strong></div></div></div>';
        renderCaseList(); updateCasesCount(); updateStageUI(); renderEntriesPanel();
        showNotif('✅ Đã đóng ca thành công!');
      }
    });
    return;
  }

  if (!confirm(`Sau khi hoàn thành GĐ ${currentStage}, các form giai đoạn này sẽ bị khóa.\nBạn có chắc muốn tiếp tục?`)) return;

  const nextStage = currentStage + 1;
  const cfg = STAGE_CONFIG[currentStage];

  // Khóa các form của giai đoạn hiện tại
  cfg.lockedForms.forEach(fi => {
    const item = document.querySelector(`.form-item[data-fi="${fi}"]`);
    if (item) {
      item.style.opacity = '0.6';
      item.title = '🔒 Đã hoàn thành giai đoạn trước';
    }
  });

  // ★ Lưu entry + stageData cho giai đoạn HIỆN TẠI trước khi chuyển sang giai đoạn mới
  const _completeNotes = document.getElementById('dash-notes').value.trim();
  if (curCaseId) {
    const _cc = loadCases();
    const _ce = _cc[curCaseId];
    if (_ce) {
      const _snap = D ? JSON.parse(JSON.stringify(D)) : null;
      // Save to stageData
      _ce.stageData = _ce.stageData || {};
      _ce.stageData[currentStage] = { notes: _completeNotes, analysis: _snap, savedAt: new Date().toISOString() };
      // Save to entries
      if (_completeNotes) {
        _ce.entries = _ce.entries || [];
        const _today = new Date().toDateString();
        const _last = _ce.entries[_ce.entries.length-1];
        const _sameDS = _last && _last.stage === currentStage && new Date(_last.date).toDateString() === _today;
        if (_sameDS) {
          _ce.entries[_ce.entries.length-1] = {..._last, notes:_completeNotes, analysis:_snap, date:new Date().toISOString()};
        } else {
          _ce.entries.push({ date:new Date().toISOString(), notes:_completeNotes, analysis:_snap, stage:currentStage });
        }
      }
      _cc[curCaseId] = _ce;
      _cases = _cc;
    }
  }

  // Lưu stage vào D
  D._currentStage = nextStage;
  currentStage = nextStage;

  // Clear textarea cho giai đoạn mới
  document.getElementById('dash-notes').value = '';
  document.getElementById('dash-cc').textContent = '0 ký tự';

  updateStageUI();
  saveCaseNow();
  showNotif(`✅ Đã hoàn thành GĐ ${currentStage - 1} — Bắt đầu GĐ ${currentStage}: ${STAGE_CONFIG[currentStage].label}`);
}

function rollbackStage() {
  if (currentStage <= 1) { showNotif('ℹ️ Đang ở giai đoạn đầu tiên', 'warn'); return; }
  if (!confirm(`Lùi về GĐ ${currentStage - 1}?\nCác form giai đoạn trước sẽ được mở khóa lại.`)) return;
  gotoStage(currentStage - 1);
}

function gotoStage(targetStage) {
  if (targetStage === currentStage) return;
  if (targetStage > currentStage) { showNotif('ℹ️ Hãy hoàn thành giai đoạn hiện tại để tiến lên', 'warn'); return; }
  if (!curCaseId) { showNotif('⚠️ Không tìm thấy ca', 'warn'); return; }

  const cases = loadCases();
  const c = cases[curCaseId];
  if (!c) { showNotif('⚠️ Không tìm thấy ca', 'warn'); return; }

  // Save current stage snapshot before switching
  c.stageData = c.stageData || {};
  c.stageData[currentStage] = {
    notes: document.getElementById('dash-notes').value,
    analysis: D ? JSON.parse(JSON.stringify(D)) : null,
    savedAt: new Date().toISOString()
  };
  c.updatedAt = new Date().toISOString();
  cases[curCaseId] = c;
  saveCases(cases);

  // Unlock all forms then re-lock appropriate ones
  [1,2,3,4,5].forEach(s => {
    const cfg = STAGE_CONFIG[s];
    if (cfg) cfg.lockedForms.forEach(fi => {
      const item = document.querySelector(`.form-item[data-fi="${fi}"]`);
      if (item) { item.classList.remove('form-locked'); item.style.opacity = ''; item.title = ''; }
    });
  });
  for (let s = 1; s < targetStage; s++) {
    const cfg = STAGE_CONFIG[s];
    if (cfg) cfg.lockedForms.forEach(fi => {
      const item = document.querySelector(`.form-item[data-fi="${fi}"]`);
      if (item) { item.style.opacity = '0.6'; item.title = '🔒 Đã hoàn thành giai đoạn trước'; }
    });
  }

  // Load target stage data: prefer stageData snapshot, fall back to entries
  const snap = c.stageData[targetStage];
  const ta = document.getElementById('dash-notes');
  if (snap) {
    if (ta) { ta.value = snap.notes || ''; document.getElementById('dash-cc').textContent = (snap.notes||'').length + ' ký tự'; }
    if (snap.analysis) { D = JSON.parse(JSON.stringify(snap.analysis)); D._currentStage = targetStage; if (D._report) renderReport(D._report); }
  } else {
    const entries = (c.entries || []).filter(e => (e.stage||1) === targetStage);
    const last = entries.length ? entries[entries.length-1] : null;
    if (last) {
      if (ta) { ta.value = last.notes || ''; document.getElementById('dash-cc').textContent = (last.notes||'').length + ' ký tự'; }
      if (last.analysis) { D = JSON.parse(JSON.stringify(last.analysis)); D._currentStage = targetStage; if (D._report) renderReport(D._report); }
    } else {
      if (ta) { ta.value = ''; document.getElementById('dash-cc').textContent = '0 ký tự'; }
    }
  }

  currentStage = targetStage;
  if (D) D._currentStage = targetStage;

  updateStageUI();
  showNotif(`↩ Đã chuyển sang GĐ ${targetStage}: ${STAGE_CONFIG[targetStage]?.label}`);
}

// ════════════════════════════════════════════════════════════
// ★★★ CORE: ANALYSIS ENGINE v15 ★★★
// Stage-aware, DeepMerge, Append for Stage 4
// ════════════════════════════════════════════════════════════
async function runAnalysis() {
  const notes = document.getElementById('dash-notes').value.trim();
  if (!notes) { showNotif('⚠️ Nhập ghi chép trước', 'warn'); return; }
  if (notes.length < 30) { showNotif('⚠️ Ghi chép quá ngắn — cần ít nhất 30 ký tự', 'warn'); return; }
  _commitDraft(); // lưu ca draft thành thật nếu chưa lưu
  const notesAI = maskPhonesInText(notes); // mask phones before sending to AI

  const btn = document.getElementById('btn-analyze');
  btn.disabled = true;
  const originalBtnHTML = btn.innerHTML;
  btn.innerHTML = '<span class="spin"></span> Đang phân tích...';
  const prog = document.getElementById('prog-fill');
  prog.style.transition = 'width 4s'; prog.style.width = '80%';

  // Khởi tạo D nếu chưa có
  if (!D) {
    D = {
      co_ban: {}, gia_dinh: {}, tinh_trang: {}, danh_gia: {},
      vang_gia: {}, ke_hoach: { nhu_cau_ho_tro: [], hoat_dong: [] },
      cap_nhat: Array.isArray(D?.cap_nhat) ? D.cap_nhat : [], tien_trinh: {}, chuyen_gui: {}, ket_thuc: {},
      nguon_luc_xa_hoi: {}, _report: null, _notes: notes, _currentStage: currentStage
    };
  }

  // Chọn prompt theo giai đoạn
  const stagePrompts = {
    1: PROMPT_STAGE_1, 2: PROMPT_STAGE_2,
    3: PROMPT_STAGE_3, 4: PROMPT_STAGE_4, 5: PROMPT_STAGE_5
  };
  const extractPrompt = stagePrompts[currentStage] || PROMPT_STAGE_1;

  try {
    // Giai đoạn 4: chỉ cần extract (không cần parallel report)
    if (currentStage === 4) {
      prog.style.transition = 'width 2.5s'; prog.style.width = '70%';
      const formRaw = await callAI(extractPrompt, 'Ghi chép NVXH (Cập nhật tiến trình):\n\n' + notesAI, 0, 3000);
      let appendData = {};
      try { appendData = robustJSON(formRaw); } catch(e) { console.warn('Stage 4 JSON error:', e); }

      // ★ APPEND MODE: nối thêm vào mảng cap_nhat
      if (appendData.cap_nhat_moi && Array.isArray(appendData.cap_nhat_moi)) {
        if (!Array.isArray(D.cap_nhat)) D.cap_nhat = [];
        appendData.cap_nhat_moi.forEach(entry => {
          if (entry && (entry.van_de || entry.ket_qua)) {
            D.cap_nhat.push(entry);
          }
        });
        showNotif(`✅ Đã nối thêm ${appendData.cap_nhat_moi.length} bản ghi vào tiến trình`);
      }

      // Merge nhận xét tiến trình
      if (appendData.tien_trinh_moi) {
        D.tien_trinh = deepMerge(D.tien_trinh || {}, appendData.tien_trinh_moi);
      }
      // ★ Merge tien_do_muc_tieu vào D.tien_do (append mode)
      if (appendData.tien_do_muc_tieu && Array.isArray(appendData.tien_do_muc_tieu)) {
        if (!Array.isArray(D.tien_do)) D.tien_do = [];
        appendData.tien_do_muc_tieu.forEach(td => {
          if (td && (td.nhu_cau || td.hoat_dong)) D.tien_do.push(td);
        });
      }

      D._notes_stage4 = (D._notes_stage4 || []);
      D._notes_stage4.push({ date: new Date().toISOString(), notes });

      // ★ Thêm báo cáo AI cho GĐ 4
      try {
        const report4Raw = await callAI(SYS_REPORT_4, 'Ghi chép NVXH (Tiến trình):\n\n' + notesAI + '\n\nDữ liệu hiện tại:\n' + JSON.stringify({cap_nhat: (D.cap_nhat||[]).slice(-3), ke_hoach: D.ke_hoach}).substring(0, 600), 0.3, 2000);
        const report4 = robustJSON(report4Raw);
        D._report = report4;
        D._report._stage = 4;
      } catch(e) { console.warn('Report GĐ4 error:', e); }

      prog.style.transition = 'width .3s'; prog.style.width = '100%';
      setTimeout(() => { prog.style.width = '0'; prog.style.transition = 'none'; }, 600);

      _logEdit('AI phân tích (GĐ4 append)', currentStage);
      renderProgressSummary();
      document.getElementById('btn-fill').disabled = false;
      document.getElementById('chat-input').disabled = false;
      document.getElementById('btn-send').disabled = false;
      updateStageUI();

    } else {
      // Giai đoạn 1, 2, 3, 5: parallel report + extract (+ RAG context)
      const reportPrompt = STAGE_REPORT_MAP[currentStage] || SYS_REPORT_1;
      const ragCtx = await fetchRagContext(notesAI);
      const [reportRaw, formRaw] = await Promise.all([
        callAI(reportPrompt + ragCtx, 'Ghi chép NVXH:\n\n' + notesAI, 0.3, 2500),
        callAI(extractPrompt, 'Ghi chép NVXH:\n\n' + notesAI, 0, 4096)
      ]);

      let report = {};
      try { report = robustJSON(reportRaw); } catch(e) { report = { risk: 'Không xác định', summary: reportRaw.substring(0, 300) }; }

      let formData = {};
      try { formData = robustJSON(formRaw); } catch(e) { console.warn('Form JSON error:', e); formData = {}; }

      // ★ DEEP MERGE — không bao giờ ghi đè D
      D = deepMerge(D, formData);
      report._stage = currentStage;
      D._report = report;
      D._notes = notes;
      D._currentStage = currentStage;
      if (!D.co_ban) D.co_ban = {};

      _validateData(D);

      prog.style.transition = 'width .3s'; prog.style.width = '100%';
      setTimeout(() => { prog.style.width = '0'; prog.style.transition = 'none'; }, 600);

      renderReport(report);
      renderEntriesPanel();

      document.getElementById('chat-input').disabled = false;
      document.getElementById('btn-send').disabled = false;
      document.getElementById('btn-fill').disabled = false;

      chatHistory = [
        { role: 'user', content: 'Ghi chép:\n' + notes },
        { role: 'assistant', content: 'Đã phân tích. Báo cáo: ' + JSON.stringify(report).substring(0, 500) }
      ];

      // Mark forms có dữ liệu
      const stageFormMap = { 1: [0, 1], 2: [2, 3, 4], 3: [5], 5: [8, 9, 10] };
      (stageFormMap[currentStage] || []).forEach(fi => {
        const item = document.querySelector(`.form-item[data-fi="${fi}"]`);
        if (item && !item.querySelector('.fi-ck')) {
          const ck = document.createElement('span'); ck.className = 'fi-ck'; ck.textContent = '✓';
          item.appendChild(ck);
        }
      });

      _logEdit('AI phân tích', currentStage);
      if(window._markUnsaved) window._markUnsaved();
      showNotif(`✅ GĐ ${currentStage}: Phân tích hoàn tất — nhớ nhấn Lưu`);
    }

    updateStageUI();

  } catch(e) {
    showNotif('❌ Lỗi: ' + e.message, 'err');
    prog.style.width = '0';
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalBtnHTML;
  }
}

function renderProgressSummary() {
  // Stage 4: refresh entries + hiển thị báo cáo GĐ4
  renderEntriesPanel();
  if (D?._report) renderReport(D._report);
}
// ════════════════════════════════════════════════════════════
// DATA VALIDATION — cảnh báo dữ liệu bất hợp lý
// ════════════════════════════════════════════════════════════
function _validateData(data) {
  if (!data) return;
  const warnings = [];
  const cb = data.co_ban || {};
  const gd = data.gia_dinh || {};
  const ncs = gd.nguoi_cham_soc || {};

  // Parse year helper
  const parseYr = (v) => {
    if (!v) return null;
    const m = String(v).match(/\b(19|20)\d{2}\b/);
    return m ? parseInt(m[0]) : null;
  };

  const childYr = parseYr(cb.ngay_sinh || cb.tuoi);
  const careYr  = parseYr(ncs.ngay_sinh);

  if (childYr && careYr) {
    const diff = childYr - careYr;
    if (diff < 13)  warnings.push(`⚠️ Tuổi người chăm sóc (${careYr}) và trẻ (${childYr}) bất hợp lý — chênh lệch chỉ ${diff} tuổi.`);
    if (diff > 75)  warnings.push(`⚠️ Tuổi người chăm sóc (${careYr}) và trẻ (${childYr}) chênh lệch ${diff} tuổi — kiểm tra lại.`);
  }

  // Check members
  (gd.thanh_vien || []).forEach(tv => {
    if (!tv.ho_ten && !tv.quan_he) return;
    const tvYr = parseYr(tv.nam_sinh);
    if (childYr && tvYr) {
      const diff = childYr - tvYr;
      if (tv.quan_he && /cha|mẹ|bố|ba|mẹ/i.test(tv.quan_he) && diff < 13) {
        warnings.push(`⚠️ "${tv.ho_ten || tv.quan_he}" (${tvYr}) có thể không hợp lý là cha/mẹ của trẻ (${childYr}).`);
      }
    }
  });

  // Missing critical fields
  if (!cb.ho_ten) warnings.push('📋 Chưa có họ tên trẻ.');
  if (!cb.ngay_sinh && !cb.tuoi) warnings.push('📋 Chưa có năm sinh / tuổi trẻ.');

  if (!warnings.length) return;

  // Show as dismissible banner above analysis
  const eo = document.getElementById('eval-output');
  if (!eo) return;
  const existBanner = document.getElementById('_val-banner');
  if (existBanner) existBanner.remove();
  const banner = document.createElement('div');
  banner.id = '_val-banner';
  banner.style.cssText = 'background:#fff8e1;border:1px solid #f9a825;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;line-height:1.7;';
  banner.innerHTML = `<div style="font-weight:700;margin-bottom:6px;color:#e65100;">🔍 Cảnh báo dữ liệu</div>${warnings.map(w=>`<div>${w}</div>`).join('')}<div style="text-align:right;margin-top:6px;"><button onclick="this.closest('#_val-banner').remove()" style="background:none;border:none;color:#999;cursor:pointer;font-size:11px;">Đóng ×</button></div>`;
  eo.insertAdjacentElement('beforebegin', banner);
}

// ════════════════════════════════════════════════════════════
// ★★★ REPORT RENDERER v22 — Stage-aware ★★★
// ════════════════════════════════════════════════════════════
function renderReport(report) {
  if (!report) return;
  try {
  const stage = report._stage || D?._currentStage || currentStage || 1;
  switch(stage) {
    case 1: renderReport1(report); break;
    case 2: renderReport2(report); break;
    case 3: renderReport3(report); break;
    case 4: renderReport4(report); break;
    case 5: renderReport5(report); break;
    default: renderReport1(report);
  }
  } catch(e) { console.error('renderReport error:', e); document.getElementById('chat-msgs').innerHTML = '<div class="cb cb-ai">⚠️ Lỗi hiển thị báo cáo: ' + e.message + '</div>'; }
}

// ── Helpers dùng chung ──
function _riskColor(r) { return r==='Cao'?'#dc2626':r==='Trung bình'?'#d97706':'#16a34a'; }
function _riskBg(r) { return r==='Cao'?'#fef2f2':r==='Trung bình'?'#fffbeb':'#f0fdf4'; }
function _riskIcon(r) { return r==='Cao'?'🔴':r==='Trung bình'?'🟡':'🟢'; }
function _levelBadge(obj) {
  if (!obj||!obj.level) return '<span style="color:#9ca3af">—</span>';
  const cm={C:['#dc2626','#fef2f2'],TB:['#d97706','#fffbeb'],T:['#16a34a','#f0fdf4'],KR:['#6b7280','#f3f4f6']};
  const lm={C:'Cao',TB:'TB',T:'Thấp',KR:'Chưa rõ'};
  const [c,bg]=cm[obj.level]||cm.KR;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${bg};color:${c};border:1px solid ${c}33">${lm[obj.level]||obj.level}</span>`;
}
function _chip(txt,color) {
  return `<span style="display:inline-flex;padding:3px 9px;border-radius:16px;font-size:11px;font-weight:600;background:${color}15;color:${color};border:1px solid ${color}33;margin:2px">${esc(txt)}</span>`;
}
function _secHead(icon,num,title,color='#1e3a5f') {
  return `<div style="display:flex;align-items:center;gap:8px;margin:14px 0 8px;padding:6px 12px;background:${color}0d;border-left:4px solid ${color};border-radius:0 6px 6px 0">
    <span style="font-size:14px">${icon}</span><span style="color:${color};font-size:11px;font-weight:800">${num}</span>
    <span style="font-size:13px;font-weight:800;color:${color}">${title}</span></div>`;
}
function _header(stageName,stageNum,color) {
  const cb=D?.co_ban||{};
  const now=fmtVN(new Date().toISOString());
  return `<div style="background:linear-gradient(135deg,#0f2d6b 0%,#1a3f8f 60%,${color} 100%);border-radius:12px;padding:14px 18px;margin-bottom:14px;color:#fff;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;width:100%;box-sizing:border-box">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:18px">🌿</div>
      <div><div style="font-size:14px;font-weight:900">Báo cáo GĐ ${stageNum} — ${stageName}</div>
      <div style="font-size:10px;opacity:.6;margin-top:2px">${esc(cb.ho_ten||'—')} · ${now}</div></div>
    </div>
    <button onclick="dlReportDocx()" style="background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);padding:5px 12px;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s" onmouseover="this.style.background='rgba(255,255,255,.25)'" onmouseout="this.style.background='rgba(255,255,255,.15)'">⬇ .docx</button>
  </div>`;
}
function _urgentBanner(report) {
  if (!report.urgent||!report.urgent_reason) return '';
  return `<div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:8px;padding:10px 14px;margin-bottom:10px;font-size:12px;color:#7f1d1d"><strong>⚠️ KHẨN CẤP:</strong> ${esc(report.urgent_reason)}</div>`;
}
function _supervisionNotes(notes) {
  if (!notes||!notes.length) return '';
  return `<div style="background:#fefce8;border:1.5px solid #fde047;border-radius:8px;padding:10px 14px;margin-top:10px">
    <div style="font-size:10px;font-weight:700;color:#854d0e;margin-bottom:5px">📋 GHI CHÚ GIÁM SÁT VIÊN</div>
    <ul style="margin:0;padding-left:14px">${notes.map(n=>`<li style="font-size:12px;color:#713f12;margin:2px 0">${esc(n)}</li>`).join('')}</ul></div>`;
}
function _infoTable(cb) {
  return `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px">
    <tr><td style="padding:5px 10px;font-weight:600;color:#555;background:#f9fafb;border:1px solid #e5e7eb;width:20%">Họ tên</td>
    <td style="padding:5px 10px;border:1px solid #e5e7eb;color:#1a4a8a;font-weight:700">${esc(cb.ho_ten||'—')}</td>
    <td style="padding:5px 10px;font-weight:600;color:#555;background:#f9fafb;border:1px solid #e5e7eb;width:18%">Tuổi / Giới</td>
    <td style="padding:5px 10px;border:1px solid #e5e7eb">${esc([cf(cb.tuoi),cf(cb.gioi_tinh)].filter(Boolean).join(' / ')||'—')}</td></tr></table>`;
}
function _setReport(html) {
  document.getElementById('chat-msgs').innerHTML = `<div class="cb cb-report" style="width:100%;max-width:100%">${html}</div>`;
  document.getElementById('chat-msgs').scrollTop = 0;
}

// ════════════════════
// RENDER GĐ 1 — TIẾP CẬN
// ════════════════════
function renderReport1(r) {
  const cb=D?.co_ban||{}, rm=r.risk_matrix||{}, nw=r.needs_vs_wants||{}, pf=r.parentification||{}, dr=r.data_reliability||[];
  const rC=_riskColor(r.risk), rBg=_riskBg(r.risk), rI=_riskIcon(r.risk);
  let h = `<div style="font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;line-height:1.6;color:#1f2937;width:100%;box-sizing:border-box">`;
  h += _header('Tiếp cận ban đầu',1,'#2563eb');
  h += _infoTable(cb);
  h += _urgentBanner(r);

  // Ma trận rủi ro
  h += _secHead('⚠️','I.','MA TRẬN RỦI RO ĐA CHIỀU','#dc2626');
  h += `<div style="display:grid;gap:5px;margin-bottom:10px">`;
  ['an_toan_the_chat','an_toan_tam_ly','moi_truong','giao_duc','he_thong_bao_ve'].forEach((k,i)=>{
    const lb=['🛡 An toàn Thể chất','🧠 An toàn Tâm lý','🏠 Môi trường Sống','📚 Giáo dục & Phát triển','👨‍👩‍👧 Hệ thống Bảo vệ'];
    const obj=rm[k]||{};
    h+=`<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#fff;border:1px solid #e5e7eb;border-radius:6px">
      <span style="font-size:12px;min-width:175px;font-weight:600;color:#374151">${lb[i]}</span>${_levelBadge(obj)}
      <span style="font-size:11.5px;color:#6b7280;flex:1">${esc(obj.detail||'')}</span></div>`;
  });
  h += `</div>`;
  h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <div style="background:${rBg};border:1.5px solid ${rC}44;border-left:4px solid ${rC};border-radius:8px;padding:12px">
      <div style="font-size:10px;font-weight:700;color:${rC};text-transform:uppercase;margin-bottom:5px">Mức độ Rủi ro</div>
      <div style="display:flex;align-items:center;gap:8px"><span style="font-size:26px">${rI}</span>
      <div><div style="font-size:17px;font-weight:900;color:${rC}">${r.risk||'?'}</div>
      ${r.urgent?'<div style="font-size:10px;background:#dc2626;color:#fff;padding:1px 7px;border-radius:10px;margin-top:2px;display:inline-block">⚠️ KHẨN CẤP</div>':''}</div></div>
      <div style="margin-top:6px;font-size:12px;color:#374151">${esc(r.risk_reason||'')}</div></div>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px">
      <div style="font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;margin-bottom:5px">🚩 Red Flags</div>
      <ul style="margin:0;padding-left:14px">${(r.red_flags||[]).map(f=>`<li style="font-size:12px;margin:2px 0;color:#78350f">${esc(f)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Không phát hiện</li>'}</ul>
    </div></div>`;

  // Phụ mẫu hóa
  if (pf.detected) {
    h += `<div style="background:#faf5ff;border:1.5px solid #c084fc;border-radius:8px;padding:10px 14px;margin-bottom:10px">
      <div style="font-weight:800;color:#7c3aed;margin-bottom:4px">⚡ PHỤ MẪU HÓA — ${esc(pf.type||'')}</div>
      <div style="font-size:12.5px;color:#4c1d95">${esc(pf.description||'')}</div></div>`;
  }

  // Nhu cầu vs Yêu cầu
  h += _secHead('📌','II.','NHU CẦU vs YÊU CẦU','#1e40af');
  h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#1e40af;margin-bottom:5px">NHU CẦU (khách quan)</div>
      <div style="display:flex;flex-wrap:wrap;gap:2px">${(nw.needs||[]).map(n=>_chip(n,'#1e40af')).join('')||'<span style="color:#9ca3af;font-style:italic;font-size:11px">Chưa xác định</span>'}</div></div>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#c2410c;margin-bottom:5px">YÊU CẦU (chủ quan)</div>
      <div style="display:flex;flex-wrap:wrap;gap:2px">${(nw.wants||[]).map(w=>_chip(w,'#c2410c')).join('')||'<span style="color:#9ca3af;font-style:italic;font-size:11px">Chưa thu thập</span>'}</div></div></div>`;

  // Độ tin cậy
  if (dr.length) {
    h += _secHead('🔍','III.','ĐỘ TIN CẬY DỮ LIỆU','#059669');
    h += `<div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:10px;margin-bottom:10px">`;
    dr.forEach(d => {
      h+=`<div style="display:flex;gap:7px;margin-bottom:5px;padding:4px 8px;background:#fff;border-radius:5px;border:1px solid #e5e7eb">
        <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:8px;${d.type==='sự kiện'?'background:#dcfce7;color:#166534':'background:#fef3c7;color:#92400e'};flex-shrink:0">${esc(d.type)}</span>
        <div style="font-size:12px;flex:1">"${esc(d.content)}"${d.note?`<div style="color:#0d9488;font-size:11px;margin-top:1px">→ ${esc(d.note)}</div>`:''}</div></div>`;
    });
    h += `</div>`;
  }

  // Gợi ý can thiệp
  h += _secHead('🎯','IV.','GỢI Ý CAN THIỆP','#7c3aed');
  h += `<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px;margin-bottom:10px">`;
  (r.suggestions||[]).sort((a,b)=>(a.priority||9)-(b.priority||9)).forEach((s,i)=>{
    h+=`<div style="display:flex;gap:8px;padding:7px 8px;background:#fff;border:1px solid #e9d5ff;border-radius:6px;margin-bottom:5px">
      <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0">${i+1}</div>
      <div><div style="font-weight:700;color:#4c1d95;font-size:12px">${esc(s.action)}</div>
      <div style="font-size:11.5px;color:#6b21a8">${esc(s.reason)}</div>
      ${s.who||s.timeline?`<div style="font-size:10.5px;color:#8b5cf6;margin-top:2px">${s.who?'👤 '+esc(s.who):''}${s.timeline?' · ⏱ '+esc(s.timeline):''}</div>`:''}</div></div>`;
  });
  h += `</div>`;

  // Ưu thế + Câu hỏi
  h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#166534;margin-bottom:5px">💪 ƯU THẾ & BẢO VỆ</div>
      <ul style="margin:0;padding-left:13px">${(r.strengths||[]).map(s=>`<li style="font-size:12px;margin:2px 0;color:#14532d">${esc(s)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Chưa xác định</li>'}</ul></div>
    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#6b21a8;margin-bottom:5px">❓ CÂU HỎI CẦN KHAI THÁC</div>
      <ol style="margin:0;padding-left:13px">${(r.next_questions||[]).map(q=>`<li style="font-size:12px;margin:2px 0;color:#4c1d95;font-style:italic">${esc(q)}</li>`).join('')||'<li style="color:#9ca3af">Chưa có</li>'}</ol></div></div>`;

  h += _supervisionNotes(r.supervision_notes);
  h += `</div>`;
  _setReport(h);
}

// ════════════════════
// RENDER GĐ 2 — VÃNG GIA
// ════════════════════
function renderReport2(r) {
  const cb=D?.co_ban||{}, he=r.home_environment||{}, fd=r.family_dynamics||{}, vs=r.vs_stage1||{}, nu=r.needs_updated||{};
  const updColor=r.risk_update==='Tăng'?'#dc2626':r.risk_update==='Giảm'?'#16a34a':'#d97706';
  const updIcon=r.risk_update==='Tăng'?'📈':r.risk_update==='Giảm'?'📉':'➡️';
  let h = `<div style="font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;line-height:1.6;color:#1f2937;width:100%;box-sizing:border-box">`;
  h += _header('Vãng gia & Đánh giá',2,'#0891b2');
  h += _infoTable(cb);
  h += _urgentBanner(r);

  // Cập nhật rủi ro
  h += _secHead('⚠️','I.','CẬP NHẬT MỨC RỦI RO','#dc2626');
  h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <div style="background:${_riskBg(r.risk_current)};border:1.5px solid ${_riskColor(r.risk_current)}44;border-left:4px solid ${_riskColor(r.risk_current)};border-radius:8px;padding:12px">
      <div style="font-size:10px;font-weight:700;color:${_riskColor(r.risk_current)};text-transform:uppercase;margin-bottom:5px">Mức rủi ro hiện tại</div>
      <div style="display:flex;align-items:center;gap:8px"><span style="font-size:24px">${_riskIcon(r.risk_current)}</span>
      <span style="font-size:17px;font-weight:900;color:${_riskColor(r.risk_current)}">${r.risk_current||'?'}</span></div></div>
    <div style="background:#f8fafc;border:1.5px solid ${updColor}44;border-left:4px solid ${updColor};border-radius:8px;padding:12px">
      <div style="font-size:10px;font-weight:700;color:${updColor};text-transform:uppercase;margin-bottom:5px">So với GĐ 1</div>
      <div style="display:flex;align-items:center;gap:6px"><span style="font-size:20px">${updIcon}</span>
      <span style="font-size:15px;font-weight:800;color:${updColor}">${r.risk_update||'?'}</span></div>
      <div style="font-size:11.5px;color:#374151;margin-top:5px">${esc(r.risk_change_reason||'')}</div></div></div>`;

  // Môi trường sống
  h += _secHead('🏠','II.','MÔI TRƯỜNG SỐNG THỰC TẾ','#0891b2');
  const safeColor=he.safety_level==='An toàn'?'#059669':he.safety_level==='Nguy hiểm'?'#dc2626':'#d97706';
  h += `<div style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:8px;padding:10px;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:12px;font-weight:700;color:${safeColor};background:${safeColor}15;padding:3px 10px;border-radius:12px;border:1px solid ${safeColor}33">${he.safety_level||'Chưa đánh giá'}</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div><div style="font-size:10px;font-weight:700;color:#0891b2;margin-bottom:3px">Quan sát chính</div>
      <ul style="margin:0;padding-left:13px">${(he.key_observations||[]).map(o=>`<li style="font-size:12px;color:#374151;margin:2px 0">${esc(o)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Chưa có</li>'}</ul></div>
      <div><div style="font-size:10px;font-weight:700;color:#dc2626;margin-bottom:3px">Mối lo ngại</div>
      <ul style="margin:0;padding-left:13px">${(he.concerns||[]).map(c=>`<li style="font-size:12px;color:#7f1d1d;margin:2px 0">${esc(c)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Không có</li>'}</ul></div></div></div>`;

  // Gia đình
  h += _secHead('👨‍👩‍👧','III.','NĂNG LỰC GIA ĐÌNH & NGƯỜI CHĂM SÓC','#7c3aed');
  const capColor=fd.caregiver_capacity==='Cao'?'#059669':fd.caregiver_capacity==='Thấp'?'#dc2626':'#d97706';
  h += `<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:11px;font-weight:700">Năng lực người chăm sóc:</span>
      <span style="font-size:11px;font-weight:800;color:${capColor};background:${capColor}15;padding:2px 8px;border-radius:10px;border:1px solid ${capColor}33">${fd.caregiver_capacity||'?'}</span></div>
    <div style="font-size:12px;color:#374151;margin-bottom:6px">${esc(fd.relationship_quality||'')}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div><div style="font-size:10px;font-weight:700;color:#059669;margin-bottom:3px">Yếu tố bảo vệ</div>
      <ul style="margin:0;padding-left:13px">${(fd.protective_factors||[]).map(f=>`<li style="font-size:12px;color:#14532d;margin:2px 0">${esc(f)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Chưa xác định</li>'}</ul></div>
      <div><div style="font-size:10px;font-weight:700;color:#dc2626;margin-bottom:3px">Yếu tố nguy cơ</div>
      <ul style="margin:0;padding-left:13px">${(fd.risk_factors||[]).map(f=>`<li style="font-size:12px;color:#7f1d1d;margin:2px 0">${esc(f)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Không có</li>'}</ul></div></div></div>`;

  // So sánh GĐ 1
  h += _secHead('🔄','IV.','SO SÁNH VỚI GĐ 1','#1e40af');
  h += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px">
      <div style="font-size:10px;font-weight:700;color:#166534;margin-bottom:4px">✅ Xác nhận</div>
      <ul style="margin:0;padding-left:12px">${(vs.confirmed||[]).map(c=>`<li style="font-size:11.5px;color:#14532d;margin:2px 0">${esc(c)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic;font-size:11px">Chưa có</li>'}</ul></div>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px">
      <div style="font-size:10px;font-weight:700;color:#1e40af;margin-bottom:4px">🆕 Phát hiện mới</div>
      <ul style="margin:0;padding-left:12px">${(vs.new_findings||[]).map(f=>`<li style="font-size:11.5px;color:#1e3a8a;margin:2px 0">${esc(f)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic;font-size:11px">Không có</li>'}</ul></div>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px">
      <div style="font-size:10px;font-weight:700;color:#dc2626;margin-bottom:4px">⚡ Mâu thuẫn</div>
      <ul style="margin:0;padding-left:12px">${(vs.contradictions||[]).map(c=>`<li style="font-size:11.5px;color:#7f1d1d;margin:2px 0">${esc(c)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic;font-size:11px">Không có</li>'}</ul></div></div>`;

  // Nhu cầu cập nhật + Câu hỏi
  h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#c2410c;margin-bottom:5px">📌 NHU CẦU CẬP NHẬT</div>
      <div style="display:flex;flex-wrap:wrap;gap:2px">${(nu.needs||[]).map(n=>_chip(n,'#0891b2')).join('')||'<span style="color:#9ca3af;font-style:italic;font-size:11px">Như GĐ 1</span>'}</div></div>
    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#6b21a8;margin-bottom:5px">❓ CÂU HỎI CẦN KHAI THÁC</div>
      <ol style="margin:0;padding-left:13px">${(r.next_questions||[]).map(q=>`<li style="font-size:12px;margin:2px 0;color:#4c1d95;font-style:italic">${esc(q)}</li>`).join('')||'<li style="color:#9ca3af">Chưa có</li>'}</ol></div></div>`;

  h += _supervisionNotes(r.supervision_notes);
  h += `</div>`;
  _setReport(h);
}

// ════════════════════
// RENDER GĐ 3 — KẾ HOẠCH
// ════════════════════
function renderReport3(r) {
  const cb=D?.co_ban||{}, pa=r.plan_assessment||{}, rr=r.resources_review||{};
  const feasColor=pa.feasibility==='Cao'?'#059669':pa.feasibility==='Thấp'?'#dc2626':'#d97706';
  const engColor=r.family_engagement==='Tốt'?'#059669':r.family_engagement==='Yếu'?'#dc2626':'#d97706';
  let h = `<div style="font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;line-height:1.6;color:#1f2937;width:100%;box-sizing:border-box">`;
  h += _header('Kế hoạch can thiệp',3,'#7c3aed');
  h += _infoTable(cb);

  // Tổng quan kế hoạch
  h += _secHead('📋','I.','ĐÁNH GIÁ KẾ HOẠCH','#7c3aed');
  h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <div style="background:#faf5ff;border:1.5px solid #c084fc;border-left:4px solid #7c3aed;border-radius:8px;padding:12px">
      <div style="font-size:10px;font-weight:700;color:#7c3aed;text-transform:uppercase;margin-bottom:5px">Tính khả thi</div>
      <div style="font-size:18px;font-weight:900;color:${feasColor}">${pa.feasibility||'?'}</div>
      <div style="margin-top:6px">
        <div style="font-size:10px;font-weight:700;color:#059669;margin-bottom:3px">Điểm mạnh</div>
        <ul style="margin:0;padding-left:13px">${(pa.strengths||[]).map(s=>`<li style="font-size:12px;color:#14532d;margin:2px 0">${esc(s)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Chưa có</li>'}</ul></div></div>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px">
      <div style="font-size:10px;font-weight:700;color:#dc2626;text-transform:uppercase;margin-bottom:5px">Khoảng trống & Rủi ro</div>
      <div style="margin-bottom:6px">
        <div style="font-size:10px;font-weight:700;color:#d97706;margin-bottom:3px">Khoảng trống</div>
        <ul style="margin:0;padding-left:13px">${(pa.gaps||[]).map(g=>`<li style="font-size:12px;color:#78350f;margin:2px 0">${esc(g)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Không có</li>'}</ul></div>
      <div><div style="font-size:10px;font-weight:700;color:#dc2626;margin-bottom:3px">Rủi ro</div>
      <ul style="margin:0;padding-left:13px">${(pa.risks||[]).map(r2=>`<li style="font-size:12px;color:#7f1d1d;margin:2px 0">${esc(r2)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Không có</li>'}</ul></div></div></div>`;

  // Review từng mục tiêu
  h += _secHead('🎯','II.','NHẬN XÉT TỪNG MỤC TIÊU','#1e40af');
  h += `<div style="margin-bottom:10px">`;
  (r.goals_review||[]).forEach((g,i) => {
    const gc=g.realistic?'#059669':'#dc2626';
    h+=`<div style="display:flex;gap:8px;padding:8px 10px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:5px">
      <span style="font-size:11px;font-weight:800;color:${gc};background:${gc}15;padding:2px 8px;border-radius:8px;border:1px solid ${gc}33;flex-shrink:0;height:fit-content">${g.realistic?'✅ Khả thi':'⚠️ Cần xem lại'}</span>
      <div><div style="font-size:12px;font-weight:600;color:#374151">${esc(g.goal||'')}</div>
      <div style="font-size:11.5px;color:#6b7280;margin-top:2px">${esc(g.comment||'')}</div></div></div>`;
  });
  if (!(r.goals_review||[]).length) h += `<div style="color:#9ca3af;font-style:italic;font-size:12px;padding:8px">Chưa có mục tiêu</div>`;
  h += `</div>`;

  // Nguồn lực
  h += _secHead('💡','III.','NGUỒN LỰC','#059669');
  h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#166534;margin-bottom:4px">✅ Có sẵn</div>
      <ul style="margin:0;padding-left:13px">${(rr.available||[]).map(a=>`<li style="font-size:12px;color:#14532d;margin:2px 0">${esc(a)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Chưa xác định</li>'}</ul></div>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#dc2626;margin-bottom:4px">❌ Còn thiếu</div>
      <ul style="margin:0;padding-left:13px">${(rr.missing||[]).map(m=>`<li style="font-size:12px;color:#7f1d1d;margin:2px 0">${esc(m)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Không có</li>'}</ul></div></div>`;

  // Tham gia gia đình + Timeline
  h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#475569;margin-bottom:5px">👨‍👩‍👧 THAM GIA GIA ĐÌNH</div>
      <span style="font-size:14px;font-weight:800;color:${engColor}">${r.family_engagement||'?'}</span></div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#475569;margin-bottom:5px">⏱ ĐÁNH GIÁ THỜI GIAN</div>
      <div style="font-size:12px;color:#374151">${esc(r.timeline_assessment||'Chưa đánh giá')}</div></div></div>`;

  // Câu hỏi
  h += `<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px;margin-bottom:10px">
    <div style="font-size:10px;font-weight:700;color:#6b21a8;margin-bottom:5px">❓ CÂU HỎI CẦN LÀM RÕ</div>
    <ol style="margin:0;padding-left:13px">${(r.next_questions||[]).map(q=>`<li style="font-size:12px;margin:2px 0;color:#4c1d95;font-style:italic">${esc(q)}</li>`).join('')||'<li style="color:#9ca3af">Chưa có</li>'}</ol></div>`;

  h += _supervisionNotes(r.supervision_notes);
  h += `</div>`;
  _setReport(h);
}

// ════════════════════
// RENDER GĐ 4 — TIẾN TRÌNH
// ════════════════════
function renderReport4(r) {
  const cb=D?.co_ban||{}, wb=r.child_wellbeing||{}, ns=r.next_session||{}, pa=r.plan_adjustment||{};
  function wbColor(v){return v==='Cải thiện'?'#059669':v==='Xấu hơn'?'#dc2626':'#d97706';}
  function wbIcon(v){return v==='Cải thiện'?'📈':v==='Xấu hơn'?'📉':'➡️';}
  let h = `<div style="font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;line-height:1.6;color:#1f2937;width:100%;box-sizing:border-box">`;
  h += _header('Cập nhật tiến trình',4,'#d97706');
  h += _infoTable(cb);
  h += _urgentBanner(r);

  // Tóm tắt tiến trình
  h += _secHead('📊','I.','TÓM TẮT TIẾN TRÌNH','#d97706');
  h += `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px;margin-bottom:10px;font-size:12.5px;color:#374151">${esc(r.progress_summary||'Chưa có tóm tắt')}</div>`;

  // Wellbeing 3 lĩnh vực
  // Trend wellbeing qua nhiều buổi
  const wbHistory = (D._notes_stage4||[]).length;
  if (wbHistory > 1) {
    h += _secHead('📊','II.','WELLBEING TREND (' + wbHistory + ' buổi)','#059669');
    h += '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:10px;margin-bottom:10px;font-size:11px;color:#065f46">';
    h += '📈 Đã theo dõi qua <strong>' + wbHistory + ' buổi</strong>. ';
    const wbVal = {physical:wb.physical,psychological:wb.psychological,education:wb.education};
    const improved = Object.entries(wbVal).filter(([k,v])=>v==='Cải thiện').map(([k])=>({'physical':'Thể chất','psychological':'Tâm lý','education':'Giáo dục'}[k]));
    const worse = Object.entries(wbVal).filter(([k,v])=>v==='Xấu hơn').map(([k])=>({'physical':'Thể chất','psychological':'Tâm lý','education':'Giáo dục'}[k]));
    if (improved.length) h += '✅ Cải thiện: <strong>' + improved.join(', ') + '</strong>. ';
    if (worse.length) h += '⚠️ Xấu hơn: <strong>' + worse.join(', ') + '</strong> — cần điều chỉnh kế hoạch. ';
    if (!improved.length && !worse.length) h += 'Ổn định — tiếp tục theo dõi.';
    h += '</div>';
  } else {
    h += _secHead('💚','II.','WELLBEING CHECK','#059669');
  }
  h += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">`;
  [['Thể chất','physical','🏃'],['Tâm lý','psychological','🧠'],['Giáo dục','education','📚']].forEach(([lbl,key,icon])=>{
    const val=wb[key]||'Ổn định';
    const c=wbColor(val);
    h+=`<div style="background:${c}0d;border:1.5px solid ${c}33;border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:18px;margin-bottom:3px">${icon}</div>
      <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:4px">${lbl}</div>
      <div style="font-size:11px;font-weight:800;color:${c}">${wbIcon(val)} ${val}</div></div>`;
  });
  h += `</div>`;

  // Tiến độ từng mục tiêu
  h += _secHead('🎯','III.','TIẾN ĐỘ MỤC TIÊU','#1e40af');
  h += `<div style="margin-bottom:10px">`;
  (r.goals_progress||[]).forEach(g => {
    const statusColor={'Đạt':'#059669','Đang tiến hành':'#d97706','Chưa đạt':'#dc2626','Bỏ qua':'#6b7280'}[g.status]||'#6b7280';
    const statusIcon={'Đạt':'✅','Đang tiến hành':'🔄','Chưa đạt':'❌','Bỏ qua':'⏭'}[g.status]||'•';
    h+=`<div style="padding:8px 10px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:5px;border-left:3px solid ${statusColor}">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">
        <span style="font-size:10px;font-weight:700;color:${statusColor};background:${statusColor}15;padding:2px 7px;border-radius:8px">${statusIcon} ${g.status||'?'}</span>
        <span style="font-size:12px;font-weight:600;color:#374151">${esc(g.goal||'')}</span></div>
      ${g.evidence?`<div style="font-size:11.5px;color:#059669;margin-bottom:2px">📌 Bằng chứng: ${esc(g.evidence)}</div>`:''}
      ${g.comment?`<div style="font-size:11.5px;color:#6b7280">${esc(g.comment)}</div>`:''}</div>`;
  });
  if (!(r.goals_progress||[]).length) h += `<div style="color:#9ca3af;font-style:italic;font-size:12px;padding:8px">Chưa có dữ liệu mục tiêu</div>`;
  h += `</div>`;

  // Thay đổi tích cực + Rào cản
  h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#166534;margin-bottom:5px">✨ THAY ĐỔI TÍCH CỰC</div>
      <ul style="margin:0;padding-left:13px">${(r.positive_changes||[]).map(c=>`<li style="font-size:12px;color:#14532d;margin:2px 0">${esc(c)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Chưa ghi nhận</li>'}</ul></div>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#dc2626;margin-bottom:5px">🚧 RÀO CẢN</div>
      <ul style="margin:0;padding-left:13px">${(r.barriers||[]).map(b=>`<li style="font-size:12px;color:#7f1d1d;margin:2px 0">${esc(b)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Không có</li>'}</ul></div></div>`;

  // Điều chỉnh kế hoạch
  if (pa.needed) {
    h += `<div style="background:#fffbeb;border:1.5px solid #fde047;border-radius:8px;padding:10px;margin-bottom:10px">
      <div style="font-size:10px;font-weight:700;color:#854d0e;margin-bottom:5px">🔄 CẦN ĐIỀU CHỈNH KẾ HOẠCH</div>
      <ul style="margin:0;padding-left:13px">${(pa.suggestions||[]).map(s=>`<li style="font-size:12px;color:#713f12;margin:2px 0">${esc(s)}</li>`).join('')||'<li style="color:#9ca3af">Chưa có đề xuất</li>'}</ul></div>`;
  }

  // Buổi tiếp theo
  h += _secHead('📅','IV.','ĐỊNH HƯỚNG BUỔI TIẾP THEO','#7c3aed');
  h += `<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px;margin-bottom:10px">
    <div style="font-size:12.5px;font-weight:600;color:#4c1d95;margin-bottom:6px">${esc(ns.focus||'Chưa xác định')}</div>
    <ul style="margin:0;padding-left:13px">${(ns.actions||[]).map(a=>`<li style="font-size:12px;color:#6b21a8;margin:2px 0">${esc(a)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Chưa có</li>'}</ul></div>`;

  h += _supervisionNotes(r.supervision_notes);
  h += `</div>`;
  _setReport(h);
}

// ════════════════════
// RENDER GĐ 5 — KẾT THÚC CA
// ════════════════════
function renderReport5(r) {
  const cb=D?.co_ban||{}, oc=r.outcomes||{}, cs=r.child_status_final||{}, rec=r.recommendations||{};
  const rateColor=oc.achievement_rate==='Cao'?'#059669':oc.achievement_rate==='Thấp'?'#dc2626':'#d97706';
  const safeColor=cs.safety==='An toàn'?'#059669':'#d97706';
  let h = `<div style="font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;line-height:1.6;color:#1f2937;width:100%;box-sizing:border-box">`;
  h += _header('Kết thúc ca',5,'#059669');
  h += _infoTable(cb);

  // Tóm tắt ca
  h += _secHead('📋','I.','TÓM TẮT TOÀN CA','#059669');
  h += `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:10px;margin-bottom:10px;font-size:12.5px;color:#374151">${esc(r.case_summary||'Chưa có tóm tắt')}</div>`;

  // Kết quả
  h += _secHead('🏆','II.','KẾT QUẢ ĐẠT ĐƯỢC','#059669');
  h += `<div style="margin-bottom:6px;display:flex;align-items:center;gap:8px">
    <span style="font-size:11px;font-weight:700;color:#475569">Tỉ lệ đạt mục tiêu:</span>
    <span style="font-size:13px;font-weight:900;color:${rateColor}">${oc.achievement_rate||'?'}</span></div>`;
  h += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px">
      <div style="font-size:10px;font-weight:700;color:#166534;margin-bottom:4px">✅ Đạt được</div>
      <ul style="margin:0;padding-left:12px">${(oc.achieved||[]).map(a=>`<li style="font-size:12px;color:#14532d;margin:2px 0">${esc(a)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Chưa có</li>'}</ul></div>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px">
      <div style="font-size:10px;font-weight:700;color:#92400e;margin-bottom:4px">⚡ Đạt một phần</div>
      <ul style="margin:0;padding-left:12px">${(oc.partial||[]).map(p=>`<li style="font-size:12px;color:#78350f;margin:2px 0">${esc(p)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Không có</li>'}</ul></div>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px">
      <div style="font-size:10px;font-weight:700;color:#dc2626;margin-bottom:4px">❌ Chưa đạt</div>
      <ul style="margin:0;padding-left:12px">${(oc.not_achieved||[]).map(n=>`<li style="font-size:12px;color:#7f1d1d;margin:2px 0">${esc(n)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Không có</li>'}</ul></div></div>`;

  // Tình trạng trẻ khi đóng ca
  h += _secHead('👧','III.','TÌNH TRẠNG TRẺ KHI ĐÓNG CA','#0891b2');
  h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <div style="background:#ecfeff;border:1.5px solid ${safeColor}44;border-left:4px solid ${safeColor};border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:${safeColor};text-transform:uppercase;margin-bottom:4px">Mức độ an toàn</div>
      <div style="font-size:16px;font-weight:900;color:${safeColor}">${cs.safety==='An toàn'?'✅':'⚠️'} ${cs.safety||'?'}</div></div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:4px">Wellbeing tổng thể</div>
      <div style="font-size:14px;font-weight:800;color:#374151">${cs.wellbeing||'?'}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:3px">${esc(cs.family_situation||'')}</div></div></div>`;

  // Điểm ngoặt + Bài học
  h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#7c3aed;margin-bottom:5px">⭐ ĐIỂM NGOẶT QUAN TRỌNG</div>
      <ul style="margin:0;padding-left:13px">${(r.key_turning_points||[]).map(t=>`<li style="font-size:12px;color:#4c1d95;margin:2px 0">${esc(t)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Chưa ghi nhận</li>'}</ul></div>
    <div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#854d0e;margin-bottom:5px">📚 BÀI HỌC KINH NGHIỆM</div>
      <ul style="margin:0;padding-left:13px">${(r.lessons_learned||[]).map(l=>`<li style="font-size:12px;color:#713f12;margin:2px 0">${esc(l)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Chưa có</li>'}</ul></div></div>`;

  // Khuyến nghị
  h += _secHead('💡','IV.','KHUYẾN NGHỊ','#1e40af');
  h += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#1e40af;margin-bottom:4px">👧 Cho trẻ</div>
      <ul style="margin:0;padding-left:12px">${(rec.for_child||[]).map(r2=>`<li style="font-size:12px;color:#1e3a8a;margin:2px 0">${esc(r2)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Không có</li>'}</ul></div>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#166534;margin-bottom:4px">👨‍👩‍👧 Cho gia đình</div>
      <ul style="margin:0;padding-left:12px">${(rec.for_family||[]).map(r2=>`<li style="font-size:12px;color:#14532d;margin:2px 0">${esc(r2)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Không có</li>'}</ul></div>
    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px">
      <div style="font-size:10px;font-weight:700;color:#7c3aed;margin-bottom:4px">🏢 Cho tổ chức</div>
      <ul style="margin:0;padding-left:12px">${(rec.for_organization||[]).map(r2=>`<li style="font-size:12px;color:#4c1d95;margin:2px 0">${esc(r2)}</li>`).join('')||'<li style="color:#9ca3af;font-style:italic">Không có</li>'}</ul></div></div>`;

  // Theo dõi sau đóng ca
  if (r.follow_up_needed) {
    h += `<div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:8px;padding:10px;margin-bottom:10px">
      <div style="font-size:10px;font-weight:700;color:#dc2626;margin-bottom:5px">📌 CẦN THEO DÕI SAU ĐÓNG CA</div>
      <div style="font-size:12.5px;color:#7f1d1d">${esc(r.follow_up_plan||'Chưa có kế hoạch cụ thể')}</div></div>`;
  }

  h += _supervisionNotes(r.supervision_notes);
  h += `</div>`;
  _setReport(h);
}

function renderEntriesPanel() {
  const panel = document.getElementById('entries-panel');
  if (!panel) return;
  const cases = loadCases();
  const c = curCaseId ? cases[curCaseId] : null;
  const entries = c?.entries || [];

  // Cập nhật label toggle header
  const toggleCount = document.getElementById('entries-toggle-count');
  if (toggleCount) {
    toggleCount.textContent = entries.length
      ? `Lịch sử ghi chép · ${entries.length} lần`
      : 'Lịch sử ghi chép';
  }

  if (!entries.length && !D) {
    panel.innerHTML = `<div id="entries-empty" style="text-align:center;padding:28px 16px;color:var(--t3);">
      <div style="font-size:28px;margin-bottom:8px;opacity:.4">📋</div>
      <div style="font-size:12.5px;font-weight:700;color:var(--t2);margin-bottom:4px">Chưa có ghi chép</div>
      <div style="font-size:11.5px">Nhập ghi chép và nhấn <strong>Phân tích</strong></div>
    </div>`;
    return;
  }

  const stageNames = ['','Tiếp cận','Vãng gia','Kế hoạch','Tiến trình','Kết thúc'];
  const sorted = [...entries].reverse();

  panel.innerHTML = `
    ${sorted.map((e, i) => {
      const realIdx = entries.length - 1 - i;
      const stageLabel = stageNames[e.stage || 1] || 'GĐ ' + (e.stage || 1);
      const preview = (e.notes || '').replace(/\n+/g, ' ').substring(0, 100);
      const isLatest = i === 0;
      return `<div class="entry-card${isLatest ? ' active-entry' : ''}" id="ecard-${realIdx}">
        <div class="entry-card-stage">GĐ ${e.stage || 1} — ${stageLabel}</div>
        <div class="entry-card-date">${fmtVN(e.date)}</div>
        <div class="entry-card-preview">${esc(preview)}${(e.notes||'').length > 100 ? '…' : ''}</div>
        <div class="entry-card-actions">
          <button class="btn-entry-load" onclick="loadEntryToEditor(${realIdx})">✏️ Sửa / dùng lại</button>
          <button class="btn-entry-del" onclick="deleteEntry(${realIdx})">🗑</button>
        </div>
      </div>`;
    }).join('')}`;
}

function loadEntryToEditor(idx) {
  const cases = loadCases();
  const c = curCaseId ? cases[curCaseId] : null;
  if (!c?.entries?.[idx]) return;
  const entry = c.entries[idx];

  // Restore notes into textarea
  const ta = document.getElementById('dash-notes');
  if (ta) {
    ta.value = entry.notes || '';
    document.getElementById('dash-cc').textContent = (entry.notes || '').length + ' ký tự';
  }

  // Restore stage if different
  if (entry.stage && entry.stage !== currentStage) {
    currentStage = entry.stage;
    updateStageUI();
  }

  // Restore analysis data if available
  if (entry.analysis) {
    D = entry.analysis;
    document.getElementById('btn-fill').disabled = false;
    document.getElementById('chat-input').disabled = false;
    document.getElementById('btn-send').disabled = false;
    if (D._report) renderReport(D._report);
  }

  // Highlight active entry
  document.querySelectorAll('.entry-card').forEach(el => el.classList.remove('active-entry'));
  const card = document.getElementById('ecard-' + idx);
  if (card) card.classList.add('active-entry');

  switchMain('dash');
  showNotif(`📂 Đã tải ghi chép GĐ ${entry.stage || 1} — ${fmtVN(entry.date)}`);
}

function deleteEntry(idx) {
  if (!confirm('Xóa ghi chép này?')) return;
  const cases = loadCases();
  const c = curCaseId ? cases[curCaseId] : null;
  if (!c?.entries) return;
  c.entries.splice(idx, 1);
  c.updatedAt = new Date().toISOString();
  cases[curCaseId] = c;
  saveCases(cases);
  renderEntriesPanel();
  showNotif('🗑 Đã xóa ghi chép');
}

// ── TEMPLATE PANEL (gợi ý câu hỏi) ──
function toggleTemplate() {
  _tplOpen = !_tplOpen;
  _renderTemplate();
}

function _renderTemplate() {
  const panel = document.getElementById('tpl-panel');
  const btn   = document.getElementById('tpl-toggle-btn');
  if (!panel) return;
  if (!_tplOpen) {
    panel.style.display = 'none';
    if (btn) { btn.classList.remove('open'); btn.textContent = '💡 Gợi ý câu hỏi'; }
    return;
  }
  const tpl = STAGE_TEMPLATES[currentStage];
  if (!tpl) { panel.style.display = 'none'; return; }
  if (btn) { btn.classList.add('open'); btn.textContent = '✕ Đóng gợi ý'; }
  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="tpl-title">${tpl.title}</div>
    ${tpl.items.map(q => `<div class="tpl-item" onclick="insertTemplate(${JSON.stringify(q)})"><span class="tpl-item-ico">＋</span><span class="tpl-item-text">${esc(q)}</span></div>`).join('')}
    <div class="tpl-actions">
      <button class="tpl-use-all" onclick="insertAllTemplate()">↓ Chèn tất cả</button>
      <button class="tpl-clear" onclick="clearNotes()">🗑 Xóa textarea</button>
    </div>`;
}

function insertTemplate(q) {
  const ta = document.getElementById('dash-notes');
  if (!ta || ta.disabled) return;
  const sep = ta.value && !ta.value.endsWith('\n') ? '\n' : '';
  ta.value += sep + '— ' + q + '\n';
  ta.dispatchEvent(new Event('input'));
  ta.focus();
}

function insertAllTemplate() {
  const tpl = STAGE_TEMPLATES[currentStage];
  if (!tpl) return;
  const ta = document.getElementById('dash-notes');
  if (!ta || ta.disabled) return;
  const sep = ta.value && !ta.value.endsWith('\n') ? '\n' : '';
  ta.value += sep + tpl.items.map(q => '— ' + q).join('\n') + '\n';
  ta.dispatchEvent(new Event('input'));
  ta.focus();
}

function clearNotes() {
  const ta = document.getElementById('dash-notes');
  if (ta) { ta.value = ''; ta.dispatchEvent(new Event('input')); }
}

// toggleFormSidebar — toggle class on .forms-tab for CSS grid collapse
let sidebarVisible = window.innerWidth > 768;
function toggleFormSidebar() {
  sidebarVisible = !sidebarVisible;
  const tab = document.querySelector('.forms-tab');
  const btn = document.getElementById('sidebar-toggle');
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    // Mobile: overlay sidebar, hidden by default
    if (tab) tab.classList.toggle('sidebar-shown', sidebarVisible);
  } else {
    // Desktop: sidebar visible by default
    if (tab) tab.classList.toggle('sidebar-hidden', !sidebarVisible);
  }
  if (btn) btn.textContent = sidebarVisible ? '☰' : '▶';
}
// Reset sidebar state on resize
window.addEventListener('resize', () => {
  const isMobile = window.innerWidth <= 768;
  const tab = document.querySelector('.forms-tab');
  if (!tab) return;
  if (!isMobile) {
    tab.classList.remove('sidebar-shown');
    if (!sidebarVisible) tab.classList.add('sidebar-hidden');
  } else {
    tab.classList.remove('sidebar-hidden');
    if (!sidebarVisible) tab.classList.remove('sidebar-shown');
  }
});

// ════════════════════════════════════════════════════════════
// CHAT
// ════════════════════════════════════════════════════════════
// ── QUICK SUGGESTIONS theo giai đoạn ──
const STAGE_SUGGESTIONS = {
  1: [
    {icon:'🤝', text:'Cách tạo rapport với trẻ/gia đình?'},
    {icon:'👀', text:'Những dấu hiệu cần quan sát khi tiếp cận?'},
    {icon:'📋', text:'Thông tin nào cần thu thập đầu tiên?'},
    {icon:'⚠️', text:'Dấu hiệu nguy hiểm cần can thiệp khẩn?'},
    {icon:'🗣️', text:'Kỹ thuật phỏng vấn trẻ em?'},
  ],
  2: [
    {icon:'🏠', text:'Cần quan sát gì khi vãng gia?'},
    {icon:'📊', text:'Hướng dẫn vẽ eco-map / genogram?'},
    {icon:'🔍', text:'Cách đánh giá mức độ rủi ro?'},
    {icon:'💡', text:'Phân biệt nhu cầu vs yêu cầu?'},
    {icon:'👨‍👩‍👧', text:'Đánh giá năng lực chăm sóc của gia đình?'},
    {icon:'📝', text:'Gợi ý câu hỏi phỏng vấn gia đình?'},
  ],
  3: [
    {icon:'🎯', text:'Hướng dẫn đặt mục tiêu SMART?'},
    {icon:'🔗', text:'Nguồn lực nào có thể kết nối cho ca này?'},
    {icon:'📅', text:'Gợi ý timeline can thiệp hợp lý?'},
    {icon:'⚖️', text:'Ưu tiên nhu cầu nào trước?'},
    {icon:'🤝', text:'Cách phối hợp đa ngành cho ca này?'},
  ],
  4: [
    {icon:'📈', text:'Ca này đang tiến triển thế nào?'},
    {icon:'🔄', text:'Khi nào cần điều chỉnh kế hoạch?'},
    {icon:'⚠️', text:'Dấu hiệu ca đang đi sai hướng?'},
    {icon:'📝', text:'Cách ghi nhận thay đổi của trẻ?'},
    {icon:'💪', text:'Đánh giá kết quả trung gian?'},
  ],
  5: [
    {icon:'✅', text:'Tiêu chí đóng ca là gì?'},
    {icon:'📋', text:'Cần chuẩn bị gì để kết thúc ca?'},
    {icon:'🔄', text:'Kế hoạch theo dõi sau kết thúc?'},
    {icon:'📤', text:'Khi nào cần chuyển gửi?'},
    {icon:'📊', text:'Tổng kết kết quả ca này?'},
  ]
};

const GENERAL_SUGGESTIONS = [
  {icon:'📖', text:'Quy trình quản lý ca CTXH gồm những bước nào?'},
  {icon:'👶', text:'Luật trẻ em 2016 quy định gì về bảo vệ trẻ?'},
  {icon:'🤝', text:'Kỹ thuật tạo rapport với thân chủ?'},
  {icon:'📋', text:'Cách viết ghi chép ca CTXH chuyên nghiệp?'},
  {icon:'🔍', text:'Công cụ đánh giá rủi ro cho trẻ em?'},
];

function renderSuggestions() {
  const el = document.getElementById('chat-suggestions');
  if (!el) return;
  let sug, label;
  if (D) {
    sug = STAGE_SUGGESTIONS[currentStage] || STAGE_SUGGESTIONS[1];
    const stageLabel = ['','Tiếp cận','Vãng gia','Kế hoạch','Tiến trình','Kết thúc'][currentStage] || '';
    label = `💡 Gợi ý GĐ${currentStage} — ${stageLabel}:`;
  } else {
    sug = GENERAL_SUGGESTIONS;
    label = '💡 Hỏi chuyên gia CTXH:';
  }
  el.innerHTML = `<div class="chat-sug-label">${label}</div>` +
    sug.map(s => `<button class="chat-sug-btn" onclick="useSuggestion('${s.text.replace(/'/g,"\\\'")}')">${s.icon} ${s.text}</button>`).join('');
  el.style.display = 'flex';
}

function useSuggestion(text) {
  const input = document.getElementById('chat-input');
  input.value = text;
  sendChat();
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  const el = document.getElementById('chat-msgs');
  el.innerHTML += `<div class="cb cb-user">${esc(msg)}</div>`;
  const typId = 'typ_'+Date.now();
  el.innerHTML += `<div class="cb cb-ai" id="${typId}"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
  el.scrollTop = el.scrollHeight;
  document.getElementById('btn-send').disabled = true;

  chatHistory.push({role:'user',content:msg});
  const stageLabel = ['','Tiếp cận ban đầu','Vãng gia & Đánh giá','Kế hoạch can thiệp','Tiến trình','Kết thúc ca'][currentStage] || '';
  
  // ── ENHANCED CONTEXT: gửi data nếu có, hoặc chế độ tư vấn chung ──
  let ctx = `\n\nGiai đoạn hiện tại: GĐ ${currentStage} — ${stageLabel}`;
  let sysPrompt = SYS_CHAT;
  if (D) {
    const parts = [];
    if (D.co_ban) parts.push('Thông tin trẻ: ' + JSON.stringify(D.co_ban).substring(0,500));
    if (D.gia_dinh) parts.push('Gia đình: ' + JSON.stringify(D.gia_dinh).substring(0,400));
    if (D.tinh_trang) parts.push('Tình trạng: ' + JSON.stringify(D.tinh_trang).substring(0,300));
    if (D.danh_gia) parts.push('Đánh giá: ' + JSON.stringify(D.danh_gia).substring(0,500));
    if (D.ke_hoach) parts.push('Kế hoạch: ' + JSON.stringify(D.ke_hoach).substring(0,500));
    if (D.vang_gia) parts.push('Vãng gia: ' + JSON.stringify(D.vang_gia).substring(0,400));
    if (D.cap_nhat?.length) parts.push('Cập nhật gần nhất: ' + JSON.stringify(D.cap_nhat.slice(-2)).substring(0,500));
    if (D._report) {
      const r = D._report;
      if (r.risk) parts.push('Rủi ro: ' + JSON.stringify(r.risk).substring(0,300));
      if (r.strengths) parts.push('Điểm mạnh: ' + JSON.stringify(r.strengths).substring(0,300));
      if (r.recommendations) parts.push('Đề xuất: ' + JSON.stringify(r.recommendations).substring(0,300));
    }
    ctx += '\n\nDữ liệu case:\n' + parts.join('\n');
  } else {
    ctx = '\n\n[Chưa có dữ liệu case cụ thể — đang ở chế độ tư vấn chung về CTXH. Hãy trả lời dựa trên kiến thức chuyên môn CTXH, kỹ thuật quản lý ca, luật trẻ em Việt Nam, và kinh nghiệm thực tiễn.]';
  }

  try {
    const ragCtx = await fetchRagContext(msg);
    const reply = await callGroqChat([
      {role:'system',content:SYS_CHAT+ctx+ragCtx},
      ...chatHistory.slice(-10)
    ]);
    chatHistory.push({role:'assistant',content:reply});
    document.getElementById(typId).innerHTML = formatMd(reply);
  } catch(e) {
    document.getElementById(typId).innerHTML = '❌ '+e.message;
  } finally {
    document.getElementById('btn-send').disabled = false;
    el.scrollTop = el.scrollHeight;
  }
}

// ════════════════════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════════════════════
function switchMain(tab) {
  curMain = tab;
  ['dash','forms','cases','analysis'].forEach(t => {
    document.getElementById('panel-'+t)?.classList.toggle('active', t===tab);
    document.getElementById('mnav-'+t)?.classList.toggle('active', t===tab);
  });
  if (tab==='cases') renderCaseList();
  if (tab==='analysis') renderAnalysisPanel();
}

function fillForms() {
  if (!D) return;
  switchMain('forms');
  setTimeout(()=>showForm(0), 50);
}

// ════════════════════════════════════════════════════════════
// FORMS
// ════════════════════════════════════════════════════════════
function restoreFormChecks() {
  if (!D) return;
  const stageFormMap = { 1: [0, 1], 2: [2, 3, 4], 3: [5], 4: [6, 7], 5: [8, 9, 10] };
  for (let s = 1; s <= currentStage; s++) {
    (stageFormMap[s] || []).forEach(fi => {
      const item = document.querySelector(`.form-item[data-fi="${fi}"]`);
      if (item && !item.querySelector('.fi-ck')) {
        const ck = document.createElement('span');
        ck.className = 'fi-ck'; ck.textContent = '✓';
        item.appendChild(ck);
      }
    });
  }
}

function showForm(idx) {
  curForm = idx;
  // Reset edit mode on form switch
  document.getElementById('form-preview')?.classList.remove('fv-edit-mode');
  document.querySelectorAll('.form-item').forEach(el => el.classList.toggle('active', parseInt(el.dataset.fi)===idx));
  const fv = document.getElementById('fv');
  if (!D) {
    fv.innerHTML = '<div style="padding:40px;text-align:center;color:var(--t3);"><div style="font-size:36px;margin-bottom:12px;">📋</div><div style="font-weight:700;margin-bottom:6px;">Chưa có dữ liệu</div><div style="font-size:12px;">Phân tích ghi chép trong tab <strong>Dashboard</strong> trước</div></div>';
    fv.style.display = 'block'; return;
  }
  renderFormTab(idx);
  fv.style.display = 'block';
  fv.style.width = '100%';
  fv.style.maxWidth = 'none';
  fv.style.boxSizing = 'border-box';
  document.getElementById('form-preview').scrollTop = 0;
  const ctx = document.getElementById('fec-ctx');
  if (ctx) ctx.textContent = '— '+FORM_NAMES[idx];
}

function F(lbl, val, ic='-', path='') {
  const s = fmtDate(clean(val));
  const extra = path ? ` fl-editable" onclick="inlineEdit(this,'${path}')" title="Bấm để chỉnh sửa"` : '"';
  return `<div class="fl"><div class="fl-ico">${ic}</div><div class="fl-bd"><div class="fl-lb">${lbl}</div><div class="fl-vl ${s?'ok':'no'}${extra}>${s||'—'}</div></div></div>`;
}

function toggleFvEditMode(idx) {
  const fp = document.getElementById('form-preview');
  if (!fp) return;
  const active = fp.classList.toggle('fv-edit-mode');
  const btn = document.getElementById('btn-fv-edit-'+idx);
  if (btn) {
    btn.textContent = active ? '✓ Xong' : '✏️ Chỉnh sửa';
    btn.classList.toggle('btn-fv-edit-active', active);
  }
  if (active) showNotif('✏️ Chế độ chỉnh sửa — bấm trực tiếp vào trường bất kỳ để sửa', 'ok', 2500);
}

function inlineEdit(el, path) {
  if (!D || !path) return;
  // Only allow editing when edit mode is active
  if (!document.getElementById('form-preview')?.classList.contains('fv-edit-mode')) return;
  if (el.querySelector('input,textarea')) return;
  const cur = el.textContent.trim() === '—' ? '' : el.textContent.trim();
  el.classList.add('fl-editing');
  const long = cur.length > 80 || path.includes('mo_ta') || path.includes('ghi_chu') || path.includes('nhan_xet') || path.includes('hoan_canh') || path.includes('van_de') || path.includes('nhu_cau') || path.includes('uu_the') || path.includes('nguon_luc') || path.includes('cam_ket') || path.includes('yeu_cau');
  const inp = document.createElement(long ? 'textarea' : 'input');
  if (!long) inp.type = 'text'; else { inp.rows = 3; inp.className += ' fl-inline-ta'; }
  inp.value = cur;
  inp.className = (long ? 'fl-inline-ta' : 'fl-inline-input');
  el.textContent = '';
  el.appendChild(inp);
  inp.focus();
  if (!long) inp.select();

  const restore = () => {
    el.classList.remove('fl-editing');
    const v = clean(inp.value);
    setNested(D, path, v);
    el.classList.toggle('ok', !!v);
    el.classList.toggle('no', !v);
    el.textContent = v || '—';
    if (curCaseId) {
      const cases = loadCases();
      const c = cases[curCaseId];
      if (c) { c.lastAnalysis = JSON.parse(JSON.stringify(D)); c.updatedAt = new Date().toISOString(); cases[curCaseId] = c; _cases = cases; }
      if (window._markUnsaved) window._markUnsaved();
      showNotif('✅ Đã cập nhật — nhớ bấm Lưu', 'ok', 2000);
    }
  };

  inp.addEventListener('blur', restore);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); restore(); }
    if (e.key === 'Escape') { el.classList.remove('fl-editing'); el.textContent = cur || '—'; }
  });
}

function Sec(ttl, id, body, ic='📌') {
  const safeTtl = ttl.replace(/'/g, '&apos;').replace(/"/g, '&quot;');
  return `<div class="sec"><div class="sec-hd"><div class="sec-hl"><span class="sec-ico">${ic}</span>${ttl}</div><div class="sec-acts"><button class="btn-cp" onclick="navigator.clipboard.writeText(document.getElementById('${id}').innerText).then(()=>{this.textContent='✓';setTimeout(()=>this.textContent='Copy',1400)}).catch(()=>{})">Copy</button></div></div><div class="sec-bd" id="${id}">${body}</div></div>`;
}

function Dv(t) { return `<div class="dv">${t}</div>`; }

function TBL(hs, rows) {
  return `<table class="tbl"><thead><tr>${hs.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${fmtDate(clean(String(c||'')))||'—'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function renderFormTab(idx) {
  const cb=D.co_ban||{},gd=D.gia_dinh||{},tt=D.tinh_trang||{},dg=D.danh_gia||{},vg=D.vang_gia||{},kh=D.ke_hoach||{},ktu=D.ket_thuc||{};
  const ncs=gd.nguoi_cham_soc||{},hv=tt.hoc_van||{},sk=tt.suc_khoe||{},tl=tt.tam_ly||{};
  const gks=tt.giay_khai_sinh||{},tr=tt.thuong_tru||{},cc=tt.cccd||{};
  const nlxh=D.nguon_luc_xa_hoi||{},cg=D.chuyen_gui||{};
  const _d=new Date(),mo=_d.getMonth()+1,yr=_d.getFullYear();
  const todayFmtH=String(_d.getDate()).padStart(2,'0')+'/'+String(mo).padStart(2,'0')+'/'+yr;

  let h = `<div class="fv-header">
    <div class="fv-title-block">
      <div class="fv-ttl">${FORM_NAMES[idx]}</div>
      <div class="fv-meta">Mã: DADH2025/00001 &nbsp;|&nbsp; TĐ-00020 &nbsp;|&nbsp; ${todayFmtH}</div>
      <div class="fv-badges">
        <span class="fv-badge">✓ v16</span>
        <span class="fv-badge-stage">GĐ ${currentStage}</span>
      </div>
    </div>
    <div class="fv-acts">
      <button class="btn-fv-edit" id="btn-fv-edit-${idx}" onclick="toggleFvEditMode(${idx})">✏️ Chỉnh sửa</button>
      <button class="btn-fv-save" onclick="saveCaseNow()">💾 Lưu ca</button>
      <button class="btn-dl-docx" onclick="dlDocx(${idx})">⬇ .docx</button>
    </div>
  </div>`;

  if (idx===0) {
    h+=Sec("A. Thông tin trẻ","s0a",
      F("Ngày tiếp cận",cb.ngay_tiep_can,'-','co_ban.ngay_tiep_can')+F("Nơi tiếp cận",cb.noi_tiep_can,'-','co_ban.noi_tiep_can')+F("Người tiếp cận",cb.nguoi_tiep_can,'-','co_ban.nguoi_tiep_can')+
      F("Họ tên trẻ",cb.ho_ten,'-','co_ban.ho_ten')+F("Giới tính",cb.gioi_tinh,'-','co_ban.gioi_tinh')+F("Năm sinh",cb.ngay_sinh,'-','co_ban.ngay_sinh')+F("Tuổi",cb.tuoi,'-','co_ban.tuoi')+
      F("SĐT trẻ",cb.sdt_tre,'-','co_ban.sdt_tre')+F("SĐT người thân",cb.sdt_nguoi_than,'-','co_ban.sdt_nguoi_than')+F("Địa chỉ thường trú",cb.dia_chi_thuong_tru,'-','co_ban.dia_chi_thuong_tru')+F("Địa chỉ hiện tại",cb.dia_chi_hien_tai,'-','co_ban.dia_chi_hien_tai')+
      F("Sống với",cb.song_voi,'-','co_ban.song_voi')+F("Nhóm trẻ",cb.nhom_tre,'-','co_ban.nhom_tre'));
    const tvR=(gd.thanh_vien||[]).map(tv=>[tv.ho_ten,tv.quan_he,tv.nam_sinh,tv.suc_khoe,tv.nghe_nghiep,tv.ghi_chu]);
    h+=Sec("B. Thông tin gia đình","s0b",
      Dv("Người chăm sóc chính")+F("Họ tên",ncs.ho_ten,'-','gia_dinh.nguoi_cham_soc.ho_ten')+F("Quan hệ",ncs.quan_he,'-','gia_dinh.nguoi_cham_soc.quan_he')+F("Năm sinh",ncs.ngay_sinh,'-','gia_dinh.nguoi_cham_soc.ngay_sinh')+F("SĐT",ncs.sdt,'-','gia_dinh.nguoi_cham_soc.sdt')+F("Nghề nghiệp",ncs.nghe_nghiep,'-','gia_dinh.nguoi_cham_soc.nghe_nghiep')+F("Sức khỏe",ncs.suc_khoe,'-','gia_dinh.nguoi_cham_soc.suc_khoe')+
      Dv("Thành viên gia đình")+TBL(["Họ tên","Quan hệ","Năm sinh","SK","Nghề nghiệp","Ghi chú"],tvR)+
      Dv("Hoàn cảnh gia đình")+F("Loại hình gia đình",gd.loai_hinh,'-','gia_dinh.loai_hinh')+F("Tình trạng hôn nhân",gd.tinh_trang_hon_nhan,'-','gia_dinh.tinh_trang_hon_nhan')+F("Bầu khí gia đình",gd.bau_khi,'-','gia_dinh.bau_khi')+F("Mối quan hệ với trẻ",gd.moi_quan_he_voi_tre,'-','gia_dinh.moi_quan_he_voi_tre')+
      F("Kinh tế/Nhà ở",[cf(gd.kinh_te),cf(gd.nha_o)].filter(Boolean).join(' | '))+F("Cộng đồng",gd.cong_dong,'-','gia_dinh.cong_dong')+F("Quá trình rời gia đình",gd.qua_trinh_roi_gd,'-','gia_dinh.qua_trinh_roi_gd')+F("Hoàn cảnh",gd.hoan_canh,'-','gia_dinh.hoan_canh'));
    h+=Sec("C. Tình trạng trẻ","s0c",
      Dv("Lao động")+F("Công việc",tt.cong_viec,'-','tinh_trang.cong_viec')+F("Thời gian (h/ngày)",tt.thoi_gian_lam_viec,'-','tinh_trang.thoi_gian_lam_viec')+F("Bắt đầu làm từ",tt.bat_dau_lam_tu,'-','tinh_trang.bat_dau_lam_tu')+
      Dv("Giấy tờ")+F("Khai sinh",[cf(gks.co),cf(gks.ly_do)].filter(Boolean).join(' — '))+F("Thường trú",[cf(tr.co),cf(tr.ly_do)].filter(Boolean).join(' — '))+F("CCCD",[cf(cc.co),cf(cc.ly_do)].filter(Boolean).join(' — '))+
      Dv("Giáo dục")+F("Đang học",cf(hv.lop)?'Lớp '+cf(hv.lop)+(cf(hv.truong)?' — '+cf(hv.truong):''):'')+F("Kết quả học tập",hv.ket_qua,'-','tinh_trang.hoc_van.ket_qua')+F("Bỏ học",cf(hv.bo_hoc)?'Lớp '+cf(hv.bo_hoc)+(cf(hv.nam_bo_hoc)?' ('+cf(hv.nam_bo_hoc)+')':''):'')+F("Lý do bỏ học",hv.ly_do_bo_hoc,'-','tinh_trang.hoc_van.ly_do_bo_hoc')+F("Học nghề",cf(hv.hoc_nghe)?(cf(hv.nghe_da_hoc)||'Có'):'Không')+F("Sở thích",hv.so_thich,'-','tinh_trang.hoc_van.so_thich')+F("Ước mơ",hv.uoc_mo,'-','tinh_trang.hoc_van.uoc_mo')+
      Dv("Sức khỏe")+F("Tình trạng",sk.tinh_trang,'-','tinh_trang.suc_khoe.tinh_trang')+F("Cân nặng (kg)",sk.can_nang,'-','tinh_trang.suc_khoe.can_nang')+F("Chiều cao (cm)",sk.chieu_cao,'-','tinh_trang.suc_khoe.chieu_cao')+F("Bệnh trong 6 tháng",sk.benh_trong_6t,'-','tinh_trang.suc_khoe.benh_trong_6t')+F("Được khám",sk.duoc_kham,'-','tinh_trang.suc_khoe.duoc_kham')+F("BHYT",sk.bhyt,'-','tinh_trang.suc_khoe.bhyt')+
      Dv("Tâm lý")+F("Tăng động",tl.tang_dong,'-','tinh_trang.tam_ly.tang_dong')+F("Bi quan",tl.bi_quan,'-','tinh_trang.tam_ly.bi_quan')+F("Tự tổn thương",tl.tu_ton_thuong,'-','tinh_trang.tam_ly.tu_ton_thuong')+F("Mô tả",tl.mo_ta,'-','tinh_trang.tam_ly.mo_ta')+
      (()=>{ const dass=(tt.dass||null); if(!dass) return ''; const dL=_getDASSSeverity('D',dass.D||0),aL=_getDASSSeverity('A',dass.A||0),sL=_getDASSSeverity('S',dass.S||0); return Dv('DASS-'+dass.version+' ('+dass.date+')')+`<div class="dass-form-result"><span class="dass-fb" style="color:${dL.c};border-color:${dL.c};background:${dL.c}15">😔 TC: ${dass.D} — ${dL.lv}</span><span class="dass-fb" style="color:${aL.c};border-color:${aL.c};background:${aL.c}15">😰 LA: ${dass.A} — ${aL.lv}</span><span class="dass-fb" style="color:${sL.c};border-color:${sL.c};background:${sL.c}15">😤 CT: ${dass.S} — ${sL.lv}</span></div>`; })());
    h+=Sec("D. Đánh giá ban đầu","s0d",
      F("Vấn đề thể chất",dg.van_de_the_chat,'-','danh_gia.van_de_the_chat')+F("Vấn đề tâm lý",dg.van_de_tam_ly,'-','danh_gia.van_de_tam_ly')+F("Vấn đề nhận thức",dg.van_de_nhan_thuc,'-','danh_gia.van_de_nhan_thuc')+
      F("Nhu cầu thể chất",dg.nhu_cau_the_chat,'-','danh_gia.nhu_cau_the_chat')+F("Nhu cầu tâm lý",dg.nhu_cau_tam_ly,'-','danh_gia.nhu_cau_tam_ly')+F("Nhu cầu nhận thức",dg.nhu_cau_nhan_thuc,'-','danh_gia.nhu_cau_nhan_thuc')+
      F("Yêu cầu của trẻ",dg.yeu_cau_tre,'-','danh_gia.yeu_cau_tre')+F("Yêu cầu gia đình",dg.yeu_cau_gia_dinh,'-','danh_gia.yeu_cau_gia_dinh')+
      F("Ưu thế trẻ",dg.uu_the_tre,'-','danh_gia.uu_the_tre')+F("Ưu thế gia đình",dg.uu_the_gia_dinh,'-','danh_gia.uu_the_gia_dinh')+F("Nguồn lực trẻ",dg.nguon_luc_tre,'-','danh_gia.nguon_luc_tre')+
      F("Nguy cơ",dg.nguy_co,'-','danh_gia.nguy_co')+F("Mức khẩn cấp",dg.muc_khan_cap,'-','danh_gia.muc_khan_cap')+F("Yếu tố bảo vệ",dg.yeu_to_bao_ve,'-','danh_gia.yeu_to_bao_ve')+F("Nhận xét NVXH",dg.nhan_xet_nvxh,'-','danh_gia.nhan_xet_nvxh'));
    h+=Sec("E. Nguồn lực xã hội","s0e",
      F("Quan phường/Chính quyền",nlxh.quan_phuong,'-','nguon_luc_xa_hoi.quan_phuong')+F("Tôn giáo/Chùa",nlxh.ton_giao,'-','nguon_luc_xa_hoi.ton_giao')+F("Tổ chức/Hội đoàn",nlxh.to_chuc,'-','nguon_luc_xa_hoi.to_chuc')+F("Đường đi kết nối",nlxh.duong_di,'-','nguon_luc_xa_hoi.duong_di'),'🤝');
  } else if (idx===1) {
    h+=Sec("A. Thông tin trẻ","s1a",F("Họ tên",cb.ho_ten,'-','co_ban.ho_ten')+F("Giới tính",cb.gioi_tinh,'-','co_ban.gioi_tinh')+F("Năm sinh",cb.ngay_sinh,'-','co_ban.ngay_sinh')+F("Tuổi",cb.tuoi,'-','co_ban.tuoi')+F("Sống với",cb.song_voi,'-','co_ban.song_voi')+F("Nhóm trẻ",cb.nhom_tre,'-','co_ban.nhom_tre'));
    h+=Sec("B. Hoàn cảnh gia đình","s1b",F("Hoàn cảnh",gd.hoan_canh,'-','gia_dinh.hoan_canh'));
    h+=Sec("C. Tình trạng hiện tại","s1c",F("Công việc",tt.cong_viec,'-','tinh_trang.cong_viec')+F("Sức khỏe",sk.tinh_trang,'-','tinh_trang.suc_khoe.tinh_trang')+F("Tinh thần",tl.mo_ta,'-','tinh_trang.tam_ly.mo_ta')+F("Nguy cơ",dg.nguy_co,'-','danh_gia.nguy_co')+F("Mong muốn",dg.yeu_cau_tre,'-','danh_gia.yeu_cau_tre'));
    h+=Sec("D. Người tiếp cận","s1d",F("Họ tên",cb.nguoi_tiep_can,'-','co_ban.nguoi_tiep_can')+F("Ngày",cb.ngay_tiep_can,'-','co_ban.ngay_tiep_can')+F("Nơi",cb.noi_tiep_can,'-','co_ban.noi_tiep_can'));
  } else if (idx===2) {
    h+=Sec("Thông tin vãng gia","s2a",F("Ngày vãng gia",vg.ngay_vang_gia,'-','vang_gia.ngay_vang_gia')+F("Người tiếp xúc",vg.nguoi_tiep_xuc,'-','vang_gia.nguoi_tiep_xuc')+F("Lần thứ",vg.lan_vang_gia,'-','vang_gia.lan_vang_gia')+F("Gặp TC",vg.co_gap_tc,'-','vang_gia.co_gap_tc')+F("Mục đích",vg.muc_dich,'-','vang_gia.muc_dich'));
    h+=Sec("Quan sát gia đình","s2b",F("Môi trường sống",vg.quan_sat_mt,'-','vang_gia.quan_sat_mt')+F("Loại hình GĐ",vg.loai_hinh_gd||gd.loai_hinh,'-','vang_gia.loai_hinh_gd')+F("Bầu khí",vg.bau_khi_gd||gd.bau_khi,'-','vang_gia.bau_khi_gd')+F("Hôn nhân cha mẹ",vg.tinh_trang_hn,'-','vang_gia.tinh_trang_hn')+F("Kinh tế",vg.van_de_kinh_te,'-','vang_gia.van_de_kinh_te')+F("Đánh giá chung",vg.danh_gia_chung,'-','vang_gia.danh_gia_chung'));
  } else if (idx===3) {
    h+=Sec("Đánh giá khẩn cấp","s3a",F("Họ tên",cb.ho_ten,'-','co_ban.ho_ten')+F("Tuổi",cb.tuoi,'-','co_ban.tuoi')+F("Hoàn cảnh GĐ",gd.hoan_canh,'-','gia_dinh.hoan_canh')+F("Tổn thương",[cf(dg.van_de_the_chat),cf(dg.van_de_tam_ly)].filter(Boolean).join(' | '))+F("Nguy cơ",dg.nguy_co,'-','danh_gia.nguy_co')+F("Mức khẩn cấp",dg.muc_khan_cap,'-','danh_gia.muc_khan_cap')+F("Yếu tố bảo vệ",dg.yeu_to_bao_ve,'-','danh_gia.yeu_to_bao_ve')+F("Nhận xét",dg.nhan_xet_nvxh,'-','danh_gia.nhan_xet_nvxh'));
  } else if (idx===4) {
    h+=Sec("Đánh giá vấn đề","s4a",Dv("Thể chất")+F("",dg.van_de_the_chat,'-','danh_gia.van_de_the_chat')+Dv("Tâm lý")+F("",dg.van_de_tam_ly,'-','danh_gia.van_de_tam_ly')+Dv("Nhận thức")+F("",dg.van_de_nhan_thuc,'-','danh_gia.van_de_nhan_thuc'));
    h+=Sec("Nhu cầu","s4b",Dv("Thể chất")+F("",dg.nhu_cau_the_chat,'-','danh_gia.nhu_cau_the_chat')+Dv("Tâm lý")+F("",dg.nhu_cau_tam_ly,'-','danh_gia.nhu_cau_tam_ly')+Dv("Nhận thức")+F("",dg.nhu_cau_nhan_thuc,'-','danh_gia.nhu_cau_nhan_thuc'));
    h+=Sec("Mong đợi","s4c",F("Từ trẻ",dg.yeu_cau_tre,'-','danh_gia.yeu_cau_tre')+F("Từ GĐ",dg.yeu_cau_gia_dinh,'-','danh_gia.yeu_cau_gia_dinh'));
    h+=Sec("Nhận xét NVXH","s4d",F("",dg.nhan_xet_nvxh,'-','danh_gia.nhan_xet_nvxh'));
  } else if (idx===5) {
    const ncR=(kh.nhu_cau_ho_tro||[]).map((nc,i)=>[i+1,nc.loai,nc.uu_tien||'',nc.muc_tieu||'']);
    h+=Sec("Nhu cầu hỗ trợ","s5a",TBL(["TT","Nhu cầu","Ưu tiên","Mục tiêu"],ncR));
    h+=Sec("Hoạt động","s5b",TBL(["Mục tiêu","Hoạt động","Ưu tiên","Người phụ trách","Thời gian","Nguồn lực"],(kh.hoat_dong||[]).map(h=>[h.muc_tieu_so,h.noi_dung,h.uu_tien||'',h.nguoi_phu_trach||'',h.thoi_gian,h.nguon_luc])));
    h+=Sec("Nguồn lực","s5c",F("",kh.nguon_luc_ket_noi));
    if (kh.cam_ket_gia_dinh || kh.cam_ket_tre || kh.cam_ket_nvxh) {
      h+=Sec("Cam kết 2 phía","s5d",
        F("🏠 Gia đình cam kết",kh.cam_ket_gia_dinh)+
        F("👧 Trẻ cam kết",kh.cam_ket_tre)+
        F("👤 NVXH cam kết",kh.cam_ket_nvxh),'🤝');
    }
  } else if (idx===6) {
    // ★ Form 5: kết hợp mục tiêu kế hoạch + kết quả thực tế từ tien_do
    const td = Array.isArray(D.tien_do) ? D.tien_do : [];
    const goals = (kh.nhu_cau_ho_tro||[]).filter(nc=>nc.loai||nc.muc_tieu);
    let tdR = [];
    if (td.length > 0) {
      // Có dữ liệu từ GĐ4 — dùng trực tiếp
      tdR = td.map(t=>[t.nhu_cau||'',t.hoat_dong||'',t.thoi_gian||'',t.nhan_xet_nvxh||'']);
    } else if (goals.length > 0) {
      // Chưa có GĐ4 — hiển thị mục tiêu từ kế hoạch với cột trống
      tdR = goals.map(nc=>[nc.loai||'',nc.muc_tieu||'','','']);
    }
    if (!tdR.length) tdR = [['','','',''],['','','',''],['','','','']];
    h+=Sec("Tiến độ thực hiện","s6a",TBL(["Nhu cầu can thiệp","Hoạt động đã thực hiện","Thời gian","Nhận xét NVXH"],tdR));
  } else if (idx===7) {
    const cuR=(Array.isArray(D.cap_nhat)?D.cap_nhat:[]).map(cu=>[cu.thoi_gian,cu.van_de,cu.muc_tieu,cu.ket_qua]);
    h+=Sec("Cập nhật","s7a",TBL(["Thời gian","Vấn đề","Mục tiêu","Kết quả"],cuR));
  } else if (idx===8) {
    h+=Sec("Trẻ cần chuyển gửi","s8a",F("Họ tên",cb.ho_ten)+F("Năm sinh",cb.ngay_sinh)+F("Người chăm sóc",ncs.ho_ten));
    h+=Sec("Người chuyển gửi","s8b",F("Họ tên",cg.nguoi_chuyen)+F("Đơn vị",cg.don_vi_chuyen));
    h+=Sec("Nơi nhận","s8c",F("Đơn vị",cg.don_vi_nhan)+F("Người nhận",cg.nguoi_nhan));
  } else if (idx===9) {
    h+=Sec("Kết thúc ca","s9a",F("Kết quả đạt",ktu.ket_qua_dat)+F("Chưa đạt",ktu.ket_qua_chua_dat)+F("Lý do",ktu.ly_do)+F("KH theo dõi",ktu.ke_hoach_theo_doi));
  } else {
    h+=Sec("PHẦN I — Thông tin cơ bản","sbc1",F("Họ tên",cb.ho_ten)+F("Năm sinh",cb.ngay_sinh)+F("Yêu cầu",dg.yeu_cau_tre)+F("Nguy cơ",dg.nguy_co));
    h+=Sec("PHẦN II — Tiến trình","sbc2",F("Bối cảnh GĐ",gd.hoan_canh)+F("Nhu cầu thể chất",dg.nhu_cau_the_chat)+F("Nhu cầu tâm lý",dg.nhu_cau_tam_ly)+F("Ưu thế trẻ",dg.uu_the_tre)+F("Đề xuất",D.de_xuat));
  }
  document.getElementById('fv').innerHTML = h;
}

// ════════════════════════════════════════════════════════════
// FORM EDIT CHAT
// ════════════════════════════════════════════════════════════
function toggleFEC() {} // no-op — FEC is now a persistent chat panel

function setNested(obj, path, val) {
  const keys = path.split('.');
  let cur = obj;
  for (let i=0; i<keys.length-1; i++) {
    const m = keys[i].match(/^(.+)\[(-?\d+)\]$/);
    if (m) {
      if (!cur[m[1]]) cur[m[1]]=[];
      const arr = cur[m[1]];
      const idx = parseInt(m[2]); 
      const realIdx = idx < 0 ? Math.max(0, arr.length + idx) : idx;
      if (!arr[realIdx]) arr[realIdx]={};
      cur = arr[realIdx];
    } else {
      if (!cur[keys[i]]) cur[keys[i]]={};
      cur = cur[keys[i]];
    }
  }
  const lastKey = keys[keys.length-1];
  const lm = lastKey.match(/^(.+)\[(-?\d+)\]$/);
  if (lm) {
    if (!cur[lm[1]]) cur[lm[1]]=[];
    const arr = cur[lm[1]];
    const idx = parseInt(lm[2]);
    arr[idx < 0 ? Math.max(0, arr.length + idx) : idx] = val;
  } else {
    cur[lastKey] = val;
  }
}

function _getFecContext(fi) {
  const FORM_DATA_MAP = {
    0: { root:'co_ban,gia_dinh,tinh_trang', data: () => ({...D.co_ban,...D.gia_dinh,...D.tinh_trang}) },
    1: { root:'co_ban', data: () => D.co_ban||{} },
    2: { root:'vang_gia', data: () => D.vang_gia||{} },
    3: { root:'danh_gia', data: () => ({muc_khan_cap:D.danh_gia?.muc_khan_cap,nguy_co:D.danh_gia?.nguy_co,yeu_to_bao_ve:D.danh_gia?.yeu_to_bao_ve}) },
    4: { root:'danh_gia', data: () => D.danh_gia||{} },
    5: { root:'ke_hoach', data: () => D.ke_hoach||{} },
    6: { root:'cap_nhat', data: () => ({cap_nhat:D.cap_nhat||[]}) },
    7: { root:'cap_nhat', data: () => ({cap_nhat:D.cap_nhat||[],tien_trinh:D.tien_trinh||{}}) },
    8: { root:'chuyen_gui', data: () => D.chuyen_gui||{} },
    9: { root:'ket_thuc', data: () => D.ket_thuc||{} },
    10:{ root:'all', data: () => ({co_ban:D.co_ban,danh_gia:D.danh_gia,ke_hoach:D.ke_hoach,ket_thuc:D.ket_thuc}) }
  };
  const map = FORM_DATA_MAP[fi] || FORM_DATA_MAP[0];
  const data = map.data();
  const snippet = JSON.stringify(data).substring(0, 1200);
  return { rootKeys: map.root, snippet };
}

async function sendFEC() {
  const input = document.getElementById('fec-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  const msgs = document.getElementById('fec-msgs');
  msgs.innerHTML += `<div class="fec-msg-user">${esc(msg)}</div>`;
  msgs.scrollTop = msgs.scrollHeight;

  const sendBtn = document.querySelector('.btn-fec-send');
  if (sendBtn) sendBtn.disabled = true;

  const fctx = _getFecContext(curForm);
  const formName = FORM_NAMES[curForm] || 'Form '+curForm;
  const caseSnip = D ? fctx.snippet : '[Chưa có dữ liệu ca]';

  const SYS_FEC = `Bạn là TRỢ LÝ AI đa năng hỗ trợ Nhân viên Công tác Xã hội (NVXH) tại Thảo Đàn SSC, TP.HCM.

Bạn có thể làm 2 việc:
① TƯ VẤN & HỖ TRỢ: Trả lời câu hỏi về CTXH, kỹ năng can thiệp, quy trình bảo vệ trẻ, tâm lý, pháp lý
② CHỈNH SỬA FORM: Cập nhật thông tin trong ${formName} đang mở

Form hiện tại (${formName}): ${caseSnip}

PHÂN TÍCH yêu cầu và trả về JSON:
• Câu hỏi / tư vấn / hỏi đáp → {"type":"chat","reply":"<câu trả lời, dùng **bold** cho từ quan trọng, dùng \\n cho xuống dòng>"}
• Lệnh sửa thông tin → {"type":"edit","edits":[{"path":"co_ban.ho_ten","old_val":"cũ","new_val":"mới","label":"Họ tên trẻ"}],"reply":"<xác nhận ngắn>"}
• Vừa hỏi vừa sửa → {"type":"both","edits":[...],"reply":"<trả lời + xác nhận>"}

Paths field: co_ban.ho_ten/gioi_tinh/ngay_sinh/tuoi/song_voi/dia_chi_hien_tai/sdt_tre/sdt_nguoi_than, gia_dinh.hoan_canh/loai_hinh/nguoi_cham_soc.ho_ten, tinh_trang.cong_viec/suc_khoe.tinh_trang/tam_ly.mo_ta, danh_gia.nguy_co/muc_khan_cap/van_de_the_chat/nhu_cau_the_chat/nhan_xet_nvxh, vang_gia.quan_sat_mt/danh_gia_chung

Luôn trả JSON hợp lệ. Ngắn gọn, thực tế, đồng nghiệp với NVXH.`;

  try {
    const raw = await callAI(SYS_FEC, msg, 0.3, 2000);
    const result = robustJSON(raw);
    const type = result.type || 'chat';

    if (type === 'edit' || type === 'both') {
      const edits = result.edits || [];
      if (edits.length && D) {
        edits.forEach(e => setNested(D, e.path, e.new_val));
        showForm(curForm);
        if (window._markUnsaved) window._markUnsaved();
        msgs.innerHTML += `<div class="fec-msg-ai fec-msg-edit">✅ Đã sửa ${edits.length} trường: ${edits.map(e=>esc(e.label||e.path)).join(', ')} — nhớ bấm <strong>Lưu ca</strong></div>`;
      }
    }

    if (type === 'chat' || type === 'both') {
      const reply = result.reply || result.message || '';
      msgs.innerHTML += `<div class="fec-msg-ai">${formatMd(reply)}</div>`;
    }

    if (type !== 'chat' && type !== 'edit' && type !== 'both') {
      const fb = result.reply || result.message || '';
      msgs.innerHTML += `<div class="fec-msg-ai">${fb ? formatMd(fb) : '🤔 Thử lại: hỏi về ca này hoặc gõ lệnh sửa, VD: "sửa họ tên thành Nguyễn Văn A"'}</div>`;
    }
  } catch(e) {
    msgs.innerHTML += `<div class="fec-msg-ai" style="color:#dc2626;">❌ ${esc(e.message)}</div>`;
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
  msgs.scrollTop = msgs.scrollHeight;
}

// ════════════════════════════════════════════════════════════
// CASES MANAGEMENT
// ════════════════════════════════════════════════════════════
// Hủy draft nếu có (không lưu gì cả)
function _discardDraft() {
  if (_draftCaseId) {
    const cases = loadCases();
    delete cases[_draftCaseId];
    _cases = cases; // xóa khỏi memory, KHÔNG gọi saveCases
    _draftCaseId = null;
  }
}

// Commit draft: lưu thật sự vào Supabase
function _commitDraft() {
  if (_draftCaseId && curCaseId === _draftCaseId) {
    _draftCaseId = null;
    saveCases(loadCases()); // persist lần đầu
  }
}

function newCase() {
  _discardDraft(); // xóa draft cũ nếu chưa dùng gì
  const id = genCaseId();
  // Tạo trong memory THÔI, chưa lưu xuống DB
  _cases[id] = { id, name:'Ca mới '+new Date().toLocaleDateString('vi-VN'), createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), status:'open', entries:[], currentStage:1 };
  _draftCaseId = id;
  curCaseId = id; D = null; chatHistory = [];
  currentStage = 1;
  // Xóa checkmark cam + unlock forms từ ca cũ
  document.querySelectorAll('.fi-ck').forEach(el => el.remove());
  document.querySelectorAll('.form-item').forEach(el => { el.classList.remove('form-locked'); el.style.opacity = ''; el.title = ''; });
  document.getElementById('dash-notes').value = '';
  document.getElementById('dash-cc').textContent = '0 ký tự';
  updateHeader();
  renderCaseList();
  renderEntriesPanel();
  document.getElementById('chat-msgs').innerHTML = '<div class="chat-empty"><div style="font-size:28px;margin-bottom:8px;">💬</div><div style="font-weight:600;">Chuyên gia CTXH sẵn sàng</div><div>Hỏi bất kỳ điều gì về CTXH hoặc nhập ghi chép để phân tích ca.</div></div>';
  document.getElementById('btn-fill').disabled = true;
  // Bắt buộc re-enable textarea và action bar (không phụ thuộc applyClosedCaseUI)
  const _ta = document.getElementById('dash-notes');
  const _ab = document.getElementById('action-bar');
  const _ci = document.getElementById('chat-input');
  const _bs = document.getElementById('btn-send');
  if (_ta) { _ta.disabled = false; }
  if (_ab) { _ab.style.display = 'flex'; }
  if (_ci) { _ci.disabled = false; }
  if (_bs) { _bs.disabled = false; }
  document.getElementById('closed-banner')?.classList.remove('show');
  updateStageUI();
  applyClosedCaseUI();
  switchMain('dash');
  showNotif('✅ Đã tạo ca mới');
}

// ── Edit log: ghi lại mỗi lần AI cập nhật form data ──
function _logEdit(source, stage) {
  if (!curCaseId) return;
  const cases = loadCases();
  const c = cases[curCaseId];
  if (!c) return;
  if (!Array.isArray(c.editLog)) c.editLog = [];
  const stageLabels = ['','Tiếp cận','Vãng gia','Kế hoạch','Tiến trình','Kết thúc'];
  c.editLog.push({
    ts: new Date().toISOString(),
    source,
    stage,
    stageLabel: stageLabels[stage] || ('GĐ'+stage),
  });
  // Giữ tối đa 50 bản ghi
  if (c.editLog.length > 50) c.editLog = c.editLog.slice(-50);
  cases[curCaseId] = c;
  _cases = cases;
}

function saveCaseNow() {
  if (!D && !document.getElementById('dash-notes').value.trim()) { showNotif('⚠️ Chưa có dữ liệu','warn'); return; }
  _commitDraft(); // lưu ca draft thành thật nếu chưa lưu
  const cases = loadCases();
  if (!curCaseId) curCaseId = genCaseId();
  const c = cases[curCaseId] || { id:curCaseId, entries:[], createdAt:new Date().toISOString(), status:'open', name:'Ca '+fmtVN(new Date().toISOString()) };
  const notes = document.getElementById('dash-notes').value.trim();
  if (D?.co_ban?.ho_ten) c.name = D.co_ban.ho_ten;
  c.updatedAt = new Date().toISOString();
  c.currentStage = currentStage;
  if (D) c.lastAnalysis = D;
  // Always update stageData snapshot for current stage
  c.stageData = c.stageData || {};
  c.stageData[currentStage] = { notes: notes || document.getElementById('dash-notes').value, analysis: D ? JSON.parse(JSON.stringify(D)) : null, savedAt: new Date().toISOString() };
  if (notes) {
    c.entries = c.entries || [];
    const today = new Date().toDateString();
    const last = c.entries[c.entries.length-1];
    const isSameDayStage = last && last.stage === currentStage && new Date(last.date).toDateString() === today;
    if (isSameDayStage) {
      c.entries[c.entries.length-1] = {...last, notes, analysis:D||null, date:new Date().toISOString()};
    } else if (!last || last.notes !== notes) {
      c.entries.push({ date:new Date().toISOString(), notes, analysis:D||null, stage:currentStage });
    }
  }
  cases[curCaseId] = c;
  saveCases(cases);
  updateHeader(); renderCaseList(); updateCasesCount();
  renderEntriesPanel();
  showNotif('💾 Đã lưu: '+c.name);
}

function updateHeader() {
  const c = curCaseId ? loadCases()[curCaseId] : null;
  const isDraft = curCaseId && curCaseId === _draftCaseId;
  document.getElementById('hdr-case-name').textContent = c?.name || '';
  document.getElementById('hdr-case-date').textContent = isDraft ? ' — ✏️ Chưa lưu' : (c ? ' — '+fmtVN(c.updatedAt) : '');
  const dl = document.getElementById('dash-case-label');
  if (dl) dl.textContent = c ? (isDraft ? '📋 '+c.name+' (chưa lưu)' : '📁 '+c.name) : '';
}

function _timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return Math.floor(diff/60) + ' phút trước';
  if (diff < 86400) return Math.floor(diff/3600) + ' giờ trước';
  const days = Math.floor(diff/86400);
  if (days === 1) return 'hôm qua';
  if (days < 30) return days + ' ngày trước';
  if (days < 365) return Math.floor(days/30) + ' tháng trước';
  return Math.floor(days/365) + ' năm trước';
}

function renderCaseList() {
  const cases = loadCases();
  const q = (document.getElementById('cases-search')?.value||'').toLowerCase();
  const fStatus = document.getElementById('filter-status')?.value || '';
  const fStage = document.getElementById('filter-stage')?.value || '';
  const el = document.getElementById('cases-list');
  const list = Object.values(cases).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
  let filtered = list;
  if (q) filtered = filtered.filter(c => {
    const childName = (c.lastAnalysis?.co_ban?.ho_ten||'').toLowerCase();
    return c.name.toLowerCase().includes(q) || childName.includes(q) || (c.id||'').toLowerCase().includes(q);
  });
  if (fStatus) filtered = filtered.filter(c => (c.status||'open') === fStatus);
  if (fStage) filtered = filtered.filter(c => String(c.currentStage||1) === fStage);
  if (!filtered.length) { el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--t3);font-size:12px;">Chưa có ca nào</div>'; return; }
  
  const now = new Date();
  el.innerHTML = filtered.map(c => {
    const stage = c.currentStage || 1;
    const risk = c.lastAnalysis?._report?.risk?.level || c.lastAnalysis?._report?.risk_level || '';
    const childName = c.lastAnalysis?.co_ban?.ho_ten || '';
    const childDob = c.lastAnalysis?.co_ban?.ngay_sinh || '';
    const days = Math.floor((now - new Date(c.updatedAt)) / 86400000);
    const isStale = c.status === 'open' && days > 14;
    const riskClass = risk === 'Cao' ? 'ci-risk-high' : risk === 'Trung bình' ? 'ci-risk-med' : risk === 'Thấp' ? 'ci-risk-low' : '';
    const stageDots = [1,2,3,4,5].map(s =>
      `<div class="ci-stage-dot ${(c.status==='closed' || s < stage) ? 'done' : s === stage ? 'current' : ''}"></div>`
    ).join('');
    
    const isDraft = c.id === _draftCaseId;
    // Follow-up badge for closed cases
    let fupBadge = '';
    if (c.status === 'closed' && c.closedAt) {
      const sched = c.followUpSchedule || _genFollowUpSchedule(c.closedAt);
      const flog  = c.followUpLog || [];
      const next  = sched.find(s => !flog.some(e => e.moc === s.moc));
      if (next) {
        const dl = Math.floor((new Date(next.due) - now) / 86400000);
        if (dl < 0)
          fupBadge = `<span class="fup-ci-badge fup-ci-over">TD quá ${-dl}n</span>`;
        else if (dl <= 14)
          fupBadge = `<span class="fup-ci-badge fup-ci-due">TD ${dl}n</span>`;
      }
    }
    return `<div class="case-item${c.id===curCaseId?' active':''}${isStale?' stale':''}${isDraft?' draft':''}" onclick="selectCase('${c.id}')">
      <div class="ci-top">
        <div class="ci-name">${esc(c.name||'?')}</div>
        <div style="display:flex;gap:4px;align-items:center;">
          ${fupBadge}
          <span class="ci-badge ${isDraft?'ci-draft':c.status==='open'?'ci-open':'ci-closed'}">${isDraft?'✏️ Chưa lưu':c.status==='open'?'Mở':'Đóng'}</span>
        </div>
      </div>
      ${childName ? `<div class="ci-child">👤 <b>${esc(childName)}</b>${childDob ? ' · '+childDob : ''}</div>` : ''}
      <div class="ci-meta">
        <span>GĐ ${stage}/5</span>
        ${riskClass ? `<span class="ci-risk ${riskClass}">${risk === 'Cao' ? '🔴' : risk === 'Trung bình' ? '🟡' : '🟢'} ${risk}</span>` : ''}
        <span>${(c.entries||[]).length} ghi chép</span>
        <span class="ci-ago">${_timeAgo(c.updatedAt)}${isStale ? ' ⚠️' : ''}</span>
      </div>
      <div class="ci-stage-bar">${stageDots}</div>
    </div>`;
  }).join('');
}

function selectCase(id) {
  if (id !== _draftCaseId) _discardDraft();
  curCaseId = id;
  renderCaseList();
  showCaseDetail(id);
}

function showCaseDetail(id) {
  const c = loadCases()[id];
  const main = document.getElementById('cases-main');
  if (!c) { main.innerHTML = '<div class="case-detail-empty"><div>Chọn ca để xem</div></div>'; return; }
  const entries = (c.entries||[]).slice().reverse();
  const stage = c.currentStage || 1;
  const risk = c.lastAnalysis?._report?.risk?.level || c.lastAnalysis?._report?.risk_level || '';
  const childName = c.lastAnalysis?.co_ban?.ho_ten || '';
  const childDob = c.lastAnalysis?.co_ban?.ngay_sinh || '';
  const riskHtml = risk === 'Cao' ? '<span class="ci-risk ci-risk-high">🔴 Rủi ro cao</span>'
    : risk === 'Trung bình' ? '<span class="ci-risk ci-risk-med">🟡 Rủi ro TB</span>'
    : risk === 'Thấp' ? '<span class="ci-risk ci-risk-low">🟢 Rủi ro thấp</span>' : '';
  const stageLabels = ['','Tiếp cận','Vãng gia','Kế hoạch','Tiến trình','Kết thúc'];
  const stageDots = [1,2,3,4,5].map(s => 
    `<div style="display:flex;align-items:center;gap:3px;">
      <div style="width:8px;height:8px;border-radius:50%;background:${s < stage ? '#16a34a' : s === stage ? 'var(--org)' : '#e2e8f0'};"></div>
      <span style="font-size:9px;color:${s === stage ? 'var(--org)' : 'var(--t3)'};font-weight:${s === stage ? '700' : '400'};">${s}</span>
    </div>`
  ).join('<div style="flex:1;height:2px;background:#e2e8f0;min-width:8px;"></div>');

  const isClosed = c.status === 'closed';
  const closedAtTxt = c.closedAt ? ' · Đóng: '+fmtVN(c.closedAt) : '';
  const statusBadge = isClosed
    ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;">✅ Đã đóng</span>`
    : `<span style="display:inline-flex;align-items:center;gap:4px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;">🔵 Đang mở</span>`;
  const closeBtn = isClosed
    ? `<button class="btn-secondary" style="color:#16a34a;border-color:#bbf7d0;" onclick="_reopenCaseFromList('${id}')">🔓 Mở lại ca</button>`
    : `<button class="btn-secondary" style="color:#f07020;border-color:#fed7aa;" onclick="_closeCaseFromList('${id}')">✅ Đóng ca</button>`;

  main.innerHTML = `
    <div class="case-detail-hd">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
          <div class="case-detail-title">${esc(c.name||'?')}</div>
          ${statusBadge} ${riskHtml}
        </div>
        ${childName ? `<div style="font-size:13px;color:var(--t1);margin-top:2px;">👤 <b>${esc(childName)}</b>${childDob ? ' · SN: '+childDob : ''}</div>` : ''}
        <div class="case-detail-meta">Tạo: ${fmtVN(c.createdAt)} · ${(c.entries||[]).length} ghi chép · Cập nhật: ${_timeAgo(c.updatedAt)}${closedAtTxt}</div>
        <div style="display:flex;align-items:center;gap:0;margin-top:8px;max-width:280px;">${stageDots}</div>
        <div style="font-size:10px;color:var(--org);font-weight:600;margin-top:3px;">GĐ ${stage} — ${stageLabels[stage]||''}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;">
        <button class="btn-secondary" onclick="loadCaseIntoApp('${id}');switchMain('dash')">🔬 Mở</button>
        <button class="btn-secondary" onclick="loadCaseIntoApp('${id}');setTimeout(printFullCase,300)">🖨 In</button>
        ${closeBtn}
        <button class="btn-secondary" onclick="deleteCase('${id}')" style="color:#b91c1c;border-color:#fecaca;">🗑 Xóa</button>
      </div>
    </div>
    <div class="case-detail-body">
      ${entries.length ? entries.map(e=>`<div class="ct-item"><div class="ct-date">📅 ${fmtVN(e.date)}</div><div class="ct-notes">${esc((e.notes||'').substring(0,300))}</div></div>`).join('') : '<div style="text-align:center;padding:40px;color:var(--t3);">Chưa có ghi chép</div>'}
      ${(c.editLog && c.editLog.length) ? `
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--bd);">
        <div style="font-weight:700;font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:7px;">📝 Lịch sử chỉnh sửa form (${c.editLog.length})</div>
        <div style="display:flex;flex-direction:column;gap:3px;">
          ${[...c.editLog].reverse().slice(0,20).map(e=>`
            <div style="display:flex;align-items:center;gap:8px;font-size:11px;padding:4px 0;border-bottom:1px solid #f1f5f9;">
              <span style="color:var(--t3);white-space:nowrap;flex-shrink:0;">${fmtVN(e.ts)}</span>
              <span style="background:#eff6ff;color:#1e40af;border-radius:4px;padding:1px 6px;font-weight:600;font-size:10px;flex-shrink:0;">GĐ${e.stage} ${esc(e.stageLabel)}</span>
              <span style="color:var(--t2);">${esc(e.source)}</span>
            </div>`).join('')}
        </div>
      </div>` : ''}
      ${_renderFollowUpSection(id, c)}
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--bd);">
        <div style="font-weight:600;font-size:13px;margin-bottom:6px;">📎 Tài liệu đính kèm</div>
        ${renderFileUpload(id)}
      </div>
    </div>
    <div class="case-actions">
      <button class="btn-analyze" style="font-size:11px;flex:none;padding:7px 14px;" onclick="loadCaseIntoApp('${id}');switchMain('dash')">🔬 Phân tích</button>
    </div>`;
  // Load files async
  refreshFileList(id);
}

function _closeCaseFromList(id) {
  const c = loadCases()[id];
  showConfirm({
    icon: '✅',
    title: 'Đóng ca?',
    body: `"${c?.name||'Ca này'}" sẽ chuyển sang trạng thái Đã đóng.`,
    okText: 'Đóng ca',
    okClass: 'cmb-ok-orange',
    onConfirm() {
      const cases = loadCases();
      if (cases[id]) {
        cases[id].status = 'closed';
        cases[id].closedAt = new Date().toISOString();
        cases[id].updatedAt = new Date().toISOString();
        if (!cases[id].followUpSchedule)
          cases[id].followUpSchedule = _genFollowUpSchedule(cases[id].closedAt);
      }
      saveCases(cases);
      if (curCaseId === id) {
        // Reset dashboard về trạng thái sạch sau khi đóng ca
        D = null; curCaseId = null; currentStage = 1; chatHistory = [];
        document.getElementById('dash-notes').value = '';
        document.getElementById('dash-cc').textContent = '0 ký tự';
        document.getElementById('btn-fill').disabled = true;
        document.getElementById('chat-msgs').innerHTML = '<div class="chat-empty"><div style="font-size:28px;margin-bottom:8px;">✅</div><div style="font-weight:600;margin-bottom:4px;">Đã đóng ca thành công</div><div>Chọn ca khác hoặc nhấn <strong>+ Ca mới</strong> để tiếp tục.</div></div>';
        document.getElementById('hdr-case-name').textContent = '';
        document.getElementById('hdr-case-date').textContent = '';
        document.getElementById('closed-banner')?.classList.remove('show');
        const fp = document.getElementById('form-preview');
        if (fp) fp.innerHTML = '<div id="fv" class="fv"><div style="padding:60px 40px;text-align:center;color:var(--t3);"><div style="font-size:48px;margin-bottom:14px;opacity:.3;">✅</div><div style="font-weight:800;font-size:15px;margin-bottom:6px;color:var(--t2)">Ca đã đóng</div><div style="font-size:12.5px;">Chọn ca khác từ <strong>Danh sách ca</strong></div></div></div>';
        updateStageUI();
      }
      renderCaseList(); showCaseDetail(id);
      showNotif('✅ Đã đóng ca');
    }
  });
}
function _reopenCaseFromList(id) {
  const c = loadCases()[id];
  showConfirm({
    icon: '🔓',
    title: 'Mở lại ca?',
    body: `"${c?.name||'Ca này'}" sẽ được mở lại để tiếp tục chỉnh sửa.`,
    okText: 'Mở lại',
    okClass: 'cmb-ok-blue',
    onConfirm() {
      const cases = loadCases();
      if (cases[id]) { cases[id].status = 'open'; delete cases[id].closedAt; }
      saveCases(cases);
      if (curCaseId === id && D) { D._status = 'open'; applyClosedCaseUI(); }
      renderCaseList(); showCaseDetail(id);
      showNotif('🔓 Đã mở lại ca');
    }
  });
}

function loadCaseIntoApp(id) {
  if (id !== _draftCaseId) _discardDraft(); // rời khỏi draft mà không làm gì → xóa
  const c = loadCases()[id];
  if (!c) return;
  curCaseId = id;
  // ★ Khôi phục giai đoạn đã lưu
  currentStage = c.currentStage || (c.lastAnalysis?._currentStage) || 1;
  // ★ Prefer stageData snapshot for current stage; fall back to entries then lastAnalysis
  const _snap = c.stageData?.[currentStage];
  if (_snap?.analysis) {
    D = JSON.parse(JSON.stringify(_snap.analysis));
    D._currentStage = currentStage;
    if (!Array.isArray(D.cap_nhat)) D.cap_nhat = [];
    if (D.co_ban && Object.keys(D.co_ban).length) {
      document.getElementById('btn-fill').disabled = false;
      document.getElementById('chat-input').disabled = false;
      document.getElementById('btn-send').disabled = false;
    }
    if (D._report) renderReport(D._report);
  } else if (c.lastAnalysis) {
    D = c.lastAnalysis;
    if (!Array.isArray(D.cap_nhat)) D.cap_nhat = [];
    if (D.co_ban && Object.keys(D.co_ban).length) {
      document.getElementById('btn-fill').disabled = false;
      document.getElementById('chat-input').disabled = false;
      document.getElementById('btn-send').disabled = false;
    }
    if (D._report) renderReport(D._report);
  } else {
    D = null;
    document.getElementById('btn-fill').disabled = true;
  }
  // ★ Hiển thị ghi chép mới nhất của giai đoạn HIỆN TẠI vào textarea
  if (_snap) {
    document.getElementById('dash-notes').value = _snap.notes || '';
    document.getElementById('dash-cc').textContent = (_snap.notes || '').length + ' ký tự';
  } else {
    const entries = c.entries || [];
    const stageEntries = entries.filter(e => (e.stage||1) === currentStage);
    const latestForStage = stageEntries.length ? stageEntries[stageEntries.length-1] : (entries.length ? entries[entries.length-1] : null);
    if (latestForStage) {
      document.getElementById('dash-notes').value = latestForStage.notes || '';
      document.getElementById('dash-cc').textContent = (latestForStage.notes || '').length + ' ký tự';
    } else {
      document.getElementById('dash-notes').value = '';
      document.getElementById('dash-cc').textContent = '0 ký tự';
    }
  }
  chatHistory = [];
  updateHeader();
  updateStageUI();
  restoreFormChecks();
  renderEntriesPanel();
  applyClosedCaseUI();
  checkReminders();
  showNotif('📂 Đã mở: ' + c.name + ' — GĐ ' + currentStage + ' · ' + entries.length + ' ghi chép');
}

// ── CUSTOM CONFIRM MODAL ──
let _confirmCb = null;
function showConfirm({icon='⚠️', title='', body='', okText='Xác nhận', okClass='cmb-ok-red', onConfirm=null}={}) {
  _confirmCb = onConfirm;
  document.getElementById('cmb-icon').textContent = icon;
  document.getElementById('cmb-title').textContent = title;
  document.getElementById('cmb-body').textContent = body;
  const ok = document.getElementById('cmb-ok');
  ok.textContent = okText;
  ok.className = 'cmb-btn ' + okClass;
  ok.onclick = _doConfirm;
  document.getElementById('confirm-overlay').classList.add('show');
}
function _doConfirm() {
  document.getElementById('confirm-overlay').classList.remove('show');
  const cb = _confirmCb; _confirmCb = null;
  if (cb) cb();
}
function _cancelConfirm() {
  document.getElementById('confirm-overlay').classList.remove('show');
  _confirmCb = null;
}

function deleteCase(id) {
  const c = loadCases()[id];
  showConfirm({
    icon: '🗑',
    title: 'Xóa ca này?',
    body: `"${c?.name||'Ca này'}" sẽ bị xóa vĩnh viễn. Không thể hoàn tác.`,
    okText: 'Xóa ca',
    okClass: 'cmb-ok-red',
    onConfirm() {
      const cases = loadCases();
      delete cases[id];
      saveCases(cases);
      deleteCaseFromDB(id);
      if (curCaseId===id) { curCaseId=null; D=null; updateHeader(); }
      renderCaseList(); updateCasesCount();
      document.getElementById('cases-main').innerHTML = '<div class="case-detail-empty"><div>Đã xóa</div></div>';
      showNotif('✅ Đã xóa ca');
    }
  });
}

function updateCasesCount() {
  const b = document.getElementById('cases-count-badge');
  const n = Object.keys(loadCases()).length;
  if (b) b.textContent = n || '';
}

// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
// EXPORT / IMPORT JSON BACKUP
// ════════════════════════════════════════════════════════════
function exportAllCasesJSON() {
  const cases = loadCases();
  const count = Object.keys(cases).length;
  if (!count) { showNotif('⚠️ Chưa có ca nào để xuất', 'warn'); return; }
  const payload = JSON.stringify(cases, null, 2);
  const blob = new Blob([payload], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ThaoDan_Backup_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showNotif('✅ Đã xuất ' + count + ' ca → file JSON');
}

function importCasesJSON() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json';
  inp.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      const keys = Object.keys(imported);
      if (!keys.length) { showNotif('⚠️ File rỗng', 'warn'); return; }
      // Validate structure
      const first = imported[keys[0]];
      if (!first.id || !first.name) { showNotif('❌ File không đúng định dạng ThaoDan backup', 'err'); return; }
      const mode = confirm('BẠN MUỐN:\n\n[OK] = GỘP thêm vào ca hiện tại\n[Cancel] = THAY THẾ toàn bộ (xóa ca cũ)');
      const cases = mode ? loadCases() : {};
      let added = 0, skipped = 0;
      keys.forEach(k => {
        if (cases[k] && mode) { skipped++; }
        else { cases[k] = imported[k]; added++; }
      });
      saveCases(cases);
      renderCaseList();
      updateCasesCount();
      showNotif('✅ Import: ' + added + ' ca mới' + (skipped ? ', ' + skipped + ' đã tồn tại' : ''));
    } catch(err) {
      showNotif('❌ File lỗi: ' + err.message, 'err');
    }
  };
  inp.click();
}

// DOCX EXPORT ENGINE v14.1 — FULL FIELDS + PRO FORMATTING
// Chuẩn văn phong hành chính Việt Nam
// ════════════════════════════════════════════════════════════
// EXPORT BÁO CÁO PHÂN TÍCH AI → .docx
// ════════════════════════════════════════════════════════════
async function dlReportDocx() {
  if (!D || !D._report) { showNotif('⚠️ Chưa có báo cáo phân tích', 'warn'); return; }
  let lib;
  try { lib = await loadDocxLib(); } catch(e) { showNotif('❌ ' + e.message, 'err'); return; }
  showNotif('📄 Đang tạo báo cáo Word...');
  const imgs = await Promise.all([fetchImg(LOGO_URL), fetchImg(FOOTER_URL)]);
  try {
    const r = D._report, stage = currentStage, cb = D.co_ban||{};
    const { Document, Paragraph, TextRun, ImageRun, AlignmentType, BorderStyle, WidthType } = lib;
    const PW=11906, MG=1134, CW=PW-2*MG, TNR='Times New Roman', NAVY='0F2D6B';
    const LS = { value:276, rule:'auto' };
    const Tx = (t,o) => new TextRun(Object.assign({text:t||'',font:TNR,size:24},o||{}));
    const Pg = (ch,o) => new Paragraph(Object.assign({children:Array.isArray(ch)?ch:[ch],spacing:{before:60,after:50,line:LS.value}},o||{}));
    const SH = (t) => new Paragraph({children:[Tx(t,{bold:true,color:NAVY,size:26})],spacing:{before:300,after:100,line:LS.value},border:{bottom:{style:BorderStyle.SINGLE,size:3,color:NAVY}}});
    const BL = (items) => (items||[]).map(i=>new Paragraph({children:[Tx('• '+String(i||''),{color:'1E293B'})],spacing:{before:30,after:30,line:LS.value}}));
    const HR = () => new Paragraph({border:{bottom:{style:BorderStyle.SINGLE,size:1,color:'CCCCCC'}},spacing:{before:160,after:80}});
    const SN = {1:'TIẾP CẬN BAN ĐẦU',2:'VÃNG GIA & ĐÁNH GIÁ',3:'KẾ HOẠCH CAN THIỆP',4:'TIẾN TRÌNH CẬP NHẬT',5:'KẾT THÚC CA'};

    const body = [];

    // ── Logo header ──
    if (imgs[0]) {
      try {
        body.push(new Paragraph({children:[new ImageRun({data:imgs[0],transformation:{width:50,height:50},type:'png'})],alignment:AlignmentType.LEFT,spacing:{before:0,after:60}}));
      } catch(e) {}
    }
    body.push(Pg([Tx('BÁO CÁO PHÂN TÍCH GĐ '+stage+' — '+(SN[stage]||''),{bold:true,color:NAVY,size:32})],{alignment:AlignmentType.CENTER}));
    body.push(Pg([Tx((cb.ho_ten||'—')+'   |   Ngày: '+new Date().toLocaleDateString('vi-VN'),{size:20,color:'666666',italics:true})],{alignment:AlignmentType.CENTER}));
    body.push(new Paragraph({border:{bottom:{style:BorderStyle.SINGLE,size:4,color:NAVY}},spacing:{before:80,after:120}}));

    // ── Stage 1 ──
    if (stage===1) {
      const rm=r.risk_matrix||{}, nw=r.needs_vs_wants||{}, pf=r.parentification||{};
      body.push(SH('I. MA TRẬN RỦI RO ĐA CHIỀU'));
      body.push(Pg([Tx('Mức rủi ro tổng thể: ',{bold:true}),Tx(r.risk||'?',{bold:true,color:r.risk==='Cao'?'DC2626':r.risk==='Trung bình'?'D97706':'059669'})]));
      if (r.risk_reason) body.push(Pg([Tx(r.risk_reason,{italics:true,color:'555555',size:22})]));
      [['an_toan_the_chat','An toàn Thể chất'],['an_toan_tam_ly','An toàn Tâm lý'],['moi_truong','Môi trường Sống'],['giao_duc','Giáo dục'],['he_thong_bao_ve','Hệ thống Bảo vệ']].forEach(([k,v])=>{
        const o=rm[k]||{}; body.push(Pg([Tx('• '+v+': ',{bold:true}),Tx('['+( o.level||'?')+']  '),Tx(o.detail||'',{color:'555555',size:22})]));
      });
      body.push(SH('II. DẤU HIỆU NGUY HIỂM (RED FLAGS)'));
      body.push(...BL(r.red_flags));
      if (pf.detected) {
        body.push(SH('III. PHỤ MẪU HÓA'));
        body.push(Pg([Tx('Loại: ',{bold:true}),Tx(pf.type||'')]));
        body.push(Pg([Tx(pf.description||'',{color:'333333'})]));
      }
      body.push(SH(pf.detected?'IV. NHU CẦU & YÊU CẦU':'III. NHU CẦU & YÊU CẦU'));
      if (nw.needs?.length) { body.push(Pg([Tx('Nhu cầu khách quan:',{bold:true})])); body.push(...BL(nw.needs)); }
      if (nw.wants?.length) { body.push(Pg([Tx('Yêu cầu chủ quan:',{bold:true})])); body.push(...BL(nw.wants)); }
      body.push(SH(pf.detected?'V. ƯU THẾ':'IV. ƯU THẾ'));
      body.push(...BL(r.strengths));
      body.push(SH(pf.detected?'VI. ĐỀ XUẤT':'V. ĐỀ XUẤT CAN THIỆP'));
      (r.suggestions||[]).forEach((s,i)=>{
        body.push(Pg([Tx((i+1)+'. [Ưu tiên '+s.priority+'] '+( s.action||''),{bold:true})]));
        if (s.reason) body.push(Pg([Tx('   Lý do: '+s.reason,{color:'555555',size:22})]));
        if (s.who||s.timeline) body.push(Pg([Tx('   Người thực hiện: '+(s.who||'—')+'  ·  Thời hạn: '+(s.timeline||'—'),{color:'555555',size:22})]));
      });
      body.push(SH(pf.detected?'VII. CÂU HỎI TIẾP THEO':'VI. CÂU HỎI TIẾP THEO'));
      body.push(...BL(r.next_questions));
    }

    // ── Stage 2 ──
    else if (stage===2) {
      const he=r.home_environment||{}, fd=r.family_dynamics||{}, vs=r.vs_stage1||{}, nw=r.needs_updated||{};
      body.push(SH('I. CẬP NHẬT MỨC RỦI RO'));
      body.push(Pg([Tx('Hiện tại: ',{bold:true}),Tx(r.risk_current||'?',{bold:true,color:'DC2626'}),Tx('  ('+( r.risk_update||'Không đổi')+')',{color:'888888'})]));
      if (r.risk_change_reason) body.push(Pg([Tx(r.risk_change_reason,{color:'555555',italics:true,size:22})]));
      body.push(SH('II. MÔI TRƯỜNG NHÀ Ở'));
      body.push(Pg([Tx('Mức an toàn: ',{bold:true}),Tx(he.safety_level||'?')]));
      if (he.key_observations?.length) { body.push(Pg([Tx('Quan sát:',{bold:true})])); body.push(...BL(he.key_observations)); }
      if (he.concerns?.length) { body.push(Pg([Tx('Mối lo ngại:',{bold:true})])); body.push(...BL(he.concerns)); }
      body.push(SH('III. ĐÁNH GIÁ GIA ĐÌNH'));
      body.push(Pg([Tx('Năng lực chăm sóc: ',{bold:true}),Tx(fd.caregiver_capacity||'?')]));
      body.push(Pg([Tx('Chất lượng quan hệ: ',{bold:true}),Tx(fd.relationship_quality||'?')]));
      if (fd.protective_factors?.length) { body.push(Pg([Tx('Yếu tố bảo vệ:',{bold:true})])); body.push(...BL(fd.protective_factors)); }
      if (fd.risk_factors?.length) { body.push(Pg([Tx('Yếu tố nguy cơ:',{bold:true})])); body.push(...BL(fd.risk_factors)); }
      body.push(SH('IV. SO VỚI GĐ 1'));
      if (vs.confirmed?.length) { body.push(Pg([Tx('✓ Xác nhận:',{bold:true})])); body.push(...BL(vs.confirmed)); }
      if (vs.new_findings?.length) { body.push(Pg([Tx('+ Phát hiện mới:',{bold:true})])); body.push(...BL(vs.new_findings)); }
      if (vs.contradictions?.length) { body.push(Pg([Tx('≠ Mâu thuẫn:',{bold:true})])); body.push(...BL(vs.contradictions)); }
      body.push(SH('V. CÂU HỎI TIẾP THEO'));
      body.push(...BL(r.next_questions));
    }

    // ── Stage 3 ──
    else if (stage===3) {
      const pa=r.plan_assessment||{}, rr=r.resources_review||{};
      body.push(SH('I. ĐÁNH GIÁ KẾ HOẠCH'));
      body.push(Pg([Tx('Tính khả thi: ',{bold:true}),Tx(pa.feasibility||'?')]));
      body.push(Pg([Tx('Mức độ tham gia của GĐ: ',{bold:true}),Tx(r.family_engagement||'?')]));
      body.push(Pg([Tx('Đánh giá thời gian: ',{bold:true}),Tx(r.timeline_assessment||'?')]));
      if (pa.strengths?.length) { body.push(Pg([Tx('Điểm mạnh:',{bold:true})])); body.push(...BL(pa.strengths)); }
      if (pa.gaps?.length) { body.push(Pg([Tx('Thiếu sót:',{bold:true})])); body.push(...BL(pa.gaps)); }
      if (pa.risks?.length) { body.push(Pg([Tx('Rủi ro:',{bold:true})])); body.push(...BL(pa.risks)); }
      body.push(SH('II. NHẬN XÉT TỪNG MỤC TIÊU'));
      (r.goals_review||[]).forEach(g=>{
        body.push(Pg([Tx('• '+(g.goal||''),{bold:true}),Tx('  →  Khả thi: '+(g.realistic?'Có':'Không'),{color:g.realistic?'059669':'DC2626'})]));
        if (g.comment) body.push(Pg([Tx('   '+g.comment,{color:'555555',size:22})]));
      });
      body.push(SH('III. NGUỒN LỰC'));
      if (rr.available?.length) { body.push(Pg([Tx('Sẵn có:',{bold:true})])); body.push(...BL(rr.available)); }
      if (rr.missing?.length) { body.push(Pg([Tx('Còn thiếu:',{bold:true})])); body.push(...BL(rr.missing)); }
      if (rr.suggestions?.length) { body.push(Pg([Tx('Đề xuất:',{bold:true})])); body.push(...BL(rr.suggestions)); }
      if ((r.priority_order||[]).length) { body.push(SH('IV. THỨ TỰ ƯU TIÊN')); body.push(...BL(r.priority_order)); }
    }

    // ── Stage 4 ──
    else if (stage===4) {
      const wb=r.child_wellbeing||{}, ns=r.next_session||{}, pa=r.plan_adjustment||{};
      body.push(SH('I. WELLBEING TRẺ'));
      [['Thể chất',wb.physical],['Tâm lý',wb.psychological],['Giáo dục',wb.education]].forEach(([lbl,val])=>{
        body.push(Pg([Tx(lbl+': ',{bold:true}),Tx(val||'Chưa đánh giá')]));
      });
      body.push(SH('II. TIẾN ĐỘ MỤC TIÊU'));
      (r.goals_progress||[]).forEach(g=>{
        const c={'Đạt':'059669','Đang tiến hành':'D97706','Chưa đạt':'DC2626','Bỏ qua':'888888'}[g.status]||'333333';
        body.push(Pg([Tx('• ['+( g.status||'?')+'] ',{bold:true,color:c}),Tx(g.goal||'',{bold:true})]));
        if (g.evidence) body.push(Pg([Tx('   📌 Bằng chứng: '+g.evidence,{color:'059669',size:22})]));
        if (g.comment) body.push(Pg([Tx('   '+g.comment,{color:'555555',size:22})]));
      });
      if ((r.positive_changes||[]).length) { body.push(SH('III. THAY ĐỔI TÍCH CỰC')); body.push(...BL(r.positive_changes)); }
      if ((r.barriers||[]).length) { body.push(SH('IV. RÀO CẢN')); body.push(...BL(r.barriers)); }
      if (pa.needed && pa.suggestions?.length) { body.push(SH('V. ĐIỀU CHỈNH KẾ HOẠCH')); body.push(...BL(pa.suggestions)); }
      body.push(SH('VI. ĐỊNH HƯỚNG BUỔI TIẾP THEO'));
      if (ns.focus) body.push(Pg([Tx(ns.focus,{bold:true})]));
      body.push(...BL(ns.actions));
    }

    // ── Stage 5 ──
    else if (stage===5) {
      const oc=r.outcomes||{}, cs=r.child_status_final||{}, rec=r.recommendations||{};
      body.push(SH('I. TÓM TẮT TOÀN CA'));
      if (r.case_summary) body.push(Pg([Tx(r.case_summary,{color:'1E293B'})]));
      body.push(SH('II. KẾT QUẢ ĐẠT ĐƯỢC'));
      body.push(Pg([Tx('Tỉ lệ đạt mục tiêu: ',{bold:true}),Tx(oc.achievement_rate||'?',{bold:true,color:oc.achievement_rate==='Cao'?'059669':oc.achievement_rate==='Thấp'?'DC2626':'D97706'})]));
      if (oc.achieved?.length) { body.push(Pg([Tx('✅ Đạt được:',{bold:true,color:'059669'})])); body.push(...BL(oc.achieved)); }
      if (oc.partial?.length) { body.push(Pg([Tx('⚡ Đạt một phần:',{bold:true,color:'D97706'})])); body.push(...BL(oc.partial)); }
      if (oc.not_achieved?.length) { body.push(Pg([Tx('❌ Chưa đạt:',{bold:true,color:'DC2626'})])); body.push(...BL(oc.not_achieved)); }
      body.push(SH('III. TÌNH TRẠNG TRẺ KHI ĐÓNG CA'));
      body.push(Pg([Tx('Mức độ an toàn: ',{bold:true}),Tx(cs.safety||'?',{color:cs.safety==='An toàn'?'059669':'D97706',bold:true})]));
      body.push(Pg([Tx('Wellbeing tổng thể: ',{bold:true}),Tx(cs.wellbeing||'?')]));
      if (cs.family_situation) body.push(Pg([Tx('Tình trạng gia đình: ',{bold:true}),Tx(cs.family_situation)]));
      if ((r.key_turning_points||[]).length) { body.push(SH('IV. ĐIỂM NGOẶT QUAN TRỌNG')); body.push(...BL(r.key_turning_points)); }
      if ((r.lessons_learned||[]).length) { body.push(SH('V. BÀI HỌC KINH NGHIỆM')); body.push(...BL(r.lessons_learned)); }
      body.push(SH('VI. KHUYẾN NGHỊ'));
      if (rec.for_child?.length) { body.push(Pg([Tx('Cho trẻ:',{bold:true})])); body.push(...BL(rec.for_child)); }
      if (rec.for_family?.length) { body.push(Pg([Tx('Cho gia đình:',{bold:true})])); body.push(...BL(rec.for_family)); }
      if (rec.for_organization?.length) { body.push(Pg([Tx('Cho tổ chức:',{bold:true})])); body.push(...BL(rec.for_organization)); }
      if (r.follow_up_needed) {
        body.push(SH('VII. KẾ HOẠCH THEO DÕI SAU CA'));
        body.push(Pg([Tx(r.follow_up_plan||'Cần xác định kế hoạch theo dõi',{color:'1E293B'})]));
      }
    }

    // ── Ghi chú giám sát (mọi giai đoạn) ──
    if ((r.supervision_notes||[]).length) {
      body.push(SH('GHI CHÚ GIÁM SÁT VIÊN'));
      body.push(...BL(r.supervision_notes));
    }
    body.push(HR());
    body.push(Pg([Tx('Cơ sở Thảo Đàn — Trung tâm Dịch vụ Xã hội TP.HCM',{size:20,color:'888888',italics:true})],{alignment:AlignmentType.CENTER}));

    // Footer image
    let footerSection={};
    if (imgs[1]) {
      try {
        const {Footer:FC}=lib;
        footerSection={default:new FC({children:[new Paragraph({children:[new ImageRun({data:imgs[1],transformation:{width:794,height:79},type:'png'})],alignment:AlignmentType.CENTER})]})};
      } catch(e){}
    }
    const doc=new Document({sections:[{properties:{page:{size:{width:PW,height:16838},margin:{top:MG,right:MG,bottom:720,left:MG,footer:0}}},footers:footerSection,children:body}]});
    const blob=await lib.Packer.toBlob(doc);
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    const cn=(cb.ho_ten||'Ca').replace(/\s+/g,'_');
    a.href=url; a.download='ThaoDan_BaoCao_GD'+stage+'_'+cn+'.docx'; a.click();
    URL.revokeObjectURL(url);
    showNotif('✅ Đã xuất báo cáo GĐ '+stage);
  } catch(e) { showNotif('❌ '+e.message,'err'); console.error(e); }
}

// ════════════════════════════════════════════════════════════
const FF=["Form0_Ho_so_xa_hoi","Form1_Phieu_tiep_can","Form2_Phuc_trinh_vang_gia","Form3a_Danh_gia_khan_cap","Form3b_Danh_gia_nhu_cau","Form4_Ke_hoach_can_thiep","Form5_Tien_do_thuc_hien","Form6_Cap_nhat_tien_trinh","Form7_Phieu_chuyen_gui","Form8_Phieu_ket_thuc_ca","BaoCao_QLTH"];

async function loadDocxLib(){
  if(docxLib)return docxLib;
  return new Promise((res,rej)=>{
    const s=document.createElement("script");
    s.src="https://unpkg.com/docx@8.5.0/build/index.umd.js";
    s.onload=()=>{docxLib=window.docx;res(docxLib);};
    s.onerror=()=>rej(new Error("Không tải được docx.js"));
    document.head.appendChild(s);
  });
}
async function fetchImg(url){
  try{const r=await fetch(url,{mode:"cors"});if(!r.ok)return null;return new Uint8Array(await r.arrayBuffer());}catch(e){return null;}
}

async function exportSelected(){
  if(!D){showNotif('⚠️ Chưa có dữ liệu','warn');return;}
  const selected=[];
  document.querySelectorAll('.form-item input[type=checkbox]').forEach((chk,i)=>{if(chk.checked)selected.push(i);});
  if(!selected.length){showNotif('⚠️ Chưa chọn form nào — tick checkbox bên trái','warn');return;}
  let lib;
  try{lib=await loadDocxLib();}catch(e){showNotif('❌ '+e.message,'err');return;}
  const imgs=await Promise.all([fetchImg(LOGO_URL),fetchImg(FOOTER_URL)]);
  showNotif('📄 Đang tạo '+selected.length+' file...');
  for(const i of selected){
    try{
      const doc=await buildDocx(i,imgs[0],imgs[1]);
      const blob=await lib.Packer.toBlob(doc);
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='ThaoDan_'+FF[i]+'.docx';a.click();
      URL.revokeObjectURL(url);
      await new Promise(r=>setTimeout(r,350));
    }catch(e){console.error('Form '+i+':',e);}
  }
  showNotif('✅ Đã xuất '+selected.length+' form');
}

async function dlDocx(fi){
  if(!D)return;
  try{
    const lib=await loadDocxLib();
    const imgs=await Promise.all([fetchImg(LOGO_URL),fetchImg(FOOTER_URL)]);
    const doc=await buildDocx(fi,imgs[0],imgs[1]);
    const blob=await lib.Packer.toBlob(doc);
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='ThaoDan_'+FF[fi]+'.docx';a.click();
    URL.revokeObjectURL(url);
    showNotif('✅ Đã tải '+FORM_NAMES[fi]);
  }catch(e){showNotif('❌ '+e.message,'err');}
}

async function buildDocx(fi,logoData,footerData,_collector){
  const lib=docxLib;
  const{Document,Paragraph,TextRun,Table,TableRow,TableCell,AlignmentType,BorderStyle,WidthType,ShadingType,VerticalAlign,ImageRun}=lib;
  const PW=11906,PH2=16838,MG=1134,CW=11906-2*1134;
  const TNR="Times New Roman",NAVY="0F2D6B";
  const T_BODY=24,T_SUB=24,T_SECT=26,T_TITLE=30,T_LOGO=26,T_TABLE=24,T_SMALL=20,T_META=18;
  const LS={value:276,rule:"auto"};
  const bn={style:BorderStyle.NONE,size:0,color:"FFFFFF"};
  const bna={top:bn,bottom:bn,left:bn,right:bn};
  function bdr(c){return{style:BorderStyle.SINGLE,size:1,color:c||"CCCCCC"};}
  function ba(c){const b=bdr(c);return{top:b,bottom:b,left:b,right:b};}

  // ══════════════════════════════════════════════════════════
  // TABLE-BASED FORM LAYOUT (UNICEF/UNHCR Style)
  // Mỗi field = 1 row: cột trái (label, nền xám) | cột phải (value, nền trắng)
  // ══════════════════════════════════════════════════════════

  // ── Auto capitalize chữ cái đầu chuẩn VN ──
  function capFirst(s){
    if(!s) return s;
    return s.charAt(0).toUpperCase()+s.slice(1);
  }

  function R(txt,o){return new TextRun(Object.assign({text:txt||"",font:TNR,size:T_BODY},o||{}));}

  // V: hiển thị giá trị inline — dùng cho P([V(...)]) còn sót
  function V(val){
    const cv=clean(val||'');
    if(!cv) return R(' ',{color:"FFFFFF",size:T_BODY});
    return R(capFirst(fmtDate(cv)),{color:"1E293B",size:T_BODY});
  }

  function P(ch,o){return new Paragraph(Object.assign({children:Array.isArray(ch)?ch:[ch],spacing:{before:40,after:30,line:LS.value}},o||{}));}

  // ── FIELD TABLE: Nhóm nhiều field thành 1 bảng gọn ──
  // rows = [["Label","Value"], ["Label2","Value2"], ...]
  // hoặc [["Label1","Val1","Label2","Val2"]] cho 2 cột
  // ══════════════════════════════════════════════════════════
  // FIELD DISPLAY — "Label : Value" inline style
  // Nền trắng, label bold, value regular, dấu : căn đều
  // ══════════════════════════════════════════════════════════

  function FTBL(rows, opts){
    opts = opts || {};
    const isTwoCol = opts.cols === 2;
    const paras = [];

    rows.forEach(r => {
      if (isTwoCol && r.length >= 4) {
        // 2 cặp label:value trên 1 dòng, dùng tab stop căn giữa
        const lbl1 = r[0]||'';
        const val1 = clean(r[1]||'');
        const lbl2 = r[2]||'';
        const val2 = clean(r[3]||'');
        const d1 = val1 ? capFirst(fmtDate(val1)) : '..............';
        const d2 = val2 ? capFirst(fmtDate(val2)) : '..............';
        const children = [];
        if (lbl1) {
          children.push(R(lbl1,{bold:true,size:T_TABLE,color:"333333"}));
          children.push(R(' :  ',{size:T_TABLE,color:"888888"}));
          children.push(R(d1,{size:T_TABLE,color:val1?"111111":"AAAAAA"}));
        }
        if (lbl2) {
          children.push(R('          ',{size:T_TABLE}));
          children.push(R(lbl2,{bold:true,size:T_TABLE,color:"333333"}));
          children.push(R(' :  ',{size:T_TABLE,color:"888888"}));
          children.push(R(d2,{size:T_TABLE,color:val2?"111111":"AAAAAA"}));
        }
        paras.push(new Paragraph({
          children: children,
          spacing:{before:50,after:50,line:LS.value},
          border:{bottom:{style:BorderStyle.SINGLE,size:1,color:"F0F0F0",space:1}}
        }));
      } else if (r.length === 1) {
        // Full-width value (mô tả dài)
        const cv = clean(r[0]||'');
        const display = cv ? capFirst(fmtDate(cv)) : '';
        if (display) {
          paras.push(new Paragraph({
            children:[R(display,{size:T_TABLE,color:"111111"})],
            spacing:{before:30,after:50,line:LS.value}
          }));
        }
      } else {
        // 1 cặp label:value
        const lbl = r[0]||'';
        const val = clean(r[1]||'');
        const display = val ? capFirst(fmtDate(val)) : '..............';
        paras.push(new Paragraph({
          children:[
            R(lbl,{bold:true,size:T_TABLE,color:"333333"}),
            R(' :  ',{size:T_TABLE,color:"888888"}),
            R(display,{size:T_TABLE,color:val?"111111":"AAAAAA"})
          ],
          spacing:{before:50,after:50,line:LS.value},
          border:{bottom:{style:BorderStyle.SINGLE,size:1,color:"F0F0F0",space:1}}
        }));
      }
    });

    // Wrap trong 1-cell table để giữ layout nhất quán
    if (paras.length === 0) paras.push(P([R(' ')]));
    return new Table({
      width:{size:CW,type:WidthType.DXA},
      columnWidths:[CW],
      rows:[new TableRow({children:[new TableCell({
        children:paras,
        width:{size:CW,type:WidthType.DXA},
        borders:{top:{style:BorderStyle.NONE,size:0,color:"FFFFFF"},bottom:{style:BorderStyle.NONE,size:0,color:"FFFFFF"},left:{style:BorderStyle.NONE,size:0,color:"FFFFFF"},right:{style:BorderStyle.NONE,size:0,color:"FFFFFF"}},
        margins:{top:30,bottom:30,left:0,right:0}
      })]})]
    });
  }

  // FL: 1 field inline
  function FL(lbl,val){
    return FTBL([[lbl, val||'']]);
  }

  // FLM: multi-field trên nhiều dòng (mỗi cặp 1 dòng, hoặc 2 cặp/dòng)
  function FLM(){
    const args=Array.from(arguments);
    if(args.length<=2){
      return FTBL([[ args[0]?args[0][0]:'', args[0]?args[0][1]:'', args[1]?args[1][0]:'', args[1]?args[1][1]:'' ]], {cols:2});
    }
    const rows=[];
    for(let i=0;i<args.length;i+=2){
      rows.push([
        args[i]?args[i][0]:'', args[i]?args[i][1]:'',
        args[i+1]?args[i+1][0]:'', args[i+1]?args[i+1][1]:''
      ]);
    }
    return FTBL(rows, {cols:2});
  }

  // SH: Section Header — LEVEL 1 (A. B. C.)
  function SH(txt){
    return new Paragraph({
      children:[R(txt,{bold:true,color:NAVY,size:T_SECT})],
      spacing:{before:360,after:120,line:LS.value},
      border:{bottom:{style:BorderStyle.SINGLE,size:3,color:NAVY}}
    });
  }

  // SUB: Sub-section label — LEVEL 2, chỉ bold, không viền
  function SUB(txt){
    return new Paragraph({
      children:[R(txt,{bold:true,size:T_SUB,color:"333333"})],
      spacing:{before:200,after:60,line:LS.value}
    });
  }

  // ML: Multi-line text area — có dữ liệu = hiện, không = để trống (viền nhẹ)
  function ML(val,n){
    n=n||2;const rows=[];
    if(val&&clean(val)){
      rows.push(new Paragraph({children:[R(capFirst(fmtDate(clean(val))),{color:"1E293B",size:T_BODY})],spacing:{before:40,after:60,line:LS.value}}));
    } else {
      for(let i=0;i<n;i++){
        rows.push(new Paragraph({
          children:[R(" ",{font:TNR,size:T_BODY})],
          spacing:{before:0,after:80},
          border:{bottom:{style:BorderStyle.SINGLE,size:1,color:"E0E0E0"}}
        }));
      }
    }
    return rows;
  }

  // CB: Checkbox
  function CB(opts,sel){
    const ch=[];
    opts.forEach((opt,i)=>{
      if(i>0) ch.push(R("     ",{size:T_BODY}));
      const chk=sel&&sel.toLowerCase().includes(opt.toLowerCase().substring(0,4));
      ch.push(R(chk?"☑ ":"☐ ",{font:"Segoe UI Symbol",size:T_BODY,color:chk?"1E293B":"555555"}));
      ch.push(R(opt,{size:T_BODY,color:"333333"}));
    });
    return P(ch,{spacing:{before:50,after:50}});
  }

  // TITLE: Tiêu đề form
  function TITLE(txt,sub){
    const ps=[new Paragraph({
      children:[R(txt,{bold:true,size:T_TITLE,color:NAVY})],
      alignment:AlignmentType.CENTER,
      spacing:{before:120,after:sub?50:160}
    })];
    if(sub) ps.push(new Paragraph({
      children:[R(sub,{size:T_BODY,color:"666666",italics:true})],
      alignment:AlignmentType.CENTER,
      spacing:{before:0,after:120}
    }));
    return ps;
  }

  // HR
  function HR(){return new Paragraph({border:{bottom:{style:BorderStyle.SINGLE,size:2,color:NAVY}},spacing:{before:60,after:100}});}

  // mkCell: cho bảng dữ liệu (thành viên GĐ, kế hoạch...)
  function mkCell(txt,isH,w,opts){
    opts=opts||{};
    const isEmpty=!isH&&(!txt||!clean(txt));
    const display=isEmpty?"":capFirst(fmtDate(clean(txt)||""));
    const textColor=isH?"FFFFFF":(isEmpty?"CCCCCC":"333333");
    return new TableCell({
      children:[new Paragraph({
        children:[R(display||' ',{bold:isH,color:textColor,size:T_TABLE})],
        alignment:isH?AlignmentType.CENTER:AlignmentType.LEFT,
        spacing:{before:40,after:40,line:LS.value}
      })],
      width:w?{size:w,type:WidthType.DXA}:undefined,
      borders:ba("CCCCCC"),
      shading:{fill:isH?NAVY:(opts.alt?"F7F8FA":"FFFFFF"),type:ShadingType.CLEAR},
      margins:{top:50,bottom:50,left:80,right:80},
      verticalAlign:VerticalAlign.CENTER
    });
  }
  function TBLF(hs,rows,cws){
    const n=hs.length;
    if(!cws){const w=Math.floor(CW/n);cws=[];for(let i=0;i<n;i++)cws.push(w);cws[n-1]=CW-w*(n-1);}
    return new Table({width:{size:CW,type:WidthType.DXA},columnWidths:cws,
      rows:[new TableRow({children:hs.map((h,i)=>mkCell(h,true,cws[i])),tableHeader:true})].concat(
        rows.map((r,ri)=>new TableRow({children:r.map((c,ci)=>mkCell(c,false,cws[Math.min(ci,cws.length-1)],{alt:ri%2===1}))})))});
  }
  function SGN(ls){
    const w=Math.floor(CW/ls.length);const cws=ls.map(()=>w);cws[ls.length-1]=CW-w*(ls.length-1);
    return new Table({width:{size:CW,type:WidthType.DXA},columnWidths:cws,rows:[
      new TableRow({children:ls.map(()=>new TableCell({children:[P([R("")])],height:{value:800,rule:"exact"},borders:bna,margins:{top:80,bottom:80,left:100,right:100}}))}),
      new TableRow({children:ls.map(l=>new TableCell({children:[
        new Paragraph({children:[R(l,{bold:true,size:T_BODY})],alignment:AlignmentType.CENTER,border:{top:{style:BorderStyle.SINGLE,size:1,color:"333333"}}}),
        new Paragraph({children:[R("(Ký, ghi rõ họ tên)",{italics:true,size:T_SMALL,color:"888888"})],alignment:AlignmentType.CENTER})
      ],borders:bna}))})
    ]});
  }
  function DATE_R(){return new Paragraph({children:[R("TP. HCM, ngày......tháng......năm......",{italics:true,size:T_BODY})],alignment:AlignmentType.RIGHT,spacing:{before:200,after:100}});}
  function NOTE(txt){return new Paragraph({children:[R(txt,{italics:true,size:T_SMALL,color:"666666"})],spacing:{before:40,after:40}});}
  function PHOTO_BOX(){
    return new Table({width:{size:1200,type:WidthType.DXA},rows:[
      new TableRow({children:[new TableCell({children:[
        new Paragraph({children:[R("Ảnh 4×6",{size:T_SMALL,color:"AAAAAA",italics:true})],alignment:AlignmentType.CENTER}),
      ],width:{size:1200,type:WidthType.DXA},height:{value:1600,rule:"exact"},borders:ba("BBBBBB"),verticalAlign:VerticalAlign.CENTER})]})
    ]});
  }

  const cb=D.co_ban||{},gd=D.gia_dinh||{},tt=D.tinh_trang||{},dg=D.danh_gia||{},vg=D.vang_gia||{},kh=D.ke_hoach||{},ktu=D.ket_thuc||{};
  const ncs=gd.nguoi_cham_soc||{},hv=tt.hoc_van||{},sk=tt.suc_khoe||{},tl=tt.tam_ly||{};
  const gks=tt.giay_khai_sinh||{},tr=tt.thuong_tru||{},cc=tt.cccd||{};
  const nlxh=D.nguon_luc_xa_hoi||{},cg=D.chuyen_gui||{};
  const _now=new Date(),mo=_now.getMonth()+1,yr=_now.getFullYear();
  const todayFmt=String(_now.getDate()).padStart(2,'0')+'/'+String(mo).padStart(2,'0')+'/'+yr;
  // Tìm cha/mẹ từ thành viên GĐ
  const tvs=gd.thanh_vien||[];
  const cha=tvs.find(t=>/cha|ba|bố|bó/i.test(t.quan_he))||{};
  const me=tvs.find(t=>/mẹ|me|má/i.test(t.quan_he))||{};
  const body=[];

  // ══ LOGO HEADER ══
  if(logoData){
    try{
      const lC=new TableCell({children:[new Paragraph({children:[new ImageRun({data:logoData,transformation:{width:58,height:58},type:"png"})],alignment:AlignmentType.LEFT})],width:{size:800,type:WidthType.DXA},borders:bna,verticalAlign:VerticalAlign.CENTER});
      const tC=new TableCell({children:[new Paragraph({children:[R("CƠ SỞ THẢO ĐÀN",{bold:true,size:T_LOGO,color:NAVY})],spacing:{before:0,after:10}}),new Paragraph({children:[R("Trung tâm Dịch vụ Xã hội · TP. Hồ Chí Minh",{size:T_META,color:"888888"})],spacing:{before:0,after:0}})],width:{size:CW-800-2400,type:WidthType.DXA},borders:bna,verticalAlign:VerticalAlign.CENTER});
      const iC=new TableCell({children:[new Paragraph({children:[R("Mã hồ sơ: DADH2025/00001",{size:T_META,bold:true})],alignment:AlignmentType.RIGHT,spacing:{before:0,after:10}}),new Paragraph({children:[R("Số TT: TĐ-00020",{size:T_META,bold:true})],alignment:AlignmentType.RIGHT,spacing:{before:0,after:10}}),new Paragraph({children:[R(todayFmt,{size:T_META})],alignment:AlignmentType.RIGHT})],width:{size:2400,type:WidthType.DXA},borders:bna,verticalAlign:VerticalAlign.CENTER});
      body.push(new Table({width:{size:CW,type:WidthType.DXA},columnWidths:[800,CW-800-2400,2400],rows:[new TableRow({children:[lC,tC,iC]})]}));
    }catch(e){body.push(P([R("CƠ SỞ THẢO ĐÀN — Mã hồ sơ: DADH2025/00001",{bold:true})]));}
  }else{body.push(P([R("Mã hồ sơ: DADH2025/00001     Số TT: TĐ-00020",{bold:true,size:T_TABLE})],{alignment:AlignmentType.RIGHT}));}
  body.push(HR());

  // ════════════════════════════════════════
  // FORM 0: HỒ SƠ THÔNG TIN TRẺ (ĐẦY ĐỦ)
  // ════════════════════════════════════════
  if(fi===0){
    body.push(...TITLE("HỒ SƠ THÔNG TIN TRẺ"));
    body.push(PHOTO_BOX());

    body.push(SH("A. THÔNG TIN TRẺ"));
    body.push(FTBL([
      ["Ngày tiếp cận đầu tiên", cb.ngay_tiep_can],
    ]));
    body.push(FTBL([
      ["Họ tên trẻ", cb.ho_ten, "Giới tính", cb.gioi_tinh],
      ["Ngày/tháng/năm sinh", cb.ngay_sinh, "Tuổi", cb.tuoi],
      ["Số điện thoại trẻ", cb.sdt_tre, "SĐT người thân", cb.sdt_nguoi_than],
    ],{cols:2}));
    body.push(FTBL([
      ["Địa chỉ thường trú (theo hộ khẩu)", cb.dia_chi_thuong_tru],
      ["Địa chỉ cư trú hiện tại", cb.dia_chi_hien_tai],
    ]));
    body.push(P([R("Trẻ hiện đang sống với:",{bold:true,size:T_BODY})]));
    body.push(CB(["Cha mẹ","Ông bà","Họ hàng","Anh chị","Một mình","Khác"],cb.song_voi));
    body.push(FTBL([
      ["Quá trình sống sau khi rời GĐ", gd.qua_trinh_roi_gd||""],
      ["Quan hệ trẻ với người sống cùng", gd.moi_quan_he_voi_tre],
    ]));

    body.push(SH("B. THÔNG TIN VỀ GIA ĐÌNH TRẺ"));
    body.push(SUB("Người chăm sóc chính"));
    body.push(FTBL([
      ["Họ tên", ncs.ho_ten, "Giới tính", ""],
      ["Ngày/tháng/năm sinh", ncs.ngay_sinh, "Điện thoại", ncs.sdt],
      ["Nghề nghiệp", ncs.nghe_nghiep, "Quan hệ với trẻ", ncs.quan_he],
    ],{cols:2}));
    body.push(FTBL([["Tình trạng sức khỏe", ncs.suc_khoe]]));

    body.push(SUB("Gia đình (cha/mẹ, anh/chị/em ruột và người sống cùng)"));
    const tvR=tvs.map(tv=>[tv.ho_ten,tv.quan_he,tv.nam_sinh,tv.suc_khoe,tv.nghe_nghiep,tv.ghi_chu]);
    while(tvR.length<4)tvR.push(["","","","","",""]);
    body.push(TBLF(["Họ và tên","Quan hệ với trẻ","Năm sinh","Tình trạng SK","Nghề nghiệp","Ghi chú"],tvR,[1600,1300,900,1400,1500,1938]));

    body.push(SUB("Hoàn cảnh gia đình (kinh tế, điều kiện sống, nhà ở, thu nhập)"));
    body.push(...ML(gd.hoan_canh,3));

    body.push(SH("C. TÌNH TRẠNG CỦA TRẺ"));
    body.push(P([R("Trẻ thuộc nhóm:",{bold:true,size:T_BODY})]));
    body.push(CB(["Trẻ có nguy cơ rơi vào hoàn cảnh đặc biệt","Trẻ có HCĐB"],cb.nhom_tre));
    body.push(FTBL([
      ["Công việc trẻ đang làm", tt.cong_viec],
    ]));
    body.push(FTBL([
      ["Thời gian làm việc (h/ngày)", tt.thoi_gian_lam_viec, "Bắt đầu làm từ năm", tt.bat_dau_lam_tu],
    ],{cols:2}));

    body.push(SUB("Tình trạng giấy tờ pháp lý"));
    body.push(FTBL([
      ["Giấy khai sinh", gks.co||"", "Không có, lý do", gks.ly_do||""],
      ["Đăng ký thường trú", tr.co||"", "Không có, lý do", tr.ly_do||""],
      ["Căn cước công dân", cc.co||"", "Không có, lý do", cc.ly_do||""],
    ],{cols:2}));

    body.push(SUB("Tình trạng giáo dục"));
    body.push(FTBL([["Trẻ có sở thích, năng khiếu", hv.so_thich]]));
    body.push(FTBL([
      ["Đang đi học lớp", hv.lop, "Trường", hv.truong],
    ],{cols:2}));
    body.push(FTBL([["Kết quả học tập", hv.ket_qua]]));
    body.push(FTBL([
      ["Đã bỏ học lớp", hv.bo_hoc, "Vào năm", hv.nam_bo_hoc],
    ],{cols:2}));
    body.push(FTBL([
      ["Lý do bỏ học/không đi học", hv.ly_do_bo_hoc],
    ]));
    body.push(FTBL([
      ["Trẻ có đi học nghề", hv.hoc_nghe, "Nghề trẻ đã học", hv.nghe_da_hoc||""],
    ],{cols:2}));
    body.push(FTBL([["Ước mơ nghề nghiệp", hv.uoc_mo]]));

    body.push(SUB("Tình trạng sức khỏe"));
    body.push(CB(["Bình thường","Khuyết tật","Bệnh nan y","Khác"],sk.tinh_trang));
    body.push(FTBL([
      ["Trẻ có BHYT", sk.bhyt, "Cân nặng", sk.can_nang],
    ],{cols:2}));
    body.push(FTBL([
      ["Chiều cao", sk.chieu_cao, "Được khám khi bệnh", sk.duoc_kham||""],
    ],{cols:2}));
    body.push(FTBL([["Trong 6 tháng qua trẻ có bệnh gì", sk.benh_trong_6t]]));

    body.push(SUB("Tình trạng tâm lý — xã hội"));
    body.push(FTBL([
      ["Tăng động, quấy phá, không tập trung", tl.tang_dong],
      ["Bi quan, mất niềm tin, động lực", tl.bi_quan],
      ["Tâm lý bất thường / tự tổn thương", tl.tu_ton_thuong],
      ["Vấn đề tâm lý xã hội khác", tl.mo_ta],
    ]));

    body.push(SUB("Sở thích năng khiếu"));
    body.push(...ML(hv.so_thich,1));

    body.push(SUB("Vấn đề/nhu cầu hiện tại của trẻ"));
    body.push(...ML(dg.nhan_xet_nvxh,3));

    body.push(SUB("Nhận xét của NVXH và đề xuất hướng hỗ trợ trẻ"));
    body.push(...ML(D.de_xuat,3));

    body.push(SUB("Các nguồn lực trẻ đã tiếp cận được (tài chính, vật chất, tinh thần)"));
    body.push(FTBL([
      ["● Tại quận, phường", nlxh.quan_phuong],
      ["● Tại nhà thờ, chùa", nlxh.ton_giao],
      ["● Tổ chức, ân nhân", nlxh.to_chuc],
      ["Mô tả đường đi tới nhà trẻ", nlxh.duong_di],
    ]));

    body.push(DATE_R());
    body.push(SGN(["Giám sát","Nhân viên xã hội"]));
    body.push(NOTE("Lưu ý: Phiếu xã hội lưu bản chính tại Cơ sở. Phiếu xã hội không thay thế phiếu chuyển cơ sở."));

  // ════════════════════════════════
  // FORM 1: PHIẾU TIẾP CẬN (ĐẦY ĐỦ)
  // ════════════════════════════════
  }else if(fi===1){
    body.push(...TITLE("PHIẾU TIẾP CẬN"));
    body.push(SH("A. THÔNG TIN TRẺ"));
    body.push(FLM(["Họ tên trẻ",cb.ho_ten],["Giới tính",cb.gioi_tinh]));
    body.push(FLM(["Ngày/tháng/năm sinh",cb.ngay_sinh],["Tuổi",cb.tuoi]));
    body.push(FLM(["SĐT trẻ",cb.sdt_tre],["SĐT người thân",cb.sdt_nguoi_than]));
    body.push(FL("Địa chỉ thường trú (theo sổ hộ khẩu)",cb.dia_chi_thuong_tru));
    body.push(FL("Địa chỉ cư trú hiện tại",cb.dia_chi_hien_tai));
    body.push(P([R("Trẻ hiện đang sống với:",{bold:true})]));
    body.push(CB(["Cha mẹ","Ông bà","Họ hàng","Anh chị","Một mình","Khác"],cb.song_voi));
    body.push(P([R("Trẻ thuộc nhóm:",{bold:true})]));
    body.push(CB(["Trẻ có hoàn cảnh đặc biệt, nhóm cộng đồng nghèo/nhập cư","Trẻ có nguy cơ rơi vào hoàn cảnh đặc biệt"],cb.nhom_tre));
    body.push(SUB("Về giấy tờ tùy thân của trẻ"));
    body.push(FLM(["Giấy khai sinh",gks.co],["Không có, lý do",gks.ly_do]));
    body.push(FLM(["Đăng ký thường trú",tr.co],["Không có, lý do",tr.ly_do]));
    body.push(FLM(["Mã định danh/Căn cước CD",cc.co],["Không có, lý do",cc.ly_do]));
    body.push(SUB("Về học vấn của trẻ"));
    body.push(FLM(["Trẻ đang học lớp",hv.lop],["Trường",hv.truong]));
    body.push(FLM(["Đã bỏ học (học hết lớp)",hv.bo_hoc],["Vào năm",hv.nam_bo_hoc]));
    body.push(FL("Lý do bỏ học hay không đi học",hv.ly_do_bo_hoc));
    body.push(CB(["Trẻ chưa từng học nghề","Trẻ đã từng tham gia học nghề"],hv.hoc_nghe));
    body.push(FLM(["Họ tên người chăm sóc chính",ncs.ho_ten],["Điện thoại liên hệ",ncs.sdt]));
    body.push(FLM(["Năm sinh",ncs.ngay_sinh],["Nghề nghiệp",ncs.nghe_nghiep],["Quan hệ với trẻ",ncs.quan_he]));
    body.push(SH("B. HOÀN CẢNH GIA ĐÌNH CỦA TRẺ"));
    body.push(P([V(gd.hoan_canh)]));body.push(...ML("",3));
    body.push(SH("C. TÌNH TRẠNG CỦA TRẺ HIỆN TẠI"));
    body.push(FL("Trẻ đang kiếm sống bằng công việc gì",tt.cong_viec));
    body.push(FLM(["Tình trạng sức khỏe thể chất",sk.tinh_trang],["Bệnh lý",sk.benh_trong_6t]));
    body.push(FL("Tinh thần, thái độ trẻ",tl.mo_ta));
    body.push(FL("Trẻ đang gặp vấn đề hay nguy cơ gì",dg.nguy_co));
    body.push(P([R("Mong muốn của trẻ tại thời điểm tiếp cận:",{bold:true})]));
    body.push(CB(["Đi học","Học nghề","Kiếm việc làm","Chỗ ở","Khác"],dg.yeu_cau_tre));
    body.push(SH("D. THÔNG TIN NGƯỜI TIẾP CẬN"));
    body.push(FLM(["Họ tên",cb.nguoi_tiep_can],["Số điện thoại",cb.sdt_nguoi_than]));
    body.push(FLM(["Ngày tiếp cận",cb.ngay_tiep_can],["Nơi tiếp cận",cb.noi_tiep_can]));
    body.push(DATE_R());
    body.push(SGN(["Giám sát","Nhân viên xã hội TC"]));

  // ════════════════════════════════
  // FORM 2: PHÚC TRÌNH VÃNG GIA
  // ════════════════════════════════
  }else if(fi===2){
    body.push(...TITLE("PHÚC TRÌNH VÃNG GIA"));
    body.push(FLM(["Họ và tên trẻ",cb.ho_ten],["Giới tính",cb.gioi_tinh]));
    body.push(FLM(["Phiếu tiếp cận số","......./......./.........."],["Năm sinh trẻ",cb.ngay_sinh]));
    body.push(FL("Địa chỉ thường trú (theo sổ hộ khẩu)",cb.dia_chi_thuong_tru));
    body.push(FL("Địa chỉ cư trú hiện tại",cb.dia_chi_hien_tai));
    body.push(FL("Trước khi đến vãng gia, NVXH đã liên hệ với",vg.nguoi_tiep_xuc));
    body.push(FLM(["Họ tên người tiếp xúc",vg.nguoi_tiep_xuc],["Quan hệ với trẻ",vg.quan_he_voi_tre]));
    body.push(FLM(["Năm sinh",""]),FL("Nghề nghiệp",""),FL("Số điện thoại liên hệ",vg.sdt));
    body.push(FLM(["Ngày đi vãng gia",vg.ngay_vang_gia],["Lần vãng gia thứ",vg.lan_vang_gia],["Có gặp TC",vg.co_gap_tc]));
    body.push(FL("Mục đích buổi vãng gia",vg.muc_dich));
    body.push(FL("Những phát hiện khác của NVXH",vg.phat_hien_khac));
    body.push(P([R("Những quan sát của NVXH về hoàn cảnh gia đình trẻ:",{bold:true})]));
    body.push(SUB("Điều kiện về môi trường sống của gia đình (nhà ở, điều kiện sinh hoạt, vật dụng, kinh tế, bối cảnh xung quanh)"));
    body.push(P([V(vg.quan_sat_mt)]));body.push(...ML("",2));
    body.push(SUB("Điều kiện liên quan đến gia đình trẻ"));
    body.push(FL("Loại hình gia đình trẻ đang sinh sống (hạt nhân, mở rộng...)",vg.loai_hinh_gd||gd.loai_hinh));
    body.push(FL("Bầu khí và mối quan hệ trong gia đình",vg.bau_khi_gd||gd.bau_khi));
    body.push(FL("Tình trạng hôn nhân của cha mẹ",vg.tinh_trang_hn||gd.tinh_trang_hon_nhan));
    body.push(FL("Mối quan hệ giữa trẻ và những người đang sống với trẻ",vg.quan_he_tre_gd||gd.moi_quan_he_voi_tre));
    body.push(FL("Cách tương tác/giao tiếp của những thành viên gia đình với nhau",vg.cach_tuong_tac));
    body.push(FL("Những vấn đề liên quan đến gia đình hoặc gia đình mở rộng (nếu có)",vg.van_de_khac));
    body.push(FL("Mối quan hệ với cộng đồng xung quanh (nếu có)",vg.van_de_cong_dong||gd.cong_dong));
    body.push(FL("Những vấn đề liên quan đến giáo dục (nếu có)",vg.van_de_giao_duc));
    body.push(FL("Những vấn đề liên quan đến sức khỏe (nếu có)",vg.van_de_suc_khoe));
    body.push(FL("Những vấn đề liên quan đến hành chính (nếu có)",vg.van_de_hanh_chinh));
    body.push(FL("Những vấn đề liên quan đến kinh tế gia đình (nếu có)",vg.van_de_kinh_te));
    body.push(FL("Những quan sát khác của NVXH đối với gia đình",vg.quan_sat_khac||""));
    body.push(FL("Những vấn đề được nêu ra trong cuộc vãng gia từ gia đình (khác với lý do ban đầu — nếu có)",vg.van_de_tu_gd||""));
    body.push(SUB("Đánh giá chung của NVXH để theo dõi/hỗ trợ"));
    body.push(P([V(vg.danh_gia_chung)]));body.push(...ML("",2));
    body.push(DATE_R());
    body.push(SGN(["Giám sát","Nhân viên xã hội"]));

  // ══════════════════════════════════════════
  // FORM 3a: ĐÁNH GIÁ KHẨN CẤP (3 TRANG ĐẦY ĐỦ)
  // ══════════════════════════════════════════
  }else if(fi===3){
    // ── TRANG 1: PHIẾU ĐÁNH GIÁ ──
    body.push(...TITLE("PHIẾU ĐÁNH GIÁ TÌNH TRẠNG CỦA TRẺ",todayFmt+" — Đối với trẻ cần hỗ trợ khẩn cấp"));
    body.push(PHOTO_BOX());
    body.push(SH("1. Thông tin về trẻ"));
    body.push(FLM(["Họ tên (nếu được biết)",cb.ho_ten],["Tuổi (hoặc ước lượng)",cb.tuoi]));
    body.push(FLM(["Giới tính",cb.gioi_tinh]));
    body.push(FL("Địa điểm (trẻ đang ở đâu vào thời điểm nhận được thông báo?)",cb.dia_chi_hien_tai));
    body.push(FLM(["Họ tên cha của trẻ",cha.ho_ten||""],["Năm sinh",cha.nam_sinh||""],["Nghề nghiệp",cha.nghe_nghiep||""]));
    body.push(FLM(["Họ tên mẹ của trẻ",me.ho_ten||""],["Năm sinh",me.nam_sinh||""],["Nghề nghiệp",me.nghe_nghiep||""]));
    body.push(FL("Hoàn cảnh gia đình",gd.hoan_canh));body.push(...ML("",1));
    body.push(FL("Tình trạng hiện tại của trẻ",dg.nhan_xet_nvxh));body.push(...ML("",2));
    body.push(P([R("Những tổn thương của trẻ (nghiêm trọng không? Như thế nào?):",{bold:true})]));
    body.push(P([V([cf(dg.van_de_the_chat),cf(dg.van_de_tam_ly)].filter(Boolean).join(" | "))]));body.push(...ML("",1));
    body.push(FL("Tác động của các hành vi/yếu tố gây tổn thương đến sự phát triển của trẻ như thế nào?",dg.van_de_nhan_thuc));body.push(...ML("",1));
    body.push(FL("Các yếu tố khác có khả năng gây tổn thương thêm cho trẻ?",dg.nguy_co));body.push(...ML("",1));
    body.push(FL("Trẻ có cần được can thiệp khẩn cấp không? (Trong vòng 24 tiếng, 32 tiếng hay 72 tiếng) Nhu cầu cụ thể là gì?",dg.muc_khan_cap));body.push(...ML("",1));
    body.push(FL("Hiện tại ai là người chăm sóc, giám hộ cho trẻ? Chất lượng chăm sóc thế nào?",ncs.ho_ten||""));body.push(...ML("",1));
    body.push(FL("Những thuận lợi và khó khăn trong môi trường chăm sóc và bảo vệ trẻ là gì?",dg.yeu_to_bao_ve));body.push(...ML("",1));
    body.push(P([R("Nhận xét đề xuất của NVXH:",{bold:true})]));body.push(P([V(dg.nhan_xet_nvxh)]));body.push(...ML("",2));
    body.push(DATE_R());body.push(SGN(["Giám sát","Nhân viên xã hội"]));
    body.push(NOTE("Nơi nhận: Lưu hồ sơ. Đã gửi....."));

    // ── TRANG 2: KẾ HOẠCH CAN THIỆP, TRỢ GIÚP TRẺ EM ──
    body.push(new Paragraph({children:[new lib.PageBreak()],spacing:{before:0,after:0}}));
    body.push(SH("KẾ HOẠCH CAN THIỆP, TRỢ GIÚP TRẺ EM"));
    body.push(P([R("1) Liệt kê các vấn đề của trẻ (sắp xếp theo thứ tự ưu tiên cần can thiệp, trợ giúp):",{bold:true})]));
    body.push(P([V(dg.nguy_co)]));body.push(...ML("",2));
    body.push(P([R("2) Xác định nhu cầu của trẻ (sắp xếp theo thứ tự ưu tiên):",{bold:true})]));
    body.push(P([V([cf(dg.nhu_cau_the_chat),cf(dg.nhu_cau_tam_ly),cf(dg.nhu_cau_nhan_thuc)].filter(Boolean).join("; "))]));body.push(...ML("",1));
    body.push(P([R("3) Mục tiêu can thiệp hỗ trợ:",{bold:true})]));
    const mts=(kh.nhu_cau_ho_tro||[]).filter(n=>n.muc_tieu);
    mts.forEach((m,i)=>body.push(FL("Mục tiêu "+(i+1),m.muc_tieu)));
    if(!mts.length){body.push(FL("Mục tiêu 1",""));body.push(FL("Mục tiêu 2",""));}
    body.push(TBLF(["Mục tiêu","Giải pháp","Người thực hiện","Thời gian","Nguồn lực/Kinh phí"],
      mts.length?mts.map(m=>[m.loai,m.muc_tieu,"","",""]):[[""],[""],[""],[""],[""],[""]]));
    body.push(P([R("4) Xây dựng hoạt động can thiệp:",{bold:true})]));
    const hds=(kh.hoat_dong||[]).map(h=>[h.noi_dung,"",h.muc_tieu_so||"",h.thoi_gian,""]);
    while(hds.length<3)hds.push(["","","","",""]);
    body.push(TBLF(["Hoạt động","Chỉ số đầu ra","Người thực hiện","Thời gian","Kết quả"],hds));
    body.push(P([R("5) Nhận xét/đánh giá/đề xuất:",{bold:true})]));body.push(P([V(D.de_xuat)]));body.push(...ML("",2));
    body.push(DATE_R());body.push(SGN(["Giám sát","Nhân viên xã hội"]));

    // ── TRANG 3: PHIẾU THEO DÕI TÌNH HÌNH ──
    body.push(new Paragraph({children:[new lib.PageBreak()],spacing:{before:0,after:0}}));
    body.push(SH("PHIẾU THEO DÕI TÌNH HÌNH VÀ KẾT QUẢ THỰC HIỆN"));
    body.push(FL("Họ và tên trẻ",cb.ho_ten));
    body.push(FL("Họ và tên NVXH",ktu.nvxh_phu_trach||""));
    body.push(FL("Thời gian thực hiện",""));
    const tdRows=(Array.isArray(D.cap_nhat)?D.cap_nhat:[]).map(cu=>[cu.van_de,cu.ket_qua,""]);
    while(tdRows.length<4)tdRows.push(["","",""]);
    body.push(TBLF(["Hoạt động can thiệp, trợ giúp","Đánh giá kết quả","Nhận xét/Đề xuất"],tdRows,[3000,3400,3238]));
    body.push(P([R("Đánh giá chung:",{bold:true})]));body.push(...ML("",2));
    body.push(P([R("Đề xuất các hoạt động tiếp theo:",{bold:true})]));body.push(...ML("",1));
    body.push(DATE_R());body.push(SGN(["Giám sát","Nhân viên xã hội"]));

  // ═══════════════════════════════
  // FORM 3b — 9: GIỮ NGUYÊN + SỬA NHỎ
  // ═══════════════════════════════
  }else if(fi===4){
    body.push(...TITLE("ĐÁNH GIÁ VẤN ĐỀ VÀ NHU CẦU CỦA TRẺ",todayFmt));
    body.push(SH("Thông tin về trẻ"));
    body.push(FL("Họ tên trẻ",cb.ho_ten));body.push(FLM(["Tuổi (hoặc ước lượng tuổi)",cb.tuoi],["Giới tính",cb.gioi_tinh]));
    body.push(FL("Địa điểm (trẻ đang ở đâu vào thời điểm nhận được thông báo?)",cb.dia_chi_hien_tai));
    body.push(FL("Họ tên cha của trẻ",cha.ho_ten||""));
    body.push(FL("Họ tên mẹ của trẻ",me.ho_ten||""));
    body.push(FL("Hoàn cảnh gia đình",gd.hoan_canh));body.push(...ML("",2));
    body.push(SH("Đánh giá vấn đề của trẻ (Trẻ có những vấn đề gì sau đây? Hãy mô tả vấn đề!)"));
    body.push(SUB("Về thể chất"));body.push(P([V(dg.van_de_the_chat)]));body.push(...ML("",2));
    body.push(SUB("Về tâm lý/Tình cảm"));body.push(P([V(dg.van_de_tam_ly)]));body.push(...ML("",2));
    body.push(SUB("Về nhận thức"));body.push(P([V(dg.van_de_nhan_thuc)]));body.push(...ML("",1));
    body.push(SH("Xác định nhu cầu của trẻ (trẻ có những nhu cầu gì? Hãy mô tả nhu cầu!)"));
    body.push(SUB("Về thể chất"));body.push(P([V(dg.nhu_cau_the_chat)]));body.push(...ML("",1));
    body.push(SUB("Về tâm lý/tình cảm"));body.push(P([V(dg.nhu_cau_tam_ly)]));body.push(...ML("",1));
    body.push(SUB("Về nhận thức"));body.push(P([V(dg.nhu_cau_nhan_thuc)]));body.push(...ML("",1));
    body.push(SH("Mong đợi và đề xuất của trẻ:"));body.push(P([V(dg.yeu_cau_tre)]));body.push(...ML("",1));
    body.push(SH("Nhận xét — định hướng của NVXH"));body.push(P([V(dg.nhan_xet_nvxh)]));body.push(...ML("",2));
    body.push(DATE_R());body.push(SGN(["Giám sát","Nhân viên xã hội TC"]));
  }else if(fi===5){
    body.push(...TITLE("KẾ HOẠCH HỖ TRỢ CAN THIỆP"));
    body.push(FLM(["Họ và tên trẻ",cb.ho_ten],["Giới tính",cb.gioi_tinh]));
    body.push(FLM(["Hồ sơ xã hội","DADH2025/00001"],["Năm sinh",cb.ngay_sinh]));
    body.push(FLM(["Thời gian bắt đầu case",kh.bat_dau_case||cb.ngay_tiep_can],["Thời gian thực hiện KH",kh.thoi_gian_kh]));
    body.push(SH("I. Các nhu cầu cần hỗ trợ"));
    // 8 loại chuẩn theo mẫu gốc
    const NC_CHUAN=["Học bổng","Học nghề, việc làm","Chăm sóc sức khỏe, y tế","Nâng cao năng lực kỹ năng sống","Mối quan hệ gia đình và xã hội","Tâm lý","Hòa nhập cộng đồng","Nhu cầu khác"];
    const ncMap={};(kh.nhu_cau_ho_tro||[]).forEach(nc=>{ncMap[(nc.loai||'').toLowerCase().trim()]={uu_tien:nc.uu_tien,muc_tieu:nc.muc_tieu};});
    const nc5=NC_CHUAN.map((loai,i)=>{
      const lo=loai.toLowerCase();
      // 1. Exact match
      let m=ncMap[lo];
      // 2. Word-based match: split to words ≥3 chars, check any overlap
      if(!m){
        const loWords=lo.split(/[\s,]+/).filter(w=>w.length>=3);
        const entry=Object.entries(ncMap).find(([k])=>{
          const kWords=k.split(/[\s,]+/).filter(w=>w.length>=3);
          return loWords.some(lw=>kWords.some(kw=>kw.includes(lw)||lw.includes(kw)));
        });
        m=entry?.[1];
      }
      m=m||{};
      return[String(i+1),loai,m.uu_tien||'',m.muc_tieu||''];
    });
    body.push(TBLF(["TT","Nhu cầu cần hỗ trợ","Mức độ ưu tiên (1, 2, 3)","Mục tiêu cụ thể cần đạt được"],nc5,[400,2800,1600,4838]));
    body.push(SH("II. Các hoạt động trợ giúp"));
    const hd5=(kh.hoat_dong||[]).map((h,i)=>[h.muc_tieu_so||String(i+1),h.noi_dung,fmtDate(h.thoi_gian),h.nguon_luc,h.nguon_luc_gd,h.nguon_luc_cs]);
    while(hd5.length<4)hd5.push(["","","","","",""]);
    body.push(TBLF(["Mục tiêu số","Hoạt động","Thời gian thực hiện","Nguồn lực/kinh phí","Nguồn lực gia đình","Nguồn lực Cơ sở"],hd5,[600,2600,1200,1600,1300,2338]));
    body.push(SH("III. Nguồn lực kết nối hỗ trợ"));
    body.push(...ML(kh.nguon_luc_ket_noi,2));
    body.push(SH("IV. Đánh giá nhận xét của nhân viên xã hội"));
    body.push(...ML(dg.nhan_xet_nvxh,3));
    body.push(SH("V. Ngày xem xét và điều chỉnh kế hoạch (tối thiểu 3–6 tháng)"));
    body.push(TBLF(["Lần 1 (ngày/tháng/năm)","Lần 2 (ngày/tháng/năm)","Lần 3 (ngày/tháng/năm)"],[["","",""]],[Math.floor(CW/3),Math.floor(CW/3),CW-2*Math.floor(CW/3)]));
    body.push(DATE_R());body.push(SGN(["Giám sát","PH Thân chủ","Nhân viên xã hội"]));
  }else if(fi===6){
    body.push(...TITLE("TIẾN ĐỘ THỰC HIỆN KẾ HOẠCH HỖ TRỢ CASE"));
    body.push(FLM(["Họ và tên trẻ",cb.ho_ten],["Giới tính",cb.gioi_tinh]));
    body.push(FLM(["Hồ sơ xã hội","DADH2025/00001"],["Năm sinh",cb.ngay_sinh]));
    body.push(FLM(["Thời gian bắt đầu case",kh.bat_dau_case||cb.ngay_tiep_can],["Thời gian thực hiện KH",kh.thoi_gian_kh||""]));
    // Ưu tiên D.tien_do (dữ liệu thực từ GĐ4), fallback ke_hoach (GĐ3)
    const _td6 = Array.isArray(D.tien_do) && D.tien_do.length > 0
      ? D.tien_do.map(t=>[t.nhu_cau||'', t.hoat_dong||'', t.thoi_gian||'', t.nhan_xet_nvxh||''])
      : (kh.nhu_cau_ho_tro||[]).filter(nc=>nc.muc_tieu).map(nc=>[nc.loai,nc.muc_tieu,'','']);
    while(_td6.length<9)_td6.push(['','','','']);
    body.push(TBLF(["Nhu cầu can thiệp, trợ giúp","Các hoạt động can thiệp, trợ giúp","Thời gian","Nhận xét của NVXH"],_td6,[2200,3000,1200,3238]));
    body.push(DATE_R());body.push(SGN(["Giám sát","Nhân viên xã hội"]));
  }else if(fi===7){
    body.push(...TITLE("PHIẾU CẬP NHẬT THÔNG TIN"));
    body.push(FLM(["Họ và tên trẻ",cb.ho_ten],["Giới tính",cb.gioi_tinh]));
    body.push(FLM(["Hồ sơ xã hội","DADH2025/00001"],["Năm sinh",cb.ngay_sinh]));
    body.push(FLM(["Thời gian bắt đầu case",kh.bat_dau_case||cb.ngay_tiep_can],["Thời gian thực hiện KH",kh.thoi_gian_kh||""]));
    body.push(FL("Nhân viên XH phụ trách case",ktu.nvxh_phu_trach));
    body.push(FL("Số điện thoại liên hệ",ktu.sdt_nvxh||""));
    const cu7=(Array.isArray(D.cap_nhat)?D.cap_nhat:[]).filter(cu=>cu&&(cu.van_de||cu.ket_qua)).map(cu=>[cu.thoi_gian,cu.van_de,cu.muc_tieu,cu.ket_qua]);
    while(cu7.length<4)cu7.push(["","","",""]);
    body.push(TBLF(["Thời gian","Vấn đề của trẻ","Mục tiêu can thiệp","Kết quả thực tế"],cu7,[1200,2700,2500,3238]));
    body.push(P([R("Nhận xét đề xuất của NVXH: ",{bold:true}),V(D.tien_trinh?.nhan_xet||"")]));body.push(...ML("",2));
    body.push(DATE_R());body.push(SGN(["Giám sát","Nhân viên xã hội"]));
  }else if(fi===8){
    body.push(...TITLE("PHIẾU CHUYỂN GỬI"));
    body.push(SH("1. Thông tin trẻ cần chuyển gửi"));
    body.push(FL("Họ và tên trẻ",cb.ho_ten));
    body.push(FLM(["Ngày tháng năm sinh",cb.ngay_sinh],["Giới tính",cb.gioi_tinh]));
    body.push(FLM(["Họ tên người chăm sóc",ncs.ho_ten],["Mối quan hệ với trẻ",ncs.quan_he]));
    body.push(FLM(["Địa chỉ",cb.dia_chi_hien_tai],["Số điện thoại",cb.sdt_nguoi_than]));
    body.push(SH("2. Thông tin người chuyển gửi"));
    body.push(FL("Họ và tên người chuyển gửi",cg.nguoi_chuyen));
    body.push(FL("Chức danh/vai trò/mối quan hệ với trẻ cần chuyển gửi",cg.chuc_danh));
    body.push(FL("Tên đơn vị/cơ quan/tổ chức chuyển gửi",cg.don_vi_chuyen));
    body.push(FLM(["Số điện thoại",cg.sdt_chuyen],["Email",cg.email_chuyen||""]));
    body.push(SH("3. Tóm tắt trường hợp trẻ cần chuyển gửi"));
    body.push(P([V(dg.nhan_xet_nvxh)]));body.push(...ML("",3));
    body.push(SH("4. Nội dung cần được hỗ trợ"));body.push(P([V(D.de_xuat)]));body.push(...ML("",2));
    body.push(SH("5. Nơi nhận chuyển gửi"));
    body.push(FL("Họ tên người nhận (nếu có)",cg.nguoi_nhan));
    body.push(FL("Tên đơn vị/cơ quan/tổ chức nhận chuyển gửi",cg.don_vi_nhan));
    body.push(FL("Địa chỉ",cg.dia_chi_nhan));
    body.push(FLM(["Số điện thoại liên hệ",cg.sdt_nhan],["Email",cg.email_nhan||""]));
    body.push(DATE_R());body.push(SGN(["Xác nhận từ nơi nhận chuyển gửi","Nhân viên xã hội"]));
  }else if(fi===9){
    body.push(...TITLE("PHIẾU KẾT THÚC CA",todayFmt));
    body.push(FLM(["Họ và tên trẻ",cb.ho_ten],["Giới tính",cb.gioi_tinh]));
    body.push(FLM(["Hồ sơ xã hội","DADH2025/00001"],["Năm sinh",cb.ngay_sinh]));
    body.push(FLM(["Thời gian bắt đầu case",ktu.bat_dau_case||cb.ngay_tiep_can],["Thời gian thực hiện KH",""]));
    body.push(FL("Địa điểm",cb.dia_chi_hien_tai));
    body.push(FLM(["Người nuôi dưỡng trẻ",ktu.nguoi_nuoi_duong||ncs.ho_ten],["Quan hệ với trẻ",ktu.quan_he||ncs.quan_he]));
    body.push(FLM(["Năm sinh",ktu.nam_sinh_nd||""],["Nghề nghiệp",ktu.nghe_nghiep_nd||""],["Số điện thoại",ktu.sdt_nd||""]));
    body.push(FLM(["Nhân viên XH phụ trách case",ktu.nvxh_phu_trach],["Số điện thoại liên hệ",ktu.sdt_nvxh||""]));
    body.push(SH("1. TÓM LƯỢC KẾT QUẢ QUÁ TRÌNH HỖ TRỢ"));
    body.push(SUB("Kết quả đạt được"));body.push(...ML(ktu.ket_qua_dat,3));
    body.push(SUB("Kết quả chưa đạt"));body.push(...ML(ktu.ket_qua_chua_dat,3));
    body.push(SH("2. LÝ DO KẾT THÚC HỖ TRỢ"));
    body.push(...ML(ktu.ly_do,5));
    body.push(SH("3. KẾ HOẠCH THEO DÕI SAU KHI KẾT THÚC HỖ TRỢ"));
    body.push(...ML(ktu.ke_hoach_theo_doi,4));
    body.push(DATE_R());body.push(SGN(["Giám sát case","Nhân viên xã hội"]));

  // ══════════════════════════════════════════════
  // FORM 10: BÁO CÁO QLTH (ĐẦY ĐỦ + GIÁM SÁT)
  // ══════════════════════════════════════════════
  }else{
    body.push(...TITLE("BÁO CÁO QUẢN LÝ TRƯỜNG HỢP","Mã hồ sơ: DADH2025/00001 — Số TT: TĐ-00020"));

    body.push(SH("PHẦN I: THÔNG TIN CƠ BẢN"));
    body.push(FL("Họ tên trẻ",cb.ho_ten));body.push(FL("Ngày sinh",cb.ngay_sinh));
    body.push(FL("Trình độ học vấn",cf(hv.lop)?"Lớp "+cf(hv.lop):""));
    body.push(P([R("Thông tin thân nhân trẻ:",{bold:true})]));
    const tv10=tvs.map(tv=>[tv.ho_ten,tv.quan_he,tv.nam_sinh,"",tv.ghi_chu]);
    while(tv10.length<3)tv10.push(["","","","",""]);
    body.push(TBLF(["Họ tên","Mối quan hệ với trẻ","Năm sinh","Cách thức liên hệ","Ghi chú (sống chung/riêng...)"],tv10,[2000,1500,900,2000,2838]));
    body.push(FL("Yêu cầu của trẻ và gia đình",[cf(dg.yeu_cau_tre),cf(dg.yeu_cau_gia_dinh)].filter(Boolean).join(" | ")));
    body.push(FL("Đánh giá nguy cơ nhanh từ NVXH",dg.nguy_co));
    body.push(FL("Tóm tắt quá trình giúp đỡ (nếu có từ các cơ quan khác hoặc từ Thảo Đàn)",D.tom_tat_qua_trinh||""));
    body.push(FL("Thông tin người cung cấp (họ tên/SĐT/địa chỉ/mối quan hệ với trẻ)",D.nguoi_cung_cap||""));

    body.push(SH("PHẦN II: TIẾN TRÌNH LÀM VIỆC VỚI THÂN CHỦ"));
    body.push(FL("Sơ đồ phả hệ","(Đính kèm — ngày lập: ......./......./...........)"));
    body.push(FL("Sơ đồ sinh thái","(Đính kèm)"));
    body.push(FL("Những sự kiện hiện tại (timeline/dòng thời gian)",D.timeline));body.push(...ML("",1));
    body.push(FL("Bối cảnh gia đình",gd.hoan_canh));body.push(...ML("",1));
    body.push(FL("Thiết lập làm việc với gia đình (mô tả quá trình vãng gia/làm việc)",D.thiet_lap_gd||""));body.push(...ML("",2));
    body.push(SUB("Nhu cầu của trẻ và gia đình sau khi NVXH làm việc và đi đến thống nhất"));
    body.push(FL("Về thể chất",dg.nhu_cau_the_chat));
    body.push(FL("Về tâm lý",dg.nhu_cau_tam_ly));
    body.push(FL("Về nhận thức",dg.nhu_cau_nhan_thuc));
    body.push(SUB("Kế hoạch hỗ trợ sau khi cam kết từ hai phía"));
    body.push(P([R("Mục tiêu:",{bold:true})]));
    const mtsBC=(kh.nhu_cau_ho_tro||[]).filter(nc=>nc.uu_tien);
    mtsBC.forEach((nc,i)=>body.push(FL("Mục tiêu "+(i+1)+" — "+nc.loai,nc.muc_tieu)));
    if(!mtsBC.length){body.push(FL("Mục tiêu 1",""));body.push(FL("Mục tiêu 2",""));}
    body.push(P([R("Kế hoạch chi tiết:",{bold:true})]));
    const khRows=mtsBC.map((nc,i)=>["Giai đoạn "+(i+1),nc.loai,"","","",""]);
    while(khRows.length<3)khRows.push(["","","","","",""]);
    body.push(TBLF(["Giai đoạn","Mục tiêu","Các hoạt động","Nguồn hỗ trợ","Kết quả mong đợi","Kết quả thực tế"],khRows));

    body.push(SUB("Lượng giá"));
    body.push(FL("Tiến trình hỗ trợ (các loại hình can thiệp)",""));body.push(...ML("",1));
    body.push(FL("Kết quả của tiến trình can thiệp",ktu.ket_qua_dat));body.push(...ML("",1));
    body.push(FL("Nhận xét",dg.nhan_xet_nvxh));body.push(...ML("",1));
    body.push(FL("Đề xuất",D.de_xuat));body.push(...ML("",1));

    body.push(SUB("Đóng hồ sơ"));
    const lyDoDong=["Vấn đề được giải quyết","Quyết định của thân chủ","Quyết định của NVXH","Chuyển gửi cho dịch vụ khác trong nội bộ","Chuyển gửi cho nhân viên khác (nội bộ)","Chuyển gửi cho...","Thân chủ — không đến làm việc tiếp","Kết thúc tiến trình hỗ trợ — lượng giá (3 tháng/6 tháng/12 tháng)","Khác (Nêu lý do)"];
    lyDoDong.forEach(ld=>{body.push(P([R("☐  ",{font:"Segoe UI Symbol",size:T_BODY}),R(ld,{size:T_BODY})]));});
    body.push(FL("Giải thích lý do",ktu.ly_do));body.push(...ML("",1));

    body.push(SUB("Phân tích và lý giải vấn đề — nhãn quan lý thuyết (nếu có)"));body.push(...ML("",2));
    body.push(SUB("Kết luận và kiến nghị (nếu có)"));
    body.push(...ML(D.de_xuat,1));

    // ── ĐÁNH GIÁ CỦA GIÁM SÁT (5 MỤC) ──
    body.push(SH("ĐÁNH GIÁ CỦA GIÁM SÁT"));
    const dgGS=[
      ["1. Về phía thân chủ",["Thay đổi tích cực","Hạn chế","Nguyên nhân"]],
      ["2. Về nhân viên xã hội",["Mặt tích cực","Hạn chế","Nguyên nhân"]],
      ["3. Về các nguồn lực — kết nối",["Mặt tích cực","Hạn chế","Nguyên nhân"]],
      ["4. Về tổ chức",["Mặt tích cực","Hạn chế","Nguyên nhân"]],
      ["5. Về chuyên môn",["Về loại hình can thiệp NVXH đã áp dụng","Về tiến trình QLTH","Về kết quả đạt được","Nguyên nhân và lý do kết thúc","Bài học kinh nghiệm"]]
    ];
    dgGS.forEach(([title,items])=>{
      body.push(SUB(title));
      items.forEach(item=>{body.push(FL("— "+item,""));});
      body.push(...ML("",1));
    });

    // ── KẾT LUẬN VÀ KIẾN NGHỊ CỦA GIÁM SÁT ──
    body.push(SH("KẾT LUẬN VÀ KIẾN NGHỊ CỦA GIÁM SÁT"));
    body.push(FL("Khuyến nghị đề xuất về chuyên môn",""));body.push(...ML("",1));
    body.push(FL("Khuyến nghị những giải pháp cho tổ chức trong tiến trình QLTH",""));body.push(...ML("",1));
    body.push(FL("Khuyến nghị cải tiến cả tiến trình và hệ thống trong quản lý trường hợp",""));body.push(...ML("",1));
    body.push(FL("Khác",""));body.push(...ML("",1));
    body.push(DATE_R());
    body.push(SGN(["Giám sát case"]));
    body.push(NOTE("CƠ SỞ THẢO ĐÀN"));
  }

  // ══ FOOTER IMAGE ══
  let footerSection={};
  if(footerData){
    try{
      const{Footer:FC}=lib;
      footerSection={default:new FC({children:[new Paragraph({children:[new ImageRun({data:footerData,transformation:{width:794,height:79},type:"png"})],alignment:AlignmentType.CENTER,spacing:{before:0,after:0},indent:{left:-MG,right:-MG}})]})};
    }catch(e){}
  }

  // _collector: nếu truyền vào array, ghi body+footer vào đó thay vì trả Document (dùng cho exportAllDocx)
  if (_collector) { _collector.push({ body, footerSection }); return null; }
  return new Document({sections:[{properties:{page:{size:{width:PW,height:PH2},margin:{top:MG,right:MG,bottom:720,left:MG,footer:0}}},footers:footerSection,children:body}]});
}

// ════════════════════════════════════════════════════════════
// EXPORT BỘ HỒ SƠ ĐẦY ĐỦ — 1 file .docx chứa tất cả biểu mẫu
// ════════════════════════════════════════════════════════════
async function exportAllDocx() {
  if (!D) { showNotif('⚠️ Chưa có dữ liệu — mở ca trước', 'warn'); return; }
  const btn = document.getElementById('btn-export-all-docx');
  const origTxt = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Đang tạo...'; }
  let lib;
  try { lib = await loadDocxLib(); } catch(e) {
    showNotif('❌ ' + e.message, 'err');
    if (btn) { btn.disabled = false; btn.innerHTML = origTxt; }
    return;
  }
  showNotif('📄 Đang tạo bộ hồ sơ đầy đủ...');
  const imgs = await Promise.all([fetchImg(LOGO_URL), fetchImg(FOOTER_URL)]);
  try {
    const pageProps = { size:{width:11906,height:16838}, margin:{top:1134,right:1134,bottom:720,left:1134,footer:0} };
    const sections = [];
    // Forms 0–9 (10 = báo cáo tổng hợp cuối danh sách)
    for (const fi of [0,1,2,3,4,5,6,7,8,9]) {
      const col = [];
      await buildDocx(fi, imgs[0], imgs[1], col);
      if (col[0]) sections.push({ properties:{ page: pageProps }, footers: col[0].footerSection, children: col[0].body });
    }
    if (!sections.length) throw new Error('Không có biểu mẫu nào để xuất');
    const doc = new lib.Document({ sections });
    const blob = await lib.Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const childName = (D.co_ban?.ho_ten || 'BoDayDu').replace(/\s+/g,'_');
    a.href = url; a.download = 'ThaoDan_' + childName + '_BoDayDu.docx'; a.click();
    URL.revokeObjectURL(url);
    showNotif('✅ Đã xuất bộ hồ sơ đầy đủ (10 biểu mẫu)');
  } catch(e) { showNotif('❌ ' + e.message, 'err'); console.error(e); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = origTxt; } }
}
// ════════════════════════════════════════════════════════════
// FEATURE 4.1 — Export ca ra file JSON (backup)
// ════════════════════════════════════════════════════════════
function exportCaseJSON() {
  if (!curCaseId) { showNotif('⚠️ Chưa chọn ca nào', 'warn'); return; }
  const cases = loadCases();
  const c = cases[curCaseId];
  if (!c) { showNotif('⚠️ Không tìm thấy ca', 'warn'); return; }
  const payload = JSON.stringify(c, null, 2);
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (c.name || 'ca').replace(/[^a-zA-Z0-9_À-ɏḀ-ỿ]/g, '_');
  a.href = url;
  a.download = `ThaoDan_${safeName}_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showNotif('✅ Đã backup ca ra file JSON');
}

// ════════════════════════════════════════════════════════════
// FEATURE 4.2 — Import ca từ file JSON (restore)
// ════════════════════════════════════════════════════════════
function importCaseJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const caseData = JSON.parse(text);
      // Validate cơ bản
      if (!caseData.id || !caseData.createdAt) {
        showNotif('❌ File không hợp lệ — không phải backup Thảo Đàn', 'err');
        return;
      }
      const cases = loadCases();
      // Nếu ca đã tồn tại → hỏi trước
      if (cases[caseData.id]) {
        if (!confirm(`Ca "${caseData.name}" đã tồn tại.\nGhi đè bằng dữ liệu từ file backup?`)) return;
      }
      cases[caseData.id] = caseData;
      saveCases(cases);
      // Load ca vừa import vào app
      loadCaseIntoApp(caseData.id);
      renderCaseList();
      updateCasesCount();
      switchMain('dash');
      showNotif(`✅ Đã import: ${caseData.name} — GĐ ${caseData.currentStage || 1}`);
    } catch(e) {
      showNotif('❌ Lỗi đọc file: ' + e.message, 'err');
    }
  };
  input.click();
}

// ════════════════════════════════════════════════════════════
// PRINT
// ════════════════════════════════════════════════════════════
function openPrint() {
  if (!D?._report) return;
  document.getElementById('ph-body').innerHTML = document.getElementById('chat-msgs').innerHTML;
  document.getElementById('pov').style.display = 'block';
}
function closePov() { document.getElementById('pov').style.display = 'none'; }
// ════════════════════════════════════════════════════════════
// PRINT FULL CASE — In toàn bộ form có dữ liệu
// ════════════════════════════════════════════════════════════
function printFullCase() {
  if (!D?.co_ban) { showNotif('⚠️ Chưa có dữ liệu ca', 'warn'); return; }
  const cb = D.co_ban || {};
  const caseName = cb.ho_ten || 'Ca chưa rõ tên';
  const now = new Date().toLocaleDateString('vi-VN');

  let h = '<div style="font-family:serif;font-size:13px;line-height:1.7;color:#1a1a2e;max-width:800px;margin:0 auto;">';
  
  // Cover
  h += '<div style="text-align:center;padding:30px 0 20px;border-bottom:3px double #0f2d6b;margin-bottom:20px;">';
  h += '<div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:3px;">Thảo Đàn Social Service Center</div>';
  h += '<div style="font-size:22px;font-weight:bold;color:#0f2d6b;margin:10px 0;">BÁO CÁO TỔNG HỢP QUẢN LÝ TRƯỜNG HỢP</div>';
  h += '<div style="font-size:16px;color:#333;">Trẻ: <strong>' + esc(caseName) + '</strong></div>';
  h += '<div style="font-size:12px;color:#888;margin-top:6px;">Ngày in: ' + now + ' · Giai đoạn: ' + currentStage + '/5</div>';
  h += '</div>';

  // Render từng form có dữ liệu
  const formSections = [
    { idx: 0, title: "FORM 0 — HỒ SƠ THÔNG TIN TRẺ" },
    { idx: 1, title: "FORM 1 — PHIẾU TIẾP CẬN" },
    { idx: 2, title: "FORM 2 — PHÚC TRÌNH VÃNG GIA" },
    { idx: 3, title: "FORM 3a — ĐÁNH GIÁ KHẨN CẤP" },
    { idx: 4, title: "FORM 3b — ĐÁNH GIÁ NHU CẦU" },
    { idx: 5, title: "FORM 4 — KẾ HOẠCH CAN THIỆP" },
    { idx: 6, title: "FORM 5 — TIẾN ĐỘ THỰC HIỆN" },
    { idx: 7, title: "FORM 6 — CẬP NHẬT TIẾN TRÌNH" },
    { idx: 8, title: "FORM 7 — PHIẾU CHUYỂN GỬI" },
    { idx: 9, title: "FORM 8 — PHIẾU KẾT THÚC CA" },
  ];

  // Tạo container ẩn để render form
  const tempFv = document.createElement("div");
  tempFv.style.display = "none";
  tempFv.id = "temp-fv-print";
  document.body.appendChild(tempFv);
  
  const origFv = document.getElementById("fv");
  const origDisplay = origFv.style.display;

  formSections.forEach(fs => {
    // Render form vào fv
    try {
      renderFormTab(fs.idx);
      const content = origFv.innerHTML;
      // Chỉ thêm nếu form có nội dung thực (không phải placeholder)
      if (content && !content.includes("Chưa có dữ liệu") && content.length > 200) {
        h += "<div style=\"page-break-inside:avoid;margin-bottom:24px;\">";
        h += "<div style=\"background:#0f2d6b;color:#fff;padding:8px 14px;border-radius:6px 6px 0 0;font-size:13px;font-weight:700;\">" + fs.title + "</div>";
        h += "<div style=\"border:1px solid #ddd;border-top:none;padding:12px 14px;border-radius:0 0 6px 6px;\">" + content + "</div>";
        h += "</div>";
      }
    } catch(e) {}
  });

  // Báo cáo AI (nếu có)
  if (D._report) {
    h += "<div style=\"page-break-before:always;margin-top:20px;\">";
    h += "<div style=\"background:#0f2d6b;color:#fff;padding:8px 14px;border-radius:6px 6px 0 0;font-size:13px;font-weight:700;\">BÁO CÁO PHÂN TÍCH AI</div>";
    h += "<div style=\"border:1px solid #ddd;border-top:none;padding:12px 14px;border-radius:0 0 6px 6px;\">";
    h += document.getElementById("chat-msgs")?.innerHTML || "";
    h += "</div></div>";
  }

  h += "</div>";

  // Khôi phục form view
  if (typeof curForm !== "undefined") renderFormTab(curForm);
  origFv.style.display = origDisplay;

  document.getElementById("ph-body").innerHTML = h;
  document.getElementById("pov").style.display = "block";
}

// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
// REMINDERS + REVIEW ALERTS
// ════════════════════════════════════════════════════════════
function checkReminders() {
  if (!curCaseId || !D) return;
  const c = loadCases()[curCaseId];
  if (!c) return;
  const now = new Date();
  const alerts = [];

  // Kiểm tra lượng giá định kỳ (3 tháng kể từ bắt đầu case hoặc lần lượng giá cuối)
  const startDate = D.ke_hoach?.bat_dau_case || D.co_ban?.ngay_tiep_can;
  if (startDate && currentStage >= 3) {
    const parts = startDate.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (parts) {
      const caseStart = new Date(parts[3], parts[2]-1, parts[1]);
      const monthsSince = (now - caseStart) / (1000*60*60*24*30);
      if (monthsSince >= 3 && monthsSince < 6) {
        alerts.push({type:'review', msg:'📋 Đã 3 tháng — cần lượng giá và điều chỉnh kế hoạch', color:'#d97706'});
      } else if (monthsSince >= 6) {
        alerts.push({type:'review', msg:'⚠️ Đã 6+ tháng — cần lượng giá khẩn cấp hoặc cân nhắc đóng ca', color:'#dc2626'});
      }
    }
  }

  // Kiểm tra ca mở quá lâu không có cập nhật
  const lastUpdate = new Date(c.updatedAt);
  const daysSinceUpdate = (now - lastUpdate) / (1000*60*60*24);
  if (daysSinceUpdate > 14 && currentStage >= 2 && currentStage <= 4) {
    alerts.push({type:'followup', msg:'⏰ Đã ' + Math.floor(daysSinceUpdate) + ' ngày chưa cập nhật — hẹn gặp trẻ/gia đình?', color:'#d97706'});
  }

  // Theo dõi sau đóng ca — kiểm tra log và nhắc nếu quá hạn
  if (c.status === 'closed') {
    const fupLog = c.followUpLog||[];
    const lastFup = fupLog.length ? new Date(fupLog[fupLog.length-1].ts) : (c.closedAt ? new Date(c.closedAt) : null);
    if (lastFup) {
      const daysSince = Math.floor((now - lastFup) / 86400000);
      if (daysSince > 30)
        alerts.push({type:'fup-overdue', msg:`📋 Đã ${daysSince} ngày chưa theo dõi — kiểm tra tình trạng trẻ/gia đình`, color:'#dc2626'});
      else if (daysSince > 14)
        alerts.push({type:'fup-due', msg:`📋 ${daysSince} ngày kể từ lần theo dõi cuối — cân nhắc liên lạc`, color:'#d97706'});
    }
  } else if (currentStage === 5 && D.ket_thuc?.ke_hoach_theo_doi) {
    alerts.push({type:'postclose', msg:'📌 Nhớ theo dõi sau đóng ca: ' + D.ket_thuc.ke_hoach_theo_doi.substring(0, 80), color:'#059669'});
  }

  // Hiển thị alerts
  const panel = document.getElementById('reminder-alerts');
  if (panel && alerts.length) {
    panel.innerHTML = alerts.map(a =>
      '<div style="padding:6px 10px;margin-bottom:4px;border-radius:6px;border-left:3px solid '+a.color+';background:'+a.color+'0d;font-size:11px;color:'+a.color+';font-weight:600;">'+esc(a.msg)+'</div>'
    ).join('');
    panel.style.display = 'block';
  } else if (panel) {
    panel.style.display = 'none';
  }
}

// ════════════════════════════════════════════════════════════
// CLOSED CASE UI + REOPEN
// ════════════════════════════════════════════════════════════
function applyClosedCaseUI() {
  const cases = loadCases();
  const c = curCaseId ? cases[curCaseId] : null;
  const isClosed = c?.status === 'closed';

  const banner      = document.getElementById('closed-banner');
  const bannerDate  = document.getElementById('closed-banner-date');
  const textarea    = document.getElementById('dash-notes');
  const btnAnalyze  = document.getElementById('btn-analyze');
  const btnFill     = document.getElementById('btn-fill');
  const btnRollback = document.getElementById('btn-rollback');
  const actionBar   = document.getElementById('action-bar');

  if (isClosed) {
    // Hiện banner đã đóng
    banner?.classList.add('show');
    if (bannerDate && c.closedAt) {
      bannerDate.textContent = 'Ngày đóng: ' + fmtVN(c.closedAt);
    }
    // Disable textarea
    if (textarea) {
      textarea.disabled = true;
      textarea.placeholder = 'Ca đã đóng — chỉ đọc';
    }
    // Ẩn action bar (Phân tích + Xem form)
    if (actionBar) actionBar.style.display = 'none';
    // Ẩn nút Lùi GĐ
    if (btnRollback) btnRollback.style.display = 'none';
    // Refresh chat panel: hiện báo cáo cuối hoặc thông báo đóng ca
    const chatMsgs = document.getElementById('chat-msgs');
    if (chatMsgs && !chatMsgs.querySelector('.cb-report')) {
      if (D?._report) {
        renderReport(D._report);
      } else {
        chatMsgs.innerHTML = `<div class="chat-empty"><div style="font-size:32px;margin-bottom:10px;">✅</div><div style="font-weight:700;font-size:14px;color:#065f46;">Ca đã đóng</div><div style="margin-top:6px;font-size:12px;color:#047857;">Xem lại phân tích ở tab Phân tích & Đánh giá</div></div>`;
      }
    }
  } else {
    // Ca đang mở — khôi phục bình thường
    banner?.classList.remove('show');
    if (textarea) {
      textarea.disabled = false;
      const cfg = STAGE_CONFIG[currentStage];
      textarea.placeholder = cfg?.placeholder || '';
    }
    if (actionBar) actionBar.style.display = 'flex';
    if (btnRollback) {
      btnRollback.style.display = currentStage > 1 ? 'inline-flex' : 'none';
    }
  }
}

function reopenCase() {
  if (!curCaseId) return;
  const cName = loadCases()[curCaseId]?.name || 'ca này';
  showConfirm({
    icon: '🔓',
    title: 'Mở lại ca?',
    body: `"${cName}" sẽ chuyển về trạng thái Đang mở ở GĐ 5.`,
    okText: 'Mở lại',
    okClass: 'cmb-ok-blue',
    onConfirm() {
      const cases = loadCases();
      if (cases[curCaseId]) {
        cases[curCaseId].status = 'open';
        delete cases[curCaseId].closedAt;
        cases[curCaseId].updatedAt = new Date().toISOString();
        if (D) delete D._status;
        saveCases(cases);
      }
      updateHeader();
      updateStageUI();
      applyClosedCaseUI();
      renderCaseList();
      updateCasesCount();
      showNotif('🔓 Đã mở lại ca — GĐ 5');
    }
  });
}

function toggleEntriesPanel() {
  const panel   = document.getElementById('entries-panel');
  const toggle  = document.getElementById('entries-toggle');
  if (!panel || !toggle) return;
  const collapsed = panel.classList.toggle('collapsed');
  toggle.classList.toggle('collapsed', collapsed);
}

// ════════════════════════════════════════════════════════════
// PHÂN TÍCH & ĐÁNH GIÁ TỔNG HỢP
// ════════════════════════════════════════════════════════════

const SYS_COMPREHENSIVE_EVAL = `Bạn là GIÁM SÁT VIÊN CTXH cấp cao tại Thảo Đàn Social Service Center TP.HCM — chuyên gia bảo vệ trẻ em với 15+ năm kinh nghiệm.

Nhiệm vụ: Tạo BÁO CÁO PHÂN TÍCH & ĐÁNH GIÁ TỔNG HỢP toàn bộ tiến trình can thiệp ca.

Dựa trên dữ liệu ca được cung cấp, viết báo cáo theo cấu trúc:

## I. TỔNG QUAN CA
Thông tin cơ bản, tình trạng hiện tại, tổng thời gian can thiệp, giai đoạn đang thực hiện.

## II. DIỄN BIẾN THEO GIAI ĐOẠN
Phân tích những gì phát hiện và thay đổi quan trọng ở mỗi giai đoạn đã thực hiện.

## III. ĐÁNH GIÁ TIẾN TRIỂN RỦI RO
Rủi ro tăng/giảm/ổn định qua các giai đoạn? Nguyên nhân? Lĩnh vực nào cải thiện, lĩnh vực nào còn đáng lo?

## IV. ĐIỂM MẠNH VÀ NGUỒN LỰC
Điểm mạnh của trẻ và gia đình. Những nguồn lực cộng đồng/xã hội đã hoặc có thể phát huy.

## V. VẤN ĐỀ CÒN TỒN TẠI
Những vấn đề chưa được giải quyết, nguy cơ tiềm ẩn cần tiếp tục theo dõi. Áp dụng triết lý Thảo Đàn: cảnh giác "kết luận tươi vui", nhận diện phụ mẫu hóa.

## VI. ĐÁNH GIÁ HIỆU QUẢ CAN THIỆP
Can thiệp đã đạt được gì so với mục tiêu ban đầu? Khoảng cách còn lại?

## VII. KHUYẾN NGHỊ ƯU TIÊN
Bước tiếp theo cụ thể, ưu tiên cao nhất, ai thực hiện, thời hạn gợi ý.

Yêu cầu:
- Viết bằng tiếng Việt chuyên nghiệp, rõ ràng
- Bám sát DỮ LIỆU THỰC TẾ của ca — không viết chung chung
- Áp dụng triết lý Thảo Đàn: phân biệt nhu cầu vs yêu cầu, nhận diện phụ mẫu hóa, không kết luận tươi vui khi thiếu dữ liệu
- Độ dài: 500–800 từ`;

function renderAnalysisPanel() {
  if (curMain !== 'analysis') return;
  const cases = loadCases();
  const c = curCaseId ? cases[curCaseId] : null;
  const leftEl = document.getElementById('analysis-left');
  if (!leftEl) return;

  if (!c && !D) {
    leftEl.innerHTML = `<div class="eval-placeholder" style="padding:32px 10px;">
      <div class="ep-icon">📊</div>
      <div class="ep-title">Chưa có ca nào</div>
      <div class="ep-sub">Mở một ca ở tab Dashboard để xem phân tích</div>
    </div>`;
    return;
  }

  const data = D || c?.lastAnalysis || {};
  const report = data._report || {};
  const cobaN = data.co_ban || {};
  const stage = currentStage;
  const risk = report.risk || '';
  const now = new Date();
  const createdAt = c?.createdAt ? new Date(c.createdAt) : null;
  const updatedAt = c?.updatedAt ? new Date(c.updatedAt) : null;
  const daysOpen = createdAt ? Math.floor((now - createdAt) / 86400000) : 0;

  const stageInfo = [null,
    {label:'Tiếp cận ban đầu', color:'#2563eb', bg:'#eff6ff'},
    {label:'Vãng gia & Đánh giá', color:'#0891b2', bg:'#ecfeff'},
    {label:'Kế hoạch can thiệp', color:'#7c3aed', bg:'#f5f3ff'},
    {label:'Tiến trình', color:'#d97706', bg:'#fffbeb'},
    {label:'Kết thúc ca', color:'#059669', bg:'#ecfdf5'}
  ];

  const rmLabels = {
    an_toan_the_chat:'🛡️ An toàn thể chất',
    an_toan_tam_ly:'🧠 An toàn tâm lý',
    moi_truong:'🏠 Môi trường sống',
    giao_duc:'📚 Giáo dục & PT',
    he_thong_bao_ve:'👨‍👩‍👧 Hệ thống BV'
  };
  const levelMap = {
    C:{label:'Cao', color:'#dc2626', bg:'#fef2f2'},
    TB:{label:'TB', color:'#d97706', bg:'#fffbeb'},
    T:{label:'Thấp', color:'#16a34a', bg:'#f0fdf4'},
    KR:{label:'Chưa rõ', color:'#6b7280', bg:'#f3f4f6'}
  };

  const si = stageInfo[stage] || stageInfo[1];
  let html = '';

  // ── Case summary card ──
  html += `<div class="analysis-card">
    <div class="analysis-card-title">📁 THÔNG TIN CA</div>
    <div style="font-size:14px;font-weight:800;color:var(--navy);margin-bottom:5px">${esc(c?.name || 'Ca chưa đặt tên')}</div>`;
  if (cobaN.ho_ten) html += `<div style="font-size:12px;color:var(--t2);margin-bottom:6px">👤 <strong>${esc(cobaN.ho_ten)}</strong>${cobaN.tuoi?' · '+esc(cobaN.tuoi)+' tuổi':''}${cobaN.gioi_tinh?' · '+esc(cobaN.gioi_tinh):''}</div>`;
  const _closed = c?.status === 'closed';
  html += `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">
    <span style="padding:3px 9px;border-radius:10px;font-size:10px;font-weight:700;background:${_closed?'#ecfdf5':'#dbeafe'};color:${_closed?'#065f46':'#1d4ed8'}">${_closed?'✅ Đã đóng':'🟢 Đang mở'}</span>
    <span style="padding:3px 9px;border-radius:10px;font-size:10px;font-weight:700;background:${si.bg};color:${si.color}">${_closed?'GĐ 5 ✓':'GĐ '+stage+'/5'}</span>
    ${createdAt?`<span style="padding:3px 9px;border-radius:10px;font-size:10px;font-weight:700;background:#f3f4f6;color:#374151">⏱ ${daysOpen} ngày</span>`:''}
    ${_closed&&c.closedAt?`<span style="padding:3px 9px;border-radius:10px;font-size:10px;font-weight:600;background:#ecfdf5;color:#059669">📅 Đóng: ${fmtVN(c.closedAt)}</span>`:''}
  </div></div>`;

  // ── Risk level card ──
  if (risk) {
    const rC=_riskColor(risk), rBg=_riskBg(risk), rI=_riskIcon(risk);
    html += `<div class="analysis-card">
      <div class="analysis-card-title">⚠️ MỨC ĐỘ RỦI RO</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span class="risk-pill" style="background:${rBg};color:${rC};border:1.5px solid ${rC}33">${rI} ${risk}</span>
        ${report.urgent?`<span style="font-size:10px;font-weight:700;color:#dc2626;background:#fef2f2;padding:3px 8px;border-radius:8px">⚡ KHẨN CẤP</span>`:''}
      </div>
      ${report.risk_reason?`<div style="font-size:11.5px;color:var(--t2);line-height:1.5;padding:7px 9px;background:${rBg};border-radius:7px">${esc(report.risk_reason)}</div>`:''}
    </div>`;
  }

  // ── Risk matrix card ──
  const rm = report.risk_matrix || {};
  const rmKeys = Object.keys(rm);
  if (rmKeys.length) {
    html += `<div class="analysis-card">
      <div class="analysis-card-title">📊 MA TRẬN RỦI RO</div>`;
    Object.entries(rmLabels).forEach(([k, label]) => {
      const f = rm[k];
      if (!f) return;
      const lv = typeof f === 'string' ? f : f?.level;
      const lvi = levelMap[lv] || {label:lv||'—', color:'#9ca3af', bg:'#f3f4f6'};
      html += `<div class="risk-matrix-row">
        <span style="color:var(--t2)">${label}</span>
        <span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${lvi.bg};color:${lvi.color}">${lvi.label}</span>
      </div>`;
    });
    html += `</div>`;
  }

  // ── Stage timeline card ──
  const entries = c?.entries || [];
  html += `<div class="analysis-card">
    <div class="analysis-card-title">🕐 TIẾN TRÌNH GIAI ĐOẠN</div>
    <div class="stage-timeline">`;
  const _isCaseClosed = c?.status === 'closed';
  for (let s = 1; s <= 5; s++) {
    const info = stageInfo[s];
    const isDone = _isCaseClosed ? true : s < stage;
    const isActive = _isCaseClosed ? false : s === stage;
    const isLocked = _isCaseClosed ? false : s > stage;
    const dotBg = isLocked ? '#e5e7eb' : info.color;
    const dotTxt = isLocked ? '#9ca3af' : '#fff';
    const stageEntries = entries.filter(e => (e.stage||1) === s);
    const lastEntry = stageEntries[stageEntries.length-1];
    html += `<div class="stage-tl-item">
      <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
        <div class="stage-tl-dot" style="background:${dotBg};color:${dotTxt}">${isDone?'✓':s}</div>
        ${s<5?`<div class="stage-tl-connector" style="background:${isDone?info.color+'55':'#e5e7eb'}"></div>`:''}
      </div>
      <div class="stage-tl-content">
        <div class="stage-tl-label" style="color:${isLocked?'#9ca3af':info.color}">${info.label}</div>
        ${lastEntry?`<div class="stage-tl-date">📅 ${fmtVN(lastEntry.date)}</div>`:''}
        ${isActive?`<span style="font-size:10px;background:${info.bg};color:${info.color};padding:2px 7px;border-radius:8px;display:inline-block;margin-top:2px;font-weight:600">Đang thực hiện</span>`:''}
        ${isDone?`<span style="font-size:10px;background:#f0fdf4;color:#16a34a;padding:2px 7px;border-radius:8px;display:inline-block;margin-top:2px;font-weight:600">✅ Hoàn thành</span>`:''}
      </div>
    </div>`;
  }
  html += `</div></div>`;

  // ── Stats card ──
  const stage4Updates = entries.filter(e => (e.stage||1) === 4).length;
  html += `<div class="analysis-card">
    <div class="analysis-card-title">📈 THỐNG KÊ</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      <div style="text-align:center;padding:10px;background:var(--cream);border-radius:8px">
        <div style="font-size:22px;font-weight:800;color:var(--navy)">${entries.length}</div>
        <div style="font-size:10px;color:var(--t3)">Lần ghi chép</div>
      </div>
      <div style="text-align:center;padding:10px;background:var(--cream);border-radius:8px">
        <div style="font-size:22px;font-weight:800;color:#d97706">${stage4Updates}</div>
        <div style="font-size:10px;color:var(--t3)">Cập nhật GĐ4</div>
      </div>
      ${updatedAt?`<div style="grid-column:span 2;padding:7px 10px;background:var(--cream);border-radius:8px;font-size:11px;color:var(--t2)">🕒 Cập nhật lần cuối: <strong>${fmtVN(updatedAt.toISOString())}</strong></div>`:''}
    </div>
  </div>`;

  leftEl.innerHTML = html;
}

async function generateComprehensiveEval() {
  const cases = loadCases();
  const c = curCaseId ? cases[curCaseId] : null;
  const data = D || c?.lastAnalysis || {};

  if (!data.co_ban && !data._report) {
    showNotif('⚠️ Chưa có dữ liệu phân tích — hãy chạy phân tích ở tab Dashboard trước', 'warn');
    return;
  }

  const btn = document.getElementById('btn-gen-eval');
  const out = document.getElementById('eval-output');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> AI đang tạo báo cáo...';
  out.innerHTML = `<div style="text-align:center;padding:40px;color:var(--t3)">
    <span class="spin" style="font-size:20px;display:inline-block"></span>
    <div style="margin-top:12px;font-size:13px;font-weight:500">AI đang phân tích toàn bộ tiến trình ca...</div>
    <div style="margin-top:6px;font-size:11px">Quá trình này mất 15–30 giây</div>
  </div>`;

  try {
    const pData = pseudonymizeForAI(data); // ẩn danh hóa trước khi gửi AI
    const caseContext = JSON.stringify({
      ten_ca: c?.name,
      giai_doan_hien_tai: currentStage,
      trang_thai: c?.status === 'closed' ? 'Đã đóng' : 'Đang mở',
      so_lan_ghi_chep: (c?.entries || []).length,
      ngay_tao: c?.createdAt,
      ngay_cap_nhat: c?.updatedAt,
      co_ban: pData.co_ban || {},
      gia_dinh: pData.gia_dinh || {},
      tinh_trang: pData.tinh_trang || {},
      danh_gia: pData.danh_gia || {},
      vang_gia: pData.vang_gia || {},
      ke_hoach: pData.ke_hoach || {},
      cap_nhat_tien_trinh: pData.cap_nhat || [],
      chuyen_gui: pData.chuyen_gui || {},
      ket_thuc: pData.ket_thuc || {},
      bao_cao_phan_tich_cuoi: pData._report || {}
    }, null, 2);

    const result = await callAI(SYS_COMPREHENSIVE_EVAL,
      `Dữ liệu ca cần phân tích và đánh giá:\n\n${caseContext}`,
      0.4, 2500);

    out.innerHTML = `<div style="font-family:'Be Vietnam Pro',sans-serif;font-size:13px;line-height:1.75;color:var(--text)">${_formatEvalReport(result)}</div>`;
  } catch(e) {
    out.innerHTML = `<div style="color:#dc2626;padding:20px;text-align:center;font-size:13px">❌ ${esc(e.message)}</div>`;
    showNotif('❌ Lỗi tạo báo cáo: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🔄 Tạo lại Báo cáo';
  }
}

function _formatEvalReport(text) {
  // escape HTML first
  let h = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // headings
  h = h.replace(/^## (.+)$/gm, '<div class="eval-section-head">$1</div>');
  h = h.replace(/^### (.+)$/gm, '<div style="font-size:12.5px;font-weight:700;color:var(--navy2);margin:12px 0 5px">$1</div>');
  // bold
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // list items → collect into <ul>
  h = h.replace(/^- (.+)$/gm, '<li style="margin:3px 0;padding-left:2px">$1</li>');
  h = h.replace(/(<li[^>]*>[\s\S]*?<\/li>)(\n<li[^>]*>[\s\S]*?<\/li>)*/g,
    m => `<ul style="margin:6px 0 8px;padding-left:18px">${m}</ul>`);
  // paragraphs
  h = h.replace(/\n\n/g, '</p><p style="margin:6px 0">');
  h = h.replace(/\n/g, '<br>');
  return `<p style="margin:0 0 6px">${h}</p>`;
}

// INIT
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const ta = document.getElementById('dash-notes');
  ta?.addEventListener('input', e => document.getElementById('dash-cc').textContent = e.target.value.length+' ký tự');

  function fixHeights() {
    const hdr = document.querySelector('.hdr');
    const nav = document.querySelector('.main-nav');
    const h = window.innerHeight - (hdr?.offsetHeight||56) - (nav?.offsetHeight||36);
    document.querySelectorAll('.tab-panel').forEach(el => { el.style.height = h+'px'; el.style.maxHeight = h+'px'; el.style.width = '100%'; });
  }
  fixHeights();
  window.addEventListener('resize', fixHeights);

  // Auto-save mỗi 60 giây (nếu có data)
  let _unsaved = false;
  window._markUnsaved = () => { _unsaved = true; };
  setInterval(() => {
    if (_unsaved && D && curCaseId) {
      saveCaseNow();
      _unsaved = false;
    }
  }, 60000);

  // Cảnh báo khi đóng tab có thay đổi chưa lưu
  window.addEventListener('beforeunload', (e) => {
    if (_unsaved && D) { e.preventDefault(); e.returnValue = ''; }
  });

  // Ctrl+S để lưu
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCaseNow();
      _unsaved = false;
    }
  });

  // Check auth session — nếu đã login thì tự load data
  _checkSession();
});
  // ── SESSION TIMEOUT (30 phút không hoạt động → cảnh báo 5 phút → tự đăng xuất) ──
  (function() {
    const WARN_AT_MS = 25 * 60 * 1000; // cảnh báo sau 25 phút
    const LOGOUT_MS  = 30 * 60 * 1000; // đăng xuất sau 30 phút
    let _tWarn = null, _tOut = null, _tTick = null;

    function _clearAll() {
      clearTimeout(_tWarn); clearTimeout(_tOut); clearInterval(_tTick);
      document.getElementById('session-warn')?.classList.remove('show');
    }

    function _showWarn() {
      if (!_currentUser) return;
      const warn = document.getElementById('session-warn');
      if (!warn) return;
      warn.classList.add('show');
      let secs = 5 * 60;
      const timerEl = document.getElementById('sw-timer');
      _tTick = setInterval(() => {
        secs--;
        if (timerEl) {
          const m = Math.floor(secs / 60), s = secs % 60;
          timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
        }
        if (secs <= 0) { clearInterval(_tTick); logoutUser(); }
      }, 1000);
    }

    function _reset() {
      _clearAll();
      if (!_currentUser) return;
      _tWarn = setTimeout(_showWarn, WARN_AT_MS);
      _tOut  = setTimeout(() => { if (_currentUser) logoutUser(); }, LOGOUT_MS);
    }

    window._sessionKeepAlive = function() { _reset(); };
    window._sessionReset     = _reset;

    ['click','keydown','touchstart','scroll'].forEach(ev =>
      document.addEventListener(ev, () => { if (_currentUser) _reset(); }, { passive: true })
    );

    // Bắt đầu bộ đếm khi load trang
    _reset();
  })();

// ════════════════════════════════════════════════════════════
// DASS-42/21 — Thang đo Trầm cảm, Lo âu, Căng thẳng
// Items 1-21 of DASS-42 are identical to DASS-21 (standard)
// For DASS-21: raw score × 2 to normalize to DASS-42 scale
// ════════════════════════════════════════════════════════════

const DASS_Q = [
  // [question_text, subscale]  subscale: D=trầm cảm, A=lo âu, S=căng thẳng
  // Items 1-21 = DASS-21 subset; Items 1-42 = DASS-42
  ['Tôi thấy khó mà thoải mái được.','S'],
  ['Tôi bị khô miệng.','A'],
  ['Tôi dường như không có cảm giác tích cực nào cả.','D'],
  ['Tôi bị rối loạn hơi thở (thở gấp, khó thở kể cả khi không gắng sức).','A'],
  ['Tôi thấy thật khó bắt tay vào công việc.','D'],
  ['Tôi có xu hướng phản ứng thái quá với các tình huống.','S'],
  ['Tôi bị run tay chân.','A'],
  ['Tôi cảm thấy mình tiêu tốn rất nhiều sức lực.','S'],
  ['Tôi lo lắng về những tình huống có thể khiến tôi hoảng sợ hoặc tự làm mình ngốc nghếch.','A'],
  ['Tôi cảm thấy không có gì để mong đợi cả.','D'],
  ['Tôi thấy bản thân dễ bị kích động.','S'],
  ['Tôi thấy khó mà thư giãn được.','S'],
  ['Tôi cảm thấy chán nản và thất vọng.','D'],
  ['Tôi không thể chịu được việc có điều gì đó cản trở công việc tôi đang làm.','S'],
  ['Tôi cảm thấy sắp hoảng loạn.','A'],
  ['Tôi không thấy hào hứng với bất kỳ điều gì cả.','D'],
  ['Tôi cảm thấy bản thân chẳng đáng là bao.','D'],
  ['Tôi cảm thấy mình khá dễ tự ái, dễ phật ý.','S'],
  ['Tôi nhận thức được nhịp tim dù không gắng sức (tim đập nhanh, loạn nhịp).','A'],
  ['Tôi cảm thấy sợ hãi vô cớ.','A'],
  ['Tôi cảm thấy cuộc sống chẳng có ý nghĩa gì.','D'],
  // Items 22-42 (DASS-42 only)
  ['Tôi thấy bản thân khó mà bình tĩnh lại được.','S'],
  ['Tôi thấy khó nuốt.','A'],
  ['Tôi không cảm nhận được niềm vui từ những điều tốt đẹp đang diễn ra.','D'],
  ['Tôi nhận thấy sự gián đoạn trong nhịp thở của mình (đôi khi thở hổn hển).','A'],
  ['Tôi cảm thấy xuống tinh thần và buồn bã.','D'],
  ['Tôi thấy khó bình tâm trước bất kỳ gián đoạn nào.','S'],
  ['Tôi cảm thấy sắp bị "vỡ tim" (tim đập dữ dội).','A'],
  ['Tôi thấy bản thân thiếu kiên nhẫn khi bị điều gì trì hoãn.','S'],
  ['Tôi cảm thấy yếu ớt (gần ngất xỉu).','A'],
  ['Tôi thấy khó có thể tìm thấy điều gì tốt đẹp trong cuộc sống.','D'],
  ['Tôi thấy thật khó chấp nhận việc bị gián đoạn khi đang làm gì đó.','S'],
  ['Tôi cảm thấy căng thẳng.','S'],
  ['Tôi cảm thấy mình vô dụng.','D'],
  ['Tôi không thể chịu đựng những điều cản trở tôi tiếp tục công việc đang làm.','S'],
  ['Tôi cảm thấy sợ hãi.','A'],
  ['Tôi không thấy bất kỳ điều gì trong tương lai để hy vọng.','D'],
  ['Tôi cảm thấy cuộc sống không có ý nghĩa.','D'],
  ['Tôi thấy mình đang bị kích động.','S'],
  ['Tôi lo lắng về những tình huống có thể khiến tôi hoảng sợ hoặc bị chế nhạo.','A'],
  ['Tôi cảm thấy run rẩy (tay chân run).','A'],
  ['Tôi thấy khó mà tận hưởng những điều tôi đang làm.','D'],
];

// Severity cutoffs (DASS-42 normalized scale)
const DASS_LEVELS = {
  D:[{max:9,lv:'Bình thường',c:'#16a34a',bg:'#f0fdf4'},{max:13,lv:'Nhẹ',c:'#ca8a04',bg:'#fefce8'},{max:20,lv:'Trung bình',c:'#ea580c',bg:'#fff7ed'},{max:27,lv:'Nặng',c:'#dc2626',bg:'#fef2f2'},{max:99,lv:'Rất nặng',c:'#7f1d1d',bg:'#fee2e2'}],
  A:[{max:7,lv:'Bình thường',c:'#16a34a',bg:'#f0fdf4'},{max:9,lv:'Nhẹ',c:'#ca8a04',bg:'#fefce8'},{max:14,lv:'Trung bình',c:'#ea580c',bg:'#fff7ed'},{max:19,lv:'Nặng',c:'#dc2626',bg:'#fef2f2'},{max:99,lv:'Rất nặng',c:'#7f1d1d',bg:'#fee2e2'}],
  S:[{max:14,lv:'Bình thường',c:'#16a34a',bg:'#f0fdf4'},{max:18,lv:'Nhẹ',c:'#ca8a04',bg:'#fefce8'},{max:25,lv:'Trung bình',c:'#ea580c',bg:'#fff7ed'},{max:33,lv:'Nặng',c:'#dc2626',bg:'#fef2f2'},{max:99,lv:'Rất nặng',c:'#7f1d1d',bg:'#fee2e2'}],
};

let _dass = { version:21, cur:-1, answers:[] };
let _dassResult = null;

function openDASS() {
  _dass = { version:21, cur:-1, answers:[] };
  _dassResult = null;
  document.getElementById('dass-overlay').style.display = 'flex';
  _renderDASS();
}
function closeDASS() {
  document.getElementById('dass-overlay').style.display = 'none';
}
function _startDASS(v) {
  _dass.version = v;
  _dass.answers = new Array(v === 42 ? 42 : 21).fill(null);
  _dass.cur = 0;
  _renderDASS();
}
function _prevDASS() {
  if (_dass.cur > 0) { _dass.cur--; _renderDASS(); }
}
function _answerDASS(val) {
  _dass.answers[_dass.cur] = val;
  const total = _dass.version === 42 ? 42 : 21;
  if (_dass.cur < total - 1) { _dass.cur++; _renderDASS(); }
  else _renderDASSResults();
}
function _getDASSSeverity(sub, score) {
  for (const lvl of DASS_LEVELS[sub]) { if (score <= lvl.max) return lvl; }
  return DASS_LEVELS[sub][4];
}
function _calcDASS() {
  const total = _dass.version === 42 ? 42 : 21;
  let D=0, A=0, S=0;
  for (let i=0; i<total; i++) {
    const v = _dass.answers[i] || 0;
    const sub = DASS_Q[i][1];
    if (sub==='D') D+=v; else if (sub==='A') A+=v; else S+=v;
  }
  if (_dass.version === 21) { D*=2; A*=2; S*=2; }
  return {D, A, S};
}
function _renderDASS() {
  const el = document.getElementById('dass-body');
  if (_dass.cur === -1) {
    el.innerHTML = `<div class="dass-sel">
      <div class="dass-sel-title">Đánh giá Sức khỏe Tâm thần</div>
      <div class="dass-sel-sub">Mô tả những gì bạn đã cảm nhận <strong>trong 1 tuần qua</strong>.<br>Không có câu trả lời đúng hay sai.</div>
      <div class="dass-ver-cards">
        <div class="dass-ver-card" onclick="_startDASS(21)">
          <div class="dvc-num">21</div>
          <div class="dvc-title">DASS-21</div>
          <div class="dvc-sub">Phiên bản ngắn · ~5 phút</div>
          <div class="dvc-badge">Khuyên dùng</div>
        </div>
        <div class="dass-ver-card" onclick="_startDASS(42)">
          <div class="dvc-num">42</div>
          <div class="dvc-title">DASS-42</div>
          <div class="dvc-sub">Phiên bản đầy đủ · ~10 phút</div>
        </div>
      </div>
    </div>`;
    return;
  }
  const total = _dass.version === 42 ? 42 : 21;
  const i = _dass.cur;
  const q = DASS_Q[i];
  const pct = Math.round((i / total) * 100);
  const subName = {D:'Cảm xúc / Trầm cảm', A:'Lo âu', S:'Căng thẳng'}[q[1]];
  el.innerHTML = `
    <div class="dass-prog-wrap">
      <div class="dass-prog-bar"><div class="dass-prog-fill" style="width:${pct}%"></div></div>
      <div class="dass-prog-txt">${i+1} / ${total}</div>
    </div>
    <div class="dass-q-num">Câu ${i+1} &nbsp;·&nbsp; ${subName}</div>
    <div class="dass-q-text">${q[0]}</div>
    <div class="dass-q-hint">Trong <strong>1 tuần vừa qua</strong>, điều này xảy ra với bạn ở mức nào?</div>
    <div class="dass-ans-grid">
      ${[0,1,2,3].map(v => `<button class="dass-ans-btn${_dass.answers[i]===v?' selected':''}" onclick="_answerDASS(${v})">
        <div class="dab-score">${v}</div>
        <div class="dab-label">${['Không đúng','Đôi khi','Thường xuyên','Hầu như luôn'][v]}</div>
      </button>`).join('')}
    </div>
    ${i > 0 ? '<button class="dass-back-btn" onclick="_prevDASS()">← Câu trước</button>' : ''}`;
}
function _renderDASSResults() {
  const el = document.getElementById('dass-body');
  const s = _calcDASS();
  _dassResult = s;
  const dL = _getDASSSeverity('D', s.D);
  const aL = _getDASSSeverity('A', s.A);
  const sL = _getDASSSeverity('S', s.S);
  const bar = (score, sub) => {
    const maxMap = {D:42, A:42, S:42};
    const pct = Math.min(100, Math.round(score / maxMap[sub] * 100));
    const c = _getDASSSeverity(sub, score).c;
    return `<div class="dass-res-bar"><div class="dass-res-fill" style="width:${pct}%;background:${c}"></div></div>`;
  };
  el.innerHTML = `<div class="dass-results">
    <div class="dass-res-title">Kết quả DASS-${_dass.version}</div>
    <div class="dass-res-note">Điểm chuẩn hóa theo thang DASS-42 (điểm tối đa 42)</div>
    <div class="dass-res-cards">
      <div class="dass-res-card" style="border-color:${dL.c}20;background:${dL.bg}">
        <div class="drc-icon">😔</div>
        <div class="drc-label">Trầm cảm</div>
        <div class="drc-score" style="color:${dL.c}">${s.D}</div>
        <div class="drc-level" style="color:${dL.c}">${dL.lv}</div>
        ${bar(s.D,'D')}
      </div>
      <div class="dass-res-card" style="border-color:${aL.c}20;background:${aL.bg}">
        <div class="drc-icon">😰</div>
        <div class="drc-label">Lo âu</div>
        <div class="drc-score" style="color:${aL.c}">${s.A}</div>
        <div class="drc-level" style="color:${aL.c}">${aL.lv}</div>
        ${bar(s.A,'A')}
      </div>
      <div class="dass-res-card" style="border-color:${sL.c}20;background:${sL.bg}">
        <div class="drc-icon">😤</div>
        <div class="drc-label">Căng thẳng</div>
        <div class="drc-score" style="color:${sL.c}">${s.S}</div>
        <div class="drc-level" style="color:${sL.c}">${sL.lv}</div>
        ${bar(s.S,'S')}
      </div>
    </div>
    <div class="dass-res-footer">
      <div class="dass-res-date">📅 ${new Date().toLocaleDateString('vi-VN')}</div>
      <div class="dass-res-btns">
        <button class="btn-dass-redo" onclick="_dass.cur=-1;_dass.answers=[];_renderDASS()">🔄 Làm lại</button>
        <button class="btn-dass-save" onclick="_saveDASS()">💾 Lưu vào hồ sơ</button>
      </div>
    </div>
  </div>`;
}
function _saveDASS() {
  if (!D) { showNotif('⚠️ Chưa mở ca nào', 'warn'); return; }
  if (!_dassResult) return;
  if (!D.tinh_trang) D.tinh_trang = {};
  const s = _dassResult;
  const dL = _getDASSSeverity('D', s.D);
  const aL = _getDASSSeverity('A', s.A);
  const sL = _getDASSSeverity('S', s.S);
  D.tinh_trang.dass = {
    version: _dass.version,
    date: new Date().toLocaleDateString('vi-VN'),
    D: s.D, D_level: dL.lv,
    A: s.A, A_level: aL.lv,
    S: s.S, S_level: sL.lv,
  };
  if (window._markUnsaved) window._markUnsaved();
  closeDASS();
  showNotif('✅ Đã lưu kết quả DASS vào hồ sơ — nhớ nhấn Lưu');
}

// ════════════════════════════════════════════════════════════
// GENOGRAM — Sơ đồ gia đình SVG
// ════════════════════════════════════════════════════════════

function _inferSex(quan_he) {
  if (!quan_he) return '';
  if (/^(cha|bố|ba|anh|ông|chú|dượng|cậu|trai)/i.test(quan_he)) return 'Nam';
  if (/^(mẹ|má|chị|bà|dì|cô|mợ|thím|gái)/i.test(quan_he)) return 'Nữ';
  return '';
}

function _gSym(sex, cx, cy, isChild, dead) {
  const f = isChild ? '#dbeafe' : '#f8fafc';
  const s = isChild ? '#2563eb' : '#64748b';
  const sw = isChild ? 2.5 : 1.5;
  const q = (sex||'').toLowerCase();
  let g = '';
  if (q.includes('nam')) {
    g = `<rect x="${cx-13}" y="${cy-13}" width="26" height="26" rx="2" fill="${f}" stroke="${s}" stroke-width="${sw}"/>`;
    if (isChild) g += `<rect x="${cx-18}" y="${cy-18}" width="36" height="36" rx="4" fill="none" stroke="${s}" stroke-width="1.2" stroke-dasharray="4,2"/>`;
  } else if (q.includes('nữ') || q.includes('nu')) {
    g = `<circle cx="${cx}" cy="${cy}" r="13" fill="${f}" stroke="${s}" stroke-width="${sw}"/>`;
    if (isChild) g += `<circle cx="${cx}" cy="${cy}" r="18" fill="none" stroke="${s}" stroke-width="1.2" stroke-dasharray="4,2"/>`;
  } else {
    g = `<polygon points="${cx},${cy-12} ${cx+12},${cy} ${cx},${cy+12} ${cx-12},${cy}" fill="${f}" stroke="${s}" stroke-width="${sw}"/>`;
    if (isChild) g += `<polygon points="${cx},${cy-17} ${cx+17},${cy} ${cx},${cy+17} ${cx-17},${cy}" fill="none" stroke="${s}" stroke-width="1.2" stroke-dasharray="4,2"/>`;
  }
  if (dead) {
    g += `<line x1="${cx-11}" y1="${cy-11}" x2="${cx+11}" y2="${cy+11}" stroke="#dc2626" stroke-width="2"/>`;
    g += `<line x1="${cx+11}" y1="${cy-11}" x2="${cx-11}" y2="${cy+11}" stroke="#dc2626" stroke-width="2"/>`;
  }
  return g;
}

function _gLabel(name, rel, cx, cy) {
  const n = esc((name||'?').substring(0,11));
  const r = esc((rel||'').substring(0,13));
  return `<text x="${cx}" y="${cy+20}" text-anchor="middle" font-size="10" font-weight="700" fill="#1e293b" font-family="system-ui">${n}</text>`
    + (r ? `<text x="${cx}" y="${cy+32}" text-anchor="middle" font-size="8.5" fill="#64748b" font-family="system-ui">${r}</text>` : '');
}

function _buildGenogram() {
  if (!D) return '<div style="padding:60px;text-align:center;color:#94a3b8;">Chưa mở ca nào.</div>';
  const cb = D.co_ban||{}, gd = D.gia_dinh||{};
  const csc = gd.nguoi_cham_soc||{};
  const mems = Array.isArray(gd.thanh_vien) ? gd.thanh_vien : [];

  const isGP  = q => /^(ông|bà|cụ)/i.test(q||'');
  const isPar = q => /^(cha|bố|ba|mẹ|má|mợ|dượng|nuôi|kế)/i.test(q||'');
  const isSib = q => /^(anh|chị|em)/i.test(q||'');
  const isDead = g => /mất|qua đời|chết/i.test(g||'');

  const gps    = mems.filter(m => isGP(m.quan_he));
  let parents  = mems.filter(m => isPar(m.quan_he) && !isGP(m.quan_he));
  const sibs   = mems.filter(m => isSib(m.quan_he));
  const others = mems.filter(m => !isGP(m.quan_he) && !isPar(m.quan_he) && !isSib(m.quan_he));

  if (csc.ho_ten && !parents.find(m=>m.ho_ten===csc.ho_ten) && !gps.find(m=>m.ho_ten===csc.ho_ten))
    parents.unshift({ho_ten:csc.ho_ten, quan_he:csc.quan_he||'NCS', ghi_chu:''});
  if (!parents.length) parents = [{ho_ten:'?', quan_he:'Cha/Mẹ/NCS', ghi_chu:''}];

  const W=640, ROWH=112;
  const rows = [];
  if (gps.length)   rows.push({people:gps,   label:'ÔNG BÀ', type:'gp'});
  rows.push({people:parents, label:'CHA · MẸ · NGƯỜI CHĂM SÓC', type:'par'});
  rows.push({people:[{...cb,_isChild:true,quan_he:cb.gioi_tinh||'Trẻ'}, ...sibs], label:'TRẺ · ANH CHỊ EM', type:'child'});
  if (others.length) rows.push({people:others, label:'THÀNH VIÊN KHÁC', type:'other'});

  const H = 30 + rows.length*ROWH + 30;
  const rowY = i => 30 + 56 + i*ROWH;
  const spc  = n => n>1 ? Math.min(115, (W-100)/(n-1)) : 0;
  const sX   = (n,sp) => (W - sp*(n-1)) / 2;

  const parts = [
    `<defs><linearGradient id="gBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#eef2f7"/></linearGradient></defs>`,
    `<rect width="${W}" height="${H}" fill="url(#gBg)" rx="12" stroke="#e2e8f0" stroke-width="1"/>`,
  ];

  // Connecting lines: par → child
  const parIdx   = rows.findIndex(r=>r.type==='par');
  const childIdx = rows.findIndex(r=>r.type==='child');
  if (parIdx>=0 && childIdx>=0) {
    const pN=rows[parIdx].people.length, cN=rows[childIdx].people.length;
    const pSp=spc(pN), cSp=spc(cN);
    const pSX=sX(pN,pSp), cSX=sX(cN,cSp);
    const pY=rowY(parIdx), cY=rowY(childIdx);
    const pMX=pSX+pSp*(pN-1)/2, cEX=cSX+cSp*(cN-1);
    const midY=pY+(cY-pY)*0.5;

    if (pN>=2) parts.push(`<line x1="${pSX}" y1="${pY}" x2="${pSX+pSp*(pN-1)}" y2="${pY}" stroke="#94a3b8" stroke-width="1.5"/>`);
    parts.push(`<line x1="${pMX}" y1="${pY+15}" x2="${pMX}" y2="${midY}" stroke="#94a3b8" stroke-width="1.5"/>`);
    const hMin=Math.min(pMX,cSX), hMax=Math.max(pMX,cEX);
    parts.push(`<line x1="${hMin}" y1="${midY}" x2="${hMax}" y2="${midY}" stroke="#94a3b8" stroke-width="1.5"/>`);
    for (let i=0;i<cN;i++) {
      const cx=cSX+i*cSp;
      parts.push(`<line x1="${cx}" y1="${midY}" x2="${cx}" y2="${cY-20}" stroke="#94a3b8" stroke-width="1.5"/>`);
    }
  }

  // Symbols + labels
  rows.forEach((row,ri) => {
    const cy=rowY(ri), n=row.people.length, sp=spc(n), sx=sX(n,sp);
    parts.push(`<text x="${W/2}" y="${cy-34}" text-anchor="middle" font-size="8.5" fill="#94a3b8" font-family="system-ui" font-weight="700" letter-spacing="1.2">${esc(row.label)}</text>`);
    row.people.forEach((p,pi) => {
      const cx=sx+pi*sp;
      const sex=p.gioi_tinh||_inferSex(p.quan_he);
      parts.push(_gSym(sex,cx,cy,!!p._isChild,isDead(p.ghi_chu||'')));
      parts.push(_gLabel(p.ho_ten,p.quan_he,cx,cy));
    });
  });

  parts.push(`<text x="14" y="${H-9}" font-size="8.5" fill="#94a3b8" font-family="system-ui">□ Nam  ○ Nữ  ◇ Không rõ  ✕ Đã mất  [- -] Trẻ CTXH</text>`);

  const childName=cb.ho_ten||'Chưa có tên', age=cb.tuoi||'';
  return `<div style="font-weight:800;font-size:15px;color:#1e293b;margin-bottom:2px;">🧬 Sơ đồ gia đình — ${esc(childName)}${age?' ('+age+' tuổi)':''}</div>
    <div style="font-size:11px;color:#64748b;margin-bottom:12px;">Từ dữ liệu Form 0 · Cập nhật bằng cách bổ sung thành viên GĐ1</div>
    <div style="overflow-x:auto">
    <svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:380px;max-width:${W}px;display:block;margin:0 auto;overflow:visible">
      ${parts.join('\n')}
    </svg></div>`;
}

function openGenogram() {
  if (!D) { showNotif('⚠️ Chưa mở ca nào', 'warn'); return; }
  document.getElementById('genogram-overlay').style.display = 'flex';
  document.getElementById('genogram-body').innerHTML = _buildGenogram();
}
function closeGenogram() {
  document.getElementById('genogram-overlay').style.display = 'none';
}

// ════════════════════════════════════════════════════════════
// FOLLOW-UP TRACKING — Theo dõi sau đóng ca (cấu trúc đầy đủ)
// ════════════════════════════════════════════════════════════

let _fupDraft = {};

function _fupSet(caseId, field, val) {
  if (!_fupDraft[caseId]) _fupDraft[caseId] = {};
  _fupDraft[caseId][field] = val;
  document.querySelectorAll(`[data-fc="${caseId}"][data-ff="${field}"]`).forEach(b => {
    const isActive = b.dataset.fv === val;
    const isWarn = ['Lo ngại','Mất kết nối','Cần mở lại ca'].includes(b.dataset.fv);
    const isOk   = ['Tốt','Duy trì','Ổn định'].includes(b.dataset.fv);
    const c = isWarn ? '#dc2626' : isOk ? '#16a34a' : '#d97706';
    b.style.background = isActive ? c : 'transparent';
    b.style.color = isActive ? '#fff' : c;
    b.style.borderColor = isActive ? c : c+'40';
  });
}

function _genFollowUpSchedule(closedAt) {
  const base = new Date(closedAt);
  return [1, 3, 6].map(m => {
    const d = new Date(base);
    d.setMonth(d.getMonth() + m);
    return { moc: m, label: `${m} tháng`, due: d.toISOString().split('T')[0] };
  });
}

function _initFollowUpSchedule(id) {
  const cases = loadCases();
  const c = cases[id];
  if (!c || !c.closedAt || c.followUpSchedule) return;
  c.followUpSchedule = _genFollowUpSchedule(c.closedAt);
  saveCases(cases);
}

function saveFollowUp(caseId) {
  const ngay = document.getElementById('fup-date-'+caseId)?.value || new Date().toISOString().split('T')[0];
  const mocRaw = document.getElementById('fup-moc-'+caseId)?.value;
  const moc = mocRaw ? parseInt(mocRaw) : null;
  const hinh_thuc = document.getElementById('fup-type-'+caseId)?.value || '';
  const ghi_chu = (document.getElementById('fup-note-'+caseId)?.value||'').trim();
  const ai_phan_tich = (document.getElementById('fup-ai-result-'+caseId)?.value||'').trim();
  const dr = _fupDraft[caseId] || {};
  if (!ghi_chu && !dr.ket_luan) { showNotif('⚠️ Nhập ghi chú hoặc chọn kết luận', 'warn'); return; }
  const cases = loadCases();
  if (!cases[caseId]) return;
  if (!cases[caseId].followUpLog) cases[caseId].followUpLog = [];
  cases[caseId].followUpLog.push({
    id: Date.now().toString(36), ts: new Date().toISOString(),
    ngay, moc, hinh_thuc, ghi_chu, ai_phan_tich,
    chi_so: {
      an_toan_the_chat: dr.an_toan_the_chat||'',
      an_toan_tam_ly:   dr.an_toan_tam_ly||'',
      hoc_tap:          dr.hoc_tap||'',
      dieu_kien_song:   dr.dieu_kien_song||'',
      ket_noi_dich_vu:  dr.ket_noi_dich_vu||'',
    },
    ket_luan: dr.ket_luan||'',
  });
  cases[caseId].updatedAt = new Date().toISOString();
  saveCases(cases);
  delete _fupDraft[caseId];
  showCaseDetail(caseId);
  showNotif('✅ Đã ghi nhận theo dõi');
}

async function analyzeFollowUp(caseId) {
  const btn = document.getElementById('fup-ai-btn-'+caseId);
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang phân tích...'; }
  const ngay      = document.getElementById('fup-date-'+caseId)?.value || '';
  const hinh_thuc = document.getElementById('fup-type-'+caseId)?.value || '';
  const ghi_chu   = document.getElementById('fup-note-'+caseId)?.value || '';
  const dr = _fupDraft[caseId] || {};
  const cases = loadCases();
  const c = cases[caseId];
  const childName = c?.lastAnalysis?.co_ban?.ho_ten || '(Chưa rõ)';
  const daysClosed = c?.closedAt ? Math.floor((Date.now()-new Date(c.closedAt))/86400000) : null;
  const prevLog = (c?.followUpLog||[]).slice(-2).map(e =>
    `Ngày ${e.ngay}: KL=${e.ket_luan||'?'}, TH=${e.hinh_thuc||'?'}, ` +
    `TC=${e.chi_so?.an_toan_the_chat||'?'}, TL=${e.chi_so?.an_toan_tam_ly||'?'}, ` +
    `HT=${e.chi_so?.hoc_tap||'?'}, DK=${e.chi_so?.dieu_kien_song||'?'}, DV=${e.chi_so?.ket_noi_dich_vu||'?'}` +
    (e.ghi_chu?` · Ghi chú: ${e.ghi_chu.substring(0,80)}`:'')
  ).join('\n') || 'Đây là lần theo dõi đầu tiên.';

  const userMsg = `TRẺ: ${childName}
NGÀY THEO DÕI: ${ngay} — HÌNH THỨC: ${hinh_thuc}
KỂ TỪ ĐÓNG CA: ${daysClosed !== null ? daysClosed+' ngày' : 'Chưa rõ'}

ĐÁNH GIÁ 5 CHỈ SỐ:
· An toàn thể chất: ${dr.an_toan_the_chat||'Chưa đánh giá'}
· An toàn tâm lý:   ${dr.an_toan_tam_ly||'Chưa đánh giá'}
· Học tập/sinh hoạt: ${dr.hoc_tap||'Chưa đánh giá'}
· Điều kiện sống:   ${dr.dieu_kien_song||'Chưa đánh giá'}
· Kết nối dịch vụ:  ${dr.ket_noi_dich_vu||'Chưa đánh giá'}

GHI CHÚ NVXH: ${ghi_chu||'(Chưa nhập)'}
KẾT LUẬN NVXH: ${dr.ket_luan||'Chưa chọn'}

LỊCH SỬ THEO DÕI TRƯỚC:
${prevLog}`;

  try {
    const result = await callAI(SYS_FOLLOWUP_ANALYSIS, userMsg, 0.35, 1200);
    const area = document.getElementById('fup-ai-result-'+caseId);
    if (area) { area.value = result; area.style.display = 'block'; area.rows = 8; }
    if (btn) { btn.disabled = false; btn.textContent = '🤖 Phân tích lại'; }
  } catch {
    if (btn) { btn.disabled = false; btn.textContent = '🤖 Phân tích AI'; }
    showNotif('⚠️ Lỗi AI', 'warn');
  }
}

function deleteFollowUp(caseId, entryId) {
  const cases = loadCases();
  if (cases[caseId]?.followUpLog) {
    cases[caseId].followUpLog = cases[caseId].followUpLog.filter(e=>e.id!==entryId);
    saveCases(cases);
    showCaseDetail(caseId);
  }
}

function _renderFollowUpSection(id, c) {
  const log = c.followUpLog||[];
  const schedule = c.followUpSchedule || (c.closedAt ? _genFollowUpSchedule(c.closedAt) : []);
  const plan = c.lastAnalysis?.ket_thuc?.ke_hoach_theo_doi || c.lastAnalysis?._report?.follow_up_plan || '';
  const today = new Date().toISOString().split('T')[0];
  const dr = _fupDraft[id] || {};
  const inp = 'height:30px;padding:0 8px;border:1px solid var(--bd);border-radius:6px;font-size:12px;font-family:inherit;background:var(--bg);color:var(--t1);';

  // --- Lịch hẹn ---
  const mocDone = m => log.some(e => e.moc === m);
  const schedHtml = schedule.map(s => {
    const done = mocDone(s.moc);
    const dl = Math.floor((new Date(s.due) - Date.now()) / 86400000);
    const badge = done
      ? `<span class="fup-moc-badge fup-moc-done">✅ Đã TH</span>`
      : dl < 0
        ? `<span class="fup-moc-badge fup-moc-over">⚠️ Quá ${-dl}n</span>`
        : dl <= 14
          ? `<span class="fup-moc-badge fup-moc-due">⏰ Còn ${dl}n</span>`
          : `<span class="fup-moc-badge fup-moc-up">📅 Còn ${dl}n</span>`;
    return `<div class="fup-sched-row"><span class="fup-sched-label">Mốc ${s.label}</span><span class="fup-sched-date">${s.due}</span><span style="flex:1"></span>${badge}</div>`;
  }).join('');

  // --- Lịch sử ---
  const cs2Color = v => v==='Tốt'||v==='Duy trì'?'#16a34a':v==='Lo ngại'||v==='Mất kết nối'?'#dc2626':'#d97706';
  const logHtml = log.slice().reverse().map(e => {
    const cs = e.chi_so||{};
    const csChips = [
      ['Thể chất',cs.an_toan_the_chat],['Tâm lý',cs.an_toan_tam_ly],
      ['Học tập',cs.hoc_tap],['ĐK sống',cs.dieu_kien_song],['Dịch vụ',cs.ket_noi_dich_vu],
    ].filter(([,v])=>v).map(([k,v])=>{
      const c=cs2Color(v);
      return `<span style="font-size:10px;padding:1px 6px;border-radius:10px;border:1px solid ${c}40;color:${c};background:${c}0d;">${k}: ${v}</span>`;
    }).join('');
    const klC = e.ket_luan==='Ổn định'?'#16a34a':e.ket_luan==='Cần mở lại ca'?'#dc2626':e.ket_luan==='Không liên lạc được'?'#94a3b8':'#d97706';
    const mocBadge = e.moc ? `<span style="background:#eff6ff;color:#1e40af;border-radius:4px;padding:1px 5px;font-size:10px;font-weight:600;">Mốc ${e.moc}T</span>` : '';
    return `<div style="padding:7px 0;border-bottom:1px solid #f1f5f9;">
      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:3px;">
        <span style="font-size:11px;color:var(--t3);font-weight:600;">${esc(e.ngay||'?')}</span>
        ${mocBadge}
        <span style="font-size:11px;color:var(--t2);">${esc(e.hinh_thuc||'')}</span>
        <span style="flex:1"></span>
        ${e.ket_luan?`<span style="font-size:10px;font-weight:700;color:${klC};">${esc(e.ket_luan)}</span>`:''}
        <button onclick="deleteFollowUp('${id}','${e.id}')" style="background:none;border:none;color:#cbd5e1;cursor:pointer;font-size:15px;padding:0;line-height:1;">×</button>
      </div>
      ${csChips?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:3px;">${csChips}</div>`:''}
      ${e.ghi_chu?`<div style="font-size:12px;color:var(--t1);margin-bottom:3px;">${esc(e.ghi_chu)}</div>`:''}
      ${e.ai_phan_tich?`<details style="margin-top:4px;"><summary style="font-size:10px;font-weight:700;color:#6d28d9;cursor:pointer;list-style:none;">🤖 Nhận xét AI ▸</summary><div style="font-size:11.5px;color:#4c1d95;background:#faf5ff;border:1px solid #e9d5ff;border-radius:6px;padding:8px;margin-top:4px;white-space:pre-wrap;line-height:1.6;">${esc(e.ai_phan_tich)}</div></details>`:''}
    </div>`;
  }).join('');

  // --- Form ghi nhận ---
  const CHI_SO = [
    {key:'an_toan_the_chat', label:'An toàn thể chất', opts:['Tốt','Cần theo dõi','Lo ngại']},
    {key:'an_toan_tam_ly',   label:'An toàn tâm lý',   opts:['Tốt','Cần theo dõi','Lo ngại']},
    {key:'hoc_tap',          label:'Học tập/sinh hoạt', opts:['Tốt','Cần theo dõi','Lo ngại']},
    {key:'dieu_kien_song',   label:'Điều kiện sống',    opts:['Tốt','Cần theo dõi','Lo ngại']},
    {key:'ket_noi_dich_vu',  label:'Kết nối dịch vụ',   opts:['Duy trì','Cần kết nối lại','Mất kết nối']},
  ];
  const KET_LUAN = ['Ổn định','Tiếp tục theo dõi','Cần mở lại ca','Không liên lạc được'];

  const optBtn = (key, val) => {
    const act = dr[key]===val;
    const isWarn=['Lo ngại','Mất kết nối'].includes(val), isOk=['Tốt','Duy trì'].includes(val);
    const c=isWarn?'#dc2626':isOk?'#16a34a':'#d97706';
    return `<button class="fup-opt" data-fc="${id}" data-ff="${key}" data-fv="${val}" onclick="_fupSet('${id}','${key}','${val}')"
      style="padding:3px 8px;border:1.5px solid ${act?c:c+'40'};border-radius:20px;font-size:10px;font-weight:600;cursor:pointer;background:${act?c:'transparent'};color:${act?'#fff':c};transition:all .12s;">${val}</button>`;
  };
  const klBtn = val => {
    const act = dr.ket_luan===val;
    const c=val==='Ổn định'?'#16a34a':val==='Cần mở lại ca'?'#dc2626':val==='Không liên lạc được'?'#94a3b8':'#d97706';
    return `<button class="fup-opt" data-fc="${id}" data-ff="ket_luan" data-fv="${val}" onclick="_fupSet('${id}','ket_luan','${val}')"
      style="padding:4px 11px;border:1.5px solid ${act?c:c+'40'};border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;background:${act?c:'transparent'};color:${act?'#fff':c};transition:all .12s;">${val}</button>`;
  };

  return `<div class="followup-section">
    <div style="font-weight:700;font-size:13px;color:var(--t1);margin-bottom:10px;">📋 Theo dõi sau đóng ca</div>
    ${plan?`<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 10px;font-size:11.5px;color:#166534;margin-bottom:10px;">📌 KH: ${esc(plan)}</div>`:''}
    ${schedule.length?`<div class="fup-schedule-box"><div class="fup-box-title">Lịch hẹn tự động</div>${schedHtml}</div>`:''}
    ${log.length?`<div style="margin:8px 0;"><div class="fup-box-title" style="margin-bottom:6px;">Lịch sử theo dõi (${log.length})</div>${logHtml}</div>`:''}
    <div class="fup-form-box">
      <div class="fup-box-title">Ghi nhận lần theo dõi mới</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
        <input type="date" id="fup-date-${id}" value="${today}" style="${inp}">
        <select id="fup-moc-${id}" style="${inp}">
          <option value="">Ngoài lịch</option>
          ${schedule.map(s=>`<option value="${s.moc}">Mốc ${s.label}</option>`).join('')}
        </select>
        <select id="fup-type-${id}" style="${inp}">
          <option>Gọi điện</option><option>Vãng gia</option><option>Gặp văn phòng</option><option>Qua bên thứ 3</option><option>Tin nhắn</option>
        </select>
      </div>
      <div style="background:#f8fafc;border-radius:6px;padding:8px;margin-bottom:8px;">
        <div class="fup-box-title" style="margin-bottom:6px;">Đánh giá 5 chỉ số</div>
        ${CHI_SO.map(cs=>`<div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
          <span style="min-width:128px;font-size:11.5px;color:var(--t2);">${cs.label}</span>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">${cs.opts.map(o=>optBtn(cs.key,o)).join('')}</div>
        </div>`).join('')}
      </div>
      <textarea id="fup-note-${id}" rows="2" placeholder="Ghi chú: quan sát, thông tin từ gia đình/nhà trường..." style="width:100%;padding:7px 9px;border:1px solid var(--bd);border-radius:6px;font-size:12px;font-family:inherit;resize:vertical;background:var(--bg);color:var(--t1);box-sizing:border-box;margin-bottom:8px;"></textarea>
      <div style="margin-bottom:10px;">
        <div class="fup-box-title" style="margin-bottom:6px;">Kết luận</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">${KET_LUAN.map(klBtn).join('')}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button id="fup-ai-btn-${id}" onclick="analyzeFollowUp('${id}')" style="height:34px;padding:0 16px;background:linear-gradient(135deg,#6d28d9,#5b21b6);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">🤖 Phân tích AI</button>
        <button onclick="saveFollowUp('${id}')" style="height:34px;padding:0 18px;background:var(--org);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">💾 Lưu theo dõi</button>
      </div>
      <textarea id="fup-ai-result-${id}" rows="1" placeholder="Nhận xét AI sẽ hiện ở đây (có thể chỉnh sửa trước khi lưu)..." style="display:none;width:100%;margin-top:10px;padding:9px 11px;border:1.5px solid #7c3aed;border-radius:8px;font-size:12px;font-family:inherit;resize:vertical;background:#faf5ff;color:#4c1d95;box-sizing:border-box;line-height:1.6;"></textarea>
    </div>
  </div>`;
}


// ════════════════════════════════════════════════════════════
// WINDOW EXPORTS — ES modules are scoped; expose onclick handlers globally
// ════════════════════════════════════════════════════════════
Object.assign(window, {
  loginEmail, logoutUser,
  switchMain,
  runAnalysis, fillForms, newCase, saveCaseNow,
  showStats, showNotifications,
  completeStage, rollbackStage, reopenCase,
  showForm, toggleFormSidebar,
  toggleTemplate, insertTemplate, insertAllTemplate, clearNotes,
  sendChat, useSuggestion,
  toggleFEC, sendFEC,
  loadEntryToEditor, deleteEntry, toggleEntriesPanel,
  selectCase, loadCaseIntoApp, deleteCase,
  _reopenCaseFromList, _closeCaseFromList,
  exportCaseJSON, importCaseJSON, exportSelected, dlDocx, exportAllDocx, dlReportDocx,
  printFullCase, closePov, generateComprehensiveEval,
  _doConfirm, _cancelConfirm,
  deleteCaseFile, refreshFileList,
  markNotifRead,
  openDASS, closeDASS, _startDASS, _prevDASS, _answerDASS, _saveDASS,
  _renderDASS, _renderDASSResults,
  openGenogram, closeGenogram,
  saveFollowUp, deleteFollowUp, _fupSet,
});
