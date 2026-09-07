// Dashboard Module (Modern Dual-Scope View: Toàn Trường vs Riêng Phòng)
// Tích hợp đồng bộ toàn bộ Công việc giao phòng & Nhật ký cá nhân tự kê khai
// Trường Đào tạo cán bộ Agribank
const Dashboard = {
  viewScope: 'school', // 'school' | 'department'
  selectedDeptId: 1,
  cachedDepartments: [],
  currentTableTab: 'tasks', // 'tasks' | 'personal_logs'
  personalLogFilterStatus: 'all', // 'all' | 'in_progress' | 'completed'
  personalLogFilterMember: 'all',
  personalLogSearchQuery: '',
  cachedDeptTasks: [],
  cachedDeptLogs: [],
  cachedSchoolLogs: [],
  cachedDeptMembers: [],
  cachedActiveDept: null,
  primaryChartInstance: null,
  statusChartInstance: null,

  async render() {
    const container = document.getElementById('main-content');
    if (!container) return;

    if (this.cachedDepartments.length === 0) {
      try {
        this.cachedDepartments = await apiFetch('/api/departments');
      } catch (e) {
        console.warn(e);
      }
    }

    const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();

    // Trưởng phòng & Nhân viên: CỐ ĐỊNH CHỈ ĐƯỢC XEM TRONG PHÒNG CỦA MÌNH
    if (!isDirectorOrAdmin) {
      this.viewScope = 'department';
      if (Auth.user && Auth.user.department_id) {
        this.selectedDeptId = Auth.user.department_id;
      }
    }

    const activeDept = this.cachedDepartments.find(d => d.id == this.selectedDeptId) || (this.cachedDepartments.length > 0 ? this.cachedDepartments[0] : null);
    const rawDeptName = activeDept ? activeDept.name : (Auth.user && Auth.user.department_name ? Auth.user.department_name : '');
    const cleanDeptName = rawDeptName.startsWith('Phòng') ? rawDeptName : ('Phòng ' + rawDeptName);
    this.cachedActiveDept = activeDept;

    container.innerHTML = `
      <div class="space-y-6">
        
        <!-- 1. BẢNG TIN HOẠT ĐỘNG & THÔNG BÁO NỘI BỘ (HIỂN THỊ ĐẦU TIÊN TRONG TRANG) -->
        <div id="dashboard-bulletin-board"></div>
        
        <!-- Header & Scope Switcher Banner -->
        <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
              <span class="p-2 bg-emerald-50 dark:bg-emerald-900/40 text-[#005d39] dark:text-emerald-400 rounded-xl">
                <i class="ph-bold ph-chart-polar text-2xl"></i>
              </span>
              Dashboard Tổng Quan
            </h1>
            <p id="scope-title-text" class="text-sm text-slate-500 dark:text-slate-400 mt-1">
              ${this.viewScope === 'school'
                ? 'Đang xem: <b>Toàn Trường Đào tạo cán bộ Agribank</b> (Tổng hợp 5 Phòng Ban)'
                : `Đang xem: <b>${cleanDeptName}</b> (${activeDept ? activeDept.code : ''})`}
            </p>
          </div>

          <!-- Controls: Dual Scope Buttons & Dept Picker (Chỉ hiển thị cho Ban Giám đốc & Admin) -->
          <div class="flex flex-wrap items-center gap-3">
            ${isDirectorOrAdmin ? `
              <div class="bg-slate-100 dark:bg-slate-700 p-1 rounded-xl flex items-center shadow-inner">
                <button onclick="Dashboard.switchScope('school')" id="btn-scope-school" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${this.viewScope === 'school' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}">
                  🏛️ Toàn Trường
                </button>
                <button onclick="Dashboard.switchScope('department')" id="btn-scope-department" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${this.viewScope === 'department' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}">
                  🏢 Riêng Phòng Ban
                </button>
              </div>

              <!-- Dept Selector Dropdown -->
              <div id="dept-selector-wrapper" class="${this.viewScope === 'department' ? 'block' : 'hidden'}">
                <select id="select-active-dept" onchange="Dashboard.switchDepartment(this.value)" class="px-3 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#005d39]">
                  ${this.cachedDepartments.map(d => `<option value="${d.id}" ${this.selectedDeptId == d.id ? 'selected' : ''}>${d.name} (${d.code})</option>`).join('')}
                </select>
              </div>
            ` : `
              <!-- Huy hiệu cố định phòng ban cho Trưởng phòng & Nhân viên -->
              <div class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[#005d39] dark:text-emerald-400 text-xs font-bold shadow-sm">
                <i class="ph-bold ph-buildings text-sm"></i>
                <span>Phòng phụ trách: <b>${cleanDeptName}</b></span>
              </div>
            `}

            <!-- Refresh Button -->
            <button onclick="Dashboard.refresh()" class="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition shadow-sm" title="Làm mới dữ liệu">
              <i class="ph-bold ph-arrows-clockwise text-lg"></i>
            </button>
          </div>
        </div>

        <!-- 4 Top KPI Cards -->
        <div id="dashboard-kpi-cards" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse h-32"></div>
          <div class="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse h-32"></div>
          <div class="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse h-32"></div>
          <div class="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse h-32"></div>
        </div>

        <!-- Visual Analytics Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <!-- Primary Chart (Left 2 cols) -->
          <div class="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2" id="primary-chart-title">
                  <i class="ph-bold ph-chart-bar text-emerald-600"></i> Khối lượng & Tiến độ 5 Phòng Ban
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5" id="primary-chart-subtitle">
                  Kế toán • Tổng hợp • QLĐT & Thư viện • Kế hoạch • Nghiên cứu - Giảng dạy
                </p>
              </div>
            </div>
            <div class="h-72 w-full">
              <canvas id="primaryComparisonChart"></canvas>
            </div>
          </div>

          <!-- Status Distribution Doughnut Chart (Right 1 col) -->
          <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
                <i class="ph-bold ph-chart-donut text-teal-600"></i> Phân bổ trạng thái
              </h3>
              <span id="status-donut-tag" class="text-[10px] uppercase font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                Toàn trường
              </span>
            </div>
            <div class="h-60 w-full relative flex items-center justify-center">
              <canvas id="statusDoughnutChart"></canvas>
            </div>
            <div class="mt-3 grid grid-cols-4 gap-1.5 text-center text-[10px]">
              <div class="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40">
                <span class="block font-bold text-[#005d39] dark:text-emerald-400">Hoàn thành</span>
              </div>
              <div class="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40">
                <span class="block font-bold text-[#c59b27] dark:text-amber-400">Đang làm</span>
              </div>
              <div class="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                <span class="block font-bold text-slate-600 dark:text-slate-300">Chưa làm</span>
              </div>
              <div class="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40">
                <span class="block font-bold text-[#8b1d24] dark:text-rose-400">Trễ hạn</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Scope Detail Table Container -->
        <div id="dashboard-detail-container"></div>
      </div>
    `;

    await this.loadData();
  },

  switchScope(scope) {
    if (!Auth.isDirector() && !Auth.isAdmin()) {
      this.viewScope = 'department';
      this.selectedDeptId = Auth.user.department_id;
      return;
    }
    this.viewScope = scope;
    this.render();
  },

  switchDepartment(deptId) {
    if (!Auth.isDirector() && !Auth.isAdmin()) {
      this.selectedDeptId = Auth.user.department_id;
      return;
    }
    this.selectedDeptId = parseInt(deptId);
    this.loadData();
  },

  async refresh() {
    await this.loadData();
  },

  async loadData() {
    this.loadNews();
    try {
      const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();
      if (!isDirectorOrAdmin) {
        this.viewScope = 'department';
        if (Auth.user && Auth.user.department_id) {
          this.selectedDeptId = Auth.user.department_id;
        }
      }

      const isSchool = this.viewScope === 'school';
      const deptQuery = isSchool ? '' : `?department_id=${this.selectedDeptId}`;
      const activeDept = this.cachedDepartments.find(d => d.id == this.selectedDeptId) || this.cachedDepartments[0];
      const rawDeptName = activeDept ? activeDept.name : (Auth.user && Auth.user.department_name ? Auth.user.department_name : '');
      const cleanDeptName = rawDeptName.startsWith('Phòng') ? rawDeptName : ('Phòng ' + rawDeptName);
      this.cachedActiveDept = activeDept;

      // Update indicator text
      const scopeTitle = document.getElementById('scope-title-text');
      if (scopeTitle) {
        scopeTitle.innerHTML = isSchool
          ? 'Đang xem: <b>Toàn Trường Đào tạo cán bộ Agribank</b> (Tổng hợp 5 Phòng Ban)'
          : `Đang xem: <b>${cleanDeptName}</b> (${activeDept ? activeDept.code : ''})`;
      }

      if (isSchool) {
        const [stats, deptData, statusDist, schoolLogs] = await Promise.all([
          apiFetch('/api/dashboard/stats'),
          apiFetch('/api/dashboard/departments-comparison'),
          apiFetch('/api/dashboard/status-distribution'),
          apiFetch('/api/personal-logs')
        ]);

        this.cachedSchoolLogs = schoolLogs || [];
        this.renderSchoolKPICards(stats);
        this.renderSchoolPrimaryChart(deptData);
        this.renderStatusChart(statusDist, 'Toàn Trường');
        this.renderSchoolDeptTable(deptData, this.cachedSchoolLogs);
      } else {
        const [stats, memberData, statusDist, deptTasks, deptLogs] = await Promise.all([
          apiFetch(`/api/dashboard/stats${deptQuery}`),
          apiFetch(`/api/dashboard/department-members-comparison${deptQuery}`),
          apiFetch(`/api/dashboard/status-distribution${deptQuery}`),
          apiFetch(`/api/tasks${deptQuery}`),
          apiFetch(`/api/personal-logs${deptQuery}`)
        ]);

        this.cachedDeptTasks = deptTasks || [];
        this.cachedDeptLogs = deptLogs || [];
        this.cachedDeptMembers = memberData || [];

        this.renderDeptKPICards(stats, activeDept);
        this.renderDeptMemberChart(memberData, activeDept);
        this.renderStatusChart(statusDist, cleanDeptName);
        this.renderDeptDetailTable(this.cachedDeptTasks, activeDept, this.cachedDeptLogs);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  },

  // 1. School Mode KPIs
  renderSchoolKPICards(stats) {
    const metrics = stats.institute || {};
    const kpiContainer = document.getElementById('dashboard-kpi-cards');
    if (!kpiContainer) return;

    kpiContainer.innerHTML = `
      <!-- Total School Tasks: Agribank Green -->
      <div onclick="Dashboard.openTaskListModal('all')" class="p-6 bg-gradient-to-br from-[#005d39] to-[#00703c] text-white rounded-2xl shadow-sm relative overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all group" title="Bấm để xem danh sách tổng công việc">
        <div class="absolute -right-3 -bottom-3 text-white/10 group-hover:text-white/20 transition">
          <i class="ph ph-kanban text-8xl"></i>
        </div>
        <div class="relative z-10">
          <div class="flex items-center justify-between">
            <span class="text-xs uppercase tracking-wider font-bold text-emerald-100">Tổng việc Toàn Trường</span>
            <button onclick="event.stopPropagation(); Dashboard.openTaskListModal('all')" class="p-2 bg-white/20 hover:bg-white/30 rounded-xl backdrop-blur-md transition shadow-sm" title="Xem danh sách chi tiết"><i class="ph-bold ph-list-checks text-lg"></i></button>
          </div>
          <div class="mt-4 flex items-baseline gap-2">
            <span class="text-3xl font-extrabold">${metrics.total || 0}</span>
            <span class="text-xs text-emerald-100 font-semibold">đầu việc giao</span>
          </div>
          <div class="mt-2 text-xs text-emerald-100/90 flex items-center gap-1">
            <i class="ph ph-clock"></i> Đang làm: <b>${metrics.in_progress || 0}</b> | Tự kê khai: <b>${metrics.total_logs || 0} việc</b>
          </div>
        </div>
      </div>

      <!-- Completed Tasks -->
      <div onclick="Dashboard.openTaskListModal('completed')" class="p-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-[#005d39]/30 dark:border-emerald-600/40 shadow-sm relative overflow-hidden cursor-pointer hover:border-[#005d39] hover:shadow-lg hover:-translate-y-0.5 transition-all group" title="Bấm để xem danh sách việc đã hoàn thành">
        <div class="absolute -right-3 -bottom-3 text-[#005d39]/5 dark:text-white/5 group-hover:text-[#005d39]/10 transition">
          <i class="ph ph-check-circle text-8xl"></i>
        </div>
        <div class="relative z-10">
          <div class="flex items-center justify-between">
            <span class="text-xs uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400">Đã Hoàn Thành</span>
            <button onclick="event.stopPropagation(); Dashboard.openTaskListModal('completed')" class="p-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 rounded-xl text-[#005d39] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 transition shadow-sm" title="Xem danh sách việc hoàn thành"><i class="ph-bold ph-check-circle text-lg"></i></button>
          </div>
          <div class="mt-4 flex items-baseline gap-2">
            <span class="text-3xl font-black text-[#005d39] dark:text-emerald-400">${metrics.completed || 0}</span>
            <span class="text-xs font-bold text-emerald-700 dark:text-emerald-400">hoàn tất &rarr;</span>
          </div>
          <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <i class="ph-bold ph-percent text-[#005d39]"></i> Tiến độ TB: <b class="text-slate-700 dark:text-slate-200">${metrics.avg_progress || 0}%</b>
          </div>
        </div>
      </div>

      <!-- Overdue: Burgundy / Đỏ đô -->
      <div onclick="Dashboard.openTaskListModal('overdue')" class="p-6 bg-gradient-to-br from-[#7d181e] to-[#981b1e] text-white rounded-2xl shadow-sm relative overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all group" title="Bấm để xem danh sách việc trễ hạn">
        <div class="absolute -right-3 -bottom-3 text-white/10 group-hover:text-white/20 transition">
          <i class="ph ph-warning-circle text-8xl"></i>
        </div>
        <div class="relative z-10">
          <div class="flex items-center justify-between">
            <span class="text-xs uppercase tracking-wider font-bold text-rose-100">Cảnh Báo Trễ Hạn</span>
            <button onclick="event.stopPropagation(); Dashboard.openTaskListModal('overdue')" class="p-2 bg-white/20 hover:bg-white/30 rounded-xl backdrop-blur-md transition shadow-sm" title="Xem danh sách việc trễ hạn"><i class="ph-bold ph-warning text-lg"></i></button>
          </div>
          <div class="mt-4 flex items-baseline gap-2">
            <span class="text-3xl font-extrabold">${metrics.overdue || 0}</span>
            <span class="text-xs text-rose-100 font-semibold">việc quá hạn &rarr;</span>
          </div>
          <div class="mt-2 text-xs text-rose-100/90 flex items-center gap-1">
            <i class="ph ph-bell-ringing"></i> Cần xử lý ngay
          </div>
        </div>
      </div>

      <!-- Total Self-Reported Logs & Work Hours: Gold / Vàng đồng -->
      <div onclick="Dashboard.openTaskListModal('personal_logs')" class="p-6 bg-gradient-to-br from-[#b3821a] via-[#c59b27] to-[#d4a838] text-white rounded-2xl shadow-sm relative overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all group" title="Bấm để xem danh sách nhật ký tự kê khai">
        <div class="absolute -right-3 -bottom-3 text-white/10 group-hover:text-white/20 transition">
          <i class="ph ph-calendar-check text-8xl"></i>
        </div>
        <div class="relative z-10">
          <div class="flex items-center justify-between">
            <span class="text-xs uppercase tracking-wider font-bold text-amber-50">Nhật Ký Cá Nhân Tự Kê Khai</span>
            <button onclick="event.stopPropagation(); Dashboard.openTaskListModal('personal_logs')" class="p-2 bg-white/20 hover:bg-white/30 rounded-xl backdrop-blur-md transition shadow-sm" title="Xem danh sách chi tiết tự kê khai"><i class="ph-bold ph-calendar-check text-lg"></i></button>
          </div>
          <div class="mt-4 flex items-baseline gap-2">
            <span class="text-3xl font-extrabold">${metrics.total_log_hours || 0}</span>
            <span class="text-xs text-amber-100 font-semibold">giờ công (${metrics.total_logs || 0} việc) &rarr;</span>
          </div>
          <div class="mt-2 text-xs text-amber-100/90 flex items-center gap-1">
            <i class="ph ph-user-check"></i> Đang làm: <b>${metrics.in_progress_logs || 0}</b> | Đã xong: <b>${metrics.completed_logs || 0}</b>
          </div>
        </div>
      </div>
    `;
  },

  // 2. Department Mode KPIs
  renderDeptKPICards(stats, dept) {
    const metrics = stats.department || {};
    const deptName = dept ? dept.name : 'Phòng ban';
    const kpiContainer = document.getElementById('dashboard-kpi-cards');
    if (!kpiContainer) return;

    kpiContainer.innerHTML = `
      <!-- Total Dept Tasks: Agribank Green -->
      <div onclick="Dashboard.openTaskListModal('all')" class="p-6 bg-gradient-to-br from-[#005d39] to-[#00703c] text-white rounded-2xl shadow-sm relative overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all group" title="Bấm để xem danh sách tổng việc phòng">
        <div class="absolute -right-3 -bottom-3 text-white/10 group-hover:text-white/20 transition">
          <i class="ph ph-buildings text-8xl"></i>
        </div>
        <div class="relative z-10">
          <div class="flex items-center justify-between">
            <span class="text-xs uppercase tracking-wider font-bold text-emerald-100">Việc giao: ${dept ? dept.code : ''}</span>
            <button onclick="event.stopPropagation(); Dashboard.openTaskListModal('all')" class="p-2 bg-white/20 hover:bg-white/30 rounded-xl backdrop-blur-md transition shadow-sm" title="Xem danh sách chi tiết"><i class="ph-bold ph-list-checks text-lg"></i></button>
          </div>
          <div class="mt-4 flex items-baseline gap-2">
            <span class="text-3xl font-extrabold">${metrics.total || 0}</span>
            <span class="text-xs text-emerald-100 font-semibold">đầu việc giao &rarr;</span>
          </div>
          <div class="mt-2 text-xs text-emerald-100/90 flex items-center gap-1 truncate" title="${deptName}">
            <i class="ph ph-clock"></i> Đang làm: <b>${metrics.in_progress || 0}</b> | Chưa bắt đầu: <b>${metrics.pending || 0}</b>
          </div>
        </div>
      </div>

      <!-- Completed: Clean White Card with Green Accents -->
      <div onclick="Dashboard.openTaskListModal('completed')" class="p-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-[#005d39]/30 dark:border-emerald-600/40 shadow-sm relative overflow-hidden cursor-pointer hover:border-[#005d39] hover:shadow-lg hover:-translate-y-0.5 transition-all group" title="Bấm để xem việc đã xong của phòng">
        <div class="absolute -right-3 -bottom-3 text-[#005d39]/5 dark:text-white/5 group-hover:text-[#005d39]/10 transition">
          <i class="ph ph-check-circle text-8xl"></i>
        </div>
        <div class="relative z-10">
          <div class="flex items-center justify-between">
            <span class="text-xs uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400">Đã Hoàn Tất</span>
            <button onclick="event.stopPropagation(); Dashboard.openTaskListModal('completed')" class="p-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 rounded-xl text-[#005d39] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 transition shadow-sm" title="Xem danh sách việc hoàn thành"><i class="ph-bold ph-check-circle text-lg"></i></button>
          </div>
          <div class="mt-4 flex items-baseline gap-2">
            <span class="text-3xl font-black text-[#005d39] dark:text-emerald-400">${metrics.completed || 0}</span>
            <span class="text-xs font-bold text-emerald-700 dark:text-emerald-400">việc xong &rarr;</span>
          </div>
          <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <i class="ph-bold ph-percent text-[#005d39]"></i> Tiến độ TB phòng: <b class="text-slate-700 dark:text-slate-200">${metrics.avg_progress || 0}%</b>
          </div>
        </div>
      </div>

      <!-- Overdue in Dept: Burgundy / Đỏ đô -->
      <div onclick="Dashboard.openTaskListModal('overdue')" class="p-6 bg-gradient-to-br from-[#7d181e] to-[#981b1e] text-white rounded-2xl shadow-sm relative overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all group" title="Bấm để xem việc quá hạn của phòng">
        <div class="absolute -right-3 -bottom-3 text-white/10 group-hover:text-white/20 transition">
          <i class="ph ph-warning-octagon text-8xl"></i>
        </div>
        <div class="relative z-10">
          <div class="flex items-center justify-between">
            <span class="text-xs uppercase tracking-wider font-bold text-rose-100">Việc Quá Hạn Phòng</span>
            <button onclick="event.stopPropagation(); Dashboard.openTaskListModal('overdue')" class="p-2 bg-white/20 hover:bg-white/30 rounded-xl backdrop-blur-md transition shadow-sm" title="Xem danh sách việc trễ hạn"><i class="ph-bold ph-warning text-lg"></i></button>
          </div>
          <div class="mt-4 flex items-baseline gap-2">
            <span class="text-3xl font-extrabold">${metrics.overdue || 0}</span>
            <span class="text-xs text-rose-100 font-semibold">việc trễ &rarr;</span>
          </div>
          <div class="mt-2 text-xs text-rose-100/90 flex items-center gap-1">
            <i class="ph ph-warning-circle"></i> Cần xử lý ngay
          </div>
        </div>
      </div>

      <!-- Self-Reported Logs in Dept: Gold / Vàng đồng -->
      <div onclick="Dashboard.openTaskListModal('personal_logs')" class="p-6 bg-gradient-to-br from-[#b3821a] via-[#c59b27] to-[#d4a838] text-white rounded-2xl shadow-sm relative overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all group" title="Bấm để xem danh sách kê khai của phòng">
        <div class="absolute -right-3 -bottom-3 text-white/10 group-hover:text-white/20 transition">
          <i class="ph ph-calendar-check text-8xl"></i>
        </div>
        <div class="relative z-10">
          <div class="flex items-center justify-between">
            <span class="text-xs uppercase tracking-wider font-bold text-amber-50">Cá Nhân Phòng Tự Kê Khai</span>
            <button onclick="event.stopPropagation(); Dashboard.openTaskListModal('personal_logs')" class="p-2 bg-white/20 hover:bg-white/30 rounded-xl backdrop-blur-md transition shadow-sm" title="Xem danh sách chi tiết tự kê khai"><i class="ph-bold ph-user-list text-lg"></i></button>
          </div>
          <div class="mt-4 flex items-baseline gap-2">
            <span class="text-3xl font-extrabold">${metrics.total_log_hours || 0}</span>
            <span class="text-xs text-amber-100 font-semibold">giờ (${metrics.total_logs || 0} việc) &rarr;</span>
          </div>
          <div class="mt-2 text-xs text-amber-100/90 flex items-center gap-1">
            <i class="ph ph-hourglass-high"></i> Đang làm: <b>${metrics.in_progress_logs || 0}</b> | Đã xong: <b>${metrics.completed_logs || 0}</b>
          </div>
        </div>
      </div>
    `;
  },

  // 3. School Mode Bar Chart (5 Departments comparison)
  renderSchoolPrimaryChart(deptData) {
    const titleEl = document.getElementById('primary-chart-title');
    const subTitleEl = document.getElementById('primary-chart-subtitle');
    if (titleEl) titleEl.innerHTML = `<i class="ph-bold ph-buildings text-emerald-600"></i> So sánh khối lượng việc giao & Nhật ký tự kê khai 5 Phòng Ban`;
    if (subTitleEl) subTitleEl.innerText = `Kế toán • Tổng hợp • QLĐT & Thư viện • Kế hoạch • Nghiên cứu - Giảng dạy`;

    const ctx = document.getElementById('primaryComparisonChart');
    if (!ctx) return;

    if (this.primaryChartInstance) {
      this.primaryChartInstance.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? '#334155' : '#f1f5f9';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const labels = deptData.map(d => `${d.code} (${d.name.split(' ').pop()})`);
    const totalData = deptData.map(d => d.total_tasks);
    const completedData = deptData.map(d => d.completed_tasks);
    const logHoursData = deptData.map(d => Math.round((d.total_log_hours || 0) / 8 * 10) / 10); // in workdays

    this.primaryChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Việc giao (đầu việc)',
            data: totalData,
            backgroundColor: '#005d39',
            borderRadius: 6
          },
          {
            label: 'Việc đã xong',
            data: completedData,
            backgroundColor: '#c59b27',
            borderRadius: 6
          },
          {
            label: 'Ngày công tự kê khai (ngày)',
            data: logHoursData,
            backgroundColor: '#2563eb',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, boxWidth: 12, font: { family: 'Plus Jakarta Sans', size: 11, weight: 'bold' } }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 } }, beginAtZero: true }
        }
      }
    });
  },

  // 4. Department Mode Bar Chart
  renderDeptMemberChart(memberData, dept) {
    const rawDeptName = dept ? dept.name : 'Phòng ban';
    const cleanDeptName = rawDeptName.startsWith('Phòng') ? rawDeptName : ('Phòng ' + rawDeptName);
    const titleEl = document.getElementById('primary-chart-title');
    const subTitleEl = document.getElementById('primary-chart-subtitle');
    if (titleEl) titleEl.innerHTML = `<i class="ph-bold ph-users text-[#005d39]"></i> Khối lượng công việc & Giờ công tự kê khai cán bộ: ${cleanDeptName}`;
    if (subTitleEl) subTitleEl.innerText = `Theo dõi tiến độ việc giao & số giờ công thực tế từng nhân sự tự ghi nhận`;

    const ctx = document.getElementById('primaryComparisonChart');
    if (!ctx) return;

    if (this.primaryChartInstance) {
      this.primaryChartInstance.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? '#334155' : '#f1f5f9';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const labels = memberData.map(m => m.full_name);
    const totalTasks = memberData.map(m => m.total_tasks || 0);
    const completedTasks = memberData.map(m => m.completed_tasks || 0);
    const logHours = memberData.map(m => m.total_log_hours || 0);

    this.primaryChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Việc giao (đầu việc)',
            data: totalTasks,
            backgroundColor: '#005d39',
            borderRadius: 6
          },
          {
            label: 'Việc đã xong',
            data: completedTasks,
            backgroundColor: '#c59b27',
            borderRadius: 6
          },
          {
            label: 'Giờ công tự kê khai (giờ)',
            data: logHours,
            backgroundColor: '#2563eb',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, boxWidth: 12, font: { family: 'Plus Jakarta Sans', size: 11, weight: 'bold' } }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor } },
          y: { grid: { color: gridColor }, ticks: { color: textColor }, beginAtZero: true }
        }
      }
    });
  },

  // 5. Status Doughnut Chart
  renderStatusChart(statusDist, tagText) {
    const donutTag = document.getElementById('status-donut-tag');
    if (donutTag && tagText) donutTag.innerText = tagText;

    const ctx = document.getElementById('statusDoughnutChart');
    if (!ctx) return;

    if (this.statusChartInstance) {
      this.statusChartInstance.destroy();
    }

    this.statusChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Hoàn thành', 'Đang làm', 'Chưa bắt đầu', 'Trễ hạn'],
        datasets: [{
          data: [
            statusDist.completed || 0,
            statusDist.in_progress || 0,
            statusDist.pending || 0,
            statusDist.overdue || 0
          ],
          backgroundColor: ['#005d39', '#c59b27', '#cbd5e1', '#8b1d24'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } }
        },
        cutout: '70%'
      }
    });
  },

  // 6. School Mode 5 Departments Table (with Personal logs metrics)
  renderSchoolDeptTable(deptData, schoolLogs = []) {
    const container = document.getElementById('dashboard-detail-container');
    if (!container) return;

    container.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden space-y-6">
        <div>
          <div class="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 class="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <i class="ph-bold ph-buildings text-emerald-600"></i>
                Tổng hợp Khối lượng Việc giao & Kê khai Nhật ký 5 Phòng Ban Toàn Trường
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Bao gồm cả chỉ tiêu giao phòng và tổng hợp công việc do cán bộ 5 phòng tự kê khai.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="App.navigateTo('personal-logs')" class="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-[#005d39] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition">
                <i class="ph-bold ph-calendar-check text-base"></i> Đến Phân hệ Bản Kê Khai &rarr;
              </button>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead class="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th class="px-6 py-4">Mã phòng</th>
                  <th class="px-6 py-4">Tên Phòng Ban</th>
                  <th class="px-6 py-4 text-center">Việc giao</th>
                  <th class="px-6 py-4 text-center">Đã xong</th>
                  <th class="px-6 py-4 text-center">Đang làm</th>
                  <th class="px-6 py-4 text-center">Quá hạn</th>
                  <th class="px-6 py-4 text-center">Tự kê khai</th>
                  <th class="px-6 py-4 text-center">Tổng giờ công</th>
                  <th class="px-6 py-4">Tiến độ giao</th>
                  <th class="px-6 py-4 text-right">Xem phòng</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
                ${deptData.map(d => `
                  <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                    <td class="px-6 py-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">${d.code}</td>
                    <td class="px-6 py-4 font-bold text-slate-800 dark:text-white">${d.name}</td>
                    <td class="px-6 py-4 text-center font-bold">${d.total_tasks}</td>
                    <td class="px-6 py-4 text-center text-emerald-600 dark:text-emerald-400 font-bold">${d.completed_tasks}</td>
                    <td class="px-6 py-4 text-center text-blue-600 dark:text-blue-400 font-semibold">${d.inprogress_tasks || d.in_progress_tasks || 0}</td>
                    <td class="px-6 py-4 text-center text-rose-600 dark:text-rose-400 font-bold">${d.overdue_tasks}</td>
                    <td class="px-6 py-4 text-center">
                      <span class="inline-flex items-center gap-1 font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                        <i class="ph-bold ph-user-list text-xs"></i> ${d.total_logs || 0} việc
                      </span>
                    </td>
                    <td class="px-6 py-4 text-center">
                      <div class="font-extrabold text-[#005d39] dark:text-emerald-400">${d.total_log_hours || 0}h</div>
                      <div class="text-[10px] text-slate-400">~${Math.round((d.total_log_hours || 0) / 8 * 10) / 10} công</div>
                    </td>
                    <td class="px-6 py-4">
                      <div class="flex items-center gap-3">
                        <div class="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div class="bg-emerald-500 h-full rounded-full" style="width: ${d.completion_rate || d.avg_progress || 0}%"></div>
                        </div>
                        <span class="text-xs font-bold w-10 text-right">${d.completion_rate || d.avg_progress || 0}%</span>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-right">
                      <button onclick="Dashboard.viewDeptDetail(${d.id})" class="px-3 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-700 dark:text-slate-300 hover:text-emerald-600 text-xs font-bold rounded-lg transition">
                        Xem phòng &rarr;
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  // 7. Department Mode Dual Tab: Giao việc phòng VS Cá nhân tự kê khai
  switchTableTab(tab) {
    this.currentTableTab = tab;
    this.renderDeptDetailTable(this.cachedDeptTasks, this.cachedActiveDept, this.cachedDeptLogs);
  },

  setPersonalLogStatusFilter(status) {
    this.personalLogFilterStatus = status;
    this.renderDeptDetailTable(this.cachedDeptTasks, this.cachedActiveDept, this.cachedDeptLogs);
  },

  setPersonalLogMemberFilter(memberId) {
    this.personalLogFilterMember = memberId;
    this.renderDeptDetailTable(this.cachedDeptTasks, this.cachedActiveDept, this.cachedDeptLogs);
  },

  handlePersonalLogSearch(query) {
    this.personalLogSearchQuery = (query || '').toLowerCase().trim();
    this.renderDeptDetailTable(this.cachedDeptTasks, this.cachedActiveDept, this.cachedDeptLogs);
  },

  renderDeptDetailTable(tasks, dept, logs = []) {
    const container = document.getElementById('dashboard-detail-container');
    if (!container) return;

    const rawDeptName = dept ? dept.name : 'Phòng ban';
    const cleanDeptName = rawDeptName.startsWith('Phòng') ? rawDeptName : ('Phòng ' + rawDeptName);

    const inProgLogsCount = logs.filter(l => l.status !== 'completed').length;
    const compLogsCount = logs.filter(l => l.status === 'completed').length;
    const totalHours = logs.reduce((acc, l) => acc + parseFloat(l.hours_spent || 0), 0);

    // Filter logs if on personal_logs tab
    let filteredLogs = [...logs];
    if (this.personalLogFilterStatus === 'in_progress') {
      filteredLogs = filteredLogs.filter(l => l.status !== 'completed');
    } else if (this.personalLogFilterStatus === 'completed') {
      filteredLogs = filteredLogs.filter(l => l.status === 'completed');
    }

    if (this.personalLogFilterMember !== 'all') {
      filteredLogs = filteredLogs.filter(l => l.user_id == this.personalLogFilterMember);
    }

    if (this.personalLogSearchQuery) {
      filteredLogs = filteredLogs.filter(l => {
        const text = `${l.title} ${l.description} ${l.user_name} ${l.activity_type} ${l.task_title || l.task_name || ''} ${l.location || ''}`.toLowerCase();
        return text.includes(this.personalLogSearchQuery);
      });
    }

    container.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        
        <!-- Header with Dual Tabs Switcher -->
        <div class="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <h3 class="font-bold text-slate-800 dark:text-white flex items-center gap-2 mr-2">
              <i class="ph-bold ph-folders text-[#005d39]"></i>
              Hoạt động: ${cleanDeptName}
            </h3>

            <!-- 2 Tabs Switcher: Công việc giao phòng VS Cá nhân tự kê khai -->
            <div class="bg-slate-100 dark:bg-slate-700 p-1 rounded-xl flex items-center shadow-inner">
              <button onclick="Dashboard.switchTableTab('tasks')" id="btn-tab-dept-tasks" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${this.currentTableTab === 'tasks' ? 'bg-white dark:bg-slate-800 text-[#005d39] dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}">
                <i class="ph-bold ph-kanban mr-1"></i> 1. Công việc giao phòng
                <span class="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-[#005d39] dark:bg-emerald-950/60 dark:text-emerald-400 font-extrabold">${tasks.length}</span>
              </button>
              <button onclick="Dashboard.switchTableTab('personal_logs')" id="btn-tab-dept-logs" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${this.currentTableTab === 'personal_logs' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}">
                <i class="ph-bold ph-user-list mr-1"></i> 2. Cá nhân tự kê khai
                <span class="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 font-extrabold">${logs.length}</span>
              </button>
            </div>
          </div>

          <!-- Quick Link Buttons -->
          <div class="flex items-center gap-2">
            ${this.currentTableTab === 'personal_logs' ? `
              <button onclick="App.navigateTo('personal-logs')" class="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-[#005d39] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition">
                <i class="ph-bold ph-calendar-check text-sm"></i> Đi đến Phân hệ Bản Kê Khai &rarr;
              </button>
            ` : `
              <button onclick="App.navigateTo('tasks')" class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition">
                <i class="ph-bold ph-kanban text-sm"></i> Bảng Quản lý Công việc &rarr;
              </button>
            `}
          </div>
        </div>

        <!-- TAB 1: GIAO VIỆC CHO PHÒNG -->
        ${this.currentTableTab === 'tasks' ? `
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead class="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th class="px-6 py-4">Tên công việc</th>
                  <th class="px-6 py-4">Mức ưu tiên</th>
                  <th class="px-6 py-4">Trạng thái</th>
                  <th class="px-6 py-4">Tiến độ (%)</th>
                  <th class="px-6 py-4">Hạn chót</th>
                  <th class="px-6 py-4 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
                ${tasks.length === 0 ? `
                  <tr>
                    <td colspan="6" class="px-6 py-12 text-center text-slate-400">Chưa có công việc giao nào cho phòng này.</td>
                  </tr>
                ` : tasks.map(t => {
                  const statusBadges = {
                    pending: '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Chưa bắt đầu</span>',
                    in_progress: '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">Đang thực hiện</span>',
                    completed: '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">Hoàn thành</span>',
                    overdue: '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">Trễ hạn</span>'
                  };
                  return `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                      <td class="px-6 py-4 font-bold text-slate-800 dark:text-white">${t.title}</td>
                      <td class="px-6 py-4"><span class="priority-${t.priority} px-2.5 py-1 rounded-full text-xs font-semibold uppercase">${t.priority}</span></td>
                      <td class="px-6 py-4">${statusBadges[t.status] || t.status}</td>
                      <td class="px-6 py-4">
                        <div class="flex items-center gap-2">
                          <div class="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div class="bg-blue-600 h-full rounded-full" style="width: ${t.progress}%"></div>
                          </div>
                          <span class="text-xs font-bold">${t.progress}%</span>
                        </div>
                      </td>
                      <td class="px-6 py-4 font-mono text-xs">${t.due_date}</td>
                      <td class="px-6 py-4 text-right">
                        <button onclick="Tasks.viewTaskDetails(${t.id})" class="text-[#005d39] dark:text-emerald-400 hover:underline font-bold text-xs">
                          Chi tiết &rarr;
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <!-- TAB 2: CÁ NHÂN TỰ KÊ KHAI -->
          <div class="p-6 space-y-4">
            
            <!-- Quick Filter Bar for Personal Logs -->
            <div class="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-200 dark:border-slate-700">
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <span class="text-slate-400 font-bold mr-1">Trạng thái:</span>
                <button onclick="Dashboard.setPersonalLogStatusFilter('all')" class="px-2.5 py-1 rounded-lg font-bold transition ${this.personalLogFilterStatus === 'all' ? 'bg-[#005d39] text-white shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}">
                  Tất cả (${logs.length})
                </button>
                <button onclick="Dashboard.setPersonalLogStatusFilter('in_progress')" class="px-2.5 py-1 rounded-lg font-bold transition ${this.personalLogFilterStatus === 'in_progress' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-600'}">
                  ⏳ Đang thực hiện (${inProgLogsCount})
                </button>
                <button onclick="Dashboard.setPersonalLogStatusFilter('completed')" class="px-2.5 py-1 rounded-lg font-bold transition ${this.personalLogFilterStatus === 'completed' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-600'}">
                  ✅ Đã hoàn thành (${compLogsCount})
                </button>
                
                <span class="ml-2 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 text-[#b3821a] dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-lg font-bold">
                  ⏱️ Tổng: ${totalHours} giờ (~${Math.round(totalHours / 8 * 10) / 10} ngày công)
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <!-- Member selector filter -->
                <select onchange="Dashboard.setPersonalLogMemberFilter(this.value)" class="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none">
                  <option value="all">👥 Tất cả cán bộ trong phòng</option>
                  ${(this.cachedDeptMembers || []).map(m => `
                    <option value="${m.id}" ${this.personalLogFilterMember == m.id ? 'selected' : ''}>👤 ${m.full_name} (${m.position || m.role})</option>
                  `).join('')}
                </select>

                <!-- Search -->
                <div class="relative">
                  <input type="text" oninput="Dashboard.handlePersonalLogSearch(this.value)" value="${this.personalLogSearchQuery}" placeholder="Tìm nội dung, cán bộ..." class="pl-7 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-xs dark:text-white w-48">
                  <i class="ph ph-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                </div>
              </div>
            </div>

            <!-- Table of Personal Logs -->
            <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead class="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th class="px-5 py-3.5">Cán bộ thực hiện</th>
                    <th class="px-5 py-3.5">Thời gian</th>
                    <th class="px-5 py-3.5">Nội dung công việc</th>
                    <th class="px-5 py-3.5">Phân loại & Nhiệm vụ</th>
                    <th class="px-5 py-3.5 text-center">Thời lượng</th>
                    <th class="px-5 py-3.5 text-center">Trạng thái</th>
                    <th class="px-5 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
                  ${filteredLogs.length === 0 ? `
                    <tr>
                      <td colspan="7" class="px-6 py-12 text-center text-slate-400">
                        <i class="ph ph-calendar-blank text-4xl mb-2 block text-slate-300"></i>
                        Chưa có bản kê khai công việc cá nhân nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ` : filteredLogs.map(l => {
                    const isCompleted = l.status === 'completed';
                    return `
                      <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition ${isCompleted ? 'bg-emerald-50/15 dark:bg-emerald-950/10' : ''}">
                        <td class="px-5 py-4 whitespace-nowrap">
                          <div class="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                            <span class="w-6 h-6 rounded-full bg-emerald-100 text-[#005d39] dark:bg-emerald-900/50 dark:text-emerald-300 flex items-center justify-center text-[10px] font-black">
                              ${(l.user_name || 'U').charAt(0)}
                            </span>
                            <span>${l.user_name}</span>
                          </div>
                          <div class="text-[11px] text-slate-400 mt-0.5">${l.user_position || l.user_role || 'Cán bộ'}</div>
                        </td>

                        <td class="px-5 py-4 whitespace-nowrap">
                          <div class="flex items-center gap-1 font-mono text-xs font-bold text-slate-800 dark:text-white">
                            <span class="${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}">${l.start_date}</span>
                            ${l.start_date !== l.end_date ? `<i class="ph-bold ph-arrow-right text-slate-400 text-[10px]"></i><span class="text-cyan-600 dark:text-cyan-400">${l.end_date}</span>` : ''}
                          </div>
                          ${l.start_time && l.end_time ? `
                            <div class="mt-1">
                              <span class="inline-flex items-center gap-1 text-[10px] font-bold ${isCompleted ? 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200' : 'text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200'} px-1.5 py-0.2 rounded border">
                                <i class="ph-bold ph-clock text-[10px]"></i> ${l.start_time} - ${l.end_time}
                              </span>
                            </div>
                          ` : ''}
                        </td>

                        <td class="px-5 py-4 max-w-xs">
                          <div class="font-bold text-slate-800 dark:text-white line-clamp-1 ${isCompleted ? 'line-through text-slate-500 dark:text-slate-400' : ''}">
                            ${l.title}
                          </div>
                          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">${l.description}</p>
                        </td>

                        <td class="px-5 py-4">
                          <span class="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md ${isCompleted ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'}">
                            ${l.activity_type || 'Chuyên môn'}
                          </span>
                          <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 truncate max-w-[140px]" title="${l.task_title || l.task_name || 'Việc phát sinh'}">
                            <i class="ph-bold ph-link text-slate-400"></i>
                            <span>${l.task_title || l.task_name || 'Việc phát sinh'}</span>
                          </div>
                        </td>

                        <td class="px-5 py-4 text-center whitespace-nowrap">
                          <div class="font-extrabold text-sm text-slate-800 dark:text-white">${l.hours_spent}h</div>
                          <div class="text-[10px] text-slate-400">${Math.round(l.hours_spent / 8 * 10) / 10} ngày công</div>
                        </td>

                        <td class="px-5 py-4 text-center whitespace-nowrap">
                          ${isCompleted 
                            ? '<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-[#005d39] dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1"><i class="ph-bold ph-check-circle"></i> Đã hoàn thành</span>'
                            : '<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 inline-flex items-center gap-1"><i class="ph-bold ph-hourglass-high"></i> Đang thực hiện</span>'}
                        </td>

                        <td class="px-5 py-4 text-right whitespace-nowrap">
                          <div class="flex items-center justify-end gap-1.5">
                            <button onclick="Dashboard.openPersonalLogDetailModal(${l.id})" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition" title="Xem chi tiết bản kê khai">
                              Chi tiết
                            </button>
                            <button onclick="Dashboard.goToUserLogs(${l.user_id})" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-[#005d39] dark:text-emerald-400 text-xs font-bold rounded-lg transition flex items-center gap-1" title="Xem toàn bộ nhật ký của cán bộ này">
                              <span>Bản kê khai</span>
                              <i class="ph-bold ph-arrow-square-out text-xs"></i>
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
        `}
      </div>
    `;
  },

  goToUserLogs(userId) {
    PersonalLogs.targetUserId = userId;
    App.navigateTo('personal-logs');
  },

  async openPersonalLogDetailModal(logId) {
    let allLogs = [...(this.cachedDeptLogs || []), ...(this.cachedSchoolLogs || [])];
    let log = allLogs.find(l => l.id == logId);
    if (!log) {
      try {
        const fetched = await apiFetch('/api/personal-logs');
        log = (fetched || []).find(l => l.id == logId) || fetched[0];
      } catch (e) {
        console.warn(e);
      }
    }
    if (!log) return;

    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const isCompleted = log.status === 'completed';

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div class="p-6 bg-gradient-to-r ${isCompleted ? 'from-[#005d39] to-[#00703c]' : 'from-blue-600 to-indigo-700'} text-white flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2.5 bg-white/20 rounded-2xl">
                <i class="ph-bold ${isCompleted ? 'ph-check-circle' : 'ph-calendar-check'} text-2xl"></i>
              </div>
              <div>
                <h3 class="font-bold text-lg leading-tight">Chi tiết Nhật ký Kê khai Công việc</h3>
                <p class="text-xs text-white/80 mt-0.5">Cán bộ: <b>${log.user_name}</b> (${log.department_code || 'PHÒNG'})</p>
              </div>
            </div>
            <button onclick="App.closeModal()" class="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/20 transition">
              <i class="ph-bold ph-x text-xl"></i>
            </button>
          </div>

          <div class="p-6 space-y-4 text-xs">
            <div class="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-600 space-y-2">
              <div class="text-[11px] uppercase font-bold text-slate-400">Tên đầu việc / Nhiệm vụ</div>
              <div class="text-base font-extrabold text-slate-800 dark:text-white ${isCompleted ? 'text-emerald-700 dark:text-emerald-400' : ''}">${log.title}</div>
              ${log.task_name ? `<div class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1"><i class="ph-bold ph-link text-emerald-600"></i> Gắn kết với: <b>${log.task_name}</b></div>` : ''}
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div class="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-700">
                <span class="text-slate-400 block text-[10px] font-bold uppercase">Thời gian thực hiện</span>
                <span class="font-bold text-slate-800 dark:text-white font-mono mt-1 block">${log.start_date} ${log.start_date !== log.end_date ? `&rarr; ${log.end_date}` : ''}</span>
                ${log.start_time ? `<span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-0.5">(${log.start_time} - ${log.end_time || ''})</span>` : ''}
              </div>

              <div class="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-700">
                <span class="text-slate-400 block text-[10px] font-bold uppercase">Thời lượng ghi nhận</span>
                <span class="font-extrabold text-slate-800 dark:text-white text-sm mt-1 block">${log.hours_spent} giờ</span>
                <span class="text-[10px] text-slate-400 block">~${Math.round(log.hours_spent / 8 * 10) / 10} ngày công</span>
              </div>

              <div class="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-700">
                <span class="text-slate-400 block text-[10px] font-bold uppercase">Trạng thái</span>
                <span class="mt-1 inline-block font-bold ${isCompleted ? 'text-[#005d39] dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}">
                  ${isCompleted ? '✅ Đã hoàn thành' : '⏳ Đang thực hiện'}
                </span>
              </div>
            </div>

            <div>
              <span class="text-slate-400 block text-[10px] font-bold uppercase mb-1">Địa điểm thực hiện</span>
              <div class="p-2.5 bg-slate-50 dark:bg-slate-700/30 rounded-xl font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <i class="ph-bold ph-map-pin text-rose-500"></i>
                <span>${log.location || 'Tại Trường ĐT CB Agribank'}</span>
              </div>
            </div>

            <div>
              <span class="text-slate-400 block text-[10px] font-bold uppercase mb-1">Chi tiết công việc đã thực hiện</span>
              <div class="p-3.5 bg-slate-50 dark:bg-slate-700/30 rounded-xl text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap border border-slate-100 dark:border-slate-700">
                ${log.description}
              </div>
            </div>
          </div>

          <div class="p-4 px-6 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <button onclick="App.closeModal(); Dashboard.goToUserLogs(${log.user_id})" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5">
              <i class="ph-bold ph-arrow-square-out"></i>
              <span>Mở Toàn bộ Bản Kê Khai của ${log.user_name}</span>
            </button>
            <button onclick="App.closeModal()" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs transition">
              Đóng
            </button>
          </div>
        </div>
      </div>
    `;
  },

  viewDeptDetail(deptId) {
    if (!Auth.isDirector() && !Auth.isAdmin()) {
      return;
    }
    this.viewScope = 'department';
    this.selectedDeptId = parseInt(deptId);
    this.render();
  },

  // Interactive KPI Modal: Display specific tasks list on card/icon click
      async openTaskListModal(type) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();
    if (!isDirectorOrAdmin) {
      this.viewScope = 'department';
      if (Auth.user && Auth.user.department_id) {
        this.selectedDeptId = Auth.user.department_id;
      }
    }

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-3 text-slate-500">
          <i class="ph ph-spinner animate-spin text-4xl text-[#005d39]"></i>
          <span class="text-sm font-bold text-slate-700 dark:text-slate-200">Đang truy xuất danh sách...</span>
        </div>
      </div>
    `;

    try {
      const isSchool = this.viewScope === 'school';
      const deptQuery = isSchool ? '' : `?department_id=${this.selectedDeptId}`;
      const activeDept = this.cachedDepartments.find(d => d.id == this.selectedDeptId) || this.cachedDepartments[0];
      const rawDeptName = activeDept ? activeDept.name : (Auth.user && Auth.user.department_name ? Auth.user.department_name : '');
      const cleanDeptName = rawDeptName.startsWith('Phòng') ? rawDeptName : ('Phòng ' + rawDeptName);
      const today = new Date().toISOString().split('T')[0];

      let filteredItems = [];
      let meta = {};

      if (type === 'personal_logs' || type === 'logs') {
        const logs = await apiFetch(`/api/personal-logs${deptQuery}`);
        let totalHours = 0;
        logs.forEach(l => totalHours += (parseFloat(l.hours_spent || l.actual_hours || 0) || 0));

        filteredItems = logs;
        meta = {
          type: 'personal_logs',
          title: 'Nhật Ký Cá Nhân Tự Kê Khai ' + (isSchool ? '(Toàn Trường)' : `- ${cleanDeptName}`),
          sub: isSchool ? 'Tổng hợp toàn bộ nhật ký công việc và giờ công tự kê khai của tất cả cán bộ 5 Phòng Ban' : `Danh sách nhật ký công tác và giờ làm việc tự kê khai của cán bộ ${cleanDeptName}`,
          badgeText: `${logs.length} bản kê khai (${totalHours.toFixed(1)}h)`,
          badgeClass: 'bg-amber-100 text-[#b3821a] dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800',
          icon: 'ph-calendar-check',
          headerGradient: 'from-[#b3821a] via-[#c59b27] to-[#d4a838]',
          themeText: 'text-[#c59b27]'
        };
      } else {
        const allTasks = await apiFetch(`/api/tasks${deptQuery}`);
        meta.type = 'tasks';

        if (type === 'all') {
          filteredItems = allTasks;
          meta = {
            type: 'tasks',
            title: 'Tổng công việc ' + (isSchool ? 'Toàn Trường' : cleanDeptName),
            sub: isSchool ? 'Toàn bộ các nhiệm vụ, đề án và công việc đang triển khai tại 5 Phòng Ban' : `Toàn bộ công việc thuộc ${cleanDeptName}`,
            badgeText: `${filteredItems.length} đầu việc`,
            badgeClass: 'bg-emerald-100 text-[#005d39] dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800',
            icon: 'ph-list-checks',
            headerGradient: 'from-[#005d39] to-[#00703c]',
            themeText: 'text-[#005d39]'
          };
        } else if (type === 'completed') {
          filteredItems = allTasks.filter(t => t.status === 'completed' || t.progress >= 100);
          meta = {
            type: 'tasks',
            title: 'Công việc Đã Hoàn Thành ' + (isSchool ? '(Toàn Trường)' : `- ${cleanDeptName}`),
            sub: isSchool ? 'Danh sách các nhiệm vụ đã hoàn tất 100% chỉ tiêu theo kế hoạch' : `Các nhiệm vụ của ${cleanDeptName} đã hoàn tất 100%`,
            badgeText: `${filteredItems.length} việc hoàn tất`,
            badgeClass: 'bg-emerald-100 text-[#005d39] dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800',
            icon: 'ph-check-circle',
            headerGradient: 'from-[#005d39] to-[#00703c]',
            themeText: 'text-[#005d39]'
          };
        } else if (type === 'overdue') {
          filteredItems = allTasks.filter(t => t.status === 'overdue' || (t.status !== 'completed' && t.due_date && t.due_date < today));
          meta = {
            type: 'tasks',
            title: 'Cảnh Báo Công Việc Trễ Hạn ' + (isSchool ? '(Toàn Trường)' : `- ${cleanDeptName}`),
            sub: 'Các nhiệm vụ đã quá hạn chót (Deadline) nhưng chưa hoàn thành - Cần đôn đốc xử lý ngay',
            badgeText: `${filteredItems.length} việc quá hạn`,
            badgeClass: 'bg-rose-100 text-[#8b1d24] dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-800',
            icon: 'ph-warning-octagon',
            headerGradient: 'from-[#7d181e] to-[#981b1e]',
            themeText: 'text-[#8b1d24]'
          };
        } else if (type === 'rate') {
          filteredItems = [...allTasks].sort((a, b) => (b.progress || 0) - (a.progress || 0));
          meta = {
            type: 'tasks',
            title: 'Tiến Độ & Tỷ Lệ Thực Hiện Công Việc ' + (isSchool ? '(Toàn Trường)' : `- ${cleanDeptName}`),
            sub: 'Theo dõi tiến độ, tỷ lệ hoàn thành (%) và đánh giá năng lực hoàn thành của các đầu việc',
            badgeText: `${filteredItems.length} đầu việc`,
            badgeClass: 'bg-amber-100 text-[#b3821a] dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800',
            icon: 'ph-trend-up',
            headerGradient: 'from-[#b3821a] via-[#c59b27] to-[#d4a838]',
            themeText: 'text-[#c59b27]'
          };
        }
      }

      this.currentFilteredModalTasks = filteredItems;
      this.currentModalMeta = meta;
      this.renderTaskListModalHTML(meta, filteredItems);
    } catch (err) {
      console.error('Failed to open task list modal:', err);
      App.closeModal();
      alert('Không thể tải danh sách: ' + err.message);
    }
  },

  filterModalTasks(keyword) {
    if (!this.currentFilteredModalTasks) return;
    const q = (keyword || '').toLowerCase().trim();
    const rows = document.querySelectorAll('.modal-task-row');
    rows.forEach(r => {
      const text = r.getAttribute('data-search') || '';
      if (!q || text.includes(q)) {
        r.classList.remove('hidden');
      } else {
        r.classList.add('hidden');
      }
    });
  },

  renderTaskListModalHTML(meta, items) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const priorityBadges = {
      urgent: '<span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-rose-100 text-[#8b1d24] dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">Khẩn cấp</span>',
      high: '<span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-100 text-[#b3821a] dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Cao</span>',
      medium: '<span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Trung bình</span>',
      low: '<span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Thấp</span>'
    };

    const statusBadges = {
      completed: '<span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-100 text-[#005d39] dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center gap-1 border border-emerald-200"><i class="ph-bold ph-check"></i> Hoàn thành</span>',
      in_progress: '<span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-100 text-[#b3821a] dark:bg-amber-950/50 dark:text-amber-300 flex items-center gap-1 border border-amber-200"><i class="ph-bold ph-clock"></i> Đang làm</span>',
      reviewing: '<span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 flex items-center gap-1 border border-purple-200"><i class="ph-bold ph-eye"></i> Đang duyệt</span>',
      overdue: '<span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-rose-100 text-[#8b1d24] dark:bg-rose-950/50 dark:text-rose-300 flex items-center gap-1 border border-rose-200"><i class="ph-bold ph-warning"></i> Quá hạn</span>',
      pending: '<span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 flex items-center gap-1"><i class="ph-bold ph-hourglass"></i> Chưa làm</span>'
    };

    const isPersonalLogs = meta.type === 'personal_logs';
    const today = new Date().toISOString().split('T')[0];

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          <!-- Header Banner with Agribank Brand Styling -->
          <div class="p-6 bg-gradient-to-r ${meta.headerGradient} text-white flex items-center justify-between shrink-0 shadow-md">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-2xl shadow-inner shrink-0">
                <i class="ph-bold ${meta.icon}"></i>
              </div>
              <div>
                <div class="flex items-center gap-3">
                  <h3 class="text-lg sm:text-xl font-black text-white leading-tight">
                    ${meta.title}
                  </h3>
                  <span class="px-3 py-0.5 rounded-full text-xs font-black bg-white/20 backdrop-blur-md text-white border border-white/30">
                    ${meta.badgeText}
                  </span>
                </div>
                <p class="text-xs text-white/90 mt-1 font-medium hidden sm:block">
                  ${meta.sub}
                </p>
              </div>
            </div>
            <button onclick="App.closeModal()" class="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/20 transition" title="Đóng cửa sổ">
              <i class="ph-bold ph-x text-2xl"></i>
            </button>
          </div>

          <!-- Quick Search Toolbar -->
          <div class="px-6 py-3 bg-slate-50 dark:bg-slate-700/40 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4 shrink-0">
            <div class="relative flex-1 max-w-md">
              <i class="ph-bold ph-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input type="text" oninput="Dashboard.filterModalTasks(this.value)" placeholder="${isPersonalLogs ? 'Tìm kiếm tên công việc, cán bộ kê khai, phòng ban...' : 'Tìm kiếm nhanh tên việc, phòng ban, người phụ trách...'}" class="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#005d39]">
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
              Tổng số: <b class="text-slate-800 dark:text-white font-bold">${items.length}</b> ${isPersonalLogs ? 'bản kê khai' : 'công việc'}
            </div>
          </div>

          <!-- Table Content (Scrollable) -->
          <div class="overflow-y-auto flex-1 p-4 sm:p-6">
            ${items.length === 0 ? `
              <div class="py-16 text-center text-slate-400">
                <i class="ph ph-tray text-5xl mb-2 block"></i>
                <div class="font-bold text-base text-slate-600 dark:text-slate-300">Không có dữ liệu trong danh mục này</div>
                <p class="text-xs text-slate-400 mt-1">Chưa phát sinh bản ghi hoặc toàn bộ dữ liệu đã được bảo đảm.</p>
              </div>
            ` : isPersonalLogs ? `
              <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead class="bg-slate-50 dark:bg-slate-700/60 text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th class="px-5 py-3.5">Nội dung công việc tự kê khai</th>
                      <th class="px-5 py-3.5">Cán bộ & Phòng ban</th>
                      <th class="px-5 py-3.5 text-center">Thời gian thực hiện</th>
                      <th class="px-5 py-3.5 text-center">Giờ công</th>
                      <th class="px-5 py-3.5 text-center">Trạng thái</th>
                      <th class="px-5 py-3.5 text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-700/60">
                    ${items.map(l => {
                      const logTitle = l.title || l.task_name || 'Bản kê khai công việc';
                      const logDesc = l.description || l.details || l.result_outcome || '';
                      const logUser = l.user_name || l.full_name || 'Cán bộ';
                      const logDept = l.department_name || '';
                      const logPos = l.user_position || l.position || '';
                      const logDate = l.start_date || l.work_date || 'Hôm nay';
                      const logHours = parseFloat(l.hours_spent || l.actual_hours || 0).toFixed(1);
                      const isDone = l.status === 'completed';
                      const searchIndex = `${logTitle} ${logUser} ${logDept} ${logDesc}`.toLowerCase();

                      return `
                        <tr class="modal-task-row hover:bg-slate-50 dark:hover:bg-slate-700/40 transition" data-search="${searchIndex}">
                          <td class="px-5 py-4 max-w-xs">
                            <div class="font-extrabold text-slate-800 dark:text-white line-clamp-2">${logTitle}</div>
                            ${logDesc ? `<p class="text-xs text-slate-400 line-clamp-1 mt-0.5">${logDesc}</p>` : ''}
                          </td>
                          <td class="px-5 py-4 whitespace-nowrap">
                            <div class="font-bold text-slate-800 dark:text-white text-xs">${logUser}</div>
                            <span class="inline-block text-[11px] text-slate-400 mt-0.5">
                              ${logDept} ${logPos ? `• ${logPos}` : ''}
                            </span>
                          </td>
                          <td class="px-5 py-4 text-center whitespace-nowrap text-xs text-slate-600 dark:text-slate-300 font-medium">
                            <div class="font-bold font-mono">${logDate}</div>
                            ${l.start_time && l.end_time ? `<span class="text-[11px] text-slate-400">${l.start_time} - ${l.end_time}</span>` : (l.end_date && l.end_date !== logDate ? `<span class="text-[11px] text-slate-400">Đến ${l.end_date}</span>` : '')}
                          </td>
                          <td class="px-5 py-4 text-center whitespace-nowrap">
                            <span class="px-2.5 py-1 rounded-lg text-xs font-black bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              ${logHours}h
                            </span>
                          </td>
                          <td class="px-5 py-4 text-center whitespace-nowrap">
                            ${isDone ? statusBadges.completed : statusBadges.in_progress}
                          </td>
                          <td class="px-5 py-4 text-right whitespace-nowrap">
                            <button onclick="App.closeModal(); PersonalLogs.openDetailModal(${l.id})" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-[#b3821a] hover:text-white text-slate-700 dark:text-slate-200 font-bold text-xs transition flex items-center gap-1 ml-auto">
                              <span>Xem</span>
                              <i class="ph-bold ph-arrow-right"></i>
                            </button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead class="bg-slate-50 dark:bg-slate-700/60 text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th class="px-5 py-3.5">Nội dung công việc</th>
                      <th class="px-5 py-3.5">Phòng ban & Phụ trách</th>
                      <th class="px-5 py-3.5 text-center">Ưu tiên</th>
                      <th class="px-5 py-3.5 text-center">Hạn chót</th>
                      <th class="px-5 py-3.5">Tiến độ</th>
                      <th class="px-5 py-3.5 text-center">Trạng thái</th>
                      <th class="px-5 py-3.5 text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-700/60">
                    ${items.map(t => {
                      const isOverdue = t.status !== 'completed' && t.due_date && t.due_date < today;
                      const assigneesStr = t.assignees && t.assignees.length > 0
                        ? t.assignees.map(a => a.full_name).join(', ')
                        : (t.creator_name || 'Chưa phân công');
                      const searchIndex = `${t.title} ${t.department_name || ''} ${t.department_code || ''} ${assigneesStr}`.toLowerCase();

                      return `
                        <tr class="modal-task-row hover:bg-slate-50 dark:hover:bg-slate-700/40 transition" data-search="${searchIndex}">
                          <td class="px-5 py-4 max-w-xs">
                            <div class="font-extrabold text-slate-800 dark:text-white line-clamp-2">${t.title}</div>
                            ${t.description ? `<p class="text-xs text-slate-400 line-clamp-1 mt-0.5">${t.description}</p>` : ''}
                          </td>
                          <td class="px-5 py-4 whitespace-nowrap">
                            <span class="inline-block text-xs font-bold text-[#005d39] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                              ${t.department_code || 'PHÒNG'}
                            </span>
                            <div class="text-[11px] text-slate-400 mt-1 truncate max-w-[160px]" title="${assigneesStr}">
                              👤 ${assigneesStr}
                            </div>
                          </td>
                          <td class="px-5 py-4 text-center whitespace-nowrap">
                            ${priorityBadges[t.priority] || t.priority}
                          </td>
                          <td class="px-5 py-4 text-center whitespace-nowrap font-mono text-xs">
                            <div class="${isOverdue ? 'text-[#8b1d24] font-black' : 'text-slate-600 dark:text-slate-300 font-bold'}">
                              ${t.due_date || 'Không có'}
                            </div>
                            ${isOverdue ? '<span class="text-[10px] text-[#8b1d24] font-extrabold uppercase block">Quá hạn</span>' : ''}
                          </td>
                          <td class="px-5 py-4 whitespace-nowrap">
                            <div class="flex items-center gap-2">
                              <div class="w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                                <div class="h-full rounded-full ${t.progress >= 100 ? 'bg-[#005d39]' : isOverdue ? 'bg-[#8b1d24]' : 'bg-[#c59b27]'}" style="width: ${t.progress || 0}%"></div>
                              </div>
                              <span class="text-xs font-black text-slate-800 dark:text-white">${t.progress || 0}%</span>
                            </div>
                          </td>
                          <td class="px-5 py-4 text-center whitespace-nowrap">
                            ${isOverdue ? statusBadges.overdue : (statusBadges[t.status] || t.status)}
                          </td>
                          <td class="px-5 py-4 text-right whitespace-nowrap">
                            <button onclick="App.closeModal(); Tasks.viewTaskDetails(${t.id})" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-[#005d39] hover:text-white text-slate-700 dark:text-slate-200 font-bold text-xs transition flex items-center gap-1 ml-auto">
                              <span>Xem</span>
                              <i class="ph-bold ph-arrow-right"></i>
                            </button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- Modal Footer -->
          <div class="p-4 px-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
            ${isPersonalLogs ? `
              <button onclick="App.closeModal(); App.navigateTo('personal-logs')" class="text-xs font-bold text-[#b3821a] dark:text-amber-400 hover:underline flex items-center gap-1.5">
                <i class="ph-bold ph-calendar-check"></i> Đi đến Bảng Kê Khai Nhật Ký chi tiết &rarr;
              </button>
            ` : `
              <button onclick="App.closeModal(); App.navigateTo('tasks')" class="text-xs font-bold text-[#005d39] dark:text-emerald-400 hover:underline flex items-center gap-1.5">
                <i class="ph-bold ph-kanban"></i> Đi đến Bảng Quản lý Công việc chi tiết &rarr;
              </button>
            `}
            <button onclick="App.closeModal()" class="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs transition">
              Đóng
            </button>
          </div>
        </div>
      </div>
    `;
  },

    cachedNews: [],
  activeNewsCategory: 'all',
  isNewsLoading: false,
  newsError: null,

  async loadNews() {
    try {
      this.isNewsLoading = true;
      this.newsError = null;
      this.renderBulletinBoard();
      const news = await apiFetch('/api/news');
      this.cachedNews = news || [];
      this.isNewsLoading = false;
      this.renderBulletinBoard();
    } catch (err) {
      console.warn('Load news error:', err);
      this.isNewsLoading = false;
      this.newsError = 'Không thể tải tin tức. Vui lòng thử lại.';
      this.renderBulletinBoard();
    }
  },

  setNewsCategory(cat) {
    this.activeNewsCategory = cat;
    this.renderBulletinBoard();
  },

  renderBulletinBoard() {
    const container = document.getElementById('dashboard-bulletin-board');
    if (!container) return;

    const isAdmin = Auth.isAdmin();
    const allNews = this.cachedNews || [];

    container.innerHTML = `
      <div class="bg-gradient-to-br from-slate-900 via-slate-850 to-emerald-950 text-white rounded-3xl p-5 sm:p-7 border border-emerald-800/40 shadow-xl relative overflow-hidden">
        <!-- Decorative Glow -->
        <div class="absolute -right-8 -top-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <!-- Header of Bulletin Board -->
        <div class="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div class="flex items-center gap-3">
            <span class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#005d39] to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-900/50 shrink-0">
              <i class="ph-bold ph-newspaper-clipping text-2xl"></i>
            </span>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                  BẢNG TIN HOẠT ĐỘNG & THÔNG BÁO NỘI BỘ
                </h2>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ${allNews.length} tin tức
                </span>
              </div>
              <p class="text-xs text-slate-300 mt-0.5">
                Cập nhật thông báo chỉ đạo, kế hoạch đào tạo và các sự kiện hoạt động trọng tâm của Trường Đào tạo cán bộ Agribank
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2">
            ${isAdmin ? `
              <button onclick="Dashboard.openCreateNewsModal()" class="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/40 flex items-center gap-1.5 transition transform hover:scale-102">
                <i class="ph-bold ph-plus-circle text-base"></i>
                <span>Đăng tin mới (Admin)</span>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- News Content Section: Simple Clean List View -->
        <div class="relative z-10 mt-4">
          ${this.isNewsLoading ? `
            <!-- Loading Skeleton -->
            <div class="space-y-2">
              ${[1, 2, 3].map(() => `
                <div class="h-14 rounded-2xl bg-white/5 animate-pulse border border-white/5 flex items-center px-4 gap-4">
                  <div class="flex-1 h-5 bg-white/10 rounded-lg"></div>
                  <div class="w-24 h-5 bg-white/10 rounded-lg shrink-0 hidden md:block"></div>
                  <div class="w-28 h-8 bg-white/10 rounded-xl shrink-0"></div>
                </div>
              `).join('')}
            </div>
          ` : this.newsError ? `
            <!-- Error State -->
            <div class="py-8 text-center text-rose-300 text-xs bg-rose-950/20 rounded-2xl border border-rose-900/40">
              <i class="ph-bold ph-warning-circle text-3xl mb-2 block opacity-70"></i>
              ${this.newsError}
              <div class="mt-2">
                <button onclick="Dashboard.loadNews()" class="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-xs transition">
                  Thử lại
                </button>
              </div>
            </div>
          ` : allNews.length === 0 ? `
            <!-- Empty State -->
            <div class="py-8 text-center text-slate-400 text-xs bg-white/5 rounded-2xl border border-white/5">
              <i class="ph-bold ph-newspaper text-3xl mb-2 block opacity-40"></i>
              Hiện chưa có tin tức nào được đăng tải.
            </div>
          ` : `
            <!-- News List (Simple, Spacious & Elegant) -->
            <div class="bg-white/5 dark:bg-slate-900/60 rounded-2xl border border-white/10 dark:border-slate-700/60 divide-y divide-white/10 dark:divide-slate-700/50 overflow-hidden shadow-inner">
              ${allNews.map((n, idx) => {
                const dateStr = n.created_at ? n.created_at.split(' ')[0].split('-').reverse().join('/') : '';
                return `
                  <div class="news-row-item px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-white/10 dark:hover:bg-slate-800/80 transition flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-4 group cursor-pointer ${n.is_pinned ? 'bg-amber-950/15' : ''}" onclick="Dashboard.openNewsDetailModal(${n.id})">
                    
                    <!-- Left: Title with Pin or Number indicator (flex-1 with full space & ellipsis) -->
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                      <span class="flex items-center justify-center shrink-0">
                        ${n.is_pinned ? `
                          <span class="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-xs shadow-sm" title="Tin đã ghim">
                            <i class="ph-bold ph-push-pin"></i>
                          </span>
                        ` : `
                          <span class="w-6 h-6 rounded-lg bg-white/10 text-emerald-300 flex items-center justify-center text-xs font-bold font-mono">
                            ${idx + 1}
                          </span>
                        `}
                      </span>

                      <span class="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 transition truncate block leading-snug" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${n.title.replace(/"/g, '&quot;')}">
                        ${n.title}
                      </span>
                    </div>

                    <!-- Right on Desktop / Bottom on Mobile: Date, Actions -->
                    <div class="flex items-center justify-between md:justify-end gap-3 sm:gap-5 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-white/5">
                      <!-- Ngày đăng -->
                      <div class="w-24 sm:w-28 shrink-0 text-[11px] sm:text-xs text-slate-400 font-mono flex items-center gap-1 text-center justify-center">
                        <i class="ph-bold ph-calendar-blank text-slate-400 shrink-0"></i>
                        <span>${dateStr}</span>
                      </div>

                      <!-- Nút Xem chi tiết & Admin Controls -->
                      <div class="shrink-0 flex items-center justify-end gap-2" onclick="event.stopPropagation()">
                        <button onclick="Dashboard.openNewsDetailModal(${n.id})" class="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1 group/btn shrink-0 shadow-sm whitespace-nowrap" title="Xem chi tiết">
                          <span>Xem chi tiết</span>
                          <i class="ph-bold ph-arrow-right group-hover/btn:translate-x-0.5 transition-transform text-xs"></i>
                        </button>

                        ${isAdmin ? `
                          <div class="flex items-center gap-1 shrink-0">
                            <button onclick="Dashboard.togglePinNews(${n.id})" class="p-1.5 rounded-lg ${n.is_pinned ? 'text-amber-400 bg-amber-500/20' : 'text-slate-400 hover:bg-white/10'}" title="${n.is_pinned ? 'Bỏ ghim' : 'Ghim tin lên đầu'}">
                              <i class="ph-bold ph-push-pin text-xs"></i>
                            </button>
                            <button onclick="Dashboard.openEditNewsModal(${n.id})" class="p-1.5 rounded-lg text-blue-400 hover:bg-white/10" title="Chỉnh sửa tin">
                              <i class="ph-bold ph-pencil-simple text-xs"></i>
                            </button>
                            <button onclick="Dashboard.deleteNews(${n.id}, \`${n.title.replace(/[`\"]/g, '')}\`)" class="p-1.5 rounded-lg text-rose-400 hover:bg-white/10" title="Xóa tin">
                              <i class="ph-bold ph-trash text-xs"></i>
                            </button>
                          </div>
                        ` : ''}
                      </div>
                    </div>

                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  },

  openNewsDetailModal(newsId) {
    const item = this.cachedNews.find(n => n.id === newsId);
    if (!item) return;

    const modalContainer = document.getElementById('modal-container');
    const dateStr = item.created_at ? item.created_at.split(' ')[0].split('-').reverse().join('/') : '';

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5 my-8">
          
          <!-- Modal Header -->
          <div class="flex items-start justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
            <div class="space-y-1.5 pr-4">
              ${item.is_pinned ? `
                <span class="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 inline-flex items-center gap-1 mb-1">
                  <i class="ph-bold ph-push-pin"></i> Tin nổi bật (Đã ghim)
                </span>
              ` : ''}
              <h2 class="text-xl sm:text-2xl font-black text-slate-800 dark:text-white leading-tight">
                ${item.title}
              </h2>
              <div class="flex items-center gap-2 text-xs text-slate-400">
                <span class="font-bold text-slate-600 dark:text-slate-300">🏛️ ${item.author_name || 'Ban Quản trị'}</span>
                <span>•</span>
                <span>📅 ${dateStr}</span>
              </div>
            </div>
            <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition shrink-0">
              <i class="ph-bold ph-x text-xl"></i>
            </button>
          </div>

          <!-- Modal Body -->
          <div class="space-y-4 text-slate-700 dark:text-slate-200 text-sm leading-relaxed max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            ${item.summary ? `
              <div class="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-600 rounded-r-xl font-medium text-emerald-900 dark:text-emerald-200 text-xs">
                ${item.summary}
              </div>
            ` : ''}

            <div class="whitespace-pre-line text-xs sm:text-sm">
              ${item.content}
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div class="text-[11px] text-slate-400 font-medium">
              Trường Đào tạo cán bộ Agribank
            </div>
            <button onclick="App.closeModal()" class="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs transition">
              Đóng
            </button>
          </div>
        </div>
      </div>
    `;
  },

  openCreateNewsModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5 my-8">
          
          <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
            <div class="flex items-center gap-3">
              <span class="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 text-[#005d39] dark:text-emerald-400 rounded-2xl">
                <i class="ph-bold ph-newspaper-clipping text-2xl"></i>
              </span>
              <div>
                <h3 class="text-lg font-extrabold text-slate-800 dark:text-white">
                  Đăng Tin Tức & Thông Báo Mới
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  Tin tức sẽ hiển thị nổi bật ở đầu trang Tổng Quan của toàn thể cán bộ
                </p>
              </div>
            </div>
            <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition">
              <i class="ph-bold ph-x text-xl"></i>
            </button>
          </div>

          <form onsubmit="Dashboard.submitCreateNews(event)" class="space-y-4 text-xs">
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tiêu đề tin tức *</label>
              <input type="text" id="news-create-title" required placeholder="VD: Thông báo kế hoạch đào tạo cán bộ nguồn năm 2026" class="w-full px-3.5 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-bold dark:text-white focus:ring-2 focus:ring-[#005d39]">
            </div>

            <div class="flex items-center">
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" id="news-create-pinned" class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300">
                <span class="font-bold text-slate-700 dark:text-slate-300">📌 Ghim lên đầu bảng tin (Ưu tiên hiển thị)</span>
              </label>
            </div>

            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tóm tắt ngắn (Tùy chọn)</label>
              <input type="text" id="news-create-summary" placeholder="Mô tả tóm lược nội dung..." class="w-full px-3.5 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl dark:text-white focus:ring-2 focus:ring-[#005d39]">
            </div>

            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Nội dung chi tiết *</label>
              <textarea id="news-create-content" required rows="6" placeholder="Nhập toàn bộ nội dung thông báo, văn bản chỉ đạo hoặc thông tin hoạt động..." class="w-full px-3.5 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl dark:text-white focus:ring-2 focus:ring-[#005d39]"></textarea>
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
              <button type="button" onclick="App.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold transition">
                Hủy bỏ
              </button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-md">
                Đăng tin tức
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitCreateNews(e) {
    e.preventDefault();
    try {
      const title = document.getElementById('news-create-title').value.trim();
      const category = 'Thông báo';
      const is_pinned = document.getElementById('news-create-pinned').checked ? 1 : 0;
      const summary = document.getElementById('news-create-summary').value.trim();
      const content = document.getElementById('news-create-content').value.trim();

      await apiFetch('/api/news', {
        method: 'POST',
        body: JSON.stringify({ title, category, is_pinned, summary, content })
      });

      App.showToast('✅ Đã đăng tin tức lên Bảng Tin Hoạt Động thành công!', 'success');
      App.closeModal();
      this.loadNews();
    } catch (err) {
      alert('Lỗi đăng tin: ' + err.message);
    }
  },

  openEditNewsModal(newsId) {
    const item = this.cachedNews.find(n => n.id === newsId);
    if (!item) return;

    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5 my-8">
          
          <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
            <div class="flex items-center gap-3">
              <span class="p-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-2xl">
                <i class="ph-bold ph-pencil-simple text-2xl"></i>
              </span>
              <div>
                <h3 class="text-lg font-extrabold text-slate-800 dark:text-white">
                  Chỉnh Sửa Tin Tức
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  Cập nhật nội dung tin tức đã đăng
                </p>
              </div>
            </div>
            <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition">
              <i class="ph-bold ph-x text-xl"></i>
            </button>
          </div>

          <form onsubmit="Dashboard.submitEditNews(event, ${newsId})" class="space-y-4 text-xs">
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tiêu đề tin tức *</label>
              <input type="text" id="news-edit-title" required value="${item.title.replace(/"/g, '&quot;')}" class="w-full px-3.5 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-bold dark:text-white focus:ring-2 focus:ring-[#005d39]">
            </div>

            <div class="flex items-center">
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" id="news-edit-pinned" ${item.is_pinned ? 'checked' : ''} class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300">
                <span class="font-bold text-slate-700 dark:text-slate-300">📌 Ghim lên đầu bảng tin (Ưu tiên hiển thị)</span>
              </label>
            </div>

            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tóm tắt ngắn</label>
              <input type="text" id="news-edit-summary" value="${(item.summary || '').replace(/"/g, '&quot;')}" class="w-full px-3.5 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl dark:text-white focus:ring-2 focus:ring-[#005d39]">
            </div>

            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Nội dung chi tiết *</label>
              <textarea id="news-edit-content" required rows="6" class="w-full px-3.5 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl dark:text-white focus:ring-2 focus:ring-[#005d39]">${item.content}</textarea>
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
              <button type="button" onclick="App.closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold transition">
                Hủy bỏ
              </button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md">
                Lưu cập nhật
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitEditNews(e, newsId) {
    e.preventDefault();
    try {
      const title = document.getElementById('news-edit-title').value.trim();
      const category = 'Thông báo';
      const is_pinned = document.getElementById('news-edit-pinned').checked ? 1 : 0;
      const summary = document.getElementById('news-edit-summary').value.trim();
      const content = document.getElementById('news-edit-content').value.trim();

      await apiFetch(`/api/news/${newsId}`, {
        method: 'PUT',
        body: JSON.stringify({ title, category, is_pinned, summary, content })
      });

      App.showToast('✅ Đã cập nhật tin tức thành công!', 'success');
      App.closeModal();
      this.loadNews();
    } catch (err) {
      alert('Lỗi cập nhật: ' + err.message);
    }
  },

  async togglePinNews(newsId) {
    try {
      await apiFetch(`/api/news/${newsId}/pin`, { method: 'PUT' });
      App.showToast('Đã cập nhật trạng thái ghim tin tức', 'success');
      this.loadNews();
    } catch (err) {
      alert('Lỗi ghim tin: ' + err.message);
    }
  },

  async deleteNews(newsId, newsTitle) {
    if (!confirm(`Bạn có chắc chắn muốn xóa bản tin "${newsTitle}"?`)) return;
    try {
      await apiFetch(`/api/news/${newsId}`, { method: 'DELETE' });
      App.showToast('Đã xóa bản tin thành công', 'success');
      this.loadNews();
    } catch (err) {
      alert('Lỗi xóa tin: ' + err.message);
    }
  },

};

window.Dashboard = Dashboard;
