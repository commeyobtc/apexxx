// ─── APP.JS — Management System Controller ──────────────────────────────────

DB.init();

// ── Session ──────────────────────────────────────────────────────────────────
let SESSION = null;

function setSession(user) {
  SESSION = user;
  sessionStorage.setItem('session_id', user.id);
}
function clearSession() {
  SESSION = null;
  sessionStorage.removeItem('session_id');
}
// Restore session on page reload
(function restoreSession() {
  const id = sessionStorage.getItem('session_id');
  if (id) {
    const u = DB.getUserById(id);
    if (u && u.isActive) { SESSION = u; }
    else { sessionStorage.removeItem('session_id'); }
  }
})();

// ── Toast System ─────────────────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 3500) {
  const icons = { success: '✓', error: '✕', info: '◈', warn: '⚠' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]||'◈'}</span><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(20px)';
    el.style.transition = '.3s'; setTimeout(() => el.remove(), 300); }, duration);
}

// ── Screen Router ─────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showPanel(key) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const panel = document.getElementById(`panel-${key}`);
  const nav   = document.querySelector(`[data-panel="${key}"]`);
  if (panel) { panel.classList.add('active'); renderPanel(key); }
  if (nav) nav.classList.add('active');
}

// ── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (SESSION) { bootApp(); } else { showScreen('screen-login'); }
  bindLoginEvents();
});

function bootApp() {
  buildSidebar();
  buildTopbar();
  showScreen('screen-app');
  showPanel('home');
}

// ── Topbar ────────────────────────────────────────────────────────────────────
function buildTopbar() {
  const rc = DB.getRoleColor(SESSION.role);
  document.getElementById('topbar-name').textContent = SESSION.fullName;
  const badge = document.getElementById('topbar-badge');
  badge.textContent = SESSION.role.toUpperCase();
  badge.style.background = rc;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NAV_ALL = [
  { key: 'home',     icon: '⊞', label: 'Dashboard',   perms: [] },
  { key: 'users',    icon: '◉', label: 'Users',        perms: ['view_all','view_team'] },
  { key: 'invites',  icon: '⊕', label: 'Invite Links', perms: ['send_invites'] },
  { key: 'whatsapp', icon: '◈', label: 'WhatsApp',     perms: ['send_whatsapp','send_whatsapp_limited'] },
  { key: 'requests', icon: '⊟', label: 'Requests Sheet', perms: ['manage_users'] },
  { key: 'roles',    icon: '⊛', label: 'Roles',        perms: ['manage_roles','view_all'] },
  { key: 'logs',     icon: '≡', label: 'Activity Log', perms: ['view_logs'] },
  { key: 'profile',  icon: '◯', label: 'My Profile',   perms: [] },
];

function buildSidebar() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';
  const userPerms = DB.getPerms(SESSION.role);
  NAV_ALL.forEach(item => {
    const allowed = item.perms.length === 0 || item.perms.some(p => userPerms.includes(p));
    if (!allowed) return;
    const el = document.createElement('div');
    el.className = 'nav-item';
    el.dataset.panel = item.key;
    el.innerHTML = `<span class="nav-icon">${item.icon}</span><span class="nav-label">${item.label}</span>`;
    el.addEventListener('click', () => showPanel(item.key));
    nav.appendChild(el);
  });
}

