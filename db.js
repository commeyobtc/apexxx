// ─── DB.JS — LocalStorage-backed database engine ───────────────────────────

const DB = (() => {
  const read = (key) => { try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; } };
  const write = (key, val) => localStorage.setItem(key, JSON.stringify(val));

  const ROLES_DEF = {
    admin:      ['manage_users','send_invites','view_all','edit_all','delete_all','send_whatsapp','manage_roles','view_logs'],
    manager:    ['add_users','send_invites','view_all','edit_basic','send_whatsapp','view_logs'],
    supervisor: ['view_team','edit_basic','send_whatsapp','view_logs'],
    employee:   ['view_own','send_whatsapp_limited'],
    viewer:     ['view_own'],
  };

  const ROLE_COLORS = {
    admin: '#FF6B35', manager: '#A855F7', supervisor: '#38BDF8',
    employee: '#34D399', viewer: '#94A3B8'
  };

  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    return Math.abs(h).toString(16).padStart(8,'0') + str.length.toString(16);
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  function init() {
    if (read('db_init')) return;
    write('users', [{
      id: 'admin_1', username: 'admin', password: hash('Admin@1234'),
      fullName: 'System Administrator', role: 'admin',
      phone: '', whatsapp: '', isActive: true,
      createdBy: null, createdAt: new Date().toISOString(), inviteToken: null
    }]);
    write('invites', []);
    write('activity_log', []);
    write('whatsapp_msgs', []);
    write('db_init', true);
  }

  function getUsers() { return read('users') || []; }
  function saveUsers(u) { write('users', u); }

  function getUserById(id) { return getUsers().find(u => u.id === id) || null; }
  function getUserByUsername(un) { return getUsers().find(u => u.username === un) || null; }

  function login(username, password) {
    const u = getUsers().find(u => u.username === username && u.password === hash(password));
    if (!u) return null;
    if (!u.isActive) return { error: 'disabled' };
    log(u.id, 'LOGIN', `${username} logged in`);
    return u;
  }

  function createUser(data, createdBy) {
    const users = getUsers();
    if (users.find(u => u.username === data.username)) return null;
    const user = {
      id: uid(), username: data.username, password: hash(data.password),
      fullName: data.fullName, role: data.role,
      phone: data.phone || '', whatsapp: data.whatsapp || '',
      isActive: true, createdBy, createdAt: new Date().toISOString(),
      inviteToken: uid()
    };
    users.push(user);
    saveUsers(users);
    log(createdBy, 'CREATE_USER', `Created ${data.username} (${data.role})`);
    return user;
  }

  function updateUserRole(userId, newRole, changedBy) {
    const users = getUsers();
    const u = users.find(u => u.id === userId);
    if (u) { u.role = newRole; saveUsers(users); log(changedBy, 'CHANGE_ROLE', `${u.username} → ${newRole}`); }
  }

  function toggleActive(userId, changedBy) {
    const users = getUsers();
    const u = users.find(u => u.id === userId);
    if (u) {
      u.isActive = !u.isActive;
      saveUsers(users);
      log(changedBy, u.isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', u.username);
    }
    return u?.isActive;
  }

  function deleteUser(userId, deletedBy) {
    const users = getUsers().filter(u => u.id !== userId || u.role === 'admin');
    saveUsers(users);
    log(deletedBy, 'DELETE_USER', `id=${userId}`);
  }

  function changePassword(userId, oldPwd, newPwd) {
    const users = getUsers();
    const u = users.find(u => u.id === userId);
    if (!u || u.password !== hash(oldPwd)) return false;
    u.password = hash(newPwd);
    saveUsers(users);
    log(userId, 'CHANGE_PASSWORD', 'Password changed');
    return true;
  }

  function generateInvite(role, createdBy) {
    const token = uid() + uid();
    const invites = read('invites') || [];
    invites.unshift({ id: uid(), token, role, createdBy, used: false, createdAt: new Date().toISOString() });
    write('invites', invites);
    log(createdBy, 'GENERATE_INVITE', `role=${role}`);
    return token;
  }

  function getInvites(createdBy = null) {
    const invs = read('invites') || [];
    const users = getUsers();
    return (createdBy ? invs.filter(i => i.createdBy === createdBy) : invs)
      .map(i => ({ ...i, creatorName: users.find(u => u.id === i.createdBy)?.fullName || '—' }));
  }

  function useInvite(token, userData) {
    const invites = read('invites') || [];
    const inv = invites.find(i => i.token === token && !i.used);
    if (!inv) return null;
    const user = createUser({ ...userData, role: inv.role }, inv.createdBy);
    if (!user) return null;
    inv.used = true;
    write('invites', invites);
    return user;
  }

  function log(userId, action, details = '') {
    const logs = read('activity_log') || [];
    logs.unshift({ id: uid(), userId, action, details, timestamp: new Date().toISOString() });
    if (logs.length > 500) logs.length = 500;
    write('activity_log', logs);
  }

  function getLogs(limit = 100) {
    const users = getUsers();
    return (read('activity_log') || []).slice(0, limit).map(l => ({
      ...l, userName: users.find(u => u.id === l.userId)?.fullName || 'System'
    }));
  }

  function saveMessage(senderId, recipient, message) {
    const msgs = read('whatsapp_msgs') || [];
    msgs.unshift({ id: uid(), senderId, recipient, message, status: 'sent', sentAt: new Date().toISOString() });
    write('whatsapp_msgs', msgs);
    log(senderId, 'WHATSAPP_SENT', `To: ${recipient}`);
  }

  function getMessages(userId = null) {
    const users = getUsers();
    const msgs = read('whatsapp_msgs') || [];
    return (userId ? msgs.filter(m => m.senderId === userId) : msgs)
      .map(m => ({ ...m, senderName: users.find(u => u.id === m.senderId)?.fullName || '—' }));
  }

  // ── Requests Sheet ───────────────────────────────────────────
  const REQUEST_STATUSES = ['Pending','In Review','Approved','Rejected','Completed'];
  const REQUEST_STATUS_COLORS = {
    'Pending':'#FFB300','In Review':'#2979FF','Approved':'#00E676',
    'Rejected':'#FF3D5A','Completed':'#94A3B8'
  };

  function getRequests() { return read('requests') || []; }
  function saveRequests(r) { write('requests', r); }

  function getNextRequestId() {
    const reqs = getRequests();
    if (!reqs.length) return 'REQ-0001';
    const nums = reqs.map(r => parseInt((r.requestId||'REQ-0000').split('-')[1]||0));
    return 'REQ-' + String(Math.max(...nums) + 1).padStart(4, '0');
  }

  function createRequest(data, createdBy) {
    const reqs = getRequests();
    const req = {
      id: uid(),
      requestId: getNextRequestId(),
      number: data.number || '',
      companyName: data.companyName || '',
      description: data.description || '',
      status: data.status || 'Pending',
      notes: data.notes || '',
      createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    reqs.unshift(req);
    saveRequests(reqs);
    log(createdBy, 'CREATE_REQUEST', `${req.requestId} — ${req.companyName}`);
    return req;
  }

  function updateRequest(id, data, updatedBy) {
    const reqs = getRequests();
    const r = reqs.find(r => r.id === id);
    if (!r) return null;
    Object.assign(r, { ...data, updatedAt: new Date().toISOString() });
    saveRequests(reqs);
    log(updatedBy, 'UPDATE_REQUEST', `${r.requestId} — ${r.companyName}`);
    return r;
  }

  function deleteRequest(id, deletedBy) {
    const reqs = getRequests();
    const r = reqs.find(r => r.id === id);
    saveRequests(reqs.filter(r => r.id !== id));
    if (r) log(deletedBy, 'DELETE_REQUEST', `${r.requestId} — ${r.companyName}`);
  }

  function getRequestById(id) { return getRequests().find(r => r.id === id) || null; }

  function getPerms(role) { return ROLES_DEF[role] || []; }
  function hasPerm(role, perm) { return getPerms(role).includes(perm); }
  function getRoleColor(role) { return ROLE_COLORS[role] || '#94A3B8'; }
  function getAllRoles() { return ROLES_DEF; }

  return { init, login, createUser, updateUserRole, toggleActive, deleteUser,
           changePassword, generateInvite, getInvites, useInvite,
           getUsers, getUserById, getUserByUsername,
           saveMessage, getMessages, getLogs, log,
           getPerms, hasPerm, getRoleColor, getAllRoles,
           getRequests, createRequest, updateRequest, deleteRequest, getRequestById,
           REQUEST_STATUSES, REQUEST_STATUS_COLORS };
})();
