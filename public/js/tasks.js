// Tasks Management Module (Modern Kanban & List View)
// Trường Đào tạo cán bộ Agribank
const Tasks = {
  viewMode: 'kanban', // 'kanban' | 'list'
  filterDept: '',
  filterPriority: '',
  filterStatus: '',
  searchQuery: '',
  cachedTasks: [],
  cachedUsers: [],
  cachedDepartments: [],

  async render() {
    const container = document.getElementById('main-content');
    if (!container) return;

    const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();
    const rawDeptName = Auth.user.department_name || '';
    const cleanDeptName = rawDeptName.startsWith('Phòng') ? rawDeptName : ('Phòng ' + rawDeptName);

    // Mặc định đối với Trưởng phòng/Nhân viên: Cố định vào phòng ban mình phụ trách
    this.filterDept = isDirectorOrAdmin ? '' : (Auth.user.department_id || '');
    this.filterPriority = '';
    this.filterStatus = '';
    this.searchQuery = '';

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Control Header -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
              <span class="p-2 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <i class="ph-bold ph-kanban text-2xl"></i>
              </span>
              ${Auth.isAdmin() ? 'Quản lý Công việc Toàn Trường' : Auth.isDirector() ? 'Chỉ đạo & Quản lý Công việc' : Auth.isManager() ? `Công việc ${cleanDeptName}` : 'Công việc của Tôi & Phòng'}
            </h1>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Giao việc, đôn đốc tiến độ, cập nhật % hoàn thành và quản lý nhật ký 5 Phòng Ban Trường Đào tạo cán bộ Agribank.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <!-- View Mode Switcher -->
            <div class="bg-slate-100 dark:bg-slate-700 p-1 rounded-xl flex items-center shadow-inner">
              <button onclick="Tasks.setViewMode('kanban')" id="btn-view-kanban" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${this.viewMode === 'kanban' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}">
                <i class="ph-bold ph-squares-four"></i> Kanban
              </button>
              <button onclick="Tasks.setViewMode('list')" id="btn-view-list" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${this.viewMode === 'list' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}">
                <i class="ph-bold ph-list-dashes"></i> Danh sách
              </button>
              <button onclick="Tasks.setViewMode('workload')" id="btn-view-workload" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${this.viewMode === 'workload' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}">
                <i class="ph-bold ph-users-three"></i> Theo nhân sự
              </button>
            </div>

            <!-- Export Tasks to Excel -->
            <button onclick="ExportModule.exportTasksToExcel()" class="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl flex items-center gap-2 transition">
              <i class="ph-bold ph-file-xls text-emerald-600 text-base"></i> Xuất Excel
            </button>

            <!-- Create Task Button -->
            <button onclick="Tasks.openCreateModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition">
              <i class="ph-bold ph-plus text-base"></i> Tạo công việc mới
            </button>
          </div>
        </div>

        <!-- Filter & Search Bar -->
        <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center gap-3">
          <!-- Search Input -->
          <div class="relative flex-1 min-w-[220px]">
            <i class="ph ph-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
            <input type="text" id="task-search-input" oninput="Tasks.handleSearch(this.value)" placeholder="${isDirectorOrAdmin ? 'Tìm kiếm công việc toàn trường...' : 'Tìm kiếm công việc trong ' + cleanDeptName + '...'}" class="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-white">
          </div>

          <!-- Department Filter: Ban Giám đốc & Admin được chọn tất cả phòng; Trưởng phòng cố định phòng mình -->
          ${isDirectorOrAdmin ? `
            <select id="task-filter-dept" onchange="Tasks.handleFilterDept(this.value)" class="px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium">
              <option value="">-- Tất cả 5 Phòng ban --</option>
            </select>
          ` : `
            <div class="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs" title="Bạn chỉ tìm kiếm và theo dõi công việc thuộc phòng ban phụ trách">
              <i class="ph-bold ph-buildings text-emerald-600"></i>
              <span>${cleanDeptName}</span>
              <span class="text-[10px] bg-emerald-200/70 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 px-1.5 py-0.5 rounded font-extrabold ml-0.5">Phòng phụ trách</span>
            </div>
          `}

          <!-- Priority Filter -->
          <select id="task-filter-priority" onchange="Tasks.handleFilterPriority(this.value)" class="px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">-- Mức ưu tiên --</option>
            <option value="urgent">🔴 Khẩn cấp</option>
            <option value="high">🟠 Cao</option>
            <option value="medium">🔵 Trung bình</option>
            <option value="low">🟢 Thấp</option>
          </select>

          <!-- Status Filter -->
          <select id="task-filter-status" onchange="Tasks.handleFilterStatus(this.value)" class="px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">-- Trạng thái --</option>
            <option value="pending">Chưa bắt đầu</option>
            <option value="in_progress">Đang thực hiện</option>
            <option value="completed">Hoàn thành</option>
            <option value="overdue">Trễ hạn</option>
          </select>

          <!-- Reset Filter -->
          <button onclick="Tasks.resetFilters()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition" title="Xóa bộ lọc">
            <i class="ph-bold ph-arrow-counter-clockwise text-lg"></i>
          </button>
        </div>

        <!-- Tasks Content View (Kanban / List) -->
        <div id="tasks-view-container">
          <div class="flex items-center justify-center py-20 text-slate-400">
            <i class="ph ph-spinner animate-spin text-3xl mr-2 text-emerald-600"></i> Đang tải dữ liệu công việc...
          </div>
        </div>
      </div>
    `;

    await this.initFilterOptions();
    await this.loadTasks();
  },

  async initFilterOptions() {
    try {
      const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();
      const [departments, users] = await Promise.all([
        apiFetch('/api/departments'),
        apiFetch('/api/users')
      ]);
      this.cachedDepartments = departments;
      this.cachedUsers = users;

      const deptSelect = document.getElementById('task-filter-dept');
      if (deptSelect && isDirectorOrAdmin) {
        deptSelect.innerHTML = `<option value="">-- Tất cả 5 Phòng ban --</option>` +
          departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
      }
    } catch (err) {
      console.error('Failed to init filter options:', err);
    }
  },

  setViewMode(mode) {
    this.viewMode = mode;
    const btnKanban = document.getElementById('btn-view-kanban');
    const btnList = document.getElementById('btn-view-list');
    const btnWorkload = document.getElementById('btn-view-workload');

    const activeClass = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm';
    const inactiveClass = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition text-slate-600 dark:text-slate-300';

    if (btnKanban) btnKanban.className = mode === 'kanban' ? activeClass : inactiveClass;
    if (btnList) btnList.className = mode === 'list' ? activeClass : inactiveClass;
    if (btnWorkload) btnWorkload.className = mode === 'workload' ? activeClass : inactiveClass;

    this.renderCurrentView();
  },

  async loadTasks() {
    try {
      const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();
      let query = '?';
      if (!isDirectorOrAdmin) {
        this.filterDept = Auth.user.department_id || '';
        if (this.filterDept) query += `department_id=${this.filterDept}&`;
      } else {
        if (this.filterDept) query += `department_id=${this.filterDept}&`;
      }
      if (this.filterPriority) query += `priority=${this.filterPriority}&`;
      if (this.filterStatus) query += `status=${this.filterStatus}&`;
      if (this.searchQuery) query += `search=${encodeURIComponent(this.searchQuery)}&`;

      this.cachedTasks = await apiFetch(`/api/tasks${query}`);
      this.renderCurrentView();
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  },

  renderCurrentView() {
    const container = document.getElementById('tasks-view-container');
    if (!container) return;

    if (this.viewMode === 'kanban') {
      this.renderKanbanView(container);
    } else if (this.viewMode === 'workload') {
      this.renderWorkloadView(container);
    } else {
      this.renderListView(container);
    }
  },

  handleSearch(val) {
    this.searchQuery = val;
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.loadTasks(), 300);
  },

  handleFilterDept(val) {
    if (!Auth.isDirector() && !Auth.isAdmin()) {
      this.filterDept = Auth.user.department_id || '';
      return;
    }
    this.filterDept = val;
    this.loadTasks();
  },

  handleFilterPriority(val) {
    this.filterPriority = val;
    this.loadTasks();
  },

  handleFilterStatus(val) {
    this.filterStatus = val;
    this.loadTasks();
  },

  resetFilters() {
    const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();
    this.filterDept = isDirectorOrAdmin ? '' : (Auth.user.department_id || '');
    this.filterPriority = '';
    this.filterStatus = '';
    this.searchQuery = '';
    const searchInput = document.getElementById('task-search-input');
    if (searchInput) searchInput.value = '';
    const deptSelect = document.getElementById('task-filter-dept');
    if (deptSelect) deptSelect.value = '';
    const prioritySelect = document.getElementById('task-filter-priority');
    if (prioritySelect) prioritySelect.value = '';
    const statusSelect = document.getElementById('task-filter-status');
    if (statusSelect) statusSelect.value = '';
    this.loadTasks();
  },

  // Render Kanban Board
  renderKanbanView(container) {
    const columns = [
      { id: 'pending', title: 'Chưa bắt đầu', color: 'slate', icon: 'ph-hourglass' },
      { id: 'in_progress', title: 'Đang thực hiện', color: 'blue', icon: 'ph-play-circle' },
      { id: 'completed', title: 'Đã hoàn thành', color: 'emerald', icon: 'ph-check-circle' },
      { id: 'overdue', title: 'Trễ hạn', color: 'rose', icon: 'ph-warning-circle' }
    ];

    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        ${columns.map(col => {
          const colTasks = this.cachedTasks.filter(t => t.status === col.id);
          return `
            <div class="bg-slate-100/70 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex flex-col kanban-col">
              <!-- Column Header -->
              <div class="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                <div class="flex items-center gap-2">
                  <span class="p-1 rounded-lg bg-${col.color}-100 dark:bg-${col.color}-900/40 text-${col.color}-600 dark:text-${col.color}-400">
                    <i class="ph-bold ${col.icon}"></i>
                  </span>
                  <h3 class="font-bold text-sm text-slate-700 dark:text-slate-200">${col.title}</h3>
                </div>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  ${colTasks.length}
                </span>
              </div>

              <!-- Task Cards List -->
              <div class="flex-1 space-y-3 overflow-y-auto pr-1">
                ${colTasks.length === 0 ? `
                  <div class="h-32 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center text-xs text-slate-400">
                    Trống
                  </div>
                ` : colTasks.map(t => this.renderTaskCard(t)).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderTaskCard(t) {
    const priorityLabels = {
      urgent: { label: 'Khẩn cấp', class: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
      high: { label: 'Cao', class: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
      medium: { label: 'Trung bình', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
      low: { label: 'Thấp', class: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' }
    };
    const p = priorityLabels[t.priority] || priorityLabels.medium;

    return `
      <div onclick="Tasks.viewTaskDetails(${t.id})" class="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs hover:shadow-md hover:border-emerald-500/50 transition cursor-pointer space-y-2.5">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${p.class}">
            ${p.label}
          </span>
          <span class="text-[10px] text-slate-400 font-mono font-bold">
            ${t.department_code || 'PHÒNG'}
          </span>
        </div>

        <h4 class="font-bold text-sm text-slate-800 dark:text-slate-100 leading-snug hover:text-emerald-600 transition">
          ${t.title}
        </h4>

        <!-- Progress bar -->
        <div class="space-y-1">
          <div class="flex justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>Tiến độ</span>
            <span class="text-emerald-600 dark:text-emerald-400 font-bold">${t.progress}%</span>
          </div>
          <div class="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
            <div class="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full" style="width: ${t.progress}%"></div>
          </div>
        </div>

        <!-- Footer Card -->
        <div class="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
          <div class="flex items-center gap-1">
            <i class="ph ph-calendar"></i>
            <span class="font-mono text-[11px] ${t.status === 'overdue' ? 'text-rose-500 font-bold' : ''}">${t.due_date}</span>
          </div>
          <div class="flex items-center gap-1.5">
            ${t.assignees_count > 1 ? `
              <span class="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                👥 ${t.assignees_count}
              </span>
            ` : ''}
            <button onclick="event.stopPropagation(); Tasks.openProgressModal(${t.id}, ${t.progress})" class="p-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-600" title="Cập nhật tiến độ">
              <i class="ph-bold ph-gauge"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // Render Table List View
  renderListView(container) {
    container.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead class="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th class="px-6 py-4">Tên công việc</th>
                <th class="px-6 py-4">Phòng ban</th>
                <th class="px-6 py-4">Mức ưu tiên</th>
                <th class="px-6 py-4">Trạng thái</th>
                <th class="px-6 py-4">Tiến độ (%)</th>
                <th class="px-6 py-4">Hạn chót</th>
                <th class="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
              ${this.cachedTasks.map(t => {
                const statusBadges = {
                  pending: '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Chưa bắt đầu</span>',
                  in_progress: '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">Đang thực hiện</span>',
                  completed: '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">Hoàn thành</span>',
                  overdue: '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">Trễ hạn</span>'
                };
                return `
                  <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                    <td class="px-6 py-4 font-bold text-slate-800 dark:text-white">${t.title}</td>
                    <td class="px-6 py-4"><span class="font-mono text-xs font-semibold">${t.department_code || 'PHÒNG'}</span></td>
                    <td class="px-6 py-4"><span class="priority-${t.priority} px-2.5 py-1 rounded-full text-xs font-semibold uppercase">${t.priority}</span></td>
                    <td class="px-6 py-4">${statusBadges[t.status] || t.status}</td>
                    <td class="px-6 py-4">
                      <div class="flex items-center gap-2">
                        <div class="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div class="bg-emerald-600 h-full rounded-full" style="width: ${t.progress}%"></div>
                        </div>
                        <span class="text-xs font-bold">${t.progress}%</span>
                      </div>
                    </td>
                    <td class="px-6 py-4 font-mono text-xs ${t.status === 'overdue' ? 'text-rose-600 font-bold' : ''}">${t.due_date}</td>
                    <td class="px-6 py-4 text-right">
                      <div class="flex items-center justify-end gap-2">
                        <button onclick="Tasks.openProgressModal(${t.id}, ${t.progress})" class="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg" title="Cập nhật tiến độ">
                          <i class="ph-bold ph-gauge text-base"></i>
                        </button>
                        <button onclick="Tasks.viewTaskDetails(${t.id})" class="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg" title="Xem chi tiết">
                          <i class="ph-bold ph-eye text-base"></i>
                        </button>
                        ${(Auth.isAdmin() || Auth.isManager()) ? `
                          <button onclick="Tasks.deleteTask(${t.id})" class="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg" title="Xóa công việc">
                            <i class="ph-bold ph-trash text-base"></i>
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
  },

  // Render Workload Matrix View (Quản lý khối lượng công việc theo nhân sự)
  renderWorkloadView(container) {
    const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();
    const myDeptId = Auth.user.department_id;
    
    // Filter users based on scope
    let usersList = this.cachedUsers || [];
    if (!isDirectorOrAdmin) {
      usersList = usersList.filter(u => u.department_id === myDeptId);
    } else if (this.filterDept) {
      usersList = usersList.filter(u => u.department_id === parseInt(this.filterDept));
    }

    // Filter by search query if any
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      usersList = usersList.filter(u => 
        (u.full_name + ' ' + (u.position || '') + ' ' + (u.department_name || '')).toLowerCase().includes(q)
      );
    }

    // Compute workload stats for each user
    const statsList = usersList.map(u => {
      // Find all tasks assigned to this user in cachedTasks
      const assignedTasks = this.cachedTasks.filter(t => 
        t.assignees && t.assignees.some(a => a.id === u.id)
      );

      const total = assignedTasks.length;
      const important = assignedTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length;
      const overdue = assignedTasks.filter(t => t.status === 'overdue').length;
      const inProgress = assignedTasks.filter(t => t.status === 'in_progress').length;
      const pending = assignedTasks.filter(t => t.status === 'pending').length;
      const completed = assignedTasks.filter(t => t.status === 'completed').length;
      
      const avgProgress = total > 0 
        ? Math.round(assignedTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / total)
        : 0;

      // Status indicator dot matching Image 2
      // Red: Overdue > 0 or Total >= 8 (Quá tải / Có việc trễ hạn)
      // Yellow: Total >= 4 && Overdue === 0 (Tải trung bình)
      // Green: Total > 0 && Total < 4 && Overdue === 0 (Tải tối ưu)
      // Gray: Total === 0 (Chưa giao việc)
      let statusDot = 'bg-slate-300 dark:bg-slate-600';
      let statusTooltip = 'Chưa có công việc được giao';
      let statusColorText = 'text-slate-400';
      if (overdue > 0 || total >= 8) {
        statusDot = 'bg-rose-500 shadow-rose-500/50 shadow-md animate-pulse';
        statusTooltip = overdue > 0 ? `Có ${overdue} việc trễ hạn` : 'Khối lượng việc cao (Quá tải)';
        statusColorText = 'text-rose-600 font-bold';
      } else if (total >= 4) {
        statusDot = 'bg-amber-400 shadow-amber-400/50 shadow-sm';
        statusTooltip = 'Khối lượng việc vừa phải';
        statusColorText = 'text-amber-600 font-bold';
      } else if (total > 0) {
        statusDot = 'bg-emerald-500 shadow-emerald-500/50 shadow-sm';
        statusTooltip = 'Khối lượng việc tối ưu';
        statusColorText = 'text-emerald-600 font-bold';
      }

      return {
        user: u,
        total,
        important,
        overdue,
        inProgress,
        pending,
        completed,
        avgProgress,
        statusDot,
        statusTooltip,
        statusColorText,
        tasks: assignedTasks
      };
    });

    // Sort by Overdue DESC, then Total DESC, then Name ASC
    statsList.sort((a, b) => b.overdue - a.overdue || b.total - a.total || a.user.full_name.localeCompare(b.user.full_name));

    // Summary counters
    const totalStaff = statsList.length;
    const totalAssignedTasks = statsList.reduce((sum, s) => sum + s.total, 0);
    const totalImportant = statsList.reduce((sum, s) => sum + s.important, 0);
    const totalOverdue = statsList.reduce((sum, s) => sum + s.overdue, 0);

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Workload Summary KPI Banner -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <div class="text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
              <i class="ph-bold ph-users text-emerald-600"></i> Tổng số cán bộ
            </div>
            <div class="text-xl font-extrabold text-slate-800 dark:text-white mt-1">${totalStaff} <span class="text-xs font-normal text-slate-400">người</span></div>
          </div>
          <div class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <div class="text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
              <i class="ph-bold ph-kanban text-blue-600"></i> Lượt giao việc
            </div>
            <div class="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">${totalAssignedTasks} <span class="text-xs font-normal text-slate-400">lượt</span></div>
          </div>
          <div class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <div class="text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
              <i class="ph-bold ph-fire text-amber-600"></i> Việc quan trọng
            </div>
            <div class="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">${totalImportant} <span class="text-xs font-normal text-slate-400">việc</span></div>
          </div>
          <div class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <div class="text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
              <i class="ph-bold ph-warning-circle text-rose-600"></i> Việc quá hạn
            </div>
            <div class="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">${totalOverdue} <span class="text-xs font-normal text-slate-400">việc</span></div>
          </div>
        </div>

        <!-- Workload Table matching user illustration exactly -->
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="p-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <i class="ph-bold ph-users-three text-lg"></i>
              </span>
              <h3 class="font-extrabold text-sm sm:text-base text-slate-800 dark:text-white">
                Quản Lý Khối Lượng Công Việc Theo Nhân Sự
              </h3>
            </div>
            <div class="hidden sm:flex items-center gap-3 text-xs text-slate-400">
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> Quá tải / Trễ hạn</span>
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span> Tải vừa</span>
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Tải tối ưu</span>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead class="bg-slate-50/80 dark:bg-slate-700/60 text-xs font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th class="px-6 py-4">Cán bộ</th>
                  <th class="px-6 py-4 text-center">Việc</th>
                  <th class="px-6 py-4 text-center">Quan trọng</th>
                  <th class="px-6 py-4 text-center">Quá hạn</th>
                  <th class="px-6 py-4 text-center">Đang làm</th>
                  <th class="px-6 py-4 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700/70">
                ${statsList.length === 0 ? `
                  <tr>
                    <td colspan="6" class="px-6 py-12 text-center text-slate-400 text-xs">
                      Không tìm thấy cán bộ nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ` : statsList.map(s => {
                  const u = s.user;
                  const roleTag = u.role === 'director' ? 'BGD' : u.role === 'admin' ? 'Admin' : u.role === 'manager' ? 'Trưởng phòng' : 'Nhân viên';
                  const tagColor = u.role === 'director' ? 'bg-amber-100 text-amber-900' : u.role === 'admin' ? 'bg-purple-100 text-purple-900' : u.role === 'manager' ? 'bg-blue-100 text-blue-900' : 'bg-emerald-100 text-emerald-900';

                  return `
                    <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition cursor-pointer group" onclick="Tasks.openPersonnelWorkloadModal(${u.id})">
                      <!-- Column 1: Cán bộ -->
                      <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                          <div class="w-9 h-9 rounded-xl ${u.role === 'director' ? 'bg-amber-100 text-amber-800' : u.role === 'admin' ? 'bg-purple-100 text-purple-800' : u.role === 'manager' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'} font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                            ${u.full_name.split(' ').pop()[0]}
                          </div>
                          <div>
                            <div class="font-bold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition flex items-center gap-2">
                              <span>${u.full_name}</span>
                              <span class="text-[9px] px-1.5 py-0.2 rounded font-bold ${tagColor}">${roleTag}</span>
                            </div>
                            <div class="text-[11px] text-slate-400">${u.position || roleTag} • ${u.department_name || 'Ban Giám đốc'}</div>
                          </div>
                        </div>
                      </td>

                      <!-- Column 2: Việc -->
                      <td class="px-6 py-4 text-center">
                        <span class="font-mono font-extrabold text-sm ${s.total > 0 ? 'text-slate-800 dark:text-white' : 'text-slate-400'}">
                          ${s.total}
                        </span>
                      </td>

                      <!-- Column 3: Quan trọng -->
                      <td class="px-6 py-4 text-center">
                        ${s.important > 0 ? `
                          <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono">
                            ${s.important}
                          </span>
                        ` : `
                          <span class="font-mono text-slate-400 text-xs">0</span>
                        `}
                      </td>

                      <!-- Column 4: Quá hạn -->
                      <td class="px-6 py-4 text-center">
                        ${s.overdue > 0 ? `
                          <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-black bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-mono shadow-2xs">
                            ${s.overdue}
                          </span>
                        ` : `
                          <span class="font-mono text-slate-400 text-xs">0</span>
                        `}
                      </td>

                      <!-- Column 5: Đang làm -->
                      <td class="px-6 py-4 text-center">
                        <div class="flex items-center justify-center gap-2">
                          <span class="font-mono font-bold text-xs ${s.inProgress > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}">
                            ${s.inProgress}
                          </span>
                          ${s.total > 0 ? `
                            <div class="w-12 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 hidden sm:block overflow-hidden" title="Tiến độ TB: ${s.avgProgress}%">
                              <div class="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full" style="width: ${s.avgProgress}%"></div>
                            </div>
                          ` : ''}
                        </div>
                      </td>

                      <!-- Column 6: Status Dot & Actions -->
                      <td class="px-6 py-4 text-right">
                        <div class="flex items-center justify-end gap-3">
                          <span class="w-3.5 h-3.5 rounded-full ${s.statusDot} shrink-0 inline-block" title="${s.statusTooltip}"></span>
                          <button onclick="event.stopPropagation(); Tasks.openPersonnelWorkloadModal(${u.id})" class="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition" title="Xem chi tiết danh sách công việc của cán bộ này">
                            <i class="ph-bold ph-list-checks text-base"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  // Modal: Detail tasks of a specific personnel
  openPersonnelWorkloadModal(userId) {
    const user = this.cachedUsers.find(u => u.id === userId);
    if (!user) return;

    const assignedTasks = this.cachedTasks.filter(t => 
      t.assignees && t.assignees.some(a => a.id === userId)
    );

    const modalContainer = document.getElementById('modal-container');
    const roleTag = user.role === 'director' ? 'BGD' : user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Trưởng phòng' : 'Nhân viên';

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-700">
          <div class="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold flex items-center justify-center text-sm shadow-2xs">
                ${user.full_name.split(' ').pop()[0]}
              </div>
              <div>
                <h3 class="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  <span>${user.full_name}</span>
                  <span class="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">${roleTag}</span>
                </h3>
                <p class="text-xs text-slate-400">${user.position || roleTag} • ${user.department_name || 'Ban Giám đốc'}</p>
              </div>
            </div>
            <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700">
              <i class="ph-bold ph-x text-lg"></i>
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div class="flex items-center justify-between">
              <div class="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Danh sách công việc đang phụ trách (${assignedTasks.length} việc)
              </div>
            </div>

            ${assignedTasks.length === 0 ? `
              <div class="text-center py-12 text-slate-400 text-xs">
                <i class="ph-bold ph-check-circle text-4xl text-emerald-500 mb-2"></i>
                <p class="font-bold text-slate-600 dark:text-slate-300">Hiện không có công việc nào đang được giao cho cán bộ này.</p>
              </div>
            ` : `
              <div class="space-y-2.5">
                ${assignedTasks.map(t => `
                  <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 flex items-center justify-between gap-4">
                    <div class="space-y-1 min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="priority-${t.priority} px-2 py-0.5 rounded text-[10px] font-bold uppercase">${t.priority}</span>
                        <h4 class="font-bold text-xs text-slate-800 dark:text-white truncate">${t.title}</h4>
                      </div>
                      <div class="flex items-center gap-3 text-[11px] text-slate-400">
                        <span>Hạn chót: <b class="${t.status === 'overdue' ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'} font-mono">${t.due_date}</b></span>
                        <span>•</span>
                        <span>Trạng thái: <b>${t.status}</b></span>
                      </div>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                      <div class="text-right">
                        <span class="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">${t.progress}%</span>
                        <div class="w-16 bg-slate-200 dark:bg-slate-600 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div class="bg-emerald-600 h-full rounded-full" style="width: ${t.progress}%"></div>
                        </div>
                      </div>
                      <button onclick="App.closeModal(); Tasks.openProgressModal(${t.id}, ${t.progress})" class="p-2 bg-white dark:bg-slate-800 text-emerald-600 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-emerald-50 text-xs font-bold" title="Cập nhật tiến độ">
                        <i class="ph-bold ph-gauge"></i>
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  },

  // Modal: Open Create Task
  openCreateModal() {
    const modalContainer = document.getElementById('modal-container');
    const today = new Date().toISOString().split('T')[0];
    const defaultDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();
    const myDeptId = Auth.user.department_id || 1;
    const defaultDeptId = isDirectorOrAdmin ? (this.cachedDepartments[0]?.id || 1) : myDeptId;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-700">
          <div class="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10">
            <h3 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <i class="ph-bold ph-plus-circle text-emerald-600"></i> Tạo công việc mới
            </h3>
            <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700">
              <i class="ph-bold ph-x text-lg"></i>
            </button>
          </div>

          <form onsubmit="Tasks.submitCreateTask(event)" class="p-6 space-y-4">
            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Tên công việc <span class="text-red-500">*</span></label>
              <input type="text" id="task-title" required placeholder="VD: Xây dựng báo cáo chuyên đề chuyển đổi số quý 3..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white">
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Mô tả chi tiết</label>
              <textarea id="task-desc" rows="3" placeholder="Nêu rõ yêu cầu, đầu ra cần đạt..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white"></textarea>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Phòng ban phụ trách <span class="text-red-500">*</span>
                  ${!isDirectorOrAdmin ? '<span class="text-emerald-600 dark:text-emerald-400 font-normal lowercase">(Cố định phòng của bạn)</span>' : '<span class="text-amber-600 dark:text-amber-400 font-normal lowercase">(BGD có quyền chọn mọi phòng)</span>'}
                </label>
                ${isDirectorOrAdmin ? `
                  <select id="task-dept" required onchange="Tasks.updateCreateModalAssignees(this.value)" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white font-medium">
                    ${this.cachedDepartments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('')}
                  </select>
                ` : `
                  <select id="task-dept-display" disabled class="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-slate-300 cursor-not-allowed font-bold">
                    ${this.cachedDepartments.filter(d => d.id === myDeptId).map(d => `<option value="${d.id}" selected>${d.name} (${d.code})</option>`).join('')}
                  </select>
                  <input type="hidden" id="task-dept" value="${myDeptId}">
                `}
              </div>

              <div>
                <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Mức độ ưu tiên</label>
                <select id="task-priority" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white">
                  <option value="medium" selected>🔵 Trung bình</option>
                  <option value="high">🟠 Cao</option>
                  <option value="urgent">🔴 Khẩn cấp</option>
                  <option value="low">🟢 Thấp</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Ngày bắt đầu <span class="text-red-500">*</span></label>
                <input type="date" id="task-start-date" value="${today}" required class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white">
              </div>

              <div>
                <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Hạn chót (Deadline) <span class="text-red-500">*</span></label>
                <input type="date" id="task-due-date" value="${defaultDue}" required class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white">
              </div>
            </div>

            <!-- Multi-assignee selection -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-xs font-bold uppercase text-slate-500">Nhân sự thực hiện (Người phụ trách chính & Phối hợp)</label>
                <span class="text-[11px] text-slate-400">Người chọn đầu tiên là Phụ trách chính</span>
              </div>
              <div id="task-assignees-container" class="p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl max-h-56 overflow-y-auto space-y-2">
                ${this.renderAssigneeCheckboxes(defaultDeptId)}
              </div>
            </div>

            <!-- Submit buttons -->
            <div class="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button type="button" onclick="App.closeModal()" class="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-sm transition">
                Hủy bỏ
              </button>
              <button type="submit" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm shadow-sm transition">
                Tạo công việc
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  renderAssigneeCheckboxes(selectedDeptId) {
    const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();

    // 1. Trường hợp là Trưởng phòng hoặc Nhân viên: CHỈ ĐƯỢC CHỌN NHÂN SỰ CỦA PHÒNG MÌNH
    if (!isDirectorOrAdmin) {
      const myDeptId = Auth.user.department_id;
      const dept = this.cachedDepartments.find(d => d.id === myDeptId);
      const deptName = dept ? dept.name : (Auth.user.department_name || 'Phòng ban');
      const usersInDept = this.cachedUsers.filter(u => u.department_id === myDeptId);

      return `
        <div class="p-2.5 mb-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
          <i class="ph-bold ph-shield-check text-base text-emerald-600 shrink-0"></i>
          <span><b>Quyền Trưởng phòng:</b> Bạn chỉ được phân công nhân sự thuộc <b>${deptName}</b>.</span>
        </div>

        ${usersInDept.length > 0 ? `
          <div class="space-y-1.5">
            ${usersInDept.map(u => `
              <label class="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 rounded-xl hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 cursor-pointer border border-slate-200 dark:border-slate-700 transition">
                <div class="flex items-center gap-3">
                  <input type="checkbox" name="task_assignees" value="${u.id}" class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer">
                  <div>
                    <div class="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      ${u.full_name}
                      ${u.id === Auth.user.id ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold">Bạn</span>' : ''}
                    </div>
                    <div class="text-xs text-slate-400 font-medium">${u.position || 'Nhân viên'} • ${u.department_code || ''}</div>
                  </div>
                </div>
                <span class="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">Giao việc</span>
              </label>
            `).join('')}
          </div>
        ` : `
          <div class="p-4 text-center text-xs text-slate-400">Chưa có cán bộ nào khác trong phòng.</div>
        `}
      `;
    }

    // 2. Trường hợp là Ban Giám đốc hoặc Admin: ĐƯỢC PHÉP CHỌN HẾT NHÂN SỰ TOÀN TRƯỜNG
    const deptId = parseInt(selectedDeptId) || 1;
    const currentDept = this.cachedDepartments.find(d => d.id === deptId);
    const deptName = currentDept ? currentDept.name : 'Phòng được chọn';
    const usersInDept = this.cachedUsers.filter(u => u.department_id === deptId);
    const otherUsers = this.cachedUsers.filter(u => u.department_id !== deptId);

    return `
      <div class="p-2.5 mb-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
        <i class="ph-bold ph-crown text-base text-amber-600 shrink-0"></i>
        <span><b>Quyền Ban Giám đốc:</b> Được phép chỉ đạo & chọn tất cả cán bộ nhân sự trong toàn trường.</span>
      </div>

      ${usersInDept.length > 0 ? `
        <div class="text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase mb-1.5 flex items-center gap-1.5 mt-2">
          <i class="ph-bold ph-buildings"></i> Cán bộ thuộc ${deptName} (Chủ trì chính):
        </div>
        <div class="space-y-1.5 mb-3">
          ${usersInDept.map(u => `
            <label class="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 rounded-xl hover:bg-amber-50/60 dark:hover:bg-amber-950/30 cursor-pointer border border-amber-200 dark:border-slate-700 transition">
              <div class="flex items-center gap-3">
                <input type="checkbox" name="task_assignees" value="${u.id}" class="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer">
                <div>
                  <div class="text-sm font-bold text-slate-800 dark:text-white">${u.full_name}</div>
                  <div class="text-xs text-slate-400">${u.position || 'Cán bộ'} • ${u.department_code || ''}</div>
                </div>
              </div>
              <span class="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">Chủ trì</span>
            </label>
          `).join('')}
        </div>
      ` : ''}

      ${otherUsers.length > 0 ? `
        <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 flex items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
          <i class="ph-bold ph-users"></i> Toàn thể cán bộ các phòng ban khác trong trường (Phối hợp):
        </div>
        <div class="space-y-1.5">
          ${otherUsers.map(u => `
            <label class="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer border border-slate-200 dark:border-slate-700 transition opacity-90">
              <div class="flex items-center gap-3">
                <input type="checkbox" name="task_assignees" value="${u.id}" class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer">
                <div>
                  <div class="text-sm font-bold text-slate-800 dark:text-white">${u.full_name}</div>
                  <div class="text-xs text-slate-400">${u.position || 'Cán bộ'} • ${u.department_name || u.department_code || ''}</div>
                </div>
              </div>
              <span class="text-xs text-slate-500 font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700">Phối hợp</span>
            </label>
          `).join('')}
        </div>
      ` : ''}
    `;
  },

  updateCreateModalAssignees(deptId) {
    const container = document.getElementById('task-assignees-container');
    if (container) {
      container.innerHTML = this.renderAssigneeCheckboxes(deptId);
    }
  },

  async submitCreateTask(e) {
    e.preventDefault();
    try {
      const title = document.getElementById('task-title').value;
      const description = document.getElementById('task-desc').value;
      const deptEl = document.getElementById('task-dept');
      const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();
      const department_id = isDirectorOrAdmin 
        ? (deptEl ? parseInt(deptEl.value) : 1)
        : (Auth.user.department_id || 1);

      const priority = document.getElementById('task-priority').value;
      const start_date = document.getElementById('task-start-date').value;
      const due_date = document.getElementById('task-due-date').value;

      const checkedAssignees = Array.from(document.querySelectorAll('input[name="task_assignees"]:checked')).map((input, idx) => ({
        user_id: parseInt(input.value),
        is_leader: idx === 0 ? 1 : 0
      }));

      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          department_id,
          priority,
          start_date,
          due_date,
          assignees: checkedAssignees
        })
      });

      App.showToast('Tạo công việc thành công!', 'success');
      App.closeModal();
      this.loadTasks();
    } catch (err) {
      alert(err.message);
    }
  },

  formatDateDisplay(dateStr) {
    if (!dateStr) return '--';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        const parts = String(dateStr).split('T')[0].split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dateStr;
      }
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateStr;
    }
  },

  async completeTask(taskId, reopen = false) {
    const actionText = reopen ? 'mở lại công việc này để tiếp tục thực hiện' : 'xác nhận hoàn thành 100% công việc này';
    if (!confirm(`Bạn có chắc chắn muốn ${actionText}?`)) return;

    try {
      const newProgress = reopen ? 50 : 100;
      const newStatus = reopen ? 'in_progress' : 'completed';
      const note = reopen ? 'Đã mở lại công việc để tiếp tục thực hiện.' : 'Đã báo cáo & xác nhận hoàn thành công việc 100%.';

      await apiFetch(`/api/tasks/${taskId}/progress`, {
        method: 'PUT',
        body: JSON.stringify({
          progress: newProgress,
          status: newStatus,
          note: note,
          log_date: new Date().toISOString().split('T')[0]
        })
      });

      if (window.showToast) {
        showToast('success', reopen ? 'Đã mở lại công việc thành công!' : 'Đã hoàn thành công việc 100%! 🎉');
      } else {
        App.showToast(reopen ? 'Đã mở lại công việc thành công!' : 'Đã hoàn thành công việc 100%! 🎉', 'success');
      }

      App.closeModal();
      this.loadTasks();
    } catch (err) {
      alert('Lỗi cập nhật trạng thái: ' + err.message);
    }
  },

  openProgressModal(taskId, currentProgress) {
    const modalContainer = document.getElementById('modal-container');
    const today = new Date().toISOString().split('T')[0];

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80">
            <h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <i class="ph-bold ph-gauge text-emerald-600"></i> Cập nhật tiến độ & Nhật ký
            </h3>
            <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700">
              <i class="ph-bold ph-x text-lg"></i>
            </button>
          </div>

          <form onsubmit="Tasks.submitProgressUpdate(event, ${taskId})" class="p-6 space-y-4">
            <div>
              <div class="flex justify-between items-center mb-2">
                <label class="text-xs font-bold uppercase text-slate-500">Mức độ hoàn thành</label>
                <span id="progress-val-display" class="text-lg font-black text-emerald-600">${currentProgress}%</span>
              </div>
              <input type="range" id="progress-slider" min="0" max="100" step="5" value="${currentProgress}" oninput="document.getElementById('progress-val-display').innerText = this.value + '%'" class="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600">
              
              <!-- Quick Progress Chips -->
              <div class="flex items-center justify-between gap-1.5 mt-2.5">
                <button type="button" onclick="document.getElementById('progress-slider').value=25; document.getElementById('progress-val-display').innerText='25%'" class="px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-lg transition">25%</button>
                <button type="button" onclick="document.getElementById('progress-slider').value=50; document.getElementById('progress-val-display').innerText='50%'" class="px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-lg transition">50%</button>
                <button type="button" onclick="document.getElementById('progress-slider').value=75; document.getElementById('progress-val-display').innerText='75%'" class="px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-lg transition">75%</button>
                <button type="button" onclick="document.getElementById('progress-slider').value=100; document.getElementById('progress-val-display').innerText='100%'" class="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 text-emerald-800 dark:text-emerald-300 text-[11px] font-extrabold rounded-lg transition flex items-center gap-1 border border-emerald-300">
                  <i class="ph-bold ph-check"></i> 100% Xong
                </button>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Ngày ghi nhận</label>
              <input type="date" id="log-date" value="${today}" class="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white font-medium">
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Ghi chú công việc đã làm / Kết quả đạt được</label>
              <textarea id="log-note" rows="3" placeholder="Nêu rõ nội dung đã xử lý, tài liệu đính kèm hoặc kết quả công việc..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white"></textarea>
            </div>

            <div class="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2.5">
              <button type="button" onclick="App.closeModal()" class="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs">Hủy</button>
              <button type="submit" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5">
                <i class="ph-bold ph-floppy-disk text-base"></i> Lưu Tiến Độ
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitProgressUpdate(e, taskId) {
    e.preventDefault();
    const progress = parseInt(document.getElementById('progress-slider').value);
    const log_date = document.getElementById('log-date').value;
    const note = document.getElementById('log-note').value;
    const status = progress === 100 ? 'completed' : (progress > 0 ? 'in_progress' : 'pending');

    try {
      await apiFetch(`/api/tasks/${taskId}/progress`, {
        method: 'PUT',
        body: JSON.stringify({ progress, status, log_date, note })
      });

      if (window.showToast) {
        showToast('success', progress === 100 ? 'Đã hoàn thành công việc 100%! 🎉' : 'Cập nhật tiến độ thành công!');
      } else {
        App.showToast('Cập nhật tiến độ thành công!', 'success');
      }

      App.closeModal();
      this.loadTasks();
    } catch (err) {
      alert(err.message);
    }
  },

  async viewTaskDetails(taskId) {
    try {
      const task = await apiFetch(`/api/tasks/${taskId}`);
      const modalContainer = document.getElementById('modal-container');

      const isCreator = (task.created_by == Auth.user.id);
      const isAssignee = task.assignees && task.assignees.some(a => a.id == Auth.user.id);
      const canManage = isCreator || isAssignee || Auth.isManager() || Auth.isDirector() || Auth.isAdmin();

      const priorityLabels = {
        urgent: '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">🔴 Khẩn cấp</span>',
        high: '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">🟠 Cao</span>',
        medium: '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">🔵 Trung bình</span>',
        low: '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">🟢 Thấp</span>'
      };

      const statusLabels = {
        completed: '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">✅ Hoàn thành</span>',
        in_progress: '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">⏳ Đang thực hiện</span>',
        pending: '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">⏸️ Chưa bắt đầu</span>',
        overdue: '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">⚠️ Quá hạn</span>'
      };

      modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col">
            
            <!-- Top Header -->
            <div class="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10">
              <div>
                <span class="text-xs font-mono font-bold text-emerald-600">${task.department_name}</span>
                <h3 class="text-xl font-bold text-slate-800 dark:text-white mt-0.5">${task.title}</h3>
                ${task.creator_name ? `<p class="text-[11px] text-slate-400 mt-0.5">Người giao việc: <b>${task.creator_name}</b></p>` : ''}
              </div>
              <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700">
                <i class="ph-bold ph-x text-lg"></i>
              </button>
            </div>

            <div class="p-6 space-y-6 flex-1">
              <!-- Meta Row -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div class="text-[10px] text-slate-400 font-bold uppercase">Mức ưu tiên</div>
                  <div class="mt-1">${priorityLabels[task.priority] || task.priority}</div>
                </div>
                <div class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div class="text-[10px] text-slate-400 font-bold uppercase">Trạng thái</div>
                  <div class="mt-1">${statusLabels[task.status] || task.status}</div>
                </div>
                <div class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div class="text-[10px] text-slate-400 font-bold uppercase">Ngày bắt đầu</div>
                  <div class="font-bold text-xs mt-1 font-mono text-slate-800 dark:text-slate-200">${this.formatDateDisplay(task.start_date)}</div>
                </div>
                <div class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div class="text-[10px] text-slate-400 font-bold uppercase">Hạn chót</div>
                  <div class="font-bold text-xs mt-1 font-mono ${task.status === 'overdue' ? 'text-rose-500' : 'text-slate-800 dark:text-slate-200'}">${this.formatDateDisplay(task.due_date)}</div>
                </div>
              </div>

              <!-- Progress Bar Section -->
              <div class="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-slate-800 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 space-y-2">
                <div class="flex items-center justify-between text-xs font-bold">
                  <span class="text-slate-700 dark:text-slate-300">Tiến độ thực hiện hiện tại:</span>
                  <span class="text-emerald-700 dark:text-emerald-400 font-black text-sm">${task.progress || 0}%</span>
                </div>
                <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden shadow-inner">
                  <div class="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-300" style="width: ${task.progress || 0}%"></div>
                </div>
              </div>

              <!-- Description -->
              <div>
                <h4 class="text-xs font-bold uppercase text-slate-400 mb-1">Mô tả yêu cầu</h4>
                <p class="text-sm text-slate-700 dark:text-slate-300 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-700 whitespace-pre-line leading-relaxed">
                  ${task.description || 'Không có mô tả chi tiết.'}
                </p>
              </div>

              <!-- Assignees -->
              <div>
                <h4 class="text-xs font-bold uppercase text-slate-400 mb-2">Nhân sự thực hiện (${task.assignees ? task.assignees.length : 0})</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  ${(task.assignees || []).map(a => `
                    <div class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-700 font-bold text-xs flex items-center justify-center shadow-2xs">
                          ${a.full_name.split(' ').pop()[0]}
                        </div>
                        <div>
                          <div class="text-xs font-bold text-slate-800 dark:text-white">${a.full_name}</div>
                          <div class="text-[10px] text-slate-400">${a.position || a.role}</div>
                        </div>
                      </div>
                      ${a.is_leader ? '<span class="text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-md">Phụ trách chính</span>' : '<span class="text-[10px] text-slate-400 font-medium">Phối hợp</span>'}
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Progress Logs History -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-xs font-bold uppercase text-slate-400">Nhật ký cập nhật tiến độ (${task.logs ? task.logs.length : 0})</h4>
                  ${canManage ? `
                    <button onclick="Tasks.openProgressModal(${task.id}, ${task.progress})" class="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 transition">
                      <i class="ph-bold ph-plus"></i> Ghi nhận tiến độ mới
                    </button>
                  ` : ''}
                </div>
                <div class="space-y-2 max-h-48 overflow-y-auto">
                  ${(task.logs || []).length === 0 ? `
                    <div class="text-xs text-slate-400 italic p-3.5 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-200 dark:border-slate-700">Chưa có nhật ký ghi nhận.</div>
                  ` : (task.logs || []).map(l => `
                    <div class="p-3 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                      <div class="flex items-center justify-between text-slate-400">
                        <span class="font-bold text-slate-700 dark:text-slate-200">${l.user_name}</span>
                        <span class="font-mono text-[10px]">${this.formatDateDisplay(l.log_date)} (${l.progress_percent}%)</span>
                      </div>
                      <p class="text-slate-600 dark:text-slate-300">${l.note}</p>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <!-- Modal Action Footer -->
            <div class="p-5 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/80 shrink-0">
              <div>
                ${task.status === 'completed' ? `
                  <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-xs border border-emerald-300 dark:border-emerald-800">
                    <i class="ph-bold ph-check-circle text-base"></i> Đã hoàn thành 100%
                  </span>
                ` : `
                  <span class="text-xs text-slate-500">
                    Trạng thái: <b class="text-slate-800 dark:text-white uppercase">${task.status}</b>
                  </span>
                `}
              </div>

              <div class="flex flex-wrap items-center gap-2.5">
                <button onclick="App.closeModal()" class="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition">
                  Đóng
                </button>
                
                ${canManage ? `
                  <button onclick="Tasks.openProgressModal(${task.id}, ${task.progress})" class="px-3.5 py-2 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold rounded-xl text-xs border border-blue-200 dark:border-blue-800 transition flex items-center gap-1.5">
                    <i class="ph-bold ph-gauge text-base"></i> Ghi tiến độ
                  </button>
                  
                  ${task.status === 'completed' ? `
                    <button onclick="Tasks.completeTask(${task.id}, true)" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5">
                      <i class="ph-bold ph-arrow-counter-clockwise text-base"></i> Mở lại công việc
                    </button>
                  ` : `
                    <button onclick="Tasks.completeTask(${task.id}, false)" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5">
                      <i class="ph-bold ph-check-circle text-base"></i> Báo cáo Hoàn Thành (100%)
                    </button>
                  `}
                ` : ''}
              </div>
            </div>

          </div>
        </div>
      `;
    } catch (err) {
      alert(err.message);
    }
  },

  async deleteTask(taskId) {
    if (!confirm('Bạn có chắc chắn muốn xóa công việc này?')) return;
    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      App.showToast('Đã xóa công việc thành công', 'success');
      this.loadTasks();
    } catch (err) {
      alert(err.message);
    }
  }
};
