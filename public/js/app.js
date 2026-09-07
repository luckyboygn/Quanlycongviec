// Main App Controller (Modern Clean UI)
// Trường Đào tạo cán bộ Agribank
const App = {
  currentView: 'dashboard',
  isDark: false,
  cachedDepartments: [],

  async init() {
    // 1. Check local dark mode setting (default to dark mode)
    const savedDark = localStorage.getItem('agy_dark_mode');
    this.isDark = savedDark === null ? true : savedDark === 'true';
    this.applyDarkMode();

    const urlParams = new URLSearchParams(window.location.search);
    const autoUser = urlParams.get('auto_user');
    const targetView = urlParams.get('view') || 'dashboard';
    const targetModal = urlParams.get('modal');

    if (autoUser && (!Auth.token || !Auth.user)) {
      try {
        const uMap = {
          director: 'hanguyenthithu',
          admin: 'admin',
          manager: 'tp_qldt',
          staff: 'Nguyễn Lan Hương'
        };
        const uname = uMap[autoUser] || autoUser;
        await Auth.quickLogin(uname, '123456', false);
      } catch (e) {
        console.error('Auto login error:', e);
      }
    }

    // 2. Initialize Auth
    if (!Auth.init()) {
      return;
    }

    try {
      const [depts, users] = await Promise.all([
        apiFetch('/api/departments'),
        apiFetch('/api/users')
      ]);
      this.cachedDepartments = depts;
      this.cachedUsers = users;
    } catch (e) {
      console.warn('Could not cache departments/users on init:', e);
    }

    this.renderHeader();
    this.renderSidebar();
    this.navigateTo(targetView);
    if (window.Chat) Chat.init();

    const taskMode = urlParams.get('task_mode');
    const adminTab = urlParams.get('admin_tab');
    const dashScope = urlParams.get('scope');
    const dashDeptId = urlParams.get('dept_id');
    const dashTab = urlParams.get('dashboard_tab');

    if (targetView === 'dashboard') {
      if (dashScope) Dashboard.viewScope = dashScope;
      if (dashDeptId) Dashboard.selectedDeptId = parseInt(dashDeptId);
      if (dashTab) Dashboard.currentTableTab = dashTab;
    }

    if (taskMode && targetView === 'tasks') {
      setTimeout(() => Tasks.setViewMode(taskMode), 350);
    }
    if (adminTab && targetView === 'admin') {
      setTimeout(() => Admin.setTab(adminTab), 350);
    }

    if (targetModal) {
      setTimeout(() => {
        if (targetModal === 'create_task') Tasks.openCreateModal();
        else if (targetModal === 'create_log') PersonalLogs.openCreateModal();
        else if (targetModal === 'check_missing') PersonalLogs.checkMissingDays();
        else if (targetModal === 'self_profile') App.openSelfProfileModal();
        else if (targetModal === 'change_password') App.openChangePasswordModal();
        else if (targetModal === 'import_excel') Admin.openImportExcelModal();
        else if (targetModal === 'edit_user') {
          apiFetch('/api/users').then(users => {
            if (users && users.length > 0) Admin.openEditUserModal(users[0].id, encodeURIComponent(JSON.stringify(users[0])));
          });
        }
        else if (targetModal === 'personnel_workload') Tasks.openPersonnelWorkloadModal(parseInt(urlParams.get('user_id') || '5'));
        else if (targetModal === 'kpi_all') Dashboard.openTaskListModal('all');
        else if (targetModal === 'kpi_completed') Dashboard.openTaskListModal('completed');
        else if (targetModal === 'kpi_overdue') Dashboard.openTaskListModal('overdue');
        else if (targetModal === 'kpi_rate') Dashboard.openTaskListModal('rate');
        else if (targetModal === 'kpi_logs' || targetModal === 'kpi_personal_logs') Dashboard.openTaskListModal('personal_logs');
        else if (targetModal === 'log_detail') {
          apiFetch('/api/personal-logs').then(logs => {
            if (logs && logs.length > 0) Dashboard.openPersonalLogDetailModal(logs[0].id);
          });
        }
      }, 500);
    }
  },

  filterSwitchUsers(query) {
    const q = (query || '').toLowerCase().trim();
    const items = document.querySelectorAll('.user-switch-item');
    const groups = document.querySelectorAll('.dept-switch-group');

    items.forEach(el => {
      const searchStr = el.getAttribute('data-search') || '';
      if (!q || searchStr.includes(q)) {
        el.style.display = 'flex';
      } else {
        el.style.display = 'none';
      }
    });

    groups.forEach(g => {
      const visibleChildren = g.querySelectorAll('.user-switch-item:not([style*="display: none"])');
      if (visibleChildren.length === 0) {
        g.style.display = 'none';
      } else {
        g.style.display = 'block';
      }
    });
  },

  toggleDarkMode() {
    this.isDark = !this.isDark;
    localStorage.setItem('agy_dark_mode', this.isDark);
    this.applyDarkMode();
  },

  applyDarkMode() {
    if (this.isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  // 1. Render Header
  renderHeader() {
    const header = document.getElementById('app-header');
    if (!header || !Auth.user) return;

    const role = Auth.user.role;
    const users = this.cachedUsers || [];

    const deptsMap = {};
    users.forEach(u => {
      const dName = u.department_name || 'Ban Giám đốc';
      if (!deptsMap[dName]) deptsMap[dName] = [];
      deptsMap[dName].push(u);
    });

    header.innerHTML = `
      <div class="px-4 sm:px-6 py-3 flex items-center justify-between">
        <!-- Logo & Title -->
        <div class="flex items-center gap-3">
          <button onclick="App.toggleMobileSidebar()" class="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 md:hidden hover:bg-slate-200">
            <i class="ph-bold ph-list text-lg"></i>
          </button>
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-[#005d39] text-white shadow-md shadow-[#005d39]/20 shrink-0">
            <img src="/images/agribank-logo.png" alt="Agribank" class="w-7 h-7 object-contain" onerror="this.onerror=null; this.src='/images/logo.png';">
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-extrabold text-sm sm:text-base text-slate-800 dark:text-white tracking-tight uppercase">
                TRƯỜNG ĐÀO TẠO CÁN BỘ AGRIBANK
              </span>
            </div>
            <p class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold tracking-wide hidden sm:block">
              Hệ thống Theo dõi & Kê khai Công việc
            </p>
          </div>
        </div>

        <!-- Right Action Toolbar -->
        <div class="flex items-center gap-3">
          <!-- Role & All Users Switcher Dropdown (Chỉ hiển thị cho tài khoản Quản trị viên / Admin) -->
          ${Auth.isAdmin() ? `
          <div class="relative group">
            <button class="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition shadow-2xs">
              <i class="ph-bold ph-swap text-emerald-600"></i>
              <span class="hidden sm:inline">Chuyển vai trò / Cán bộ:</span>
              <span class="text-emerald-700 dark:text-emerald-400 font-extrabold">${role.toUpperCase()}</span>
              <i class="ph-bold ph-caret-down text-[10px]"></i>
            </button>

            <!-- Role & Full Employee Options Menu -->
            <div class="absolute right-0 top-full mt-1 w-84 sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-3 hidden group-hover:block z-50 text-xs divide-y divide-slate-100 dark:divide-slate-700">
              ${(role !== 'admin' || Auth.user.username !== 'admin') ? `
              <div class="pb-2.5">
                <button onclick="Auth.switchToAdmin()" class="w-full p-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition">
                  <i class="ph-bold ph-arrow-u-up-left text-sm"></i>
                  <span>Quay về tài khoản Admin gốc</span>
                </button>
              </div>
              ` : ''}

              <!-- Section 1: Switch Current User's Role -->
              <div class="pb-2.5 pt-1 space-y-1.5">
                <div class="text-[10px] uppercase font-extrabold text-emerald-700 dark:text-emerald-400 flex items-center justify-between px-1">
                  <span>Đổi cấp quyền cho chính bạn:</span>
                  <span class="text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold">Linh hoạt</span>
                </div>
                <div class="grid grid-cols-2 gap-1.5 pt-1">
                  <button onclick="Auth.switchMyRole('director')" class="p-2 rounded-xl text-left font-bold transition flex items-center gap-1.5 ${role === 'director' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-amber-50 text-slate-700 dark:text-slate-200'}">
                    <span>🏛️ Ban Giám đốc</span>
                  </button>
                  <button onclick="Auth.switchMyRole('admin')" class="p-2 rounded-xl text-left font-bold transition flex items-center gap-1.5 ${role === 'admin' ? 'bg-purple-100 text-purple-900 border border-purple-300' : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-purple-50 text-slate-700 dark:text-slate-200'}">
                    <span>👑 Admin</span>
                  </button>
                  <button onclick="Auth.switchMyRole('manager')" class="p-2 rounded-xl text-left font-bold transition flex items-center gap-1.5 ${role === 'manager' ? 'bg-blue-100 text-blue-900 border border-blue-300' : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-50 text-slate-700 dark:text-slate-200'}">
                    <span>⭐ Trưởng phòng</span>
                  </button>
                  <button onclick="Auth.switchMyRole('staff')" class="p-2 rounded-xl text-left font-bold transition flex items-center gap-1.5 ${role === 'staff' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-emerald-50 text-slate-700 dark:text-slate-200'}">
                    <span>👤 Nhân viên</span>
                  </button>
                </div>
              </div>

              <!-- Section 2: Switch to ALL Employees in the Unit -->
              <div class="pt-2.5 space-y-2">
                <div class="flex items-center justify-between px-1">
                  <span class="text-[10px] uppercase font-extrabold text-slate-700 dark:text-slate-300">
                    Chuyển sang cán bộ tại đơn vị:
                  </span>
                  <span class="text-[10px] font-bold text-emerald-600">${users.length} cán bộ</span>
                </div>

                <!-- Search Input for Users -->
                <div class="relative">
                  <i class="ph-bold ph-magnifying-glass absolute left-2.5 top-2.5 text-slate-400 text-xs"></i>
                  <input type="text" oninput="App.filterSwitchUsers(this.value)" placeholder="Tìm kiếm tên, chức vụ, phòng ban..." class="w-full pl-7 pr-3 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                </div>

                <!-- Scrollable Employee List -->
                <div id="quick-switch-user-list" class="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  ${Object.keys(deptsMap).map(dName => `
                    <div class="dept-switch-group space-y-1">
                      <div class="dept-switch-header text-[10px] font-extrabold uppercase text-slate-400 px-1 pt-1 flex items-center gap-1 sticky top-0 bg-white dark:bg-slate-800 z-5">
                        <i class="ph-bold ph-buildings text-emerald-600"></i> ${dName}
                      </div>
                      ${deptsMap[dName].map(u => {
                        const isCurrent = u.id === Auth.user.id;
                        const roleTag = u.role === 'director' ? 'BGD' : u.role === 'admin' ? 'Admin' : u.role === 'manager' ? 'Trưởng phòng' : 'Nhân viên';
                        const tagColor = u.role === 'director' ? 'bg-amber-100 text-amber-900 border border-amber-300' : u.role === 'admin' ? 'bg-purple-100 text-purple-900 border border-purple-300' : u.role === 'manager' ? 'bg-blue-100 text-blue-900 border border-blue-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300';
                        return `
                          <button onclick="Auth.switchUser(${u.id})" class="user-switch-item w-full text-left p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between transition group ${isCurrent ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 shadow-2xs' : 'bg-slate-50/60 dark:bg-slate-700/30'}" data-search="${(u.full_name + ' ' + (u.username || '') + ' ' + (u.position || '') + ' ' + (u.department_name || '') + ' ' + roleTag).toLowerCase()}">
                            <div class="flex items-center gap-2 min-w-0">
                              <div class="w-7 h-7 rounded-lg font-bold flex items-center justify-center text-xs shrink-0 ${u.role === 'director' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : u.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' : u.role === 'manager' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'}">
                                ${u.full_name.split(' ').pop()[0]}
                              </div>
                              <div class="min-w-0">
                                <div class="font-bold text-slate-800 dark:text-white truncate flex items-center gap-1.5">
                                  <span>${u.full_name}</span>
                                  ${isCurrent ? '<span class="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-semibold shrink-0">Đang dùng</span>' : ''}
                                </div>
                                <div class="text-[10px] text-slate-400 truncate">${u.position || u.role} • @${u.username}</div>
                              </div>
                            </div>
                            <span class="text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ml-1.5 ${tagColor}">
                              ${roleTag}
                            </span>
                          </button>
                        `;
                      }).join('')}
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
          ` : ''}

          <!-- Dark Mode Toggle -->
          <button onclick="App.toggleDarkMode()" class="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition" title="Giao diện Sáng/Tối">
            <i class="ph-bold ph-moon dark:hidden text-lg"></i>
            <i class="ph-bold ph-sun hidden dark:block text-lg text-amber-400"></i>
          </button>

          <!-- Current User Profile & Role Badge (Click directly to edit own profile) -->
          <div class="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
            <button onclick="App.openSelfProfileModal()" class="flex items-center gap-2.5 p-1.5 -my-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/60 transition group cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-600" title="Nhấp vào đây để xem và sửa thông tin cá nhân của bạn">
              <div class="w-9 h-9 rounded-xl bg-gradient-to-tr ${role === 'director' ? 'from-amber-500 to-orange-600' : role === 'admin' ? 'from-purple-600 to-indigo-600' : role === 'manager' ? 'from-blue-600 to-cyan-600' : 'from-emerald-600 to-teal-600'} text-white font-bold flex items-center justify-center text-sm shadow-sm group-hover:scale-105 transition shrink-0">
                ${Auth.user.full_name.split(' ').pop()[0]}
              </div>
              <div class="hidden md:block text-left text-xs">
                <div class="font-bold text-slate-800 dark:text-white truncate max-w-[140px] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 flex items-center gap-1">
                  <span>${Auth.user.full_name}</span>
                  <i class="ph-bold ph-pencil-simple text-[11px] opacity-60 group-hover:opacity-100 text-emerald-600 dark:text-emerald-400 transition"></i>
                </div>
                <div class="text-[10px] ${role === 'director' ? 'text-amber-600 dark:text-amber-400' : role === 'admin' ? 'text-purple-600 dark:text-purple-400' : role === 'manager' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'} font-bold uppercase flex items-center gap-1">
                  <i class="ph-bold ph-user-circle text-xs"></i>
                  ${role === 'director' ? '🏛️ Ban Giám đốc' : role === 'admin' ? '👑 Admin' : role === 'manager' ? '⭐ Trưởng phòng' : '👤 Nhân viên'}
                </div>
              </div>
            </button>

            <!-- Logout Button -->
            <button onclick="Auth.logout()" class="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition" title="Đăng xuất">
              <i class="ph-bold ph-sign-out text-lg"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // 2. Render Sidebar Navigation Menu
  renderSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    if (!sidebar || !Auth.user) return;

    const role = Auth.user.role;
    const deptCode = Auth.user.department_code || 'PHÒNG';

    let navItems = [];

    if (role === 'director') {
      // 1. BAN GIÁM ĐỐC
      navItems = [
        { id: 'dashboard', label: 'Tổng Quan', icon: 'ph-chart-polar' },
        { id: 'tasks', label: 'Chỉ đạo & Quản lý Công việc', icon: 'ph-kanban' },
        { id: 'personal-logs', label: 'Kê khai nhật ký', icon: 'ph-calendar-check' },
        { id: 'calendar', label: 'Lịch Công Việc', icon: 'ph-calendar-dots' },
        { id: 'export', label: 'Xuất Báo cáo Giao ban', icon: 'ph-file-xls' },
        { id: 'chat', label: 'Chat nội bộ', icon: 'ph-chats-circle', hasBadge: true }
      ];
    } else if (role === 'admin') {
      // 2. ADMIN KỸ THUẬT
      navItems = [
        { id: 'dashboard', label: 'Tổng Quan', icon: 'ph-chart-polar' },
        { id: 'tasks', label: 'Quản lý Công việc', icon: 'ph-kanban' },
        { id: 'personal-logs', label: 'Kê khai nhật ký', icon: 'ph-calendar-check' },
        { id: 'calendar', label: 'Lịch Công Việc', icon: 'ph-calendar-dots' },
        { id: 'export', label: 'Xuất Báo cáo Excel', icon: 'ph-file-xls' },
        { id: 'chat', label: 'Chat nội bộ', icon: 'ph-chats-circle', hasBadge: true },
        { id: 'admin', label: 'Quản trị Hệ thống', icon: 'ph-shield-check', isAdminOnly: true }
      ];
    } else if (role === 'manager') {
      // 3. TRƯỞNG PHÒNG
      navItems = [
        { id: 'dashboard', label: 'Tổng Quan', icon: 'ph-chart-polar' },
        { id: 'tasks', label: `Công việc Phòng ${deptCode}`, icon: 'ph-kanban' },
        { id: 'personal-logs', label: 'Kê khai nhật ký', icon: 'ph-calendar-check' },
        { id: 'calendar', label: 'Lịch Công Việc', icon: 'ph-calendar-dots' },
        { id: 'export', label: 'Xuất Báo cáo Excel', icon: 'ph-file-xls' },
        { id: 'chat', label: 'Chat nội bộ', icon: 'ph-chats-circle', hasBadge: true }
      ];
    } else {
      // 4. GIẢNG VIÊN / CHUYÊN VIÊN
      navItems = [
        { id: 'dashboard', label: 'Tổng Quan', icon: 'ph-chart-polar' },
        { id: 'personal-logs', label: 'Kê khai nhật ký', icon: 'ph-calendar-check' },
        { id: 'calendar', label: 'Lịch Công Việc', icon: 'ph-calendar-dots' },
        { id: 'export', label: 'Xuất Báo cáo Excel', icon: 'ph-file-xls' },
        { id: 'chat', label: 'Chat nội bộ', icon: 'ph-chats-circle', hasBadge: true }
      ];
    }

    sidebar.innerHTML = `
      <div class="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
        ${navItems.map(item => {
          const isActive = this.currentView === item.id;
          return `
            <button onclick="App.navigateTo('${item.id}')" id="nav-${item.id}" class="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left transition relative ${isActive ? 'bg-[#005d39]/10 dark:bg-emerald-950/40 text-[#005d39] dark:text-emerald-300 font-bold border border-[#005d39]/20 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 font-medium'}">
              ${isActive ? `<span class="absolute left-0 top-2.5 bottom-2.5 w-1.5 bg-[#005d39] dark:bg-emerald-500 rounded-r-full"></span>` : ''}
              <div class="flex items-center gap-3 min-w-0">
                <i class="ph-bold ${item.icon} text-xl shrink-0 ${isActive ? 'text-[#005d39] dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}"></i>
                <span class="text-[13px] tracking-tight truncate ${isActive ? 'text-[#005d39] dark:text-emerald-300 font-extrabold' : 'text-slate-700 dark:text-slate-200'}">${item.label}</span>
              </div>
              ${item.hasBadge ? `
                <span id="sidebar-chat-badge" class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white hidden shrink-0 shadow-2xs"></span>
              ` : ''}
            </button>
          `;
        }).join('')}
      </div>

      <!-- LỊCH CÔNG VIỆC - MINI CALENDAR TẠI DƯỚI CÙNG GÓC TRÁI -->
      <div id="sidebar-mini-calendar" class="p-3 pt-1 shrink-0"></div>
    `;

    if (window.Calendar) Calendar.renderSidebarMiniCalendar();
    if (window.Chat) Chat.updateUnreadBadges();
  },

  toggleMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar-container');
    if (sidebar) sidebar.classList.toggle('hidden');
  },

  navigateTo(view) {
    if (view === 'admin' && !Auth.isAdmin()) {
      view = 'dashboard';
    }

    // Clean up Chat timers if leaving chat view to avoid background overhead
    if (view !== 'chat' && window.Chat) {
      if (Chat.pollTimer) { clearInterval(Chat.pollTimer); Chat.pollTimer = null; }
      if (Chat.contactsPollTimer) { clearInterval(Chat.contactsPollTimer); Chat.contactsPollTimer = null; }
    }

    this.currentView = view;
    this.renderSidebar();

    const mobileSidebar = document.getElementById('app-sidebar-container');
    if (mobileSidebar) mobileSidebar.classList.add('hidden');

    if (view === 'dashboard') {
      Dashboard.render();
    } else if (view === 'tasks') {
      Tasks.render();
    } else if (view === 'personal-logs') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('tab') === 'completed') {
        PersonalLogs.currentStatusTab = 'completed';
      } else {
        PersonalLogs.currentStatusTab = 'in_progress';
      }
      PersonalLogs.render();
      if (urlParams.get('modal') === 'create_log') {
        setTimeout(() => PersonalLogs.openCreateModal(), 300);
      }
    } else if (view === 'calendar') {
      Calendar.render();
    } else if (view === 'export') {
      this.renderExportView();
    } else if (view === 'chat') {
      Chat.renderView(document.getElementById('main-content'));
    } else if (view === 'admin') {
      Admin.render();
    }
  },

  async renderExportView() {
    const container = document.getElementById('main-content');
    const isStaff = Auth.isStaff();
    const isManager = Auth.isManager();
    const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();

    const rawDeptName = Auth.user?.department_name || 'Phòng ban';
    const cleanDeptName = rawDeptName.startsWith('Phòng') ? rawDeptName : ('Phòng ' + rawDeptName);

    let logTitle = '1. Bản Kê Khai Nhật Ký Toàn Trường';
    let logDesc = 'Xuất toàn bộ công việc, giờ công của tất cả cán bộ 5 Phòng Ban toàn trường.';
    let logBadge = 'Quyền: Toàn Trường (5 Phòng)';

    let taskTitle = '2. Báo Cáo Tiến Độ Việc Toàn Trường';
    let taskDesc = 'Xuất danh sách công việc toàn trường phân theo 5 phòng ban.';
    let taskBadge = 'Toàn Trường';

    if (isStaff) {
      logTitle = '1. Bản Kê Khai Nhật Ký Cá Nhân';
      logDesc = `Xuất toàn bộ nhật ký công việc, khung giờ và kết quả của bản thân cán bộ: <b class="text-emerald-700 dark:text-emerald-300">${Auth.user.full_name}</b>.`;
      logBadge = 'Quyền: Cá nhân';

      taskTitle = '2. Danh Sách Công Việc Phòng';
      taskDesc = `Xuất danh sách các công việc thuộc <b class="text-blue-700 dark:text-blue-300">${cleanDeptName}</b>.`;
      taskBadge = cleanDeptName;
    } else if (isManager) {
      logTitle = '1. Bản Kê Khai Nhật Ký Toàn Phòng';
      logDesc = `Xuất toàn bộ nhật ký công việc, giờ công của tất cả cán bộ thuộc <b class="text-emerald-700 dark:text-emerald-300">${cleanDeptName}</b>.`;
      logBadge = `Quyền: ${cleanDeptName} (Toàn phòng)`;

      taskTitle = '2. Báo Cáo Công Việc Phòng';
      taskDesc = `Xuất danh sách công việc và phân công nhiệm vụ của <b class="text-blue-700 dark:text-blue-300">${cleanDeptName}</b>.`;
      taskBadge = cleanDeptName;
    }

    container.innerHTML = `
      <div class="space-y-6">
        <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
              <span class="p-2 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <i class="ph-bold ph-file-xls text-2xl"></i>
              </span>
              Xuất Báo Cáo & Dữ Liệu Excel
            </h1>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Xuất dữ liệu theo dõi công việc và bản kê khai nhật ký cá nhân phục vụ họp giao ban định kỳ Trường Đào tạo cán bộ Agribank.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <i class="ph-bold ph-shield-check mr-1"></i> ${logBadge}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 flex flex-col justify-between">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center text-xl font-bold">
                  <i class="ph-bold ph-calendar-check"></i>
                </div>
                <span class="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  ${isStaff ? 'Cá nhân' : (isManager ? 'Toàn phòng' : 'Toàn trường')}
                </span>
              </div>
              <div>
                <h3 class="font-bold text-slate-800 dark:text-white">${logTitle}</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${logDesc}</p>
              </div>
            </div>
            <button onclick="ExportModule.exportPersonalLogsToExcel()" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2">
              <i class="ph-bold ph-download-simple text-base"></i> Tải Excel (.xlsx)
            </button>
          </div>

          <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 flex flex-col justify-between">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center text-xl font-bold">
                  <i class="ph-bold ph-kanban"></i>
                </div>
                <span class="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  ${isStaff || isManager ? cleanDeptName : 'Toàn trường'}
                </span>
              </div>
              <div>
                <h3 class="font-bold text-slate-800 dark:text-white">${taskTitle}</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${taskDesc}</p>
              </div>
            </div>
            <button onclick="ExportModule.exportTasksToExcel()" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2">
              <i class="ph-bold ph-file-arrow-down text-base"></i> Tải Báo Cáo (.xlsx)
            </button>
          </div>
        </div>
      </div>
    `;
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = {
      success: 'bg-emerald-600 text-white shadow-emerald-600/30',
      error: 'bg-rose-600 text-white shadow-rose-600/30',
      info: 'bg-slate-800 text-white dark:bg-slate-700',
      warning: 'bg-amber-600 text-white shadow-amber-600/30'
    };

    toast.className = `${colors[type] || colors.info} px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-semibold pointer-events-auto transform transition-all duration-300 translate-y-4 opacity-0`;
    toast.innerHTML = `
      <i class="ph-bold ${type === 'success' ? 'ph-check-circle' : type === 'error' ? 'ph-warning-circle' : 'ph-info'} text-lg"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove('translate-y-4', 'opacity-0');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-4');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  closeModal() {
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) modalContainer.innerHTML = '';
  },

  openSelfProfileModal() {
    if (!Auth.user) return;
    const u = Auth.user;
    const modalContainer = document.getElementById('modal-container');
    const roleMap = {
      director: '🏛️ Ban Giám đốc',
      admin: '👑 Admin Quản trị',
      manager: '⭐ Trưởng phòng',
      staff: '👤 Nhân viên'
    };

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-700">
          <div class="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10">
            <h3 class="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <i class="ph-bold ph-identification-card text-emerald-600 text-xl"></i> Thông tin cá nhân cán bộ
            </h3>
            <button onclick="App.closeModal()" class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
              <i class="ph-bold ph-x text-base"></i>
            </button>
          </div>

          <form onsubmit="App.submitSelfProfile(event)" class="p-6 space-y-4 text-xs">
            <!-- Organization info summary (Read-only badge) -->
            <div class="p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-4 gap-2 text-center">
              <div>
                <div class="text-[10px] uppercase font-bold text-slate-400">Mã cán bộ</div>
                <div class="font-bold text-blue-600 dark:text-blue-400 font-mono truncate mt-0.5">${u.employee_code || ('CB' + String(u.id).padStart(3, '0'))}</div>
              </div>
              <div>
                <div class="text-[10px] uppercase font-bold text-slate-400">Phòng ban</div>
                <div class="font-bold text-slate-700 dark:text-slate-200 truncate mt-0.5">${u.department_name || 'Ban Giám đốc'}</div>
              </div>
              <div>
                <div class="text-[10px] uppercase font-bold text-slate-400">Chức vụ</div>
                <div class="font-bold text-emerald-600 dark:text-emerald-400 truncate mt-0.5">${u.position || 'Nhân viên'}</div>
              </div>
              <div>
                <div class="text-[10px] uppercase font-bold text-slate-400">Cấp phân quyền</div>
                <div class="font-bold text-purple-600 dark:text-purple-400 truncate mt-0.5">${roleMap[u.role] || u.role}</div>
              </div>
            </div>

            <!-- Mã cán bộ & Họ tên & Tên đăng nhập -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold uppercase text-slate-500 mb-1 flex items-center justify-between">
                  <span>Mã cán bộ</span>
                  ${Auth.isAdmin() ? '<span class="text-[9px] text-emerald-600 font-semibold">Admin sửa</span>' : '<span class="text-[9px] text-slate-400 font-semibold">Cố định</span>'}
                </label>
                <input type="text" id="self-employee-code" value="${u.employee_code || ('CB' + String(u.id).padStart(3, '0'))}" ${Auth.isAdmin() ? '' : 'disabled'} placeholder="VD: CB001" class="w-full px-3.5 py-2.5 ${Auth.isAdmin() ? 'bg-slate-50 dark:bg-slate-700 font-bold' : 'bg-slate-100 dark:bg-slate-700/60 font-mono text-slate-500 cursor-not-allowed'} border border-slate-200 dark:border-slate-600 rounded-xl dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
              </div>

              <div>
                <label class="block font-bold uppercase text-slate-500 mb-1">Họ và tên của bạn *</label>
                <input type="text" id="self-fullname" required value="${u.full_name || ''}" class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-bold dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
              </div>

              <div>
                <label class="block font-bold uppercase text-slate-500 mb-1 flex items-center justify-between">
                  <span>Tên đăng nhập</span>
                  <span class="text-[9px] text-amber-600 dark:text-amber-400 font-semibold lowercase flex items-center gap-0.5"><i class="ph-bold ph-lock"></i> Chỉ Admin đổi</span>
                </label>
                <input type="text" id="self-username" value="${u.username || ''}" disabled class="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl font-mono text-slate-500 dark:text-slate-400 font-medium cursor-not-allowed select-none" title="Tên đăng nhập cố định do Quản trị viên (Admin) cấp">
              </div>
            </div>

            <!-- Ngày sinh, Giới tính, Trình độ -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-bold uppercase text-slate-500 mb-1">Ngày sinh</label>
                <input type="date" id="self-birthdate" value="${u.birth_date || ''}" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none">
              </div>

              <div>
                <label class="block font-bold uppercase text-slate-500 mb-1">Giới tính</label>
                <select id="self-gender" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                  <option value="Nam" ${u.gender === 'Nam' ? 'selected' : ''}>Nam</option>
                  <option value="Nữ" ${u.gender === 'Nữ' ? 'selected' : ''}>Nữ</option>
                  <option value="Khác" ${u.gender === 'Khác' ? 'selected' : ''}>Khác</option>
                </select>
              </div>

              <div>
                <label class="block font-bold uppercase text-slate-500 mb-1">Trình độ</label>
                <select id="self-qualification" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                  <option value="Tiến sĩ" ${u.qualification === 'Tiến sĩ' ? 'selected' : ''}>Tiến sĩ</option>
                  <option value="Thạc sĩ" ${u.qualification === 'Thạc sĩ' ? 'selected' : ''}>Thạc sĩ</option>
                  <option value="Đại học" ${u.qualification === 'Đại học' || !u.qualification ? 'selected' : ''}>Đại học</option>
                  <option value="Cao đẳng" ${u.qualification === 'Cao đẳng' ? 'selected' : ''}>Cao đẳng</option>
                  <option value="Trung cấp" ${u.qualification === 'Trung cấp' ? 'selected' : ''}>Trung cấp</option>
                  <option value="Khác" ${u.qualification === 'Khác' ? 'selected' : ''}>Khác</option>
                </select>
              </div>
            </div>

            <!-- Điện thoại & Email -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold uppercase text-slate-500 mb-1">Số điện thoại</label>
                <input type="tel" id="self-phone" value="${u.phone || ''}" placeholder="VD: 0912345678..." class="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
              </div>

              <div>
                <label class="block font-bold uppercase text-slate-500 mb-1">Email liên hệ</label>
                <input type="email" id="self-email" value="${u.email || ''}" placeholder="VD: mail@agribank.com.vn..." class="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none">
              </div>
            </div>

            <!-- Đổi mật khẩu bảo mật (Nút mở cửa sổ đổi mật khẩu riêng) -->
            <div class="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg shrink-0">
                  <i class="ph-bold ph-key"></i>
                </div>
                <div class="min-w-0">
                  <div class="font-bold text-slate-800 dark:text-white text-xs">Mật khẩu tài khoản</div>
                  <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">Nhấp để mở cửa sổ thay đổi mật khẩu đăng nhập</div>
                </div>
              </div>
              <button type="button" onclick="App.openChangePasswordModal()" class="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold rounded-xl border border-amber-300 dark:border-amber-700/60 shadow-2xs transition flex items-center gap-1.5 shrink-0 cursor-pointer">
                <i class="ph-bold ph-lock-key-open"></i> Đổi mật khẩu
              </button>
            </div>

            <div class="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
              <button type="button" onclick="App.closeModal()" class="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-xl font-bold text-slate-600 dark:text-slate-300 transition">Hủy bỏ</button>
              <button type="submit" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm transition flex items-center gap-1.5">
                <i class="ph-bold ph-check"></i> Lưu thay đổi
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  openChangePasswordModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5">
          
          <!-- Modal Header -->
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
            <div class="flex items-center gap-3">
              <span class="p-2.5 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-2xl">
                <i class="ph-bold ph-lock-key text-2xl"></i>
              </span>
              <div>
                <h3 class="text-base font-extrabold text-slate-800 dark:text-white">
                  Đổi mật khẩu tài khoản
                </h3>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">
                  Tài khoản: <span class="font-bold text-slate-700 dark:text-slate-300">@${Auth.user?.username || ''}</span>
                </p>
              </div>
            </div>
            <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition">
              <i class="ph-bold ph-x text-lg"></i>
            </button>
          </div>

          <!-- Error / Info Box -->
          <div id="change-pwd-error-box" class="hidden p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2">
            <i class="ph-bold ph-warning-circle text-base shrink-0"></i>
            <span id="change-pwd-error-msg"></span>
          </div>

          <!-- Form -->
          <form onsubmit="App.submitChangePassword(event)" class="space-y-4 text-xs">
            <!-- 1. Mật khẩu cũ -->
            <div>
              <label class="block font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                <i class="ph-bold ph-shield-check text-slate-400"></i> Mật khẩu cũ (Hiện tại) *
              </label>
              <div class="relative">
                <input type="password" id="pwd-old" required placeholder="Nhập mật khẩu bạn đang sử dụng..." class="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-mono text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition">
                <button type="button" onclick="App.togglePasswordVisibility('pwd-old', this)" class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                  <i class="ph-bold ph-eye text-base"></i>
                </button>
              </div>
            </div>

            <!-- 2. Mật khẩu mới -->
            <div>
              <label class="block font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                <i class="ph-bold ph-key text-amber-500"></i> Mật khẩu mới *
              </label>
              <div class="relative">
                <input type="password" id="pwd-new" required minlength="6" placeholder="Tối thiểu 6 ký tự..." class="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-mono text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition">
                <button type="button" onclick="App.togglePasswordVisibility('pwd-new', this)" class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                  <i class="ph-bold ph-eye text-base"></i>
                </button>
              </div>
              <p class="text-[10px] text-slate-400 mt-1">Mật khẩu phải có độ dài từ 6 ký tự trở lên.</p>
            </div>

            <!-- 3. Nhập lại mật khẩu mới -->
            <div>
              <label class="block font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                <i class="ph-bold ph-check-circle text-emerald-500"></i> Nhập lại mật khẩu mới *
              </label>
              <div class="relative">
                <input type="password" id="pwd-confirm" required minlength="6" placeholder="Nhập lại chính xác mật khẩu mới..." class="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-mono text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition">
                <button type="button" onclick="App.togglePasswordVisibility('pwd-confirm', this)" class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                  <i class="ph-bold ph-eye text-base"></i>
                </button>
              </div>
            </div>

            <!-- Modal Actions -->
            <div class="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2.5">
              <button type="button" onclick="App.openSelfProfileModal()" class="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl font-bold text-slate-600 dark:text-slate-300 transition">
                Quay lại hồ sơ
              </button>
              <button type="submit" id="btn-submit-change-pwd" class="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md shadow-amber-600/20 transition flex items-center gap-1.5">
                <i class="ph-bold ph-check"></i> Xác nhận đổi mật khẩu
              </button>
            </div>
          </form>

        </div>
      </div>
    `;
  },

  togglePasswordVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    const icon = btnEl.querySelector('i');
    if (icon) {
      icon.className = isPass ? 'ph-bold ph-eye-slash text-base text-amber-600' : 'ph-bold ph-eye text-base text-slate-400';
    }
  },

  async submitChangePassword(e) {
    e.preventDefault();
    const errorBox = document.getElementById('change-pwd-error-box');
    const errorMsg = document.getElementById('change-pwd-error-msg');
    const submitBtn = document.getElementById('btn-submit-change-pwd');

    if (errorBox) errorBox.classList.add('hidden');

    const old_password = document.getElementById('pwd-old')?.value || '';
    const new_password = document.getElementById('pwd-new')?.value || '';
    const confirm_password = document.getElementById('pwd-confirm')?.value || '';

    if (!old_password) {
      if (errorBox && errorMsg) {
        errorMsg.innerText = 'Vui lòng nhập mật khẩu cũ (mật khẩu hiện tại)';
        errorBox.classList.remove('hidden');
      }
      return;
    }

    if (new_password.length < 6) {
      if (errorBox && errorMsg) {
        errorMsg.innerText = 'Mật khẩu mới phải có tối thiểu 6 ký tự';
        errorBox.classList.remove('hidden');
      }
      return;
    }

    if (new_password !== confirm_password) {
      if (errorBox && errorMsg) {
        errorMsg.innerText = 'Mật khẩu mới và Nhập lại mật khẩu không khớp nhau!';
        errorBox.classList.remove('hidden');
      }
      return;
    }

    if (old_password === new_password) {
      if (errorBox && errorMsg) {
        errorMsg.innerText = 'Mật khẩu mới không được trùng với mật khẩu cũ!';
        errorBox.classList.remove('hidden');
      }
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Đang xử lý...';
      }

      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ old_password, new_password, confirm_password })
      });

      this.showToast(res.message || 'Đổi mật khẩu thành công!', 'success');
      this.closeModal();
    } catch (err) {
      if (errorBox && errorMsg) {
        errorMsg.innerText = err.message;
        errorBox.classList.remove('hidden');
      } else {
        alert(err.message);
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="ph-bold ph-check"></i> Xác nhận đổi mật khẩu';
      }
    }
  },

  async submitSelfProfile(e) {
    e.preventDefault();
    try {
      const full_name = document.getElementById('self-fullname').value.trim();
      const birth_date = document.getElementById('self-birthdate').value;
      const gender = document.getElementById('self-gender').value;
      const qualification = document.getElementById('self-qualification').value;
      const phone = document.getElementById('self-phone').value.trim();
      const email = document.getElementById('self-email').value.trim();

      const payload = {
        full_name,
        birth_date,
        gender,
        qualification,
        phone,
        email
      };

      const empCodeEl = document.getElementById('self-employee-code');
      if (empCodeEl && !empCodeEl.disabled && empCodeEl.value.trim()) {
        payload.employee_code = empCodeEl.value.trim();
      }

      const res = await apiFetch(`/api/users/${Auth.user.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (res.user) {
        Auth.setSession(res.token || Auth.token, res.user);
      } else {
        Auth.user.full_name = full_name;
        if (payload.employee_code) Auth.user.employee_code = payload.employee_code;
        Auth.user.birth_date = birth_date;
        Auth.user.gender = gender;
        Auth.user.qualification = qualification;
        Auth.user.phone = phone;
        Auth.user.email = email;
        Auth.setSession(Auth.token, Auth.user);
      }

      this.renderHeader();
      this.renderSidebar();
      this.showToast('Cập nhật thông tin cá nhân thành công!', 'success');
      this.closeModal();

      // Refresh current view if admin
      if (this.currentView === 'admin' && typeof Admin !== 'undefined') {
        Admin.renderCurrentTab();
      }
    } catch (err) {
      alert('Lỗi cập nhật: ' + err.message);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