// ── Panel Renderer ────────────────────────────────────────────────────────────
function renderPanel(key) {
  const fns = {
    home: renderHome, users: renderUsers, invites: renderInvites,
    whatsapp: renderWhatsApp, roles: renderRoles, logs: renderLogs,
    profile: renderProfile, requests: renderRequests
  };
  if (fns[key]) fns[key]();
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function renderHome() {
  const users   = DB.getUsers();
  const active  = users.filter(u => u.isActive).length;
  const invites = DB.getInvites();
  const usedInv = invites.filter(i => i.used).length;
  const logs    = DB.getLogs(5);

  const el = document.getElementById('panel-home');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Dashboard Overview</div>
        <div class="page-sub">${new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
      </div>
    </div>
    <div class="stats-grid">
      ${statCard('◉', users.length, 'Total Users',   'c-accent')}
      ${statCard('✓', active,       'Active Users',  'c-green')}
      ${statCard('⊕', invites.length,'Invites Sent', 'c-blue')}
      ${statCard('⊛', usedInv,      'Invites Used',  'c-amber')}
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">Recent Users</div>
        <div class="card-sub">Latest registered members</div>
        ${users.slice(0,6).map(u => `
          <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
            <div class="avatar" style="background:${DB.getRoleColor(u.role)}">${initials(u.fullName)}</div>
            <div style="flex:1">
              <div style="font-size:12px;font-weight:600">${u.fullName}</div>
              <div style="font-size:10px;color:var(--text-2)">@${u.username}</div>
            </div>
            <span class="role-badge" style="background:${DB.getRoleColor(u.role)}">${u.role.toUpperCase()}</span>
            <span class="badge ${u.isActive?'badge-active':'badge-inactive'}">${u.isActive?'ON':'OFF'}</span>
          </div>`).join('')}
      </div>
      <div class="card">
        <div class="card-title">Recent Activity</div>
        <div class="card-sub">Last 5 system events</div>
        ${logs.map(l => logRow(l)).join('')}
      </div>
    </div>`;
}
function statCard(icon, val, label, cls) {
  return `<div class="stat-card ${cls}"><div class="stat-icon">${icon}</div>
    <div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>`;
}
function logRow(l) {
  const c = l.action.includes('DELETE')?'var(--red)':l.action.includes('CREATE')?'var(--green)':
            l.action.includes('LOGIN')?'var(--accent)':l.action.includes('CHANGE')?'var(--amber)':'var(--text-3)';
  return `<div class="log-row">
    <div class="log-dot" style="background:${c}"></div>
    <div class="log-time">${(l.timestamp||'').slice(0,16).replace('T',' ')}</div>
    <div class="log-who">${l.userName}</div>
    <div class="log-action" style="color:${c}">${l.action.replace(/_/g,' ')}</div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// USERS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
let _userSearch = '';
function renderUsers() {
  const perms  = DB.getPerms(SESSION.role);
  const canAdd = perms.includes('add_users') || perms.includes('manage_users');
  const canDel = perms.includes('delete_all');
  const canEdit= perms.includes('edit_all') || perms.includes('manage_users');
  const viewAll= perms.includes('view_all');

  const el = document.getElementById('panel-users');
  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">User Management</div>
        <div class="page-sub">Manage accounts, roles and access</div></div>
      <div class="header-actions">
        ${canAdd?`<button class="btn btn-green" onclick="openAddUserModal()">＋ Add User</button>`:''}
        <button class="btn btn-ghost" onclick="renderUsers()">⟳ Refresh</button>
      </div>
    </div>
    <div class="card">
      <div class="search-bar">
        <input class="search-input" id="userSearch" placeholder="Search name, username, role…"
          value="${_userSearch}" oninput="_userSearch=this.value;renderUserTable()">
      </div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>User</th><th>Username</th><th>Role</th><th>Phone</th>
          <th>WhatsApp</th><th>Status</th><th>Joined</th><th>Actions</th>
        </tr></thead>
        <tbody id="userTableBody"></tbody>
      </table></div>
    </div>`;
  renderUserTable(canEdit, canDel);
}

function renderUserTable(canEdit, canDel) {
  if (canEdit === undefined) {
    const p = DB.getPerms(SESSION.role);
    canEdit = p.includes('edit_all')||p.includes('manage_users');
    canDel  = p.includes('delete_all');
  }
  const viewAll = DB.getPerms(SESSION.role).includes('view_all');
  let users = viewAll ? DB.getUsers() : DB.getUsers().filter(u => u.createdBy === SESSION.id || u.id === SESSION.id);
  const q = (_userSearch||'').toLowerCase();
  if (q) users = users.filter(u => u.fullName.toLowerCase().includes(q) ||
    u.username.toLowerCase().includes(q) || u.role.includes(q));

  const tbody = document.getElementById('userTableBody');
  if (!tbody) return;
  if (!users.length) { tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-3);padding:40px">No users found</td></tr>`; return; }

  tbody.innerHTML = users.map(u => `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px">
        <div class="avatar" style="background:${DB.getRoleColor(u.role)};width:32px;height:32px;font-size:11px">${initials(u.fullName)}</div>
        <div style="font-size:12px;font-weight:600">${esc(u.fullName)}</div></div></td>
      <td class="td-muted td-mono">@${esc(u.username)}</td>
      <td><span class="role-badge" style="background:${DB.getRoleColor(u.role)};font-size:10px;padding:2px 7px">${u.role.toUpperCase()}</span></td>
      <td class="td-muted">${esc(u.phone)||'—'}</td>
      <td class="td-muted">${esc(u.whatsapp)||'—'}</td>
      <td><span class="badge ${u.isActive?'badge-active':'badge-inactive'}">${u.isActive?'ACTIVE':'INACTIVE'}</span></td>
      <td class="td-muted">${(u.createdAt||'').slice(0,10)}</td>
      <td>
        <div class="action-cell">
          ${canEdit && u.id !== 'admin_1' ? `
            <button class="btn btn-ghost btn-sm btn-icon" title="Change Role" onclick="openChangeRoleModal('${u.id}')">↑</button>
            <button class="btn btn-ghost btn-sm btn-icon" title="${u.isActive?'Deactivate':'Activate'}" onclick="doToggleActive('${u.id}')">${u.isActive?'⊘':'⊙'}</button>
          ` : ''}
          ${canDel && u.role !== 'admin' && u.id !== SESSION.id ? `
            <button class="btn btn-red btn-sm btn-icon" title="Delete" onclick="confirmDeleteUser('${u.id}','${esc(u.fullName)}')">✕</button>
          ` : ''}
          ${u.whatsapp ? `<button class="btn btn-ghost btn-sm" onclick="openWAChat('${u.whatsapp}')">📱</button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

function doToggleActive(uid) {
  const u = DB.getUserById(uid);
  if (!u) return;
  if (uid === SESSION.id) { toast('Cannot deactivate yourself','error'); return; }
  DB.toggleActive(uid, SESSION.id);
  toast(`${u.fullName} ${u.isActive?'deactivated':'activated'}`, u.isActive?'warn':'success');
  renderUserTable();
}

function confirmDeleteUser(uid, name) {
  openConfirm(`Delete user <strong>${name}</strong>?`, 'This action cannot be undone.', () => {
    DB.deleteUser(uid, SESSION.id);
    toast(`${name} deleted`, 'error');
    renderUserTable();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVITES PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function renderInvites() {
  const perms = DB.getPerms(SESSION.role);
  const viewAll = perms.includes('view_all');
  const el = document.getElementById('panel-invites');
  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Invite Links</div>
        <div class="page-sub">Generate and manage invite tokens</div></div>
      <div class="header-actions">
        <button class="btn btn-accent" onclick="openGenInviteModal()">⊕ Generate Invite</button>
        <button class="btn btn-ghost" onclick="renderInvites()">⟳ Refresh</button>
      </div>
    </div>
    <div class="card" style="background:rgba(0,255,178,.03);border-color:rgba(0,255,178,.15);margin-bottom:20px">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <span style="font-size:20px">ℹ</span>
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--accent);margin-bottom:4px">How Invite Tokens Work</div>
          <div style="font-size:11px;color:var(--text-2);line-height:1.8">
            Generate a token → Share via WhatsApp → Employee registers using token →
            They gain access with the assigned role. Tokens are <strong style="color:var(--accent)">single-use</strong>.
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Invite Tokens</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Token</th><th>Role</th><th>Status</th><th>Created By</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody id="inviteTableBody"></tbody>
      </table></div>
    </div>`;
  renderInviteTable(viewAll);
}

function renderInviteTable(viewAll) {
  const invites = viewAll ? DB.getInvites() : DB.getInvites(SESSION.id);
  const tbody = document.getElementById('inviteTableBody');
  if (!tbody) return;
  if (!invites.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:40px">No invites yet. Generate your first invite!</td></tr>`;
    return;
  }
  tbody.innerHTML = invites.map(i => `
    <tr>
      <td>
        <div class="token-box" onclick="copyToken('${i.token}',this)" style="margin:0;padding:6px 10px;font-size:11px">
          ${i.token.slice(0,24)}…
          <span class="copy-hint">Click to copy full token</span>
        </div>
      </td>
      <td><span class="role-badge" style="background:${DB.getRoleColor(i.role)};font-size:10px;padding:2px 7px">${i.role.toUpperCase()}</span></td>
      <td><span class="badge ${i.used?'badge-used':'badge-fresh'}">${i.used?'USED':'ACTIVE'}</span></td>
      <td class="td-muted">${esc(i.creatorName)}</td>
      <td class="td-muted">${(i.createdAt||'').slice(0,10)}</td>
      <td>
        <div class="action-cell">
          ${!i.used ? `<button class="btn btn-accent btn-sm" onclick="openSendInviteModal('${i.token}','${i.role}')">📱 Send</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="copyToken('${i.token}',this)">⧉ Copy</button>
        </div>
      </td>
    </tr>`).join('');
}

function copyToken(token, el) {
  navigator.clipboard.writeText(token).then(() => toast('Token copied to clipboard!', 'success'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function renderWhatsApp() {
  const perms  = DB.getPerms(SESSION.role);
  const viewAll= perms.includes('view_all');
  const users  = (viewAll ? DB.getUsers() : DB.getUsers().filter(u => u.createdBy === SESSION.id))
                  .filter(u => u.whatsapp);
  const msgs   = DB.getMessages(viewAll ? null : SESSION.id);

  const el = document.getElementById('panel-whatsapp');
  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">WhatsApp Messaging</div>
        <div class="page-sub">Send messages and invites via WhatsApp Web</div></div>
    </div>
    <div class="two-col">
      <!-- Compose -->
      <div class="card wa-compose">
        <div class="wa-compose-header">
          <span class="wa-logo">📱</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--green)">Compose Message</div>
            <div style="font-size:10px;color:var(--text-2)">Opens WhatsApp Web with pre-filled message</div>
          </div>
        </div>
        <div style="padding:20px">
          <div class="field">
            <label>TO — Phone Number</label>
            <input id="wa-phone" type="text" placeholder="e.g. 233244000000" oninput="updateWAPreview()">
            <div class="hint">International format without + sign</div>
          </div>
          <div class="field">
            <label>OR PICK FROM USERS WITH WHATSAPP</label>
            <select id="wa-user-pick" onchange="pickWAUser()">
              <option value="">— Select a user —</option>
              ${users.map(u => `<option value="${u.whatsapp}">${esc(u.fullName)} (${u.whatsapp})</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Message</label>
            <textarea id="wa-msg" rows="5" placeholder="Type your message…" oninput="updateWAPreview()"></textarea>
          </div>
          <div id="wa-preview" style="display:none;background:var(--bg-2);border:1px solid var(--border);padding:12px;margin-bottom:14px;font-size:11px;color:var(--text-2);line-height:1.7"></div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-accent" style="flex:1;justify-content:center" onclick="sendWAMessage()">✉ Send Message</button>
            <button class="btn btn-ghost" onclick="openWADirect()">⊕ Open Chat</button>
          </div>
        </div>
      </div>
      <!-- History -->
      <div class="card">
        <div class="card-title">Message History</div>
        <div class="card-sub">${viewAll?'All messages':'Your messages'}</div>
        <div style="max-height:420px;overflow-y:auto">
          ${msgs.length === 0 ? `<div class="empty-state"><div class="empty-icon">📭</div><p>No messages sent yet</p></div>` :
            msgs.map(m => `
              <div style="padding:10px 0;border-bottom:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                  <span style="font-size:11px;font-weight:600;color:var(--accent)">${esc(m.senderName)}</span>
                  <span style="font-size:10px;color:var(--text-3)">${(m.sentAt||'').slice(0,16).replace('T',' ')}</span>
                </div>
                <div style="font-size:10px;color:var(--text-2)">To: ${esc(m.recipient)}</div>
                <div style="font-size:11px;color:var(--text-1);margin-top:4px">${esc(m.message).slice(0,100)}${m.message.length>100?'…':''}</div>
              </div>`).join('')}
        </div>
      </div>
    </div>`;
}

function pickWAUser() {
  const val = document.getElementById('wa-user-pick').value;
  if (val) { document.getElementById('wa-phone').value = val; updateWAPreview(); }
}
function updateWAPreview() {
  const phone = document.getElementById('wa-phone')?.value;
  const msg   = document.getElementById('wa-msg')?.value;
  const prev  = document.getElementById('wa-preview');
  if (!prev) return;
  if (phone && msg) {
    prev.style.display = 'block';
    prev.innerHTML = `<strong style="color:var(--text-1)">Preview:</strong><br>To: +${phone}<br><br>${esc(msg).replace(/\n/g,'<br>')}`;
  } else { prev.style.display = 'none'; }
}
function sendWAMessage() {
  const phone = document.getElementById('wa-phone')?.value?.trim();
  const msg   = document.getElementById('wa-msg')?.value?.trim();
  if (!phone) { toast('Enter a phone number','error'); return; }
  if (!msg)   { toast('Enter a message','error'); return; }
  const encoded = encodeURIComponent(msg);
  window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
  DB.saveMessage(SESSION.id, phone, msg);
  toast('WhatsApp Web opening…', 'success');
  document.getElementById('wa-msg').value = '';
  document.getElementById('wa-phone').value = '';
  updateWAPreview();
  setTimeout(() => renderPanel('whatsapp'), 500);
}
function openWADirect() {
  const phone = document.getElementById('wa-phone')?.value?.trim();
  if (!phone) { toast('Enter a phone number','warn'); return; }
  window.open(`https://wa.me/${phone}`, '_blank');
}
function openWAChat(phone) { window.open(`https://wa.me/${phone}`, '_blank'); }

// ═══════════════════════════════════════════════════════════════════════════════
// ROLES PANEL
// ═══════════════════════════════════════════════════════════════════════════════
let _selectedRole = 'admin';
function renderRoles() {
  const roles = DB.getAllRoles();
  const users = DB.getUsers();
  const el = document.getElementById('panel-roles');

  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Roles & Permissions</div>
        <div class="page-sub">View role definitions and access levels</div></div>
    </div>
    <div class="two-col">
      <div class="card" style="padding:0">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border)">
          <div class="card-title" style="margin:0">System Roles</div>
        </div>
        <div id="role-list" style="padding:8px 0">
          ${Object.keys(roles).map(r => `
            <div class="nav-item ${r===_selectedRole?'active':''}" onclick="selectRole('${r}')" style="border-left-width:3px">
              <span class="avatar" style="background:${DB.getRoleColor(r)};width:28px;height:28px;font-size:10px;flex-shrink:0">${r[0].toUpperCase()}</span>
              <div>
                <div style="font-size:12px;font-weight:600">${r.toUpperCase()}</div>
                <div style="font-size:10px;color:var(--text-2)">${users.filter(u=>u.role===r).length} users</div>
              </div>
            </div>`).join('')}
        </div>
      </div>
      <div>
        <div class="card" id="role-detail">
          ${renderRoleDetail(_selectedRole)}
        </div>
      </div>
    </div>`;
}

function selectRole(r) {
  _selectedRole = r;
  const detail = document.getElementById('role-detail');
  if (detail) detail.innerHTML = renderRoleDetail(r);
  document.querySelectorAll('#role-list .nav-item').forEach(el => {
    el.classList.toggle('active', el.querySelector('div div').textContent === r.toUpperCase());
  });
}

function renderRoleDetail(role) {
  const roles = DB.getAllRoles();
  const perms = roles[role] || [];
  const users = DB.getUsers().filter(u => u.role === role);
  const permLabels = {
    manage_users:'Manage all users', send_invites:'Send invite tokens',
    view_all:'View all records', edit_all:'Edit all records',
    delete_all:'Delete users', send_whatsapp:'Full WhatsApp access',
    manage_roles:'Manage roles', add_users:'Add new users',
    view_team:'View team members', edit_basic:'Edit basic info',
    view_logs:'View activity logs', view_own:'View own profile',
    send_whatsapp_limited:'Limited WhatsApp',
  };
  return `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div class="avatar" style="background:${DB.getRoleColor(role)};width:44px;height:44px;font-size:16px">${role[0].toUpperCase()}</div>
      <div>
        <div style="font-family:var(--font-display);font-size:18px;font-weight:800">${role.toUpperCase()}</div>
        <div style="font-size:11px;color:var(--text-2)">${perms.length} permissions · ${users.length} users</div>
      </div>
    </div>
    <div style="margin-bottom:16px">
      <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--text-2);margin-bottom:8px">PERMISSIONS</div>
      <div style="display:flex;flex-wrap:wrap">
        ${perms.map(p => `<span class="perm-chip">✓ ${permLabels[p]||p}</span>`).join('')}
      </div>
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--text-2);margin-bottom:8px">USERS WITH THIS ROLE</div>
      ${users.length === 0 ? `<div style="color:var(--text-3);font-size:11px">No users with this role</div>` :
        users.map(u => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
            <div class="avatar" style="background:${DB.getRoleColor(u.role)};width:26px;height:26px;font-size:9px">${initials(u.fullName)}</div>
            <div style="font-size:12px">${esc(u.fullName)}</div>
            <div style="font-size:10px;color:var(--text-2)">@${esc(u.username)}</div>
            <span class="badge ${u.isActive?'badge-active':'badge-inactive'}" style="margin-left:auto">${u.isActive?'ON':'OFF'}</span>
          </div>`).join('')}
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
let _logFilter = '';
function renderLogs() {
  const el = document.getElementById('panel-logs');
  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Activity Log</div>
        <div class="page-sub">Full system audit trail</div></div>
      <div class="header-actions">
        <button class="btn btn-ghost" onclick="renderLogs()">⟳ Refresh</button>
      </div>
    </div>
    <div class="card">
      <div class="search-bar">
        <input class="search-input" id="logFilter" placeholder="Filter by user, action…"
          value="${_logFilter}" oninput="_logFilter=this.value;renderLogTable()">
      </div>
      <div id="log-container"></div>
    </div>`;
  renderLogTable();
}
function renderLogTable() {
  const q = (_logFilter||'').toLowerCase();
  let logs = DB.getLogs(200);
  if (q) logs = logs.filter(l => (l.userName||'').toLowerCase().includes(q) ||
    (l.action||'').toLowerCase().includes(q) || (l.details||'').toLowerCase().includes(q));
  const c = document.getElementById('log-container');
  if (!c) return;
  if (!logs.length) { c.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>No activity found</p></div>`; return; }
  c.innerHTML = logs.map(l => {
    const col = l.action.includes('DELETE')?'var(--red)':l.action.includes('CREATE')?'var(--green)':
                l.action.includes('LOGIN')?'var(--accent)':l.action.includes('CHANGE')?'var(--amber)':'var(--text-3)';
    return `<div class="log-row">
      <div class="log-dot" style="background:${col}"></div>
      <div class="log-time">${(l.timestamp||'').slice(0,16).replace('T',' ')}</div>
      <div class="log-who">${esc(l.userName)}</div>
      <div class="log-action" style="color:${col};min-width:160px">${l.action.replace(/_/g,' ')}</div>
      <div class="log-detail">${esc(l.details||'')}</div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function renderProfile() {
  const u = DB.getUserById(SESSION.id);
  const perms = DB.getPerms(u.role);
  const el = document.getElementById('panel-profile');
  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">My Profile</div>
        <div class="page-sub">Account settings and preferences</div></div>
    </div>
    <div class="profile-hero">
      <div class="avatar avatar-lg" style="background:${DB.getRoleColor(u.role)}">${initials(u.fullName)}</div>
      <div class="profile-info">
        <h2>${esc(u.fullName)}</h2>
        <p>@${esc(u.username)} · ID: ${u.id}</p>
        <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
          <span class="role-badge" style="background:${DB.getRoleColor(u.role)}">${u.role.toUpperCase()}</span>
          <span class="badge badge-active">ACTIVE</span>
          <span style="font-size:10px;color:var(--text-2)">Member since ${(u.createdAt||'').slice(0,10)}</span>
        </div>
      </div>
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">Account Details</div>
        <div class="divider"></div>
        ${profileRow('Full Name',   u.fullName)}
        ${profileRow('Username',    '@'+u.username)}
        ${profileRow('Phone',       u.phone||'—')}
        ${profileRow('WhatsApp',    u.whatsapp||'—')}
        ${profileRow('Role',        u.role.toUpperCase())}
        ${profileRow('Status',      u.isActive?'Active':'Inactive')}
      </div>
      <div class="card">
        <div class="card-title">Change Password</div>
        <div class="divider"></div>
        <div id="pwd-error" class="error-msg"></div>
        <div class="field"><label>Current Password</label><input type="password" id="pwd-old" placeholder="••••••••"></div>
        <div class="field"><label>New Password</label><input type="password" id="pwd-new" placeholder="••••••••"></div>
        <div class="field"><label>Confirm New</label><input type="password" id="pwd-new2" placeholder="••••••••"></div>
        <button class="btn btn-amber btn-full" onclick="doChangePwd()">⟳ Update Password</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">My Permissions</div>
      <div class="divider"></div>
      <div style="display:flex;flex-wrap:wrap">
        ${perms.map(p => `<span class="perm-chip">✓ ${p.replace(/_/g,' ')}</span>`).join('')}
      </div>
    </div>`;
}
function profileRow(label, val) {
  return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:11px;color:var(--text-2)">${label}</span>
    <span style="font-size:12px;font-weight:600">${esc(String(val))}</span>
  </div>`;
}
function doChangePwd() {
  const old  = document.getElementById('pwd-old').value;
  const nw   = document.getElementById('pwd-new').value;
  const nw2  = document.getElementById('pwd-new2').value;
  const err  = document.getElementById('pwd-error');
  const show = (msg) => { err.textContent = msg; err.classList.add('show'); };
  err.classList.remove('show');
  if (!old||!nw||!nw2) { show('All fields required'); return; }
  if (nw !== nw2)       { show('New passwords do not match'); return; }
  if (nw.length < 6)    { show('Minimum 6 characters'); return; }
  if (!DB.changePassword(SESSION.id, old, nw)) { show('Current password incorrect'); return; }
  toast('Password updated successfully!', 'success');
  document.getElementById('pwd-old').value = '';
  document.getElementById('pwd-new').value = '';
  document.getElementById('pwd-new2').value = '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════════════════
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open')); }

// Close on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) closeAllModals();
});

// ── Add User Modal ──
function openAddUserModal() {
  const perms = DB.getPerms(SESSION.role);
  const canAdmin = perms.includes('manage_roles');
  const roles = canAdmin ? ['viewer','employee','supervisor','manager','admin'] : ['viewer','employee','supervisor'];
  document.getElementById('modal-add-user-body').innerHTML = `
    <div id="add-user-err" class="error-msg"></div>
    <div class="field-row">
      <div class="field"><label>Full Name *</label><input id="au-fname" placeholder="John Doe"></div>
      <div class="field"><label>Username *</label><input id="au-uname" placeholder="johndoe"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Password *</label><input id="au-pwd" type="password" placeholder="••••••••"></div>
      <div class="field"><label>Role *</label>
        <select id="au-role">${roles.map(r=>`<option value="${r}">${r.toUpperCase()}</option>`).join('')}</select>
      </div>
    </div>
    <div class="field-row">
      <div class="field"><label>Phone</label><input id="au-phone" placeholder="233244000000"></div>
      <div class="field"><label>WhatsApp</label><input id="au-wa" placeholder="233244000000"></div>
    </div>`;
  openModal('modal-add-user');
}

function submitAddUser() {
  const fname = document.getElementById('au-fname')?.value?.trim();
  const uname = document.getElementById('au-uname')?.value?.trim();
  const pwd   = document.getElementById('au-pwd')?.value;
  const role  = document.getElementById('au-role')?.value;
  const phone = document.getElementById('au-phone')?.value?.trim();
  const wa    = document.getElementById('au-wa')?.value?.trim();
  const err   = document.getElementById('add-user-err');
  const show  = (m) => { err.textContent = m; err.classList.add('show'); };
  err.classList.remove('show');
  if (!fname||!uname||!pwd) { show('Full name, username and password required'); return; }
  if (pwd.length < 6)       { show('Password min 6 characters'); return; }
  const u = DB.createUser({ username:uname, password:pwd, fullName:fname, role, phone, whatsapp:wa }, SESSION.id);
  if (!u) { show('Username already taken'); return; }
  toast(`User ${fname} created (${role.toUpperCase()})`, 'success');
  closeModal('modal-add-user');
  renderUsers();
}

// ── Change Role Modal ──
function openChangeRoleModal(uid) {
  const u = DB.getUserById(uid);
  if (!u) return;
  document.getElementById('modal-change-role-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <div class="avatar" style="background:${DB.getRoleColor(u.role)}">${initials(u.fullName)}</div>
      <div>
        <div style="font-size:14px;font-weight:700">${esc(u.fullName)}</div>
        <div style="font-size:11px;color:var(--text-2)">Current role: <span style="color:${DB.getRoleColor(u.role)};font-weight:700">${u.role.toUpperCase()}</span></div>
      </div>
    </div>
    <div class="field">
      <label>New Role</label>
      <select id="cr-role">
        ${['viewer','employee','supervisor','manager','admin'].map(r =>
          `<option value="${r}" ${r===u.role?'selected':''}>${r.toUpperCase()}</option>`).join('')}
      </select>
    </div>`;
  document.getElementById('modal-change-role').dataset.uid = uid;
  openModal('modal-change-role');
}

function submitChangeRole() {
  const uid     = document.getElementById('modal-change-role').dataset.uid;
  const newRole = document.getElementById('cr-role').value;
  DB.updateUserRole(uid, newRole, SESSION.id);
  toast('Role updated successfully', 'success');
  closeModal('modal-change-role');
  renderUserTable();
}

// ── Generate Invite Modal ──
function openGenInviteModal() {
  const perms = DB.getPerms(SESSION.role);
  const canAdmin = perms.includes('manage_roles');
  const roles = canAdmin ? ['viewer','employee','supervisor','manager','admin'] : ['viewer','employee','supervisor'];
  document.getElementById('modal-gen-invite-body').innerHTML = `
    <div class="field">
      <label>Role for Invitee</label>
      <select id="gi-role">${roles.map(r=>`<option value="${r}">${r.toUpperCase()}</option>`).join('')}</select>
    </div>
    <div id="gi-result" style="display:none">
      <div style="font-size:11px;color:var(--text-2);margin-bottom:6px">Generated Token:</div>
      <div id="gi-token" class="token-box"></div>
      <button class="btn btn-accent btn-sm" onclick="copyGenToken()">⧉ Copy Token</button>
    </div>`;
  openModal('modal-gen-invite');
}

let _genToken = '';
function submitGenInvite() {
  const role = document.getElementById('gi-role').value;
  _genToken = DB.generateInvite(role, SESSION.id);
  const result = document.getElementById('gi-result');
  const tokenEl = document.getElementById('gi-token');
  result.style.display = 'block';
  tokenEl.innerHTML = `${_genToken}<span class="copy-hint">Click to copy</span>`;
  tokenEl.onclick = copyGenToken;
  toast(`Invite generated for ${role.toUpperCase()}`, 'success');
  renderInviteTable(DB.getPerms(SESSION.role).includes('view_all'));
}

function copyGenToken() {
  navigator.clipboard.writeText(_genToken).then(() => toast('Token copied!', 'success'));
}

// ── Send Invite via WhatsApp Modal ──
function openSendInviteModal(token, role) {
  document.getElementById('modal-send-invite-body').innerHTML = `
    <div style="margin-bottom:16px;padding:12px;background:rgba(0,255,178,.05);border:1px solid rgba(0,255,178,.2)">
      <div style="font-size:10px;color:var(--text-2);margin-bottom:4px">TOKEN TO SEND</div>
      <div style="font-size:12px;color:var(--accent);word-break:break-all">${token}</div>
      <div style="font-size:10px;color:var(--text-2);margin-top:4px">Role: <strong style="color:${DB.getRoleColor(role)}">${role.toUpperCase()}</strong></div>
    </div>
    <div class="field">
      <label>Recipient Phone (international, no +)</label>
      <input id="si-phone" placeholder="e.g. 233244000000">
    </div>
    <div class="field">
      <label>Your Name (shown in message)</label>
      <input id="si-name" placeholder="${SESSION.fullName}" value="${SESSION.fullName}">
    </div>`;
  document.getElementById('modal-send-invite').dataset.token = token;
  document.getElementById('modal-send-invite').dataset.role  = role;
  openModal('modal-send-invite');
}

function submitSendInvite() {
  const phone  = document.getElementById('si-phone')?.value?.trim();
  const name   = document.getElementById('si-name')?.value?.trim() || SESSION.fullName;
  const token  = document.getElementById('modal-send-invite').dataset.token;
  const role   = document.getElementById('modal-send-invite').dataset.role;
  if (!phone) { toast('Enter phone number','error'); return; }
  const msg = `Hello! 👋\n\n*${name}* has invited you to join our Management System.\n\n🔑 Your Role: *${role.toUpperCase()}*\n🎟️ Invite Token:\n\`${token}\`\n\nUse this token on the Register tab to create your account.\n\n_Single-use — keep it confidential._`;
  const encoded = encodeURIComponent(msg);
  window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
  DB.saveMessage(SESSION.id, phone, `INVITE sent: role=${role}`);
  toast('WhatsApp opening — complete sending in browser', 'info');
  closeModal('modal-send-invite');
}

// ── Confirm Dialog ──
let _confirmCallback = null;
function openConfirm(msg, warn, cb) {
  _confirmCallback = cb;
  document.getElementById('confirm-msg').innerHTML = msg;
  document.getElementById('confirm-warn').textContent = warn || '';
  openModal('modal-confirm');
}
function submitConfirm() {
  closeModal('modal-confirm');
  if (_confirmCallback) _confirmCallback();
  _confirmCallback = null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN / REGISTER
// ═══════════════════════════════════════════════════════════════════════════════
function bindLoginEvents() {
  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('btn-register').addEventListener('click', doRegister);
  ['login-username','login-password'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.dataset.tab === tab));
}

function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.classList.remove('show');
  if (!username || !password) { errEl.textContent = 'Enter username and password'; errEl.classList.add('show'); return; }
  const result = DB.login(username, password);
  if (!result) { errEl.textContent = 'Invalid username or password'; errEl.classList.add('show'); return; }
  if (result.error === 'disabled') { errEl.textContent = 'Account disabled. Contact your admin.'; errEl.classList.add('show'); return; }
  setSession(result);
  bootApp();
}

function doRegister() {
  const token  = document.getElementById('reg-token').value.trim();
  const uname  = document.getElementById('reg-username').value.trim();
  const fname  = document.getElementById('reg-fullname').value.trim();
  const phone  = document.getElementById('reg-phone').value.trim();
  const wa     = document.getElementById('reg-wa').value.trim();
  const pwd    = document.getElementById('reg-pwd').value;
  const errEl  = document.getElementById('reg-error');
  errEl.classList.remove('show');
  const show = (m) => { errEl.textContent = m; errEl.classList.add('show'); };
  if (!token)  { show('Invite token required'); return; }
  if (!uname)  { show('Username required'); return; }
  if (!fname)  { show('Full name required'); return; }
  if (!pwd || pwd.length < 6) { show('Password min 6 characters'); return; }
  const user = DB.useInvite(token, { username:uname, fullName:fname, phone, whatsapp:wa, password:pwd });
  if (!user) { show('Invalid/used token or username taken'); return; }
  toast(`Account created! Role: ${user.role.toUpperCase()}. Please log in.`, 'success', 5000);
  switchTab('login');
  document.getElementById('login-username').value = uname;
}

function doLogout() {
  if (!confirm('Log out?')) return;
  DB.log(SESSION.id, 'LOGOUT', SESSION.fullName);
  clearSession();
  SESSION = null;
  showScreen('screen-login');
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUESTS SHEET PANEL
// ═══════════════════════════════════════════════════════════════════════════════
let _reqSearch = '';
let _reqStatusFilter = 'ALL';

function renderRequests() {
  const el = document.getElementById('panel-requests');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Requests Sheet</div>
        <div class="page-sub">Manage company requests — Request ID, Number, Company Name</div>
      </div>
      <div class="header-actions">
        <button class="btn btn-accent" onclick="openAddRequestModal()">＋ New Request</button>
        <button class="btn btn-blue" onclick="exportRequestsCSV()">⬇ Export CSV</button>
        <button class="btn btn-ghost" onclick="renderRequests()">⟳ Refresh</button>
      </div>
    </div>

    <!-- Stats row -->
    <div id="req-stats" style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap"></div>

    <!-- Toolbar -->
    <div class="card" style="padding:14px 20px;margin-bottom:0;border-bottom:none">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <input class="search-input" id="reqSearch" placeholder="Search Request ID, Number, Company…"
          value="${_reqSearch}" oninput="_reqSearch=this.value;renderRequestTable()"
          style="max-width:280px">
        <div style="display:flex;gap:6px;flex-wrap:wrap" id="status-filters"></div>
        <div style="margin-left:auto;font-size:11px;color:var(--text-2)" id="req-count"></div>
      </div>
    </div>

    <!-- Sheet table -->
    <div style="background:var(--bg-card);border:1px solid var(--border);overflow:hidden">
      <div class="table-wrap">
        <table id="req-table">
          <thead>
            <tr>
              <th style="width:32px"><input type="checkbox" id="req-check-all" onchange="toggleAllReqChecks(this)"></th>
              <th style="cursor:pointer" onclick="sortRequests('requestId')">REQUEST ID ↕</th>
              <th style="cursor:pointer" onclick="sortRequests('number')">NUMBER ↕</th>
              <th style="cursor:pointer" onclick="sortRequests('companyName')">COMPANY NAME ↕</th>
              <th>DESCRIPTION</th>
              <th style="cursor:pointer" onclick="sortRequests('status')">STATUS ↕</th>
              <th>NOTES</th>
              <th style="cursor:pointer" onclick="sortRequests('createdAt')">DATE ↕</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody id="req-tbody"></tbody>
        </table>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px" id="bulk-actions"></div>
  `;

  renderReqStats();
  renderStatusFilters();
  renderRequestTable();
}

let _reqSort = { col: 'createdAt', dir: -1 };

function sortRequests(col) {
  if (_reqSort.col === col) _reqSort.dir *= -1;
  else { _reqSort.col = col; _reqSort.dir = -1; }
  renderRequestTable();
}

function renderReqStats() {
  const reqs = DB.getRequests();
  const sc = DB.REQUEST_STATUS_COLORS;
  const counts = {};
  DB.REQUEST_STATUSES.forEach(s => counts[s] = reqs.filter(r => r.status === s).length);
  document.getElementById('req-stats').innerHTML =
    `<div class="stat-card c-accent" style="padding:12px 18px;flex:1;min-width:100px">
       <div class="stat-value" style="font-size:26px">${reqs.length}</div>
       <div class="stat-label">Total</div></div>` +
    DB.REQUEST_STATUSES.map(s => `
      <div style="flex:1;min-width:90px;background:var(--bg-card);border:1px solid var(--border);
                  padding:12px 16px;position:relative;overflow:hidden">
        <div style="font-family:var(--font-display);font-size:22px;font-weight:800;color:${sc[s]}">${counts[s]}</div>
        <div style="font-size:10px;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em">${s}</div>
        <div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:${sc[s]}"></div>
      </div>`).join('');
}

function renderStatusFilters() {
  const el = document.getElementById('status-filters');
  if (!el) return;
  const all = ['ALL', ...DB.REQUEST_STATUSES];
  el.innerHTML = all.map(s => {
    const active = _reqStatusFilter === s;
    const col = s === 'ALL' ? 'var(--text-2)' : DB.REQUEST_STATUS_COLORS[s];
    return `<button onclick="_reqStatusFilter='${s}';renderRequestTable()"
      style="padding:4px 10px;font-size:10px;font-family:var(--font-mono);font-weight:600;
             letter-spacing:.06em;border:1px solid ${active?col:'var(--border2)'};
             background:${active?col+'22':'transparent'};color:${active?col:'var(--text-2)'};
             cursor:pointer;transition:all .15s">${s}</button>`;
  }).join('');
}

let _selectedReqs = new Set();

function renderRequestTable() {
  let reqs = DB.getRequests();
  const q = (_reqSearch||'').toLowerCase();
  if (q) reqs = reqs.filter(r =>
    (r.requestId||'').toLowerCase().includes(q) ||
    (r.number||'').toLowerCase().includes(q) ||
    (r.companyName||'').toLowerCase().includes(q) ||
    (r.description||'').toLowerCase().includes(q));
  if (_reqStatusFilter !== 'ALL') reqs = reqs.filter(r => r.status === _reqStatusFilter);

  // Sort
  const col = _reqSort.col, dir = _reqSort.dir;
  reqs.sort((a,b) => {
    const av = (a[col]||'').toString().toLowerCase();
    const bv = (b[col]||'').toString().toLowerCase();
    return av < bv ? -dir : av > bv ? dir : 0;
  });

  const tbody = document.getElementById('req-tbody');
  const countEl = document.getElementById('req-count');
  if (!tbody) return;
  if (countEl) countEl.textContent = `${reqs.length} record${reqs.length!==1?'s':''}`;

  renderStatusFilters();

  if (!reqs.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:50px;color:var(--text-3)">
      <div style="font-size:32px;margin-bottom:10px">📋</div>No requests found</td></tr>`;
    return;
  }

  tbody.innerHTML = reqs.map(r => {
    const sc = DB.REQUEST_STATUS_COLORS[r.status] || 'var(--text-2)';
    const checked = _selectedReqs.has(r.id);
    return `<tr style="transition:background .1s" id="req-row-${r.id}">
      <td><input type="checkbox" class="req-check" data-id="${r.id}" ${checked?'checked':''}
          onchange="toggleReqCheck('${r.id}',this.checked)"></td>
      <td>
        <span style="font-family:var(--font-mono);font-weight:700;color:var(--accent);
                     font-size:12px;letter-spacing:.04em">${esc(r.requestId)}</span>
      </td>
      <td>
        <span style="font-family:var(--font-mono);font-size:13px;font-weight:600;
                     color:var(--text-1)">${esc(r.number)||'<span style="color:var(--text-3)">—</span>'}</span>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:6px;height:6px;border-radius:50%;background:${sc};flex-shrink:0"></div>
          <span style="font-weight:600;font-size:12px">${esc(r.companyName)||'<span style="color:var(--text-3)">—</span>'}</span>
        </div>
      </td>
      <td style="max-width:180px">
        <span style="color:var(--text-2);font-size:11px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px"
              title="${esc(r.description)}">${esc(r.description)||'—'}</span>
      </td>
      <td>
        <span style="display:inline-block;padding:3px 9px;font-size:10px;font-weight:700;
                     letter-spacing:.06em;border:1px solid ${sc};color:${sc};
                     background:${sc}18">${r.status}</span>
      </td>
      <td style="max-width:140px">
        <span style="color:var(--text-2);font-size:11px;display:block;overflow:hidden;
                     text-overflow:ellipsis;white-space:nowrap;max-width:140px"
              title="${esc(r.notes)}">${esc(r.notes)||'—'}</span>
      </td>
      <td style="color:var(--text-3);font-size:11px;white-space:nowrap">${(r.createdAt||'').slice(0,10)}</td>
      <td>
        <div class="action-cell">
          <button class="btn btn-ghost btn-sm btn-icon" title="Edit" onclick="openEditRequestModal('${r.id}')">✎</button>
          <button class="btn btn-red btn-sm btn-icon" title="Delete" onclick="confirmDeleteRequest('${r.id}','${esc(r.requestId)}')">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  renderBulkActions();
}

function toggleReqCheck(id, checked) {
  if (checked) _selectedReqs.add(id); else _selectedReqs.delete(id);
  renderBulkActions();
}
function toggleAllReqChecks(chk) {
  _selectedReqs.clear();
  if (chk.checked) {
    document.querySelectorAll('.req-check').forEach(c => { c.checked = true; _selectedReqs.add(c.dataset.id); });
  } else {
    document.querySelectorAll('.req-check').forEach(c => c.checked = false);
  }
  renderBulkActions();
}
function renderBulkActions() {
  const el = document.getElementById('bulk-actions');
  if (!el) return;
  if (_selectedReqs.size === 0) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <span style="font-size:11px;color:var(--text-2);align-self:center">${_selectedReqs.size} selected</span>
    ${DB.REQUEST_STATUSES.map(s =>
      `<button class="btn btn-ghost btn-sm" onclick="bulkSetStatus('${s}')">→ ${s}</button>`
    ).join('')}
    <button class="btn btn-red btn-sm" onclick="bulkDelete()">✕ Delete Selected</button>`;
}
function bulkSetStatus(status) {
  _selectedReqs.forEach(id => DB.updateRequest(id, { status }, SESSION.id));
  _selectedReqs.clear();
  toast(`Status updated to ${status}`, 'success');
  renderRequests();
}
function bulkDelete() {
  openConfirm(`Delete <strong>${_selectedReqs.size} requests</strong>?`, 'This cannot be undone.', () => {
    _selectedReqs.forEach(id => DB.deleteRequest(id, SESSION.id));
    _selectedReqs.clear();
    toast('Requests deleted', 'error');
    renderRequests();
  });
}

// ── Add Request Modal ──
function openAddRequestModal() {
  document.getElementById('modal-req-title').textContent = '＋ New Request';
  document.getElementById('modal-req-id-field').style.display = 'none';
  document.getElementById('req-id').value = '';
  document.getElementById('req-number').value = '';
  document.getElementById('req-company').value = '';
  document.getElementById('req-desc').value = '';
  document.getElementById('req-notes').value = '';
  document.getElementById('req-status').value = 'Pending';
  document.getElementById('modal-req').dataset.mode = 'add';
  document.getElementById('modal-req').dataset.editId = '';
  openModal('modal-req');
  setTimeout(() => document.getElementById('req-number').focus(), 100);
}

function openEditRequestModal(id) {
  const r = DB.getRequestById(id);
  if (!r) return;
  document.getElementById('modal-req-title').textContent = `✎ Edit ${r.requestId}`;
  document.getElementById('modal-req-id-field').style.display = 'block';
  document.getElementById('req-id-display').textContent = r.requestId;
  document.getElementById('req-number').value = r.number || '';
  document.getElementById('req-company').value = r.companyName || '';
  document.getElementById('req-desc').value = r.description || '';
  document.getElementById('req-notes').value = r.notes || '';
  document.getElementById('req-status').value = r.status || 'Pending';
  document.getElementById('modal-req').dataset.mode = 'edit';
  document.getElementById('modal-req').dataset.editId = id;
  openModal('modal-req');
}

function submitRequest() {
  const mode = document.getElementById('modal-req').dataset.mode;
  const editId = document.getElementById('modal-req').dataset.editId;
  const number      = document.getElementById('req-number').value.trim();
  const companyName = document.getElementById('req-company').value.trim();
  const description = document.getElementById('req-desc').value.trim();
  const notes       = document.getElementById('req-notes').value.trim();
  const status      = document.getElementById('req-status').value;
  if (!number && !companyName) { toast('Enter at least a Number or Company Name', 'error'); return; }
  if (mode === 'edit') {
    DB.updateRequest(editId, { number, companyName, description, notes, status }, SESSION.id);
    toast('Request updated', 'success');
  } else {
    DB.createRequest({ number, companyName, description, notes, status }, SESSION.id);
    toast('Request created', 'success');
  }
  closeModal('modal-req');
  renderRequests();
}

function confirmDeleteRequest(id, reqId) {
  openConfirm(`Delete request <strong>${reqId}</strong>?`, 'This cannot be undone.', () => {
    DB.deleteRequest(id, SESSION.id);
    toast(`${reqId} deleted`, 'error');
    renderRequests();
  });
}

// ── CSV Export ──
function exportRequestsCSV() {
  const reqs = DB.getRequests();
  const headers = ['REQUEST ID','NUMBER','COMPANY NAME','DESCRIPTION','STATUS','NOTES','DATE CREATED'];
  const rows = reqs.map(r => [
    r.requestId, r.number, r.companyName, r.description, r.status, r.notes,
    (r.createdAt||'').slice(0,10)
  ].map(v => `"${String(v||'').replace(/"/g,'""')}"`));
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `requests_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('CSV exported!', 'success');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function initials(name) {
  return (name||'').split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase() || '?';
}
function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
