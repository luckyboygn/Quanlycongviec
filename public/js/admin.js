// System Administration Module (Dành riêng cho Admin)
// Trường Đào tạo cán bộ Agribank
const Admin = {
  activeTab: 'users', // 'users', 'departments', 'logs'
  cachedDepts: [],

  async render() {
    if (!Auth.isAdmin()) {
      document.getElementById('main-content').innerHTML = `
        <div class="bg-rose-50 dark:bg-rose-900/20 p-8 rounded-2xl border border-rose-200 dark:border-rose-800 text-center">
          <i class="ph-bold ph-shield-warning text-5xl text-rose-600 mb-2"></i>
          <h2 class="text-xl font-bold text-rose-700 dark:text-rose-400">Truy cập bị từ chối</h2>
          <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">Chức năng Quản trị hệ thống chỉ dành riêng cho Admin (Ban Giám đốc / Phòng Tổng hợp).</p>
        </div>
      `;
      return;
    }

    const container = document.getElementById('main-content');
    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
              <span class="p-2 bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-xl">
                <i class="ph-bold ph-shield-check text-2xl"></i>
              </span>
              Quản trị Hệ thống (Admin Control Center)
            </h1>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Quản lý tài khoản 4 cấp vai trò, danh mục 5 phòng ban của Trường và theo dõi nhật ký hoạt động (Audit Log).
            </p>
          </div>
          <div class="flex items-center flex-wrap gap-2.5">
            <button onclick="Admin.downloadBackup()" class="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition transform hover:scale-102" title="Tải toàn bộ dữ liệu hệ thống (User, Việc, Nhật ký, Tin nhắn) về máy tính">
              <i class="ph-bold ph-cloud-arrow-down text-base"></i> Sao lưu hệ thống (.json)
            </button>
            <button onclick="Admin.openRestoreModal()" class="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition" title="Khôi phục toàn bộ hệ thống từ file sao lưu">
              <i class="ph-bold ph-cloud-arrow-up text-base"></i> Phục hồi dữ liệu
            </button>
            <button onclick="Admin.exportAllUsersToExcel()" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition transform hover:scale-102" title="Xuất toàn bộ thông tin người dùng / cán bộ trên hệ thống ra file Excel (.xlsx)">
              <i class="ph-bold ph-download-simple text-base"></i> Xuất Excel (.xlsx)
            </button>
            <button onclick="Admin.openImportExcelModal()" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition" title="Nhập danh sách cán bộ hàng loạt từ file Excel">
              <i class="ph-bold ph-file-arrow-up text-base"></i> Nhập Excel
            </button>
            <button onclick="Admin.openCreateModal()" class="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white dark:bg-purple-600 dark:hover:bg-purple-700 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition">
              <i class="ph-bold ph-plus text-base"></i> <span id="admin-create-btn-label">Tạo tài khoản mới</span>
            </button>
          </div>
        </div>

        <!-- Admin Tabs -->
        <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div class="flex items-center bg-slate-100 dark:bg-slate-700 p-1 rounded-xl overflow-x-auto custom-scrollbar">
            <button onclick="Admin.setTab('users')" id="adm-tab-users" class="px-4 py-2 rounded-lg text-xs font-bold transition bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm flex items-center gap-2 whitespace-nowrap">
              <i class="ph-bold ph-users"></i> Quản lý Người dùng
            </button>
            <button onclick="Admin.setTab('departments')" id="adm-tab-departments" class="px-4 py-2 rounded-lg text-xs font-bold transition text-slate-600 dark:text-slate-300 flex items-center gap-2 whitespace-nowrap">
              <i class="ph-bold ph-buildings"></i> 5 Phòng Ban
            </button>
            <button onclick="Admin.setTab('backup')" id="adm-tab-backup" class="px-4 py-2 rounded-lg text-xs font-bold transition text-slate-600 dark:text-slate-300 flex items-center gap-2 whitespace-nowrap">
              <i class="ph-bold ph-database"></i> Sao lưu & Phục hồi
            </button>
            <button onclick="Admin.setTab('logs')" id="adm-tab-logs" class="px-4 py-2 rounded-lg text-xs font-bold transition text-slate-600 dark:text-slate-300 flex items-center gap-2 whitespace-nowrap">
              <i class="ph-bold ph-clock-counter-clockwise"></i> Nhật ký Hoạt động
            </button>
          </div>
        </div>

        <!-- Tab Content View -->
        <div id="admin-tab-content">
          <div class="flex items-center justify-center py-12 text-slate-400">
            <i class="ph ph-spinner animate-spin text-3xl mr-2"></i> Đang tải dữ liệu quản trị...
          </div>
        </div>
      </div>
    `;

    try {
      this.cachedDepts = await apiFetch('/api/departments');
    } catch (e) {
      console.warn(e);
    }

    this.renderCurrentTab();
  },

  setTab(tab) {
    this.activeTab = tab;
    ['users', 'departments', 'backup', 'logs'].forEach(t => {
      const btn = document.getElementById(`adm-tab-${t}`);
      if (btn) {
        if (t === tab) {
          btn.className = 'px-4 py-2 rounded-lg text-xs font-bold transition bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm flex items-center gap-2 whitespace-nowrap';
        } else {
          btn.className = 'px-4 py-2 rounded-lg text-xs font-bold transition text-slate-600 dark:text-slate-300 flex items-center gap-2 whitespace-nowrap';
        }
      }
    });

    const createLabel = document.getElementById('admin-create-btn-label');
    if (createLabel) {
      if (tab === 'users') createLabel.innerText = 'Tạo tài khoản mới';
      else if (tab === 'departments') createLabel.innerText = 'Thêm phòng ban mới';
      else if (tab === 'backup') createLabel.innerText = 'Tải bản sao lưu';
      else createLabel.innerText = 'Tạo mới';
    }

    this.renderCurrentTab();
  },

  async renderCurrentTab() {
    const container = document.getElementById('admin-tab-content');
    if (!container) return;

    if (this.activeTab === 'users') {
      await this.renderUsersTab(container);
    } else if (this.activeTab === 'departments') {
      await this.renderDepartmentsTab(container);
    } else if (this.activeTab === 'backup') {
      await this.renderBackupTab(container);
    } else if (this.activeTab === 'logs') {
      await this.renderLogsTab(container);
    }
  },

  // 1. Users Tab
  async renderUsersTab(container) {
    try {
      const [users, depts] = await Promise.all([
        apiFetch('/api/users'),
        this.cachedDepts ? Promise.resolve(this.cachedDepts) : apiFetch('/api/departments')
      ]);
      this.cachedDepts = depts;

      container.innerHTML = `
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden space-y-3 p-4">
          <!-- Search & Filter Bar -->
          <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-700">
            <div class="relative w-full sm:w-80">
              <i class="ph-bold ph-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-sm"></i>
              <input type="text" id="adm-user-search-input" onkeyup="Admin.filterUserTable(this.value)" placeholder="Tìm kiếm cán bộ theo tên, username, phòng ban..." class="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500">
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1.5">
              <span>Tổng số:</span>
              <span class="px-2 py-0.5 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-lg font-black" id="adm-user-count">${users.length} cán bộ</span>
            </div>
          </div>

          <!-- Users Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead class="bg-slate-50 dark:bg-slate-700/50 text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th class="px-3 py-3">Mã CB</th>
                  <th class="px-3 py-3">Họ và tên cán bộ</th>
                  <th class="px-3 py-3">Phòng ban</th>
                  <th class="px-3 py-3">Chức vụ</th>
                  <th class="px-3 py-3">Cấp phân quyền</th>
                  <th class="px-2 py-3 text-center">Trạng thái</th>
                  <th class="px-3 py-3 text-right whitespace-nowrap">Thao tác chỉnh sửa</th>
                </tr>
              </thead>
              <tbody id="adm-user-tbody" class="divide-y divide-slate-100 dark:divide-slate-700">
                ${users.map(u => {
                  const roleColors = {
                    director: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700',
                    admin: 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700',
                    manager: 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700',
                    staff: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
                    auditor: 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700'
                  };

                  const isLocked = u.status === 'locked' || u.status === 'inactive';
                  const empCode = u.employee_code || ('CB' + String(u.id).padStart(3, '0'));
                  const userSearchStr = (empCode + ' ' + u.full_name + ' ' + u.username + ' ' + (u.department_name || 'Ban Giám đốc') + ' ' + (u.position || '') + ' ' + u.role).toLowerCase();

                  return `
                    <tr class="adm-user-row hover:bg-slate-50 dark:hover:bg-slate-700/30 transition ${isLocked ? 'opacity-70 bg-rose-50/20' : ''}" data-search="${userSearchStr}">
                      <!-- Mã cán bộ -->
                      <td class="px-3 py-3 font-mono font-bold text-blue-600 dark:text-blue-400 text-xs whitespace-nowrap">
                        <span class="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
                          ${empCode}
                        </span>
                      </td>

                      <td class="px-3 py-3 font-bold text-slate-800 dark:text-white flex items-center gap-2.5 cursor-pointer" onclick="Admin.openEditUserModal(${u.id}, \`${encodeURIComponent(JSON.stringify(u))}\`)" title="Bấm để chỉnh sửa thông tin">
                        <div class="w-7 h-7 rounded-lg ${isLocked ? 'bg-rose-100 text-rose-700 dark:bg-rose-950' : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'} flex items-center justify-center font-bold text-xs shrink-0">
                          ${u.full_name.split(' ').pop()[0]}
                        </div>
                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5">
                            <span class="hover:text-purple-600 dark:hover:text-purple-400 transition underline-offset-2 hover:underline">${u.full_name}</span>
                            ${isLocked ? '<i class="ph-bold ph-lock text-rose-500 text-xs" title="Tài khoản đang bị khóa"></i>' : ''}
                          </div>
                          <div class="text-[10px] font-normal text-slate-400 flex items-center gap-1 mt-0.5">
                            <span>${u.gender === 'Nữ' ? '👩 Nữ' : '👨 Nam'}</span>
                            <span>•</span>
                            <span class="text-blue-600 dark:text-blue-400 font-medium">${u.qualification || 'Đại học'}</span>
                            ${u.birth_date ? `<span>•</span><span>🎂 ${u.birth_date.split('-').reverse().join('/')}</span>` : ''}
                          </div>
                          ${u.id === Auth.user.id ? '<span class="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold">Bạn</span>' : ''}
                        </div>
                      </td>

                      <!-- Dropdown chọn Phòng ban trực tiếp cho cá nhân -->
                      <td class="px-3 py-3">
                        <select onchange="Admin.changeUserDepartment(${u.id}, this.value, '${u.full_name}')" class="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-800 dark:text-white cursor-pointer hover:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition max-w-[170px]" title="Chọn phòng ban cho cá nhân này">
                          <option value="" ${!u.department_id ? 'selected' : ''}>🏛️ Ban Giám đốc</option>
                          ${depts.map(d => `
                            <option value="${d.id}" ${u.department_id == d.id ? 'selected' : ''}>🏢 ${d.name}</option>
                          `).join('')}
                        </select>
                      </td>
                      
                      <!-- Dropdown tùy chọn Chức vụ -->
                      <td class="px-3 py-3">
                        <select onchange="Admin.changeUserPosition(${u.id}, this.value, '${u.full_name}')" class="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-800 dark:text-white cursor-pointer hover:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition">
                          <option value="Giám đốc" ${u.position === 'Giám đốc' ? 'selected' : ''}>Giám đốc</option>
                          <option value="Phó Giám đốc" ${u.position === 'Phó Giám đốc' ? 'selected' : ''}>Phó Giám đốc</option>
                          <option value="Trưởng phòng" ${u.position === 'Trưởng phòng' ? 'selected' : ''}>Trưởng phòng</option>
                          <option value="Phó phòng" ${u.position === 'Phó phòng' ? 'selected' : ''}>Phó phòng</option>
                          <option value="Nhân viên" ${u.position === 'Nhân viên' ? 'selected' : ''}>Nhân viên</option>
                        </select>
                      </td>

                      <!-- Dropdown chuyển đổi phân quyền linh hoạt -->
                      <td class="px-3 py-3">
                        <select onchange="Admin.changeUserRole(${u.id}, this.value, '${u.full_name}')" class="px-2 py-1 rounded-lg text-xs font-bold border transition cursor-pointer focus:ring-1 focus:ring-purple-500 focus:outline-none ${roleColors[u.role] || ''}">
                          <option value="director" ${u.role === 'director' ? 'selected' : ''} class="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">🏛️ Ban Giám đốc</option>
                          <option value="admin" ${u.role === 'admin' ? 'selected' : ''} class="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">👑 Admin Quản trị</option>
                          <option value="manager" ${u.role === 'manager' ? 'selected' : ''} class="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">⭐ Trưởng phòng</option>
                          <option value="staff" ${u.role === 'staff' ? 'selected' : ''} class="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">👤 Nhân viên</option>
                          <option value="auditor" ${u.role === 'auditor' ? 'selected' : ''} class="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">🔍 Kiểm tra & Giám sát</option>
                        </select>
                      </td>

                      <!-- Trạng thái tài khoản -->
                      <td class="px-2 py-3 text-center">
                        ${isLocked ? `
                          <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            <i class="ph-bold ph-lock-key"></i> Đã khóa
                          </span>
                        ` : `
                          <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <i class="ph-bold ph-check-circle"></i> Hoạt động
                          </span>
                        `}
                      </td>

                      <!-- Thao tác chỉnh sửa thủ công cho tất cả tài khoản -->
                      <td class="px-3 py-3 text-right whitespace-nowrap">
                        <div class="flex items-center justify-end gap-1.5">
                          <!-- Nút Chỉnh sửa thủ công toàn diện -->
                          <button onclick="Admin.openEditUserModal(${u.id}, \`${encodeURIComponent(JSON.stringify(u))}\`)" class="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition shadow-sm" title="Chỉnh sửa thủ công toàn bộ thông tin cán bộ">
                            <i class="ph-bold ph-pencil-simple text-sm"></i>
                            <span>Sửa</span>
                          </button>

                          <!-- Nút Đổi mật khẩu & Username -->
                          <button onclick="Admin.openResetPasswordModal(${u.id}, '${u.username}')" class="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-xl transition border border-slate-200 dark:border-slate-700" title="Đổi mật khẩu / Tên đăng nhập">
                            <i class="ph-bold ph-key text-sm"></i>
                          </button>

                          <!-- Nút Khóa / Mở khóa -->
                          ${u.id !== Auth.user.id ? `
                            <button onclick="Admin.toggleUserLock(${u.id}, '${u.full_name}', '${u.status}')" class="p-1.5 ${isLocked ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border-emerald-300' : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 border-amber-300'} rounded-xl transition border" title="${isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản (ngăn đăng nhập)'}">
                              <i class="ph-bold ${isLocked ? 'ph-lock-key-open text-emerald-600' : 'ph-lock-key text-amber-600'} text-sm"></i>
                            </button>
                          ` : ''}

                          <!-- Nút Xóa -->
                          ${u.id !== Auth.user.id ? `
                            <button onclick="Admin.deleteUser(${u.id}, '${u.username}')" class="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition border border-slate-200 dark:border-slate-700" title="Xóa tài khoản">
                              <i class="ph-bold ph-trash text-sm"></i>
                            </button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div class="p-6 text-rose-500">Lỗi tải danh sách người dùng: ${e.message}</div>`;
    }
  },

  filterUserTable(query) {
    const q = (query || '').toLowerCase().trim();
    const rows = document.querySelectorAll('.adm-user-row');
    let visibleCount = 0;
    rows.forEach(r => {
      const searchData = r.getAttribute('data-search') || '';
      if (!q || searchData.includes(q)) {
        r.style.display = '';
        visibleCount++;
      } else {
        r.style.display = 'none';
      }
    });
    const countEl = document.getElementById('adm-user-count');
    if (countEl) countEl.innerText = `${visibleCount} cán bộ`;
  },

  // 2. Departments Tab
  async renderDepartmentsTab(container) {
    try {
      const depts = await apiFetch('/api/departments');
      container.innerHTML = `
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead class="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th class="px-6 py-4">Mã phòng</th>
                  <th class="px-6 py-4">Tên Phòng Ban</th>
                  <th class="px-6 py-4">Mô tả chức năng</th>
                  <th class="px-6 py-4 text-center">Số cán bộ</th>
                  <th class="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
                ${depts.map(d => `
                  <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                    <td class="px-6 py-4 font-mono font-bold text-purple-600 dark:text-purple-400">${d.code}</td>
                    <td class="px-6 py-4 font-bold text-slate-800 dark:text-white">${d.name}</td>
                    <td class="px-6 py-4 text-xs text-slate-500">${d.description || '—'}</td>
                    <td class="px-6 py-4 text-center font-bold">${d.user_count !== undefined ? d.user_count : (d.members_count || 0)}</td>
                    <td class="px-6 py-4 text-right">
                      <button onclick="Admin.openEditDeptModal(${d.id}, \`${encodeURIComponent(JSON.stringify(d))}\`)" class="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg" title="Chỉnh sửa thông tin phòng ban">
                        <i class="ph-bold ph-pencil-simple text-base"></i>
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div class="p-6 text-rose-500">Lỗi: ${e.message}</div>`;
    }
  },

  // 3. Audit Logs Tab
  async renderLogsTab(container) {
    try {
      const logs = await apiFetch('/api/audit-logs');
      container.innerHTML = `
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead class="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th class="px-6 py-4">Thời gian</th>
                  <th class="px-6 py-4">Người thực hiện</th>
                  <th class="px-6 py-4">Hành động</th>
                  <th class="px-6 py-4">Đối tượng</th>
                  <th class="px-6 py-4">Chi tiết</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700 font-mono text-xs">
                ${logs.map(l => {
                  const cleanDate = l.created_at ? (function(dStr) {
                    const clean = String(dStr).split('T')[0].split(' ')[0];
                    const parts = clean.split('-');
                    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dStr;
                  })(l.created_at) : '';

                  return `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                      <td class="px-6 py-4 text-slate-400 font-bold">${cleanDate}</td>
                      <td class="px-6 py-4 font-bold text-slate-800 dark:text-white">${l.user_name || 'Hệ thống'}</td>
                      <td class="px-6 py-4"><span class="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold">${l.action}</span></td>
                      <td class="px-6 py-4 text-slate-600 dark:text-slate-300">${l.entity_type} (#${l.entity_id || ''})</td>
                      <td class="px-6 py-4 text-slate-500 truncate max-w-xs">${l.details || '—'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div class="p-6 text-rose-500">Lỗi: ${e.message}</div>`;
    }
  },

  openCreateModal() {
    if (this.activeTab === 'users') {
      this.openCreateUserModal();
    } else if (this.activeTab === 'departments') {
      this.openCreateDeptModal();
    } else {
      App.showToast('Vui lòng chọn tab tương ứng để tạo mới.', 'info');
    }
  },

  openCreateUserModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <i class="ph-bold ph-user-plus text-purple-600"></i> Tạo mới tài khoản người dùng
            </h3>
            <button onclick="App.closeModal()" class="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
              <i class="ph-bold ph-x text-lg"></i>
            </button>
          </div>

          <form onsubmit="Admin.submitCreateUser(event)" class="space-y-4 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold uppercase text-slate-500 mb-1">Mã cán bộ (Tùy chọn)</label>
                <input type="text" id="adm-new-empcode" placeholder="VD: CB015 (để trống tự sinh)" class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-mono font-bold dark:text-white">
              </div>

              <div>
                <label class="block font-bold uppercase text-slate-500 mb-1">Tên đăng nhập (Username) *</label>
                <input type="text" id="adm-new-username" required placeholder="VD: gv_huong, nv_thanh..." class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-bold dark:text-white">
              </div>
            </div>

            <div>
              <label class="block font-bold uppercase text-slate-500 mb-1">Mật khẩu ban đầu *</label>
              <input type="password" id="adm-new-password" required value="123456" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-mono dark:text-white">
            </div>

            <div>
              <label class="block font-bold uppercase text-slate-500 mb-1">Họ và tên cán bộ *</label>
              <input type="text" id="adm-new-fullname" required placeholder="VD: ThS. Lê Thu Hường..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-bold dark:text-white">
            </div>

            <!-- Ngày sinh, Giới tính, Trình độ -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold uppercase text-slate-500 mb-1">Ngày sinh</label>
                <input type="date" id="adm-new-birthdate" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl dark:text-white font-medium">
              </div>

              <div>
                <label class="block font-bold uppercase text-slate-500 mb-1">Giới tính</label>
                <select id="adm-new-gender" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl dark:text-white font-medium">
                  <option value="Nam" selected>Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>

              <div>
                <label class="block font-bold uppercase text-slate-500 mb-1">Trình độ</label>
                <select id="adm-new-qualification" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl dark:text-white font-medium">
                  <option value="Tiến sĩ">Tiến sĩ</option>
                  <option value="Thạc sĩ">Thạc sĩ</option>
                  <option value="Đại học" selected>Đại học</option>
                  <option value="Cao đẳng">Cao đẳng</option>
                  <option value="Trung cấp">Trung cấp</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold uppercase text-slate-500 mb-1">Phòng ban *</label>
                <select id="adm-new-dept" required class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl dark:text-white">
                  <option value="">-- Không chọn (Ban Giám đốc) --</option>
                  ${this.cachedDepts.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('')}
                </select>
              </div>

              <div>
                <label class="block font-bold uppercase text-slate-500 mb-1">Cấp phân quyền *</label>
                <select id="adm-new-role" required class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl dark:text-white font-bold">
                  <option value="staff" selected>👤 Nhân viên</option>
                  <option value="manager">⭐ Cấp Trưởng phòng</option>
                  <option value="director">🏛️ Cấp Ban Giám đốc</option>
                  <option value="admin">👑 Cấp Admin Quản trị</option>
                  <option value="auditor">🔍 Cấp Kiểm tra & Giám sát</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-bold uppercase text-slate-500 mb-1">Chức vụ cụ thể *</label>
              <select id="adm-new-position" required class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl dark:text-white font-bold">
                <option value="Nhân viên" selected>Nhân viên</option>
                <option value="Phó phòng">Phó phòng</option>
                <option value="Trưởng phòng">Trưởng phòng</option>
                <option value="Phó Giám đốc">Phó Giám đốc</option>
                <option value="Giám đốc">Giám đốc</option>
              </select>
            </div>

            <div class="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
              <button type="button" onclick="App.closeModal()" class="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl font-bold">Hủy</button>
              <button type="submit" class="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-sm">Tạo người dùng</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitCreateUser(e) {
    e.preventDefault();
    try {
      const employee_code = document.getElementById('adm-new-empcode')?.value.trim() || null;
      const username = document.getElementById('adm-new-username').value.trim();
      const password = document.getElementById('adm-new-password').value;
      const full_name = document.getElementById('adm-new-fullname').value.trim();
      const deptEl = document.getElementById('adm-new-dept');
      const department_id = deptEl.value ? parseInt(deptEl.value) : null;
      const role = document.getElementById('adm-new-role').value;
      const position = document.getElementById('adm-new-position').value.trim();
      const birth_date = document.getElementById('adm-new-birthdate').value;
      const gender = document.getElementById('adm-new-gender').value;
      const qualification = document.getElementById('adm-new-qualification').value;

      await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({ employee_code, username, password, full_name, department_id, role, position, birth_date, gender, qualification })
      });

      App.showToast('Tạo tài khoản thành công!', 'success');
      App.closeModal();
      this.renderCurrentTab();
    } catch (err) {
      alert(err.message);
    }
  },

  openResetPasswordModal(userId, username) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <h3 class="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <i class="ph-bold ph-key text-amber-500"></i> Đổi tên đăng nhập & Mật khẩu
            </h3>
            <button onclick="App.closeModal()" class="p-1 text-slate-400 hover:text-slate-600 rounded">
              <i class="ph-bold ph-x"></i>
            </button>
          </div>

          <form onsubmit="Admin.submitResetPassword(event, ${userId})" class="space-y-4 text-xs">
            <div>
              <label class="block font-bold uppercase text-slate-500 mb-1">Tên đăng nhập mới *</label>
              <div class="relative">
                <i class="ph ph-user absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                <input type="text" id="adm-reset-username" required value="${username}" placeholder="Nhập tên đăng nhập mới..." class="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-mono font-bold dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
              </div>
            </div>

            <div>
              <label class="block font-bold uppercase text-slate-500 mb-1">Mật khẩu mới *</label>
              <div class="relative">
                <i class="ph ph-lock-key absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                <input type="password" id="adm-reset-pwd" required value="123456" class="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-mono dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onclick="App.closeModal()" class="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl font-bold">Hủy</button>
              <button type="submit" class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold">Lưu thay đổi</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitResetPassword(e, userId) {
    e.preventDefault();
    try {
      const username = document.getElementById('adm-reset-username').value.trim();
      const new_password = document.getElementById('adm-reset-pwd').value;

      const res = await apiFetch(`/api/users/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ username, new_password })
      });

      if (userId === Auth.user.id) {
        Auth.user.username = username;
        if (res.token) Auth.token = res.token;
        Auth.setSession(Auth.token, Auth.user);
        App.renderHeader();
        App.renderSidebar();
      }

      App.showToast(`Đã đổi tên đăng nhập thành "${username}" & cập nhật mật khẩu thành công!`, 'success');
      App.closeModal();
      this.renderCurrentTab();
    } catch (err) {
      alert(err.message);
    }
  },

  async deleteUser(userId, username) {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản "${username}"?`)) return;
    try {
      await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
      App.showToast('Đã xóa người dùng', 'success');
      this.renderCurrentTab();
    } catch (err) {
      alert(err.message);
    }
  },

  async changeUserRole(userId, newRole, fullName) {
    try {
      const roleLabels = {
        director: '🏛️ Ban Giám đốc',
        admin: '👑 Admin Quản trị',
        manager: '⭐ Trưởng phòng',
        staff: '👤 Nhân viên',
        auditor: '🔍 Kiểm tra & Giám sát'
      };

      App.showToast(`Đang cập nhật phân quyền cho "${fullName}" sang ${roleLabels[newRole]}...`, 'info');

      const res = await apiFetch(`/api/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole })
      });

      // If updating current user's own role
      if (userId === Auth.user.id) {
        Auth.user.role = newRole;
        if (res.token) Auth.token = res.token;
        Auth.setSession(Auth.token, Auth.user);
        App.renderHeader();
        App.renderSidebar();
      }

      App.showToast(`✅ Đã chuyển quyền cán bộ "${fullName}" sang "${roleLabels[newRole]}" thành công! Quyền của cá nhân này đã được cập nhật theo.`, 'success');
      this.renderUsersTab(document.getElementById('admin-tab-content'));
    } catch (err) {
      alert('Lỗi cập nhật phân quyền: ' + err.message);
      this.renderUsersTab(document.getElementById('admin-tab-content'));
    }
  },

  async changeUserPosition(userId, newPosition, fullName) {
    try {
      App.showToast(`Đang cập nhật chức vụ cho "${fullName}" thành: ${newPosition}...`, 'info');

      await apiFetch(`/api/users/${userId}/position`, {
        method: 'PUT',
        body: JSON.stringify({ position: newPosition })
      });

      if (userId === Auth.user.id) {
        Auth.user.position = newPosition;
        Auth.setSession(Auth.token, Auth.user);
        App.renderHeader();
        App.renderSidebar();
      }

      App.showToast(`✅ Đã cập nhật chức vụ của cán bộ "${fullName}" thành: ${newPosition}`, 'success');
      this.renderUsersTab(document.getElementById('admin-tab-content'));
    } catch (err) {
      alert('Lỗi cập nhật chức vụ: ' + err.message);
      this.renderUsersTab(document.getElementById('admin-tab-content'));
    }
  },

  async changeUserDepartment(userId, departmentId, fullName) {
    try {
      const deptId = departmentId ? parseInt(departmentId) : null;
      const deptObj = this.cachedDepts?.find(d => d.id === deptId);
      const deptName = deptObj ? deptObj.name : 'Ban Giám đốc';

      App.showToast(`Đang chuyển phòng ban cho "${fullName}" sang ${deptName}...`, 'info');

      await apiFetch(`/api/users/${userId}/department`, {
        method: 'PUT',
        body: JSON.stringify({ department_id: deptId })
      });

      if (userId === Auth.user.id) {
        Auth.user.department_id = deptId;
        Auth.user.department_name = deptName;
        Auth.setSession(Auth.token, Auth.user);
        App.renderHeader();
        App.renderSidebar();
      }

      App.showToast(`✅ Đã chuyển cán bộ "${fullName}" sang "${deptName}" thành công!`, 'success');
      this.renderUsersTab(document.getElementById('admin-tab-content'));
    } catch (err) {
      alert('Lỗi cập nhật phòng ban: ' + err.message);
      this.renderUsersTab(document.getElementById('admin-tab-content'));
    }
  },

  openEditUserModal(userId, userJson) {
    const user = JSON.parse(decodeURIComponent(userJson));
    const modalContainer = document.getElementById('modal-container');
    const isLocked = user.status === 'locked' || user.status === 'inactive';

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5 my-8">
          
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
            <div class="flex items-center gap-3">
              <span class="p-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-2xl">
                <i class="ph-bold ph-user-gear text-2xl"></i>
              </span>
              <div>
                <h3 class="text-lg font-extrabold text-slate-800 dark:text-white">
                  Chỉnh sửa thủ công tài khoản cán bộ
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  Cập nhật toàn bộ thông tin tài khoản, phân quyền, phòng ban và chức vụ
                </p>
              </div>
            </div>
            <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition">
              <i class="ph-bold ph-x text-xl"></i>
            </button>
          </div>

          <form onsubmit="Admin.submitEditUser(event, ${userId})" class="space-y-4 text-xs">
            <!-- 1. Tài khoản & Mật khẩu -->
            <div class="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div class="font-extrabold text-[11px] uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <i class="ph-bold ph-lock-key"></i> 1. Thông tin Đăng nhập & Xác thực
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Mã cán bộ</label>
                  <input type="text" id="adm-edit-empcode" value="${user.employee_code || ('CB' + String(user.id).padStart(3, '0'))}" placeholder="VD: CB001" class="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-mono font-bold dark:text-white focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                  <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Họ và tên cán bộ *</label>
                  <input type="text" id="adm-edit-fullname" required value="${user.full_name}" placeholder="VD: Nguyễn Văn A" class="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-bold dark:text-white focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                  <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tên đăng nhập (Username) *</label>
                  <input type="text" id="adm-edit-username" required value="${user.username}" placeholder="VD: an_nguyen" class="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-mono font-bold dark:text-white focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                  <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Mật khẩu mới</label>
                  <input type="password" id="adm-edit-password" placeholder="Để trống nếu không đổi" class="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-mono dark:text-white focus:ring-2 focus:ring-blue-500">
                </div>
              </div>
            </div>

            <!-- 2. Phòng ban & Phân quyền -->
            <div class="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div class="font-extrabold text-[11px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <i class="ph-bold ph-shield-star"></i> 2. Phân công & Cấp quyền
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Phòng ban</label>
                  <select id="adm-edit-dept" class="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl dark:text-white font-medium">
                    <option value="">-- Ban Giám đốc --</option>
                    ${this.cachedDepts.map(d => `<option value="${d.id}" ${user.department_id === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
                  </select>
                </div>

                <div>
                  <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Chức vụ cụ thể *</label>
                  <select id="adm-edit-position" required class="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl dark:text-white font-bold">
                    <option value="Giám đốc" ${user.position === 'Giám đốc' ? 'selected' : ''}>Giám đốc</option>
                    <option value="Phó Giám đốc" ${user.position === 'Phó Giám đốc' ? 'selected' : ''}>Phó Giám đốc</option>
                    <option value="Trưởng phòng" ${user.position === 'Trưởng phòng' ? 'selected' : ''}>Trưởng phòng</option>
                    <option value="Phó phòng" ${user.position === 'Phó phòng' ? 'selected' : ''}>Phó phòng</option>
                    <option value="Nhân viên" ${user.position === 'Nhân viên' || !user.position ? 'selected' : ''}>Nhân viên</option>
                  </select>
                </div>

                <div>
                  <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Cấp phân quyền *</label>
                  <select id="adm-edit-role" required class="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl dark:text-white font-bold">
                    <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>👤 Nhân viên</option>
                    <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>⭐ Trưởng phòng</option>
                    <option value="director" ${user.role === 'director' ? 'selected' : ''}>🏛️ Ban Giám đốc</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>👑 Admin Quản trị</option>
                    <option value="auditor" ${user.role === 'auditor' ? 'selected' : ''}>🔍 Kiểm tra & Giám sát</option>
                  </select>
                </div>

                <div>
                  <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Trạng thái tài khoản</label>
                  <select id="adm-edit-status" class="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl dark:text-white font-bold">
                    <option value="active" ${!isLocked ? 'selected' : ''}>🟢 Hoạt động</option>
                    <option value="inactive" ${isLocked ? 'selected' : ''}>🔴 Khóa tài khoản</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- 3. Thông tin Cá nhân & Liên hệ -->
            <div class="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div class="font-extrabold text-[11px] uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <i class="ph-bold ph-identification-card"></i> 3. Thông tin Cá nhân & Liên hệ
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Giới tính</label>
                  <select id="adm-edit-gender" class="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl dark:text-white font-medium">
                    <option value="Nam" ${user.gender === 'Nam' ? 'selected' : ''}>Nam</option>
                    <option value="Nữ" ${user.gender === 'Nữ' ? 'selected' : ''}>Nữ</option>
                    <option value="Khác" ${user.gender === 'Khác' ? 'selected' : ''}>Khác</option>
                  </select>
                </div>

                <div>
                  <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Học vị / Trình độ</label>
                  <select id="adm-edit-qualification" class="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl dark:text-white font-medium">
                    <option value="Tiến sĩ" ${user.qualification === 'Tiến sĩ' ? 'selected' : ''}>Tiến sĩ</option>
                    <option value="Thạc sĩ" ${user.qualification === 'Thạc sĩ' ? 'selected' : ''}>Thạc sĩ</option>
                    <option value="Đại học" ${user.qualification === 'Đại học' || !user.qualification ? 'selected' : ''}>Đại học</option>
                    <option value="Cao đẳng" ${user.qualification === 'Cao đẳng' ? 'selected' : ''}>Cao đẳng</option>
                    <option value="Trung cấp" ${user.qualification === 'Trung cấp' ? 'selected' : ''}>Trung cấp</option>
                  </select>
                </div>

                <div>
                  <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Ngày sinh</label>
                  <input type="date" id="adm-edit-birthdate" value="${user.birth_date || ''}" class="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl dark:text-white font-medium">
                </div>

                <div>
                  <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Số điện thoại</label>
                  <input type="text" id="adm-edit-phone" value="${user.phone || ''}" placeholder="09xxxxxxxx" class="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl dark:text-white font-medium">
                </div>

                <div>
                  <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input type="email" id="adm-edit-email" value="${user.email || ''}" placeholder="email@agribank..." class="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl dark:text-white font-medium">
                </div>
              </div>
            </div>

            <!-- Footer Actions -->
            <div class="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button type="button" onclick="App.closeModal()" class="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition">
                Hủy bỏ
              </button>
              <button type="submit" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-600/20 transition flex items-center gap-1.5">
                <i class="ph-bold ph-check"></i> Lưu toàn bộ thay đổi
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitEditUser(e, userId) {
    e.preventDefault();
    try {
      const employee_code = document.getElementById('adm-edit-empcode')?.value.trim() || null;
      const full_name = document.getElementById('adm-edit-fullname').value.trim();
      const username = document.getElementById('adm-edit-username').value.trim();
      const password = document.getElementById('adm-edit-password')?.value || '';
      const deptEl = document.getElementById('adm-edit-dept');
      const department_id = deptEl.value ? parseInt(deptEl.value) : null;
      const role = document.getElementById('adm-edit-role').value;
      const position = document.getElementById('adm-edit-position').value;
      const status = document.getElementById('adm-edit-status').value;
      const birth_date = document.getElementById('adm-edit-birthdate').value;
      const gender = document.getElementById('adm-edit-gender').value;
      const qualification = document.getElementById('adm-edit-qualification').value;
      const phone = document.getElementById('adm-edit-phone')?.value.trim() || '';
      const email = document.getElementById('adm-edit-email')?.value.trim() || '';

      const payload = { 
        employee_code,
        username, 
        full_name, 
        department_id, 
        role, 
        position, 
        status, 
        birth_date, 
        gender, 
        qualification,
        phone,
        email
      };

      if (password.trim().length > 0) {
        payload.password = password.trim();
      }

      const res = await apiFetch(`/api/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (userId === Auth.user.id) {
        Auth.user.full_name = full_name;
        Auth.user.username = username;
        Auth.user.role = role;
        Auth.user.position = position;
        Auth.user.birth_date = birth_date;
        Auth.user.gender = gender;
        Auth.user.qualification = qualification;
        Auth.user.phone = phone;
        Auth.user.email = email;
        if (res.token) Auth.token = res.token;
        Auth.setSession(Auth.token, Auth.user);
        App.renderHeader();
        App.renderSidebar();
      }

      App.showToast(`Đã cập nhật thủ công thông tin cán bộ "${full_name}" thành công!`, 'success');
      App.closeModal();

      // Refresh users tab & cached users
      await this.renderCurrentTab();
      try {
        App.cachedUsers = await apiFetch('/api/users');
        App.renderHeader();
      } catch (e) {}
    } catch (err) {
      alert('Lỗi cập nhật: ' + err.message);
    }
  },

  openCreateDeptModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <i class="ph-bold ph-buildings text-purple-600"></i> Thêm phòng ban mới
            </h3>
            <button onclick="App.closeModal()" class="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
              <i class="ph-bold ph-x text-lg"></i>
            </button>
          </div>

          <form onsubmit="Admin.submitCreateDept(event)" class="space-y-4 text-xs">
            <div>
              <label class="block font-bold uppercase text-slate-500 mb-1">Mã phòng ban (Viết tắt) *</label>
              <input type="text" id="adm-new-dept-code" required placeholder="VD: PKT, PTH, QLDT..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-mono font-bold dark:text-white uppercase">
            </div>

            <div>
              <label class="block font-bold uppercase text-slate-500 mb-1">Tên phòng ban *</label>
              <input type="text" id="adm-new-dept-name" required placeholder="VD: Phòng Kế toán..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-bold dark:text-white">
            </div>

            <div>
              <label class="block font-bold uppercase text-slate-500 mb-1">Mô tả chức năng nhiệm vụ</label>
              <textarea id="adm-new-dept-desc" rows="3" placeholder="Nhập mô tả chức năng của phòng..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl dark:text-white"></textarea>
            </div>

            <div class="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
              <button type="button" onclick="App.closeModal()" class="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl font-bold">Hủy</button>
              <button type="submit" class="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-sm">Tạo phòng ban</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitCreateDept(e) {
    e.preventDefault();
    try {
      const code = document.getElementById('adm-new-dept-code').value.trim().toUpperCase();
      const name = document.getElementById('adm-new-dept-name').value.trim();
      const description = document.getElementById('adm-new-dept-desc').value.trim();

      await apiFetch('/api/departments', {
        method: 'POST',
        body: JSON.stringify({ code, name, description })
      });

      App.showToast('Thêm phòng ban mới thành công!', 'success');
      App.closeModal();
      this.renderCurrentTab();
    } catch (err) {
      alert(err.message);
    }
  },

  openEditDeptModal(deptId, deptJson) {
    const dept = JSON.parse(decodeURIComponent(deptJson));
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <i class="ph-bold ph-pencil-simple text-blue-600"></i> Chỉnh sửa thông tin phòng ban
            </h3>
            <button onclick="App.closeModal()" class="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
              <i class="ph-bold ph-x text-lg"></i>
            </button>
          </div>

          <form onsubmit="Admin.submitEditDept(event, ${deptId})" class="space-y-4 text-xs">
            <div>
              <label class="block font-bold uppercase text-slate-500 mb-1">Mã phòng ban (Viết tắt) *</label>
              <input type="text" id="adm-edit-dept-code" required value="${dept.code || ''}" placeholder="VD: PKT, PTH..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-mono font-bold dark:text-white uppercase">
            </div>

            <div>
              <label class="block font-bold uppercase text-slate-500 mb-1">Tên phòng ban *</label>
              <input type="text" id="adm-edit-dept-name" required value="${dept.name || ''}" placeholder="VD: Phòng Kế toán..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-bold dark:text-white">
            </div>

            <div>
              <label class="block font-bold uppercase text-slate-500 mb-1">Mô tả chức năng nhiệm vụ</label>
              <textarea id="adm-edit-dept-desc" rows="3" placeholder="Nhập mô tả chức năng của phòng..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl dark:text-white">${dept.description || ''}</textarea>
            </div>

            <div class="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
              <button type="button" onclick="App.closeModal()" class="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl font-bold">Hủy</button>
              <button type="submit" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm">Lưu thay đổi</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitEditDept(e, deptId) {
    e.preventDefault();
    try {
      const code = document.getElementById('adm-edit-dept-code').value.trim().toUpperCase();
      const name = document.getElementById('adm-edit-dept-name').value.trim();
      const description = document.getElementById('adm-edit-dept-desc').value.trim();

      await apiFetch(`/api/departments/${deptId}`, {
        method: 'PUT',
        body: JSON.stringify({ code, name, description })
      });

      App.showToast('Cập nhật thông tin phòng ban thành công!', 'success');
      App.closeModal();
      this.renderCurrentTab();
    } catch (err) {
      alert(err.message);
    }
  },

  // ----------------------------------------------------
  // KHÓA / MỞ KHÓA TÀI KHOẢN (ACCOUNT LOCKING)
  // ----------------------------------------------------
  async toggleUserLock(userId, fullName, currentStatus) {
    const isLocking = currentStatus === 'active';
    const confirmMsg = isLocking
      ? `Bạn có chắc chắn muốn KHÓA tài khoản của cán bộ "${fullName}"?\n\n• Cán bộ sẽ bị đăng xuất khỏi hệ thống ngay lập tức.\n• Cán bộ sẽ không thể đăng nhập cho đến khi được mở khóa.`
      : `Bạn có chắc chắn muốn MỞ KHÓA tài khoản cho cán bộ "${fullName}"?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await apiFetch(`/api/admin/users/${userId}/toggle-status`, {
        method: 'PUT'
      });

      App.showToast(res.message, isLocking ? 'warning' : 'success');
      
      // Reload tab & refresh cached users in header
      await this.renderCurrentTab();
      try {
        App.cachedUsers = await apiFetch('/api/users');
        App.renderHeader();
      } catch (e) {}
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  },

  // ----------------------------------------------------
  // XUẤT TOÀN BỘ THÔNG TIN NGƯỜI DÙNG RA EXCEL (EXPORT ALL USERS)
  // ----------------------------------------------------
  async exportAllUsersToExcel() {
    if (typeof XLSX === 'undefined') {
      alert('Thư viện Excel đang tải, vui lòng thử lại sau vài giây!');
      return;
    }

    try {
      App.showToast('⏳ Đang tổng hợp dữ liệu toàn bộ cán bộ...', 'info');
      const users = await apiFetch('/api/users');
      if (!users || users.length === 0) {
        alert('Không có dữ liệu cán bộ để xuất!');
        return;
      }

      const roleMap = {
        'director': 'Ban Giám đốc',
        'admin': 'Quản trị viên (Admin)',
        'manager': 'Trưởng phòng / Lãnh đạo phòng',
        'staff': 'Nhân viên / Giảng viên',
        'auditor': 'Kiểm tra & Giám sát'
      };

      const statusMap = {
        'active': 'Đang hoạt động',
        'locked': 'Tạm khóa',
        'inactive': 'Ngừng hoạt động'
      };

      const exportData = users.map((u, idx) => {
        const deptName = u.department_name || (u.department_id ? `Phòng ban #${u.department_id}` : 'Ban Giám đốc');
        const formattedBirthDate = u.birth_date ? u.birth_date.split('-').reverse().join('/') : '';
        const formattedCreatedDate = u.created_at ? u.created_at.split(' ')[0].split('-').reverse().join('/') : '';

        return {
          'STT': idx + 1,
          'Mã cán bộ': u.employee_code || ('CB' + String(u.id).padStart(3, '0')),
          'Họ và tên': u.full_name || '',
          'Tên đăng nhập': u.username || '',
          'Phòng ban': deptName,
          'Chức vụ': u.position || '',
          'Cấp phân quyền': roleMap[u.role] || u.role,
          'Giới tính': u.gender || 'Nam',
          'Ngày sinh': formattedBirthDate,
          'Trình độ / Học vị': u.qualification || 'Đại học',
          'Số điện thoại': u.phone || '',
          'Email': u.email || '',
          'Trạng thái tài khoản': statusMap[u.status] || u.status || 'Đang hoạt động',
          'Ngày tạo tài khoản': formattedCreatedDate
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      ws['!cols'] = [
        { wch: 6 },  // STT
        { wch: 14 }, // Mã cán bộ
        { wch: 28 }, // Họ tên
        { wch: 18 }, // Username
        { wch: 36 }, // Phòng ban
        { wch: 20 }, // Chức vụ
        { wch: 28 }, // Cấp phân quyền
        { wch: 12 }, // Giới tính
        { wch: 14 }, // Ngày sinh
        { wch: 20 }, // Học vị
        { wch: 16 }, // SĐT
        { wch: 30 }, // Email
        { wch: 22 }, // Trạng thái
        { wch: 18 }  // Ngày tạo
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_Nguoi_Dung');

      const today = new Date().toISOString().split('T')[0];
      const fileName = `Danh_sach_toan_bo_nguoi_dung_Agribank_${today}.xlsx`;
      XLSX.writeFile(wb, fileName);

      App.showToast(`✅ Đã xuất thành công ${users.length} cán bộ ra file Excel!`, 'success');
    } catch (err) {
      console.error('Lỗi xuất dữ liệu người dùng:', err);
      alert('Lỗi xuất file Excel: ' + err.message);
    }
  },

  // ----------------------------------------------------
  // TẢI FILE EXCEL MẪU (DOWNLOAD EXCEL TEMPLATE)
  // ----------------------------------------------------
  downloadExcelTemplate() {
    if (typeof XLSX === 'undefined') {
      alert('Thư viện Excel đang tải, vui lòng thử lại sau vài giây!');
      return;
    }

    const templateData = [
      {
        'STT': 1,
        'Mã cán bộ': 'CB015',
        'Họ và tên': 'Nguyễn Văn An',
        'Tên đăng nhập': 'an_nguyen',
        'Mật khẩu': '123456',
        'Phòng ban': 'Phòng Tổng hợp',
        'Chức vụ': 'Nhân viên',
        'Cấp phân quyền': 'staff',
        'Giới tính': 'Nam',
        'Học vị': 'Thạc sĩ',
        'Số điện thoại': '0912345678',
        'Email': 'an.nv@agribank.com.vn',
        'Ngày sinh': '1990-05-15'
      },
      {
        'STT': 2,
        'Mã cán bộ': 'CB016',
        'Họ và tên': 'Trần Thị Bích',
        'Tên đăng nhập': 'bich_tran',
        'Mật khẩu': '123456',
        'Phòng ban': 'Phòng Quản lý đào tạo và Thư viện',
        'Chức vụ': 'Trưởng phòng',
        'Cấp phân quyền': 'manager',
        'Giới tính': 'Nữ',
        'Học vị': 'Tiến sĩ',
        'Số điện thoại': '0987654321',
        'Email': 'bich.tt@agribank.com.vn',
        'Ngày sinh': '1985-11-20'
      },
      {
        'STT': 3,
        'Mã cán bộ': 'CB017',
        'Họ và tên': 'Lê Hoàng Cường',
        'Tên đăng nhập': 'cuong_le',
        'Mật khẩu': '123456',
        'Phòng ban': 'Phòng Kế toán',
        'Chức vụ': 'Phó phòng',
        'Cấp phân quyền': 'manager',
        'Giới tính': 'Nam',
        'Học vị': 'Đại học',
        'Số điện thoại': '0903123456',
        'Email': 'cuong.lh@agribank.com.vn',
        'Ngày sinh': '1988-03-08'
      }
    ];

    const instructionsData = [
      { 'HƯỚNG DẪN ĐIỀN DỮ LIỆU IMPORT': 'CỘT THÔNG TIN', 'QUY ĐỊNH / GIÁ TRỊ HỢP LỆ': 'GHI CHÚ' },
      { 'HƯỚNG DẪN ĐIỀN DỮ LIỆU IMPORT': 'Mã cán bộ', 'QUY ĐỊNH / GIÁ TRỊ HỢP LỆ': 'Ví dụ: CB015, CB016... (Tùy chọn)', 'GHI CHÚ': 'Nếu để trống hệ thống sẽ tự sinh' },
      { 'HƯỚNG DẪN ĐIỀN DỮ LIỆU IMPORT': 'Họ và tên', 'QUY ĐỊNH / GIÁ TRỊ HỢP LỆ': 'Bắt buộc nhập họ tên đầy đủ', 'GHI CHÚ': 'Ví dụ: Nguyễn Văn An' },
      { 'HƯỚNG DẪN ĐIỀN DỮ LIỆU IMPORT': 'Tên đăng nhập', 'QUY ĐỊNH / GIÁ TRỊ HỢP LỆ': 'Viết liền không dấu, không trùng', 'GHI CHÚ': 'Nếu để trống hệ thống sẽ tự sinh từ họ tên' },
      { 'HƯỚNG DẪN ĐIỀN DỮ LIỆU IMPORT': 'Mật khẩu', 'QUY ĐỊNH / GIÁ TRỊ HỢP LỆ': 'Tối thiểu 6 ký tự', 'GHI CHÚ': 'Mặc định: 123456' },
      { 'HƯỚNG DẪN ĐIỀN DỮ LIỆU IMPORT': 'Phòng ban', 'QUY ĐỊNH / GIÁ TRỊ HỢP LỆ': 'Chọn 1 trong 5 phòng ban hoặc Ban Giám đốc', 'GHI CHÚ': 'VD: Phòng Kế toán, Phòng Tổng hợp, Phòng QLĐT & TV, Phòng NCGD, Phòng Kế hoạch' },
      { 'HƯỚNG DẪN ĐIỀN DỮ LIỆU IMPORT': 'Chức vụ', 'QUY ĐỊNH / GIÁ TRỊ HỢP LỆ': 'Giám đốc / Phó Giám đốc / Trưởng phòng / Phó phòng / Nhân viên', 'GHI CHÚ': 'Tùy chọn' },
      { 'HƯỚNG DẪN ĐIỀN DỮ LIỆU IMPORT': 'Cấp phân quyền', 'QUY ĐỊNH / GIÁ TRỊ HỢP LỆ': 'director / admin / manager / staff', 'GHI CHÚ': 'staff = Nhân viên, manager = Trưởng phòng' }
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(templateData);
    const ws2 = XLSX.utils.json_to_sheet(instructionsData);

    // Set column widths
    ws1['!cols'] = [
      { wch: 6 },  // STT
      { wch: 14 }, // Ma CB
      { wch: 22 }, // Ho ten
      { wch: 18 }, // Username
      { wch: 12 }, // Mat khau
      { wch: 32 }, // Phong ban
      { wch: 16 }, // Chuc vu
      { wch: 16 }, // Phan quyen
      { wch: 10 }, // Gioi tinh
      { wch: 12 }, // Hoc vi
      { wch: 15 }, // SDT
      { wch: 25 }, // Email
      { wch: 14 }  // Ngay sinh
    ];

    ws2['!cols'] = [
      { wch: 32 },
      { wch: 20 },
      { wch: 50 },
      { wch: 40 }
    ];

    XLSX.utils.book_append_sheet(wb, ws1, 'Danh_Sach_Can_Bo');
    XLSX.utils.book_append_sheet(wb, ws2, 'Huong_Dan_Nhap');

    XLSX.writeFile(wb, 'Mau_nhap_danh_sach_can_bo_Agribank.xlsx');
    App.showToast('Đã tải xuống file Excel mẫu thành công!', 'success');
  },

  // ----------------------------------------------------
  // CỬA SỔ IMPORT FILE EXCEL (IMPORT EXCEL MODAL)
  // ----------------------------------------------------
  openImportExcelModal() {
    Admin._parsedExcelUsers = [];

    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5 my-8">
          
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
            <div class="flex items-center gap-3">
              <span class="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                <i class="ph-bold ph-file-arrow-up text-2xl"></i>
              </span>
              <div>
                <h3 class="text-lg font-extrabold text-slate-800 dark:text-white">
                  Nhập danh sách Cán bộ từ file Excel (.xlsx)
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  Tải lên file danh sách cán bộ để tạo hàng loạt tài khoản vào hệ thống
                </p>
              </div>
            </div>
            <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition">
              <i class="ph-bold ph-x text-xl"></i>
            </button>
          </div>

          <!-- Template Download Hint -->
          <div class="p-3.5 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200 dark:border-slate-600 flex items-center justify-between gap-3 text-xs">
            <div class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <i class="ph-bold ph-info text-emerald-600 text-base shrink-0"></i>
              <span>Chưa có file mẫu? Tải file Excel mẫu chuẩn Agribank để điền thông tin cán bộ.</span>
            </div>
            <button type="button" onclick="Admin.downloadExcelTemplate()" class="px-3 py-1.5 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 transition shrink-0 shadow-2xs">
              <i class="ph-bold ph-download-simple"></i> Tải file mẫu
            </button>
          </div>

          <!-- Drag & Drop Upload Box -->
          <div id="excel-drop-zone" class="border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-8 text-center bg-slate-50/50 dark:bg-slate-900/30 transition cursor-pointer relative group">
            <input type="file" id="excel-file-input" accept=".xlsx, .xls, .csv" onchange="Admin.handleExcelFileSelect(event)" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10">
            <div class="space-y-2 pointer-events-none">
              <i class="ph-bold ph-cloud-arrow-up text-4xl text-emerald-600 group-hover:scale-110 transition duration-200"></i>
              <div class="font-bold text-slate-700 dark:text-slate-200 text-sm">
                Kéo thả file Excel vào đây hoặc <span class="text-emerald-600 underline">bấm để chọn file</span>
              </div>
              <div class="text-xs text-slate-400">
                Hỗ trợ định dạng .xlsx, .xls (Dung lượng tối đa 10MB)
              </div>
            </div>
          </div>

          <!-- Preview Section -->
          <div id="excel-preview-container" class="hidden space-y-3">
            <div class="flex items-center justify-between">
              <div class="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <i class="ph-bold ph-table text-emerald-600"></i> Xem trước danh sách (<span id="excel-preview-count" class="text-emerald-600 font-black">0</span> cán bộ)
              </div>
              <button type="button" onclick="Admin.resetExcelUpload()" class="text-xs text-rose-500 hover:underline font-bold">
                Chọn file khác
              </button>
            </div>

            <div class="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 custom-scrollbar">
              <table class="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead class="bg-slate-100 dark:bg-slate-700 text-[11px] uppercase font-bold text-slate-500 dark:text-slate-300 sticky top-0">
                  <tr>
                    <th class="px-3 py-2">STT</th>
                    <th class="px-3 py-2">Mã CB</th>
                    <th class="px-3 py-2">Họ và tên</th>
                    <th class="px-3 py-2">Tên đăng nhập</th>
                    <th class="px-3 py-2">Phòng ban</th>
                    <th class="px-3 py-2">Chức vụ</th>
                    <th class="px-3 py-2">Vai trò</th>
                  </tr>
                </thead>
                <tbody id="excel-preview-tbody" class="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800"></tbody>
              </table>
            </div>
          </div>

          <!-- Error Alert (If Any) -->
          <div id="excel-error-box" class="hidden p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300"></div>

          <!-- Footer Actions -->
          <div class="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
            <button type="button" onclick="App.closeModal()" class="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition">
              Đóng
            </button>
            <button type="button" id="btn-submit-batch-import" onclick="Admin.submitBatchImport()" disabled class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5">
              <i class="ph-bold ph-check"></i> Lưu và Tạo tài khoản
            </button>
          </div>

        </div>
      </div>
    `;

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('sample_preview') === '1') {
      Admin._parsedExcelUsers = [
        { 'Mã cán bộ': 'CB0101', 'Họ và tên': 'Nguyễn Văn An', 'Tên đăng nhập': 'an_nguyen', 'Phòng ban': 'Phòng Kế toán', 'Chức vụ': 'Chuyên viên', 'Cấp phân quyền': 'staff' },
        { 'Mã cán bộ': 'CB0102', 'Họ và tên': 'Trần Thị Bình', 'Tên đăng nhập': 'binh_tran', 'Phòng ban': 'Phòng Tổng hợp', 'Chức vụ': 'Trưởng phòng', 'Cấp phân quyền': 'manager' },
        { 'Mã cán bộ': 'CB0103', 'Họ và tên': 'Lê Hoàng Cường', 'Tên đăng nhập': 'cuong_le', 'Phòng ban': 'Phòng QLĐT & TV', 'Chức vụ': 'Giảng viên', 'Cấp phân quyền': 'staff' }
      ];
      setTimeout(() => {
        Admin.renderExcelPreview(Admin._parsedExcelUsers);
      }, 50);
    }
  },

  resetExcelUpload() {
    Admin._parsedExcelUsers = [];
    const input = document.getElementById('excel-file-input');
    if (input) input.value = '';
    const previewBox = document.getElementById('excel-preview-container');
    if (previewBox) previewBox.classList.add('hidden');
    const errorBox = document.getElementById('excel-error-box');
    if (errorBox) errorBox.classList.add('hidden');
    const submitBtn = document.getElementById('btn-submit-batch-import');
    if (submitBtn) submitBtn.disabled = true;
  },

  handleExcelFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
      alert('Thư viện Excel đang tải, vui lòng thử lại sau vài giây!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('File Excel rỗng không có sheet dữ liệu!');
        }

        // Ưu tiên sheet có tên chứa 'can_bo', 'danh_sach', 'users', 'nhan_su', hoặc sheet đầu tiên không phải là sheet hướng dẫn
        let targetSheetName = workbook.SheetNames[0];
        for (const sName of workbook.SheetNames) {
          const lower = sName.toLowerCase();
          if (lower.includes('can_bo') || lower.includes('can bo') || lower.includes('danh sach') || lower.includes('nhan su') || lower.includes('user')) {
            targetSheetName = sName;
            break;
          }
        }
        if (targetSheetName.toLowerCase().includes('huong_dan') && workbook.SheetNames.length > 1) {
          targetSheetName = workbook.SheetNames.find(s => !s.toLowerCase().includes('huong_dan')) || workbook.SheetNames[0];
        }

        const sheet = workbook.Sheets[targetSheetName];
        const rawJson = XLSX.utils.sheet_to_json(sheet);

        if (!rawJson || rawJson.length === 0) {
          throw new Error('File Excel rỗng hoặc không có dữ liệu cán bộ!');
        }

        // Lọc bỏ dòng hướng dẫn hoặc dòng không có họ tên
        const validRows = rawJson.filter(r => {
          const fn = r['Họ và tên'] || r['Họ tên'] || r['Họ và Tên'] || r['Ho va ten'] || r.full_name || r.name || r['Tên cán bộ'] || r['HỌ VÀ TÊN'];
          if (!fn) return false;
          const sFn = String(fn).trim().toUpperCase();
          if (sFn.includes('HƯỚNG DẪN') || sFn.includes('CỘT THÔNG TIN') || sFn.includes('QUY ĐỊNH')) return false;
          return true;
        });

        if (validRows.length === 0) {
          throw new Error('Không tìm thấy dòng dữ liệu cán bộ hợp lệ trong file Excel (Cần có cột "Họ và tên" hoặc "Họ tên")!');
        }

        Admin._parsedExcelUsers = validRows;
        Admin.renderExcelPreview(validRows);
      } catch (err) {
        const errorBox = document.getElementById('excel-error-box');
        if (errorBox) {
          errorBox.innerHTML = `<i class="ph-bold ph-warning mr-1"></i> Lỗi đọc file: ${err.message}`;
          errorBox.classList.remove('hidden');
        }
      }
    };
    reader.readAsBinaryString(file);
  },

  renderExcelPreview(rows) {
    const previewBox = document.getElementById('excel-preview-container');
    const tbody = document.getElementById('excel-preview-tbody');
    const countSpan = document.getElementById('excel-preview-count');
    const submitBtn = document.getElementById('btn-submit-batch-import');
    const errorBox = document.getElementById('excel-error-box');

    if (!previewBox || !tbody) return;

    previewBox.classList.remove('hidden');
    if (errorBox) errorBox.classList.add('hidden');
    countSpan.innerText = rows.length;
    submitBtn.disabled = rows.length === 0;

    tbody.innerHTML = rows.map((r, idx) => {
      const empCode = r.employee_code || r['Mã cán bộ'] || r['Mã CB'] || r['Mã nhân viên'] || r['Ma can bo'] || '(Tự sinh)';
      const name = r.full_name || r['Họ và tên'] || r['Họ tên'] || r['Họ và Tên'] || r['Tên cán bộ'] || r['HỌ VÀ TÊN'] || '<span class="text-rose-500 italic">Thiếu tên</span>';
      const username = r.username || r['Tên đăng nhập'] || r['Tài khoản'] || r['Ten dang nhap'] || r['TÊN ĐĂNG NHẬP'] || '(Tự sinh từ họ tên)';
      const dept = r.department_name || r['Phòng ban'] || r['Đơn vị'] || r['Phong ban'] || r['PHÒNG BAN'] || 'Ban Giám đốc';
      const position = r.position || r['Chức vụ'] || r['Chuc vu'] || r['CHỨC VỤ'] || 'Nhân viên';
      const role = r.role || r['Cấp phân quyền'] || r['Phân quyền'] || r['Vai trò'] || 'staff';

      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50">
          <td class="px-3 py-2 font-mono text-slate-400">${idx + 1}</td>
          <td class="px-3 py-2 font-mono font-bold text-blue-600 dark:text-blue-400">${empCode}</td>
          <td class="px-3 py-2 font-bold text-slate-800 dark:text-white">${name}</td>
          <td class="px-3 py-2 font-mono text-slate-500 text-xs">${username}</td>
          <td class="px-3 py-2">${dept}</td>
          <td class="px-3 py-2">${position}</td>
          <td class="px-3 py-2 font-bold text-emerald-600">${role}</td>
        </tr>
      `;
    }).join('');
  },

  async submitBatchImport() {
    const rows = Admin._parsedExcelUsers;
    if (!rows || rows.length === 0) {
      alert('Vui lòng chọn file Excel chứa dữ liệu cán bộ!');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-batch-import');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Đang tạo tài khoản...';
    }

    try {
      const res = await apiFetch('/api/admin/users/batch-import', {
        method: 'POST',
        body: JSON.stringify({ users: rows })
      });

      App.showToast(res.message, 'success');
      App.closeModal();

      // Refresh users tab & cached users
      await this.renderCurrentTab();
      try {
        App.cachedUsers = await apiFetch('/api/users');
        App.renderHeader();
      } catch (e) {}

    } catch (err) {
      const errorBox = document.getElementById('excel-error-box');
      if (errorBox) {
        errorBox.innerHTML = `<i class="ph-bold ph-warning mr-1"></i> Lỗi: ${err.message}`;
        errorBox.classList.remove('hidden');
      } else {
        alert(err.message);
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="ph-bold ph-check"></i> Lưu và Tạo tài khoản';
      }
    }
  },

  // 4. Backup & Restore Tab
  async renderBackupTab(container) {
    let stats = { users: 0, depts: 5, tasks: 0, logs: 0 };
    try {
      const users = await apiFetch('/api/users');
      const depts = await apiFetch('/api/departments');
      stats.users = users.length;
      stats.depts = depts.length;
    } catch (e) {}

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Overview Banner -->
        <div class="bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-slate-900/50 p-6 rounded-3xl border border-purple-500/30 shadow-lg">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 class="text-xl font-black text-white flex items-center gap-2.5">
                <i class="ph-bold ph-shield-check text-emerald-400 text-2xl"></i>
                Trung tâm Sao lưu & Khôi phục Dữ liệu (Backup & Disaster Recovery)
              </h2>
              <p class="text-xs text-purple-200/80 mt-1 max-w-3xl leading-relaxed">
                Cho phép Quản trị viên trích xuất toàn bộ dữ liệu hệ thống (Tài khoản người dùng, phân quyền, 5 phòng ban, nhiệm vụ được giao, nhật ký kê khai, báo cáo và trao đổi nội bộ) về máy tính an toàn, sẵn sàng phục hồi bất kỳ lúc nào chỉ bằng 1 thao tác.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Sẵn sàng sao lưu
              </span>
            </div>
          </div>
        </div>

        <!-- 2 Main Cards: Backup & Restore -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <!-- Card 1: Tạo bản sao lưu -->
          <div class="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
            <div class="space-y-4">
              <div class="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center text-2xl">
                <i class="ph-bold ph-cloud-arrow-down"></i>
              </div>
              <div>
                <h3 class="text-lg font-bold text-slate-800 dark:text-white">1. Sao lưu Toàn bộ Dữ liệu</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Trích xuất và tải về một tệp dữ liệu chuẩn <span class="font-mono text-purple-600 dark:text-purple-400 font-bold">.json</span> chứa trọn vẹn mọi bảng dữ liệu thực tế đang chạy trên máy chủ.
                </p>
              </div>
              <div class="p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div class="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <i class="ph-bold ph-check-circle text-emerald-500"></i> Dữ liệu bao gồm:
                </div>
                <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <div>• Danh sách Cán bộ & Mật khẩu</div>
                  <div>• 5 Phòng ban cơ cấu</div>
                  <div>• Công việc & Phân công</div>
                  <div>• Bảng kê khai nhật ký</div>
                  <div>• Báo cáo định kỳ các phòng</div>
                  <div>• Lịch sử tin nhắn trao đổi</div>
                </div>
              </div>
            </div>

            <div class="pt-6">
              <button onclick="Admin.downloadBackup()" class="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs rounded-2xl shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 transition transform hover:scale-[1.01]">
                <i class="ph-bold ph-download-simple text-base"></i> Tải về Bản sao lưu Hệ thống (.json)
              </button>
            </div>
          </div>

          <!-- Card 2: Khôi phục dữ liệu -->
          <div class="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
            <div class="space-y-4">
              <div class="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl">
                <i class="ph-bold ph-cloud-arrow-up"></i>
              </div>
              <div>
                <h3 class="text-lg font-bold text-slate-800 dark:text-white">2. Phục hồi Dữ liệu từ Tệp</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Nạp lại toàn bộ trạng thái dữ liệu từ một tệp sao lưu <span class="font-mono text-amber-600 dark:text-amber-400 font-bold">.json</span> đã lưu trữ trước đó.
                </p>
              </div>
              <div class="p-4 bg-amber-50/60 dark:bg-amber-950/30 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 space-y-2 text-xs text-amber-900 dark:text-amber-200">
                <div class="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <i class="ph-bold ph-warning-circle text-amber-600"></i> Lưu ý quan trọng:
                </div>
                <p class="text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-300/80">
                  Khi thực hiện khôi phục, dữ liệu hiện tại sẽ được thay thế chính xác bằng dữ liệu trong tệp sao lưu. Vui lòng tải một bản sao lưu dự phòng hiện tại trước khi tiến hành!
                </p>
              </div>
            </div>

            <div class="pt-6">
              <button onclick="Admin.openRestoreModal()" class="w-full py-3.5 px-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-xs rounded-2xl shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 transition transform hover:scale-[1.01]">
                <i class="ph-bold ph-upload-simple text-base"></i> Chọn Tệp & Bắt đầu Khôi phục
              </button>
            </div>
          </div>

        </div>

        <!-- Automated Cloud Protection Notice -->
        <div class="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-3.5">
          <i class="ph-bold ph-info text-xl text-blue-500 shrink-0 mt-0.5"></i>
          <div class="space-y-1 leading-relaxed">
            <div class="font-bold text-slate-800 dark:text-white">Cơ chế Bảo vệ Kép (Cloud Database + Manual Backup):</div>
            <div>
              Hệ thống hiện đã được liên kết với cơ sở dữ liệu đám mây PostgreSQL độc lập. Bạn có thể định kỳ tải file sao lưu <span class="font-mono text-purple-600 dark:text-purple-400 font-bold">.json</span> vào cuối mỗi tuần/tháng để lưu trữ trong ổ cứng máy tính cá nhân hoặc Google Drive của cơ quan.
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async downloadBackup() {
    try {
      App.showToast('Đang tạo bản sao lưu toàn hệ thống...', 'info');
      
      const res = await fetch('/api/admin/backup', {
        headers: {
          'Authorization': `Bearer ${Auth.token}`
        }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi tải bản sao lưu');
      }

      const blob = await res.blob();
      const dateTag = new Date().toISOString().replace(/[:\.]/g, '-').slice(0, 19);
      const filename = `Backup_TheoDoiCV_Agribank_${dateTag}.json`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      App.showToast('Đã tải về bản sao lưu toàn hệ thống thành công!', 'success');
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  openRestoreModal() {
    const modal = document.getElementById('app-modal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-5 animate-scale-up">
        <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
          <h3 class="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <i class="ph-bold ph-cloud-arrow-up text-amber-600 text-xl"></i> Khôi phục Dữ liệu Toàn Hệ thống
          </h3>
          <button onclick="App.closeModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-xl">
            <i class="ph-bold ph-x text-lg"></i>
          </button>
        </div>

        <div class="space-y-4">
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Chọn tệp sao lưu định dạng <span class="font-mono text-purple-600 font-bold">.json</span> đã tải về trước đó để phục hồi toàn bộ hệ thống.
          </p>

          <!-- Drop Area -->
          <div class="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-6 text-center hover:border-amber-500 transition cursor-pointer" onclick="document.getElementById('restore-file-input').click()">
            <input type="file" id="restore-file-input" accept=".json" class="hidden" onchange="Admin.handleRestoreFileSelect(event)">
            <i class="ph-bold ph-file-code text-4xl text-amber-500 mb-2"></i>
            <div id="restore-file-name" class="font-bold text-xs text-slate-700 dark:text-slate-200">Bấm vào đây để chọn tệp .json sao lưu</div>
            <div class="text-[10px] text-slate-400 mt-1">Hỗ trợ tệp JSON sao lưu xuất từ hệ thống</div>
          </div>

          <!-- Preview Info Box (Hidden until file selected) -->
          <div id="restore-preview-box" class="hidden p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-600 text-xs space-y-2">
            <div class="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <i class="ph-bold ph-check-circle text-emerald-500"></i> Thông tin bản sao lưu:
            </div>
            <div id="restore-preview-stats" class="text-[11px] text-slate-600 dark:text-slate-300 space-y-1"></div>
          </div>

          <div id="restore-error-box" class="hidden p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-medium"></div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
          <button type="button" onclick="App.closeModal()" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition">
            Hủy bỏ
          </button>
          <button type="button" id="btn-execute-restore" onclick="Admin.executeRestore()" disabled class="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs shadow-md shadow-amber-600/20 transition flex items-center gap-1.5">
            <i class="ph-bold ph-arrows-counter-clockwise text-base"></i> Tiến hành Khôi phục
          </button>
        </div>
      </div>
    `;

    window._selectedRestoreData = null;
    modal.classList.remove('hidden');
  },

  handleRestoreFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const nameEl = document.getElementById('restore-file-name');
    const previewBox = document.getElementById('restore-preview-box');
    const previewStats = document.getElementById('restore-preview-stats');
    const errorBox = document.getElementById('restore-error-box');
    const submitBtn = document.getElementById('btn-execute-restore');

    if (errorBox) errorBox.classList.add('hidden');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (!json || !json.data) {
          throw new Error('Cấu trúc file không đúng định dạng sao lưu hệ thống!');
        }

        window._selectedRestoreData = json;
        if (nameEl) nameEl.innerText = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        
        if (previewBox && previewStats) {
          const s = json.stats || {};
          previewStats.innerHTML = `
            <div>• <b>Thời điểm tạo:</b> ${json.exported_at ? new Date(json.exported_at).toLocaleString('vi-VN') : 'Không rõ'}</div>
            <div>• <b>Người xuất:</b> ${json.exported_by?.full_name || 'Admin'}</div>
            <div class="pt-1 border-t border-slate-200 dark:border-slate-600 grid grid-cols-2 gap-1 text-[11px]">
              <span>👤 Cán bộ: <b>${s.users || json.data.users?.length || 0}</b></span>
              <span>🏢 Phòng ban: <b>${s.departments || json.data.departments?.length || 0}</b></span>
              <span>📋 Công việc: <b>${s.tasks || json.data.tasks?.length || 0}</b></span>
              <span>📝 Nhật ký: <b>${s.personal_work_logs || json.data.personal_work_logs?.length || 0}</b></span>
              <span>💬 Tin nhắn: <b>${s.messages || json.data.messages?.length || 0}</b></span>
              <span>📰 Tin tức: <b>${s.news || json.data.news?.length || 0}</b></span>
            </div>
          `;
          previewBox.classList.remove('hidden');
        }

        if (submitBtn) submitBtn.disabled = false;
      } catch (err) {
        if (errorBox) {
          errorBox.innerText = 'Lỗi đọc tệp: ' + err.message;
          errorBox.classList.remove('hidden');
        }
        if (submitBtn) submitBtn.disabled = true;
      }
    };
    reader.readAsText(file);
  },

  async executeRestore() {
    if (!window._selectedRestoreData) {
      alert('Vui lòng chọn tệp sao lưu hợp lệ!');
      return;
    }

    if (!confirm('⚠️ CẢNH BÁO BẢO MẬT:\nBạn có chắc chắn muốn khôi phục toàn bộ hệ thống từ tệp này không?\nDữ liệu hiện tại sẽ được cập nhật hoàn toàn theo tệp sao lưu.')) {
      return;
    }

    const submitBtn = document.getElementById('btn-execute-restore');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="ph ph-spinner animate-spin text-base"></i> Đang khôi phục...';
    }

    try {
      const res = await apiFetch('/api/admin/restore', {
        method: 'POST',
        body: JSON.stringify(window._selectedRestoreData)
      });

      App.showToast(res.message || 'Khôi phục thành công!', 'success');
      App.closeModal();

      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      const errorBox = document.getElementById('restore-error-box');
      if (errorBox) {
        errorBox.innerText = 'Lỗi khôi phục: ' + err.message;
        errorBox.classList.remove('hidden');
      } else {
        alert(err.message);
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="ph-bold ph-arrows-counter-clockwise text-base"></i> Tiến hành Khôi phục';
      }
    }
  }
};



