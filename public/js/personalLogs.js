// Personal Work Logs Module (Bản kê khai nhật ký công việc cá nhân)
// Trường Đào tạo cán bộ Agribank
const PersonalLogs = {
  fromDate: '',
  toDate: '',
  filterActivity: '',
  searchQuery: '',
  targetUserId: null,
  targetSupervisorId: null,
  currentStatusTab: 'in_progress', // 'in_progress' | 'completed'
  approvalFilter: 'all', // 'all' | 'pending' | 'approved' | 'rejected'
  cachedTasks: [],
  cachedMembers: [],
  cachedLogs: [],

  getSupervisorOptions(selectedId = null) {
    const leaders = (this.cachedMembers || []).filter(u => ['manager', 'director', 'admin'].includes(u.role));
    const list = leaders.length > 0 ? leaders : (this.cachedMembers || []);

    let html = `<option value="">-- Không gắn lãnh đạo / Chưa chỉ định --</option>`;
    
    list.forEach(u => {
      let isSel = false;
      if (selectedId !== null && selectedId !== undefined && selectedId !== '') {
        isSel = (u.id == selectedId);
      } else {
        // Mặc định chọn Trưởng phòng của phòng mình
        isSel = (Auth.user && u.department_id == Auth.user.department_id && u.role === 'manager' && u.id !== Auth.user.id);
      }
      
      const roleName = u.position || (u.role === 'manager' ? 'Trưởng phòng' : (u.role === 'director' ? 'Ban Giám đốc' : 'Quản trị'));
      const deptName = u.department_name || 'Agribank';
      html += `<option value="${u.id}" ${isSel ? 'selected' : ''}>👔 ${u.full_name} (${roleName} - ${deptName})</option>`;
    });

    return html;
  },

  async render() {
    if (!this.fromDate || !this.toDate) {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      this.fromDate = firstDay.toISOString().split('T')[0];
      this.toDate = lastDay.toISOString().split('T')[0];
    }

    if (!this.targetUserId && !this.targetSupervisorId) {
      this.targetUserId = Auth.isStaff() ? Auth.user.id : 'all';
    }

    const container = document.getElementById('main-content');
    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
              <span class="p-2 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <i class="ph-bold ph-calendar-check text-2xl"></i>
              </span>
              Bản Kê Khai Nhật Ký Công Việc Cá Nhân
            </h1>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Ghi nhận chi tiết thời gian, nội dung, địa điểm, kết quả và lãnh đạo phụ trách phục vụ theo dõi, xác nhận giờ công và đánh giá KPI.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <button onclick="PersonalLogs.checkMissingDays()" class="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-sm transition">
              <i class="ph-bold ph-calendar-x text-base"></i> 🔍 Rà soát ngày thiếu trong tháng
            </button>
            ${(Auth.isManager() || Auth.isDirector() || Auth.isAdmin()) ? `
              <button onclick="PersonalLogs.batchApprovePending()" class="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-sm transition">
                <i class="ph-bold ph-checks text-base"></i> ⚡ Duyệt nhanh tất cả việc chờ duyệt
              </button>
            ` : ''}
            <button onclick="PersonalLogs.exportToExcel()" class="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl flex items-center gap-2 transition">
              <i class="ph-bold ph-file-xls text-emerald-600 text-base"></i> Xuất Bản Kê Khai
            </button>
            <button onclick="PersonalLogs.openCreateModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition">
              <i class="ph-bold ph-plus text-base"></i> Kê khai công việc mới
            </button>
          </div>
        </div>

        <!-- Date Range Selector & Filters -->
        <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            
            <!-- Date Range Box -->
            <div class="flex-1 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-slate-800 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 shadow-sm flex flex-col sm:flex-row items-center gap-3">
              <!-- Start Date -->
              <div class="flex-1 w-full bg-white dark:bg-slate-800 p-3 rounded-xl border border-emerald-100 dark:border-slate-700 shadow-xs">
                <label class="block text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-1">
                  <i class="ph-bold ph-calendar text-sm"></i> TỪ NGÀY (BẮT ĐẦU)
                </label>
                <input type="date" id="flight-from-date" value="${this.fromDate}" onchange="PersonalLogs.handleDateChange()" class="w-full font-bold text-sm text-slate-800 dark:text-white bg-transparent focus:outline-none cursor-pointer">
              </div>

              <!-- Arrow -->
              <div class="hidden sm:flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <div class="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-xs border border-emerald-200 dark:border-slate-700">
                  <i class="ph-bold ph-arrows-left-right text-base"></i>
                </div>
              </div>

              <!-- End Date -->
              <div class="flex-1 w-full bg-white dark:bg-slate-800 p-3 rounded-xl border border-emerald-100 dark:border-slate-700 shadow-xs">
                <label class="block text-[10px] font-extrabold uppercase text-teal-700 dark:text-teal-400 flex items-center gap-1.5 mb-1">
                  <i class="ph-bold ph-calendar-check text-sm"></i> ĐẾN NGÀY (KẾT THÚC)
                </label>
                <input type="date" id="flight-to-date" value="${this.toDate}" onchange="PersonalLogs.handleDateChange()" class="w-full font-bold text-sm text-slate-800 dark:text-white bg-transparent focus:outline-none cursor-pointer">
              </div>
            </div>

            <!-- Member Selector (for Manager / Director) -->
            ${(Auth.isManager() || Auth.isDirector() || Auth.isAdmin()) ? `
              <div class="min-w-[240px]">
                <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Xem phạm vi nhật ký</label>
                <select id="select-log-member" onchange="PersonalLogs.handleMemberChange(this.value)" class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500">
                  <option value="${Auth.user.id}">👤 Bản thân tôi (${Auth.user.full_name})</option>
                </select>
              </div>
            ` : ''}
          </div>

          <!-- Quick Preset Chips & Search -->
          <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
            <div class="flex flex-wrap items-center gap-1.5 text-xs">
              <span class="text-slate-400 text-[11px] font-semibold mr-1">Chọn nhanh:</span>
              <button onclick="PersonalLogs.setPreset('today')" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 font-semibold rounded-lg transition">Hôm nay</button>
              <button onclick="PersonalLogs.setPreset('this_week')" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 font-semibold rounded-lg transition">Tuần này</button>
              <button onclick="PersonalLogs.setPreset('last_week')" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 font-semibold rounded-lg transition">Tuần trước</button>
              <button onclick="PersonalLogs.setPreset('this_month')" class="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold rounded-lg transition">Tháng này</button>
              <button onclick="PersonalLogs.setPreset('last_month')" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 font-semibold rounded-lg transition">Tháng trước</button>
            </div>

            <div class="flex items-center gap-2">
              <div class="relative">
                <input type="text" id="log-search-input" oninput="PersonalLogs.handleSearch(this.value)" placeholder="Tìm nội dung, phân loại, lãnh đạo phụ trách..." class="pl-7 pr-3 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs dark:text-white w-64">
                <i class="ph ph-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              </div>
            </div>
          </div>
        </div>

        <!-- Summary Statistics for Period -->
        <div id="personal-logs-summary" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse h-24"></div>
          <div class="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse h-24"></div>
          <div class="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse h-24"></div>
        </div>

        <!-- Personal Logs Table View with 2 Menus: Đang thực hiện & Đã hoàn thành, and Approval Status Filter -->
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div class="p-5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
            <div class="flex flex-wrap items-center gap-3">
              <h3 class="font-bold text-slate-800 dark:text-white flex items-center gap-2 mr-2">
                <i class="ph-bold ph-list-numbers text-emerald-600"></i>
                Danh sách Nhật ký Kê khai
              </h3>

              <!-- 2 Tabs Switcher: Đang thực hiện & Đã hoàn thành -->
              <div class="bg-slate-100 dark:bg-slate-700 p-1 rounded-xl flex items-center shadow-inner">
                <button onclick="PersonalLogs.setStatusTab('in_progress')" id="btn-tab-inprogress" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${this.currentStatusTab === 'in_progress' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}">
                  <i class="ph-bold ph-hourglass-high mr-1"></i> Đang thực hiện
                  <span id="tab-inprogress-count" class="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-extrabold">0</span>
                </button>
                <button onclick="PersonalLogs.setStatusTab('completed')" id="btn-tab-completed" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${this.currentStatusTab === 'completed' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}">
                  <i class="ph-bold ph-check-circle mr-1"></i> Đã hoàn thành
                  <span id="tab-completed-count" class="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-extrabold">0</span>
                </button>
              </div>

              <!-- Approval Status Filters -->
              <div class="bg-slate-100 dark:bg-slate-700 p-1 rounded-xl flex items-center shadow-inner text-xs">
                <button onclick="PersonalLogs.setApprovalFilter('all')" id="btn-appr-all" class="px-2.5 py-1.5 rounded-lg font-bold transition ${this.approvalFilter === 'all' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}">
                  Tất cả duyệt
                </button>
                <button onclick="PersonalLogs.setApprovalFilter('pending')" id="btn-appr-pending" class="px-2.5 py-1.5 rounded-lg font-bold transition ${this.approvalFilter === 'pending' ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}">
                  🟡 Chờ duyệt <span id="badge-count-pending" class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-extrabold">0</span>
                </button>
                <button onclick="PersonalLogs.setApprovalFilter('approved')" id="btn-appr-approved" class="px-2.5 py-1.5 rounded-lg font-bold transition ${this.approvalFilter === 'approved' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}">
                  🟢 Đã duyệt <span id="badge-count-approved" class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-extrabold">0</span>
                </button>
                <button onclick="PersonalLogs.setApprovalFilter('rejected')" id="btn-appr-rejected" class="px-2.5 py-1.5 rounded-lg font-bold transition ${this.approvalFilter === 'rejected' ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}">
                  🔴 Từ chối <span id="badge-count-rejected" class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 font-extrabold">0</span>
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <span id="log-count-badge" class="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full font-semibold">
                0 bản ghi
              </span>
            </div>
          </div>

          <div class="overflow-x-auto" id="personal-logs-table-container">
            <div class="py-12 text-center text-slate-400">
              <i class="ph ph-spinner animate-spin text-3xl mr-2 text-emerald-600"></i> Đang tải dữ liệu bản kê khai...
            </div>
          </div>
        </div>
      </div>
    `;

    await this.initMembersAndTasks();
    await this.loadLogs();
  },

  async initMembersAndTasks() {
    try {
      const [tasks, users] = await Promise.all([
        apiFetch('/api/tasks?all_dept=1'),
        apiFetch('/api/users')
      ]);
      this.cachedTasks = tasks;
      this.cachedMembers = users;

      const isStaff = Auth.isStaff();
      const isManager = Auth.isManager();
      const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();
      const rawDeptName = Auth.user?.department_name || 'Phòng ban';
      const cleanDeptName = rawDeptName.startsWith('Phòng') ? rawDeptName : ('Phòng ' + rawDeptName);

      const memberSelect = document.getElementById('select-log-member');
      if (memberSelect) {
        let optionsHtml = '';

        if (isStaff) {
          this.targetUserId = Auth.user.id;
          optionsHtml = `<option value="${Auth.user.id}">👤 Bản thân tôi (${Auth.user.full_name})</option>`;
        } else if (isManager) {
          optionsHtml = `<option value="all">🏢 Tất cả cán bộ trong phòng (${cleanDeptName})</option>`;
          optionsHtml += `<option value="supervised_${Auth.user.id}">👔 Việc tôi là Lãnh đạo phụ trách</option>`;
          optionsHtml += `<option value="${Auth.user.id}">👤 ${Auth.user.full_name} (Trưởng phòng)</option>`;
          
          const deptMembers = users.filter(u => u.department_id == Auth.user.department_id && u.id !== Auth.user.id);
          deptMembers.forEach(u => {
            optionsHtml += `<option value="${u.id}" ${this.targetUserId == u.id ? 'selected' : ''}>👤 ${u.full_name} (${u.position || u.role})</option>`;
          });
        } else {
          optionsHtml = `<option value="all">🏛️ Toàn Trường (Tất cả 5 Phòng Ban)</option>`;
          optionsHtml += `<option value="supervised_${Auth.user.id}">👔 Việc tôi là Lãnh đạo phụ trách</option>`;
          optionsHtml += `<option value="${Auth.user.id}">👤 ${Auth.user.full_name} (Bản thân tôi)</option>`;

          const deptsMap = {};
          users.forEach(u => {
            const dName = u.department_name || 'Phòng ban';
            if (!deptsMap[dName]) deptsMap[dName] = [];
            deptsMap[dName].push(u);
          });

          Object.keys(deptsMap).forEach(dName => {
            optionsHtml += `<optgroup label="🏢 ${dName}">`;
            deptsMap[dName].forEach(u => {
              if (u.id !== Auth.user.id) {
                optionsHtml += `<option value="${u.id}" ${this.targetUserId == u.id ? 'selected' : ''}>${u.full_name} (${u.position || u.role})</option>`;
              }
            });
            optionsHtml += `</optgroup>`;
          });
        }

        memberSelect.innerHTML = optionsHtml;
      }
    } catch (e) {
      console.error(e);
    }
  },

  handleDateChange() {
    this.fromDate = document.getElementById('flight-from-date').value;
    this.toDate = document.getElementById('flight-to-date').value;
    this.loadLogs();
  },

  handleMemberChange(val) {
    if (typeof val === 'string' && val.startsWith('supervised_')) {
      this.targetSupervisorId = parseInt(val.replace('supervised_', ''));
      this.targetUserId = null;
    } else {
      this.targetSupervisorId = null;
      this.targetUserId = val === 'all' ? 'all' : parseInt(val);
    }
    this.loadLogs();
  },

  handleSearch(val) {
    this.searchQuery = val;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.loadLogs(), 300);
  },

  setPreset(preset) {
    const now = new Date();
    if (preset === 'today') {
      const d = now.toISOString().split('T')[0];
      this.fromDate = d;
      this.toDate = d;
    } else if (preset === 'this_week') {
      const day = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      this.fromDate = monday.toISOString().split('T')[0];
      this.toDate = sunday.toISOString().split('T')[0];
    } else if (preset === 'last_week') {
      const day = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day - 6);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      this.fromDate = monday.toISOString().split('T')[0];
      this.toDate = sunday.toISOString().split('T')[0];
    } else if (preset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      this.fromDate = first.toISOString().split('T')[0];
      this.toDate = last.toISOString().split('T')[0];
    } else if (preset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      this.fromDate = first.toISOString().split('T')[0];
      this.toDate = last.toISOString().split('T')[0];
    }

    const fromInput = document.getElementById('flight-from-date');
    const toInput = document.getElementById('flight-to-date');
    if (fromInput) fromInput.value = this.fromDate;
    if (toInput) toInput.value = this.toDate;

    this.loadLogs();
  },

  setStatusTab(tab) {
    this.currentStatusTab = tab;
    const btnInProg = document.getElementById('btn-tab-inprogress');
    const btnComp = document.getElementById('btn-tab-completed');

    if (tab === 'in_progress') {
      if (btnInProg) btnInProg.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm';
      if (btnComp) btnComp.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition text-slate-600 dark:text-slate-300';
    } else {
      if (btnComp) btnComp.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm';
      if (btnInProg) btnInProg.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition text-slate-600 dark:text-slate-300';
    }
    this.renderTable(this.cachedLogs || []);
  },

  setApprovalFilter(filter) {
    this.approvalFilter = filter;
    const filters = ['all', 'pending', 'approved', 'rejected'];
    filters.forEach(f => {
      const btn = document.getElementById(`btn-appr-${f}`);
      if (btn) {
        let activeClass = 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm';
        if (f === 'pending') activeClass = 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm';
        if (f === 'approved') activeClass = 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm';
        if (f === 'rejected') activeClass = 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm';

        if (this.approvalFilter === f) {
          btn.className = `px-2.5 py-1.5 rounded-lg font-bold transition ${activeClass}`;
        } else {
          btn.className = 'px-2.5 py-1.5 rounded-lg font-bold transition text-slate-500 dark:text-slate-400';
        }
      }
    });
    this.renderTable(this.cachedLogs || []);
  },

  async toggleStatus(id, newStatus) {
    try {
      await apiFetch(`/api/personal-logs/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      App.showToast(newStatus === 'completed' ? '✓ Đã chuyển công việc sang trạng thái ĐÃ HOÀN THÀNH!' : '↩ Đã khôi phục công việc về trạng thái ĐANG THỰC HIỆN!', 'success');
      await this.loadLogs();
    } catch (err) {
      alert('Lỗi cập nhật trạng thái: ' + err.message);
    }
  },

  async quickApprove(id, title, status = 'approved', comment = null) {
    try {
      await apiFetch(`/api/personal-logs/${id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ status, comment })
      });
      if (status === 'approved') {
        App.showToast(`✓ Đã duyệt và xác nhận nhật ký "${title}"!`, 'success');
      } else if (status === 'rejected') {
        App.showToast(`Đã từ chối nhật ký "${title}"!`, 'info');
      } else {
        App.showToast(`Đã đưa nhật ký "${title}" về Chờ duyệt!`, 'info');
      }
      await this.loadLogs();
    } catch (err) {
      alert('Lỗi phê duyệt: ' + err.message);
    }
  },

  openRejectModal(id, title) {
    const modalContainer = document.getElementById('modal-container');
    const safeTitle = (title || '').replace(/"/g, '&quot;');
    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <h3 class="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <i class="ph-bold ph-x-circle text-rose-500 text-xl"></i> Từ chối duyệt Nhật ký
            </h3>
            <button onclick="App.closeModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <i class="ph-bold ph-x text-lg"></i>
            </button>
          </div>
          <div>
            <p class="text-xs text-slate-600 dark:text-slate-300 mb-2.5">
              Công việc: <b class="text-slate-800 dark:text-white">${safeTitle}</b>
            </p>
            <label class="block text-xs font-bold uppercase text-slate-500 mb-1">
              Lý do từ chối (Gửi thông báo đến cán bộ) <span class="text-rose-500">*</span>
            </label>
            <textarea id="reject-reason-input" rows="3" required placeholder="Nhập lý do không xác nhận giờ công hoặc yêu cầu cán bộ chỉnh sửa lại..." class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs dark:text-white focus:ring-2 focus:ring-rose-500"></textarea>
          </div>
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            <button type="button" onclick="App.closeModal()" class="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl">Hủy bỏ</button>
            <button type="button" onclick="PersonalLogs.submitReject(${id}, \`${safeTitle}\`)" class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition">Xác nhận từ chối</button>
          </div>
        </div>
      </div>
    `;
  },

  async submitReject(id, title) {
    const reason = document.getElementById('reject-reason-input')?.value?.trim();
    if (!reason) {
      alert('Vui lòng nhập lý do từ chối để cán bộ nắm thông tin!');
      return;
    }
    App.closeModal();
    await this.quickApprove(id, title, 'rejected', reason);
  },

  async batchApprovePending() {
    const pendingLogs = (this.cachedLogs || []).filter(l => (l.approval_status || 'pending') === 'pending');
    if (pendingLogs.length === 0) {
      App.showToast('Không có nhật ký công việc nào đang chờ duyệt!', 'info');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn DUYỆT TẤT CẢ ${pendingLogs.length} nhật ký công việc đang chờ duyệt trong danh sách này?`)) {
      return;
    }

    try {
      const ids = pendingLogs.map(l => l.id);
      await apiFetch('/api/personal-logs/batch-approve', {
        method: 'POST',
        body: JSON.stringify({ log_ids: ids, status: 'approved' })
      });
      App.showToast(`✓ Đã duyệt nhanh thành công ${ids.length} nhật ký công việc!`, 'success');
      await this.loadLogs();
    } catch (err) {
      alert('Lỗi phê duyệt hàng loạt: ' + err.message);
    }
  },

  async loadLogs() {
    try {
      let query = `?from_date=${this.fromDate}&to_date=${this.toDate}`;
      if (this.targetSupervisorId) {
        query += `&supervisor_id=${this.targetSupervisorId}`;
      } else if (this.targetUserId) {
        query += `&user_id=${this.targetUserId}`;
      }
      if (this.searchQuery) query += `&search=${encodeURIComponent(this.searchQuery)}`;

      const [logs, stats] = await Promise.all([
        apiFetch(`/api/personal-logs${query}`),
        apiFetch(`/api/personal-logs/stats${query}`)
      ]);

      this.cachedLogs = logs || [];
      this.renderSummary(stats, this.cachedLogs);
      this.renderTable(this.cachedLogs);
    } catch (err) {
      console.error('Error loading personal logs:', err);
    }
  },

  renderSummary(stats, logs) {
    const summaryContainer = document.getElementById('personal-logs-summary');
    if (!summaryContainer) return;

    const inProgressCount = logs.filter(l => l.status !== 'completed').length;
    const completedCount = logs.filter(l => l.status === 'completed').length;

    const pendingCount = logs.filter(l => (l.approval_status || 'pending') === 'pending').length;
    const approvedCount = logs.filter(l => l.approval_status === 'approved').length;
    const rejectedCount = logs.filter(l => l.approval_status === 'rejected').length;

    const inProgBadge = document.getElementById('tab-inprogress-count');
    const compBadge = document.getElementById('tab-completed-count');
    const logBadge = document.getElementById('log-count-badge');

    const badgePending = document.getElementById('badge-count-pending');
    const badgeApproved = document.getElementById('badge-count-approved');
    const badgeRejected = document.getElementById('badge-count-rejected');

    if (inProgBadge) inProgBadge.innerText = inProgressCount;
    if (compBadge) compBadge.innerText = completedCount;
    if (logBadge) logBadge.innerText = `${logs.length} bản ghi`;

    if (badgePending) badgePending.innerText = pendingCount;
    if (badgeApproved) badgeApproved.innerText = approvedCount;
    if (badgeRejected) badgeRejected.innerText = rejectedCount;

    summaryContainer.innerHTML = `
      <!-- Total Hours -->
      <div class="p-5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl shadow-sm relative overflow-hidden">
        <div class="absolute -right-2 -bottom-2 text-white/10">
          <i class="ph ph-timer text-7xl"></i>
        </div>
        <div class="relative z-10">
          <div class="flex items-center justify-between text-xs font-bold text-emerald-100 uppercase">
            <span>Tổng giờ công thực tế</span>
            <i class="ph-bold ph-hourglass-high text-base"></i>
          </div>
          <div class="mt-2 flex items-baseline gap-1.5">
            <span class="text-3xl font-extrabold">${stats.total_hours || 0}</span>
            <span class="text-xs text-emerald-100">giờ</span>
          </div>
          <div class="text-[11px] text-emerald-100/90 mt-1">Quy đổi ~${Math.round((stats.total_hours || 0) / 8 * 10) / 10} ngày công chuẩn</div>
        </div>
      </div>

      <!-- In-Progress vs Completed Tasks -->
      <div class="p-5 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl shadow-sm relative overflow-hidden">
        <div class="absolute -right-2 -bottom-2 text-white/10">
          <i class="ph ph-list-checks text-7xl"></i>
        </div>
        <div class="relative z-10">
          <div class="flex items-center justify-between text-xs font-bold text-blue-100 uppercase">
            <span>Tiến trình hoàn thành</span>
            <i class="ph-bold ph-chart-donut text-base"></i>
          </div>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="text-3xl font-extrabold text-white">${completedCount}</span>
            <span class="text-xs text-blue-100">/ ${logs.length} việc hoàn thành</span>
          </div>
          <div class="text-[11px] text-blue-100/90 mt-1">Đang thực hiện: <b>${inProgressCount} việc</b></div>
        </div>
      </div>

      <!-- Approval Status KPI -->
      <div class="p-5 bg-gradient-to-br from-amber-500 to-amber-700 text-white rounded-2xl shadow-sm relative overflow-hidden">
        <div class="absolute -right-2 -bottom-2 text-white/10">
          <i class="ph ph-stamp text-7xl"></i>
        </div>
        <div class="relative z-10">
          <div class="flex items-center justify-between text-xs font-bold text-amber-100 uppercase">
            <span>Trạng thái Phê duyệt</span>
            <i class="ph-bold ph-check-square-offset text-base"></i>
          </div>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="text-3xl font-extrabold text-white">${approvedCount}</span>
            <span class="text-xs text-amber-100">/ ${logs.length} đã duyệt</span>
          </div>
          <div class="text-[11px] text-amber-100/90 mt-1 flex items-center gap-2">
            <span>Chờ duyệt: <b>${pendingCount}</b></span>
            ${rejectedCount > 0 ? `<span>• Từ chối: <b>${rejectedCount}</b></span>` : ''}
          </div>
        </div>
      </div>
    `;
  },

  renderTable(logs) {
    const container = document.getElementById('personal-logs-table-container');
    if (!container) return;

    const allLogs = logs || [];
    const inProgressLogs = allLogs.filter(l => l.status !== 'completed');
    const completedLogs = allLogs.filter(l => l.status === 'completed');

    const inProgBadge = document.getElementById('tab-inprogress-count');
    const compBadge = document.getElementById('tab-completed-count');
    const logBadge = document.getElementById('log-count-badge');

    if (inProgBadge) inProgBadge.innerText = inProgressLogs.length;
    if (compBadge) compBadge.innerText = completedLogs.length;
    if (logBadge) logBadge.innerText = `${allLogs.length} bản ghi`;

    // Filter by tab (in_progress vs completed)
    let filteredLogs = this.currentStatusTab === 'in_progress' ? inProgressLogs : completedLogs;

    // Filter by approval filter
    if (this.approvalFilter !== 'all') {
      filteredLogs = filteredLogs.filter(l => (l.approval_status || 'pending') === this.approvalFilter);
    }

    if (!filteredLogs || filteredLogs.length === 0) {
      const isProg = this.currentStatusTab === 'in_progress';
      container.innerHTML = `
        <div class="py-12 text-center text-slate-400">
          <i class="ph ${isProg ? 'ph-hourglass-high' : 'ph-check-circle'} text-5xl mb-2 ${isProg ? 'text-blue-400' : 'text-emerald-400'}"></i>
          <p class="text-sm font-semibold">
            ${isProg ? 'Không có công việc nào đang thực hiện phù hợp với bộ lọc.' : 'Chưa có công việc nào đã hoàn thành phù hợp với bộ lọc.'}
          </p>
          ${isProg ? `
            <button onclick="PersonalLogs.openCreateModal()" class="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition">
              + Kê khai công việc mới
            </button>
          ` : ''}
        </div>
      `;
      return;
    }

    const isManager = Auth.isManager();
    const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();

    container.innerHTML = `
      <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
        <thead class="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
          <tr>
            <th class="px-4 py-3.5">Thời gian thực hiện</th>
            <th class="px-4 py-3.5">Nội dung công việc</th>
            <th class="px-4 py-3.5">Phân loại & Nhiệm vụ</th>
            <th class="px-4 py-3.5 text-center">Thời lượng</th>
            <th class="px-4 py-3.5">Địa điểm</th>
            <th class="px-4 py-3.5 text-center">Trạng thái Duyệt</th>
            <th class="px-4 py-3.5 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/60">
          ${filteredLogs.map(l => {
            const canEdit = l.user_id === Auth.user.id || Auth.isAdmin();
            const isCompleted = l.status === 'completed';
            const approvalStatus = l.approval_status || 'pending';
            const canApprove = isDirectorOrAdmin || (isManager && l.department_id == Auth.user.department_id);
            const safeTitle = (l.title || '').replace(/"/g, '&quot;').replace(/'/g, "\\'");

            let approvalBadge = '';
            if (approvalStatus === 'approved') {
              approvalBadge = `
                <div class="inline-flex flex-col items-center">
                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs" title="Duyệt bởi: ${l.approved_by_name || 'Lãnh đạo'} lúc ${l.approved_at ? l.approved_at.substring(0, 16) : ''}">
                    <i class="ph-bold ph-check-circle"></i> Đã duyệt
                  </span>
                  <span class="text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]">${l.approved_by_name || 'Lãnh đạo'}</span>
                </div>
              `;
            } else if (approvalStatus === 'rejected') {
              approvalBadge = `
                <div class="inline-flex flex-col items-center">
                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 shadow-2xs" title="Lý do: ${l.approval_comment || 'Không đạt'}">
                    <i class="ph-bold ph-x-circle"></i> Từ chối
                  </span>
                  ${l.approval_comment ? `<span class="text-[10px] text-rose-500 mt-0.5 truncate max-w-[120px]" title="${l.approval_comment}">${l.approval_comment}</span>` : ''}
                </div>
              `;
            } else {
              approvalBadge = `
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shadow-2xs">
                  <i class="ph-bold ph-hourglass-high"></i> Chờ duyệt
                </span>
              `;
            }

            return `
              <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition ${isCompleted ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''}">
                <td class="px-4 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-800 dark:text-white">
                    <span class="${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}">${l.start_date}</span>
                    ${l.start_date !== l.end_date ? `<i class="ph-bold ph-arrow-right text-slate-400 text-[10px]"></i><span class="text-cyan-600 dark:text-cyan-400">${l.end_date}</span>` : ''}
                  </div>
                  ${l.start_time && l.end_time ? `
                    <div class="mt-1">
                      <span class="inline-flex items-center gap-1 text-[11px] font-bold ${isCompleted ? 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800' : 'text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800'} px-2 py-0.5 rounded-md border">
                        <i class="ph-bold ph-clock text-xs"></i> ${l.start_time} - ${l.end_time}
                      </span>
                    </div>
                  ` : ''}
                  <div class="text-[11px] text-slate-400 mt-0.5 font-medium">${l.user_name} (${l.department_code || 'PHÒNG'})</div>
                </td>

                <td class="px-4 py-4 max-w-sm">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-800 dark:text-white ${isCompleted ? 'line-through text-slate-500 dark:text-slate-400' : ''}">${l.title}</span>
                    ${isCompleted ? '<span class="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">Đã xong</span>' : '<span class="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">Đang làm</span>'}
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">${l.description}</p>
                </td>

                <td class="px-4 py-4">
                  <span class="inline-block text-xs font-bold px-2.5 py-1 rounded-lg ${isCompleted ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'}">
                    ${l.activity_type || 'Công tác chuyên môn'}
                  </span>
                  <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                    <i class="ph-bold ph-link text-slate-400"></i>
                    <span class="font-medium">${l.task_title || l.task_name || 'Việc phát sinh ngoài kế hoạch'}</span>
                  </div>
                  ${l.supervisor_name ? `
                    <div class="text-[11px] text-indigo-700 dark:text-indigo-400 mt-1 flex items-center gap-1 font-semibold" title="Lãnh đạo phụ trách: ${l.supervisor_name} (${l.supervisor_position || 'Lãnh đạo'})">
                      <i class="ph-bold ph-user-focus text-xs"></i>
                      <span>LĐ phụ trách: <b>${l.supervisor_name}</b></span>
                    </div>
                  ` : ''}
                </td>

                <td class="px-4 py-4 text-center whitespace-nowrap">
                  <div class="font-extrabold text-sm text-slate-800 dark:text-white">${l.hours_spent}h</div>
                  <div class="text-[10px] text-slate-400">${Math.round(l.hours_spent / 8 * 10) / 10} ngày công</div>
                </td>

                <td class="px-4 py-4 text-xs">
                  <div class="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                    <i class="ph-bold ph-map-pin text-rose-500"></i>
                    <span>${l.location || 'Tại Trường Agribank'}</span>
                  </div>
                </td>

                <td class="px-4 py-4 text-center whitespace-nowrap">
                  ${approvalBadge}
                </td>

                <td class="px-4 py-4 text-right whitespace-nowrap">
                  <div class="flex items-center justify-end gap-1.5">
                    <!-- Quick Approvals for Manager / Director / Admin -->
                    ${canApprove ? `
                      ${approvalStatus === 'pending' ? `
                        <button onclick="PersonalLogs.quickApprove(${l.id}, \`${safeTitle}\`)" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition" title="Xác nhận & Duyệt nhật ký ngay">
                          <i class="ph-bold ph-check-circle text-sm"></i> Duyệt
                        </button>
                        <button onclick="PersonalLogs.openRejectModal(${l.id}, \`${safeTitle}\`)" class="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition" title="Từ chối duyệt">
                          <i class="ph-bold ph-x-circle text-base"></i>
                        </button>
                      ` : approvalStatus === 'approved' ? `
                        <button onclick="PersonalLogs.quickApprove(${l.id}, \`${safeTitle}\`, 'pending')" class="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition" title="Hủy duyệt (Đưa về Chờ duyệt)">
                          <i class="ph-bold ph-arrow-counter-clockwise text-base"></i>
                        </button>
                      ` : `
                        <button onclick="PersonalLogs.quickApprove(${l.id}, \`${safeTitle}\`, 'approved')" class="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition" title="Duyệt lại">
                          <i class="ph-bold ph-check-circle text-base"></i>
                        </button>
                      `}
                    ` : ''}

                    ${canEdit ? `
                      <!-- Nút chuyển trạng thái hoàn thành / đang làm -->
                      ${!isCompleted ? `
                        <button onclick="PersonalLogs.toggleStatus(${l.id}, 'completed')" class="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition" title="Đánh dấu công việc đã hoàn thành">
                          <i class="ph-bold ph-check text-sm"></i> Xong
                        </button>
                      ` : `
                        <button onclick="PersonalLogs.toggleStatus(${l.id}, 'in_progress')" class="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition" title="Khôi phục về trạng thái Đang thực hiện">
                          <i class="ph-bold ph-arrow-counter-clockwise text-sm"></i> Làm lại
                        </button>
                      `}

                      <button onclick="PersonalLogs.openEditModal(${l.id}, \`${encodeURIComponent(JSON.stringify(l))}\`)" class="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition" title="Sửa bản kê khai">
                        <i class="ph-bold ph-pencil-simple text-base"></i>
                      </button>
                      <button onclick="PersonalLogs.deleteLog(${l.id})" class="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition" title="Xóa bản kê khai">
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
    `;
  },

  calculateHoursSpent(startTime, endTime) {
    if (!startTime || !endTime) return null;
    const [h1, m1] = startTime.split(':').map(Number);
    const [h2, m2] = endTime.split(':').map(Number);
    const diffMins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diffMins <= 0) return null;
    return Math.round((diffMins / 60) * 10) / 10;
  },

  checkDateConflict(startDate, endDate, startTime = null, endTime = null, excludeId = null) {
    if (!this.cachedLogs || !startDate || !endDate) return null;
    const currentUserId = this.targetUserId || Auth.user.id;
    const cleanStart = startTime ? startTime.trim() : null;
    const cleanEnd = endTime ? endTime.trim() : null;

    for (const l of this.cachedLogs) {
      if (l.user_id !== currentUserId) continue;
      if (excludeId && l.id == excludeId) continue;

      const datesOverlap = startDate <= l.end_date && endDate >= l.start_date;
      if (!datesOverlap) continue;

      const isBothSingleDay = (startDate === endDate) && (l.start_date === l.end_date) && (startDate === l.start_date);
      const hasBothTimes = cleanStart && cleanEnd && l.start_time && l.end_time;

      if (isBothSingleDay && hasBothTimes) {
        const timesOverlap = cleanStart < l.end_time && cleanEnd > l.start_time;
        if (timesOverlap) {
          return {
            log: l,
            message: `Trùng giờ trong ngày ${startDate}: Từ ${cleanStart} đến ${cleanEnd} bị trùng với công việc "${l.title}" (${l.start_time} - ${l.end_time})!`
          };
        }
        // Times do not overlap on this single day -> Allowed!
        continue;
      }

      const existingRange = l.start_date === l.end_date ? l.start_date : `${l.start_date} đến ${l.end_date}`;
      const newRange = startDate === endDate ? startDate : `${startDate} đến ${endDate}`;

      if (l.start_time && l.end_time) {
        return {
          log: l,
          message: `Ngày (${newRange}) đã có việc "${l.title}" (${existingRange}, khung giờ ${l.start_time} - ${l.end_time}). Vui lòng nhập khung giờ cụ thể không trùng với công việc này để kê khai nhiều việc trong 1 ngày!`
        };
      } else if (cleanStart && cleanEnd) {
        return {
          log: l,
          message: `Ngày (${newRange}) đã có việc "${l.title}" (${existingRange}) kê khai trọn ngày (chưa chia giờ). Vui lòng sửa công việc trước đó để chia khung giờ hoặc chọn ngày khác!`
        };
      } else {
        return {
          log: l,
          message: `Ngày kê khai (${newRange}) bị trùng với công việc "${l.title}" (${existingRange}). Nếu 1 ngày làm nhiều việc, vui lòng nhập khung giờ (Từ mấy giờ đến mấy giờ)!`
        };
      }
    }

    return null;
  },

  handleModalDateChange(mode, excludeId = null) {
    const prefix = mode === 'create' ? 'modal' : 'edit';
    const startDateEl = document.getElementById(`${prefix}-start-date`);
    const endDateEl = document.getElementById(`${prefix}-end-date`);
    const startTimeEl = document.getElementById(`${prefix}-start-time`);
    const endTimeEl = document.getElementById(`${prefix}-end-time`);
    const hoursEl = document.getElementById(`${prefix}-log-hours`);
    const warningBox = document.getElementById(`${prefix}-date-conflict-warning`);
    const submitBtn = document.getElementById(`${prefix}-submit-btn`);

    if (!startDateEl || !endDateEl || !warningBox) return;

    const startDate = startDateEl.value;
    const endDate = endDateEl.value;
    const startTime = startTimeEl ? startTimeEl.value : null;
    const endTime = endTimeEl ? endTimeEl.value : null;

    // Auto calculate hours if both times are set
    if (startTime && endTime && hoursEl) {
      const calcHours = this.calculateHoursSpent(startTime, endTime);
      if (calcHours && calcHours > 0) {
        hoursEl.value = calcHours;
      }
    }

    if (!startDate || !endDate) {
      warningBox.classList.add('hidden');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      warningBox.innerHTML = `
        <i class="ph-bold ph-warning-circle text-base text-rose-600 shrink-0"></i>
        <span><b>Lỗi ngày:</b> Ngày bắt đầu không được lớn hơn ngày kết thúc!</span>
      `;
      warningBox.classList.remove('hidden');
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    if ((startTime && !endTime) || (!startTime && endTime)) {
      warningBox.innerHTML = `
        <i class="ph-bold ph-info text-base text-amber-600 shrink-0"></i>
        <span><b>Lưu ý:</b> Nếu kê khai theo khung giờ, vui lòng nhập đầy đủ cả Giờ bắt đầu và Giờ kết thúc (hoặc để trống cả hai).</span>
      `;
      warningBox.classList.remove('hidden');
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    if (startDate === endDate && startTime && endTime && startTime >= endTime) {
      warningBox.innerHTML = `
        <i class="ph-bold ph-warning-circle text-base text-rose-600 shrink-0"></i>
        <span><b>Lỗi giờ:</b> Giờ bắt đầu (${startTime}) phải nhỏ hơn Giờ kết thúc (${endTime})!</span>
      `;
      warningBox.classList.remove('hidden');
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    const conflict = this.checkDateConflict(startDate, endDate, startTime, endTime, excludeId);
    if (conflict) {
      warningBox.innerHTML = `
        <i class="ph-bold ph-warning-octagon text-base text-rose-600 shrink-0"></i>
        <span>${conflict.message}</span>
      `;
      warningBox.classList.remove('hidden');
      if (submitBtn) submitBtn.disabled = true;
    } else {
      warningBox.classList.add('hidden');
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  openCreateModal(defaultDate = null) {
    const modalContainer = document.getElementById('modal-container');
    const today = defaultDate || new Date().toISOString().split('T')[0];

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-700">
          <div class="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10">
            <h3 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <i class="ph-bold ph-calendar-plus text-emerald-600"></i> Kê khai Nhật ký Công việc Cá nhân
            </h3>
            <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700">
              <i class="ph-bold ph-x text-lg"></i>
            </button>
          </div>

          <form onsubmit="PersonalLogs.submitCreate(event)" class="p-6 space-y-4">
            <div class="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-slate-800 rounded-2xl border border-emerald-200 dark:border-emerald-800">
              <div class="flex items-center justify-between mb-3">
                <div class="text-xs font-bold uppercase text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <i class="ph-bold ph-calendar-blank text-base"></i> Khoảng thời gian thực hiện
                </div>
                <span class="text-[11px] text-emerald-700/80 dark:text-emerald-400 font-medium italic">
                  (Có thể nhập giờ nếu 1 ngày làm nhiều việc)
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div class="bg-white dark:bg-slate-800 p-3 rounded-xl border border-emerald-200 dark:border-slate-700 shadow-xs">
                  <label class="block text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400 mb-1">
                    TỪ NGÀY (BẮT ĐẦU) <span class="text-red-500">*</span>
                  </label>
                  <input type="date" id="modal-start-date" required value="${today}" onchange="PersonalLogs.handleModalDateChange('create')" class="w-full font-bold text-sm text-slate-800 dark:text-white bg-transparent focus:outline-none">
                </div>

                <div class="bg-white dark:bg-slate-800 p-3 rounded-xl border border-teal-200 dark:border-slate-700 shadow-xs">
                  <label class="block text-[10px] font-extrabold uppercase text-teal-700 dark:text-teal-400 mb-1">
                    ĐẾN NGÀY (KẾT THÚC) <span class="text-red-500">*</span>
                  </label>
                  <input type="date" id="modal-end-date" required value="${today}" onchange="PersonalLogs.handleModalDateChange('create')" class="w-full font-bold text-sm text-slate-800 dark:text-white bg-transparent focus:outline-none">
                </div>
              </div>

              <!-- Time Inputs (Optional) -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-emerald-200/70 dark:border-emerald-800/70">
                <div class="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <label class="block text-[10px] font-extrabold uppercase text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <i class="ph-bold ph-clock text-xs text-emerald-600"></i> TỪ MẤY GIỜ <span class="text-[10px] font-normal text-slate-400 lowercase">(tùy chọn)</span>
                  </label>
                  <input type="time" id="modal-start-time" onchange="PersonalLogs.handleModalDateChange('create')" class="w-full font-semibold text-xs text-slate-800 dark:text-white bg-transparent focus:outline-none">
                </div>

                <div class="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <label class="block text-[10px] font-extrabold uppercase text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <i class="ph-bold ph-clock-afternoon text-xs text-emerald-600"></i> ĐẾN MẤY GIỜ <span class="text-[10px] font-normal text-slate-400 lowercase">(tùy chọn)</span>
                  </label>
                  <input type="time" id="modal-end-time" onchange="PersonalLogs.handleModalDateChange('create')" class="w-full font-semibold text-xs text-slate-800 dark:text-white bg-transparent focus:outline-none">
                </div>
              </div>

              <!-- Duplicate Warning Alert Box -->
              <div id="modal-date-conflict-warning" class="hidden mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center gap-2"></div>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Tên đầu việc / Nội dung chính <span class="text-red-500">*</span></label>
              <input type="text" id="modal-log-title" required placeholder="VD: Đi quản lý lớp, Soạn giáo trình, Thẩm định hồ sơ..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white">
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Phân loại hoạt động</label>
                <input type="text" id="modal-log-type" list="activity-suggestions" placeholder="Tự nhập (vd: Đi quản lý lớp, Giảng dạy...)" class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs dark:text-white font-medium focus:ring-2 focus:ring-emerald-500">
                <datalist id="activity-suggestions">
                  <option value="Đi quản lý lớp">
                  <option value="Giảng dạy">
                  <option value="Nghiên cứu khoa học">
                  <option value="Biên soạn giáo trình">
                  <option value="Kế toán & Tài chính">
                  <option value="Đi công tác chi nhánh">
                  <option value="Công tác chuyên môn">
                  <option value="Hành chính & Hậu cần">
                </datalist>
              </div>

              <div>
                <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Số giờ thực hiện (h)</label>
                <input type="number" id="modal-log-hours" step="0.5" min="0.5" max="200" value="8" required class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold dark:text-white">
              </div>

              <div>
                <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Gắn với nhiệm vụ</label>
                <input type="text" id="modal-log-task" list="task-suggestions" placeholder="Tự nhập tên nhiệm vụ / đề tài..." class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs dark:text-white font-medium focus:ring-2 focus:ring-emerald-500">
                <datalist id="task-suggestions">
                  ${this.cachedTasks.map(t => `<option value="${t.title}">`).join('')}
                </datalist>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                <i class="ph-bold ph-user-focus text-emerald-600"></i> Lãnh đạo phòng phụ trách / Giao việc
              </label>
              <select id="modal-log-supervisor" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500">
                ${this.getSupervisorOptions()}
              </select>
              <p class="text-[11px] text-slate-400 mt-1">Lãnh đạo được chọn sẽ nhận được thông báo và theo dõi được công việc này trong tài khoản quản lý.</p>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Địa điểm thực hiện</label>
              <input type="text" id="modal-log-location" value="Tại Trường ĐT CB Agribank" placeholder="VD: Giảng đường 301, Chi nhánh Agribank..." class="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs dark:text-white">
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Chi tiết công việc đã thực hiện <span class="text-red-500">*</span></label>
              <textarea id="modal-log-desc" rows="3" required placeholder="Ghi rõ các công việc cụ thể đã giải quyết trong khoảng thời gian này..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs dark:text-white"></textarea>
            </div>

            <!-- Status & Auto-Complete Setting -->
            <div class="p-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-600 space-y-2.5">
              <div class="flex items-center justify-between">
                <label class="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                  Trạng thái công việc ban đầu
                </label>
                <div class="flex items-center gap-3">
                  <label class="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer text-blue-600 dark:text-blue-400">
                    <input type="radio" name="modal-log-status" value="in_progress" checked class="text-blue-600 focus:ring-blue-500">
                    <span>⏳ Đang thực hiện</span>
                  </label>
                  <label class="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer text-emerald-600 dark:text-emerald-400">
                    <input type="radio" name="modal-log-status" value="completed" class="text-emerald-600 focus:ring-emerald-500">
                    <span>✅ Đã hoàn thành</span>
                  </label>
                </div>
              </div>

              <div class="pt-2 border-t border-slate-200 dark:border-slate-600">
                <label for="modal-log-auto-complete" class="text-xs text-slate-600 dark:text-slate-300 cursor-pointer flex items-center gap-2">
                  <input type="checkbox" id="modal-log-auto-complete" checked class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300">
                  <span><b>Tự động chuyển trạng thái:</b> Tự chuyển sang <i>"Đã hoàn thành"</i> khi hết thời gian thực hiện (hết ngày/giờ kết thúc).</span>
                </label>
              </div>
            </div>

            <div class="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button type="button" onclick="App.closeModal()" class="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs">
                Hủy bỏ
              </button>
              <button type="submit" id="modal-submit-btn" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-sm transition">
                Lưu Bản Kê Khai
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    setTimeout(() => this.handleModalDateChange('create'), 100);
  },

  async submitCreate(e) {
    e.preventDefault();
    try {
      const start_date = document.getElementById('modal-start-date').value;
      const end_date = document.getElementById('modal-end-date').value;
      const start_time = document.getElementById('modal-start-time').value || null;
      const end_time = document.getElementById('modal-end-time').value || null;
      const title = document.getElementById('modal-log-title').value;
      const activity_type = document.getElementById('modal-log-type').value || 'Công tác chuyên môn';
      const hours_spent = document.getElementById('modal-log-hours').value;
      const task_name = document.getElementById('modal-log-task').value || '';
      const supervisor_id = document.getElementById('modal-log-supervisor')?.value || null;
      const location = document.getElementById('modal-log-location').value;
      const description = document.getElementById('modal-log-desc').value;
      const status = document.querySelector('input[name="modal-log-status"]:checked')?.value || 'in_progress';
      const auto_complete = document.getElementById('modal-log-auto-complete')?.checked ? 1 : 0;

      await apiFetch('/api/personal-logs', {
        method: 'POST',
        body: JSON.stringify({
          start_date,
          end_date,
          start_time,
          end_time,
          title,
          activity_type,
          hours_spent,
          task_name,
          supervisor_id,
          location,
          description,
          result_outcome: '',
          attachment_url: '',
          status,
          auto_complete
        })
      });

      App.showToast('Kê khai nhật ký công việc thành công!', 'success');
      App.closeModal();
      this.loadLogs();
    } catch (err) {
      alert(`⚠️ KHÔNG THỂ KÊ KHAI:\n\n${err.message}`);
    }
  },

  openEditModal(logId, logJsonEncoded) {
    const log = JSON.parse(decodeURIComponent(logJsonEncoded));
    const modalContainer = document.getElementById('modal-container');
    const isCompleted = log.status === 'completed';
    const isAutoComplete = log.auto_complete !== 0;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-700">
          <div class="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10">
            <h3 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <i class="ph-bold ph-pencil-simple text-blue-600"></i> Chỉnh sửa Bản Kê Khai
            </h3>
            <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700">
              <i class="ph-bold ph-x text-lg"></i>
            </button>
          </div>

          <form onsubmit="PersonalLogs.submitEdit(event, ${logId})" class="p-6 space-y-4">
            <div class="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-slate-800 rounded-2xl border border-emerald-200 dark:border-emerald-800">
              <div class="flex items-center justify-between mb-3">
                <div class="text-xs font-bold uppercase text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <i class="ph-bold ph-calendar-blank text-base"></i> Khoảng thời gian thực hiện
                </div>
                <span class="text-[11px] text-emerald-700/80 dark:text-emerald-400 font-medium italic">
                  (Có thể nhập giờ nếu 1 ngày làm nhiều việc)
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div class="bg-white dark:bg-slate-800 p-3 rounded-xl border border-emerald-200 dark:border-slate-700 shadow-xs">
                  <label class="block text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400 mb-1">TỪ NGÀY (BẮT ĐẦU) <span class="text-red-500">*</span></label>
                  <input type="date" id="edit-start-date" required value="${log.start_date}" onchange="PersonalLogs.handleModalDateChange('edit', ${logId})" class="w-full font-bold text-sm text-slate-800 dark:text-white bg-transparent focus:outline-none">
                </div>
                <div class="bg-white dark:bg-slate-800 p-3 rounded-xl border border-teal-200 dark:border-slate-700 shadow-xs">
                  <label class="block text-[10px] font-extrabold uppercase text-teal-700 dark:text-teal-400 mb-1">ĐẾN NGÀY (KẾT THÚC) <span class="text-red-500">*</span></label>
                  <input type="date" id="edit-end-date" required value="${log.end_date}" onchange="PersonalLogs.handleModalDateChange('edit', ${logId})" class="w-full font-bold text-sm text-slate-800 dark:text-white bg-transparent focus:outline-none">
                </div>
              </div>

              <!-- Time Inputs (Optional) -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-emerald-200/70 dark:border-emerald-800/70">
                <div class="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <label class="block text-[10px] font-extrabold uppercase text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <i class="ph-bold ph-clock text-xs text-blue-600"></i> TỪ MẤY GIỜ <span class="text-[10px] font-normal text-slate-400 lowercase">(tùy chọn)</span>
                  </label>
                  <input type="time" id="edit-start-time" value="${log.start_time || ''}" onchange="PersonalLogs.handleModalDateChange('edit', ${logId})" class="w-full font-semibold text-xs text-slate-800 dark:text-white bg-transparent focus:outline-none">
                </div>

                <div class="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <label class="block text-[10px] font-extrabold uppercase text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <i class="ph-bold ph-clock-afternoon text-xs text-blue-600"></i> ĐẾN MẤY GIỜ <span class="text-[10px] font-normal text-slate-400 lowercase">(tùy chọn)</span>
                  </label>
                  <input type="time" id="edit-end-time" value="${log.end_time || ''}" onchange="PersonalLogs.handleModalDateChange('edit', ${logId})" class="w-full font-semibold text-xs text-slate-800 dark:text-white bg-transparent focus:outline-none">
                </div>
              </div>

              <!-- Duplicate Warning Alert Box -->
              <div id="edit-date-conflict-warning" class="hidden mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center gap-2"></div>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Tên đầu việc <span class="text-red-500">*</span></label>
              <input type="text" id="edit-log-title" required value="${log.title}" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white">
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Phân loại hoạt động</label>
                <input type="text" id="edit-log-type" list="activity-suggestions" value="${log.activity_type || ''}" placeholder="Tự nhập phân loại..." class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs dark:text-white font-medium focus:ring-2 focus:ring-blue-500">
              </div>

              <div>
                <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Số giờ (h)</label>
                <input type="number" id="edit-log-hours" step="0.5" value="${log.hours_spent}" required class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold dark:text-white">
              </div>

              <div>
                <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Gắn với nhiệm vụ</label>
                <input type="text" id="edit-log-task" list="task-suggestions" value="${log.task_title || log.task_name || ''}" placeholder="Tự nhập nhiệm vụ..." class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs dark:text-white font-medium focus:ring-2 focus:ring-blue-500">
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                <i class="ph-bold ph-user-focus text-blue-600"></i> Lãnh đạo phòng phụ trách / Giao việc
              </label>
              <select id="edit-log-supervisor" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500">
                ${this.getSupervisorOptions(log.supervisor_id)}
              </select>
              <p class="text-[11px] text-slate-400 mt-1">Lãnh đạo được chọn sẽ theo dõi được công việc này trong tài khoản quản lý.</p>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Địa điểm thực hiện</label>
              <input type="text" id="edit-log-location" value="${log.location || ''}" class="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs dark:text-white">
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Chi tiết nội dung <span class="text-red-500">*</span></label>
              <textarea id="edit-log-desc" rows="3" required class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs dark:text-white">${log.description}</textarea>
            </div>

            <!-- Status & Auto-Complete Setting -->
            <div class="p-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-600 space-y-2.5">
              <div class="flex items-center justify-between">
                <label class="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                  Trạng thái công việc
                </label>
                <div class="flex items-center gap-3">
                  <label class="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer text-blue-600 dark:text-blue-400">
                    <input type="radio" name="edit-log-status" value="in_progress" ${!isCompleted ? 'checked' : ''} class="text-blue-600 focus:ring-blue-500">
                    <span>⏳ Đang thực hiện</span>
                  </label>
                  <label class="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer text-emerald-600 dark:text-emerald-400">
                    <input type="radio" name="edit-log-status" value="completed" ${isCompleted ? 'checked' : ''} class="text-emerald-600 focus:ring-emerald-500">
                    <span>✅ Đã hoàn thành</span>
                  </label>
                </div>
              </div>

              <div class="pt-2 border-t border-slate-200 dark:border-slate-600">
                <label for="edit-log-auto-complete" class="text-xs text-slate-600 dark:text-slate-300 cursor-pointer flex items-center gap-2">
                  <input type="checkbox" id="edit-log-auto-complete" ${isAutoComplete ? 'checked' : ''} class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300">
                  <span><b>Tự động chuyển trạng thái:</b> Tự chuyển sang <i>"Đã hoàn thành"</i> khi hết thời gian thực hiện (hết ngày/giờ kết thúc).</span>
                </label>
              </div>
            </div>

            <div class="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button type="button" onclick="App.closeModal()" class="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs">Hủy</button>
              <button type="submit" id="edit-submit-btn" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-sm transition">Lưu Thay Đổi</button>
            </div>
          </form>
        </div>
      </div>
    `;

    setTimeout(() => this.handleModalDateChange('edit', logId), 100);
  },

  async submitEdit(e, logId) {
    e.preventDefault();
    try {
      const start_date = document.getElementById('edit-start-date').value;
      const end_date = document.getElementById('edit-end-date').value;
      const start_time = document.getElementById('edit-start-time').value || null;
      const end_time = document.getElementById('edit-end-time').value || null;
      const title = document.getElementById('edit-log-title').value;
      const activity_type = document.getElementById('edit-log-type').value;
      const hours_spent = document.getElementById('edit-log-hours').value;
      const task_name = document.getElementById('edit-log-task').value || '';
      const supervisor_id = document.getElementById('edit-log-supervisor')?.value || null;
      const location = document.getElementById('edit-log-location').value;
      const description = document.getElementById('edit-log-desc').value;
      const status = document.querySelector('input[name="edit-log-status"]:checked')?.value || 'in_progress';
      const auto_complete = document.getElementById('edit-log-auto-complete')?.checked ? 1 : 0;

      await apiFetch(`/api/personal-logs/${logId}`, {
        method: 'PUT',
        body: JSON.stringify({
          start_date,
          end_date,
          start_time,
          end_time,
          title,
          activity_type,
          hours_spent,
          task_name,
          supervisor_id,
          location,
          description,
          result_outcome: '',
          attachment_url: '',
          status,
          auto_complete
        })
      });

      App.showToast('Cập nhật bản kê khai thành công!', 'success');
      App.closeModal();
      this.loadLogs();
    } catch (err) {
      alert(`⚠️ KHÔNG THỂ CẬP NHẬT:\n\n${err.message}`);
    }
  },

  async deleteLog(logId) {
    if (!confirm('Bạn có chắc chắn muốn xóa bản ghi kê khai này?')) return;
    try {
      await apiFetch(`/api/personal-logs/${logId}`, { method: 'DELETE' });
      App.showToast('Đã xóa bản kê khai', 'success');
      this.loadLogs();
    } catch (err) {
      alert(err.message);
    }
  },

  async exportToExcel() {
    try {
      App.showToast('Đang tạo bản kê khai Excel...', 'info');

      const isStaff = Auth.isStaff();
      const isManager = Auth.isManager();
      const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();

      let query = `?from_date=${this.fromDate || ''}&to_date=${this.toDate || ''}`;
      let scopeTitle = '';

      if (this.targetSupervisorId) {
        query += `&supervisor_id=${this.targetSupervisorId}`;
        scopeTitle = `Lanh_dao_phu_trach_${Auth.user.full_name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      } else if (isStaff) {
        query += `&user_id=${Auth.user.id}`;
        scopeTitle = `Nhan_vien_${Auth.user.full_name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      } else if (isManager) {
        if (this.targetUserId && this.targetUserId !== 'all') {
          query += `&user_id=${this.targetUserId}`;
          const targetMember = this.cachedMembers.find(m => m.id == this.targetUserId) || Auth.user;
          scopeTitle = `Can_bo_${targetMember.full_name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        } else {
          query += `&department_id=${Auth.user.department_id}`;
          const rawDeptName = Auth.user.department_name || 'Phong_ban';
          const cleanDeptName = rawDeptName.startsWith('Phòng') ? rawDeptName : ('Phòng ' + rawDeptName);
          scopeTitle = cleanDeptName.replace(/[^a-zA-Z0-9]/g, '_');
        }
      } else {
        if (this.targetUserId && this.targetUserId !== 'all') {
          query += `&user_id=${this.targetUserId}`;
          const targetMember = this.cachedMembers.find(m => m.id == this.targetUserId) || Auth.user;
          scopeTitle = `Can_bo_${targetMember.full_name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        } else {
          query += `&all_dept=1`;
          scopeTitle = `Toan_truong_5_Phong_ban`;
        }
      }

      if (this.searchQuery) {
        query += `&search=${encodeURIComponent(this.searchQuery)}`;
      }

      const logs = await apiFetch(`/api/personal-logs${query}`);

      if (!logs || logs.length === 0) {
        alert('Không có dữ liệu trong khoảng thời gian này để xuất!');
        return;
      }

      const excelData = logs.map((l, index) => {
        const timeRange = (l.start_time && l.end_time) ? `${l.start_time} - ${l.end_time}` : 'Cả ngày';
        const approvalText = l.approval_status === 'approved' ? 'Đã duyệt' : (l.approval_status === 'rejected' ? 'Từ chối' : 'Chờ duyệt');
        return {
          'STT': index + 1,
          'Họ và tên cán bộ': l.user_name,
          'Chức vụ': l.user_position || l.user_role,
          'Phòng ban': l.department_name,
          'Lãnh đạo phụ trách': l.supervisor_name ? `${l.supervisor_name} (${l.supervisor_position || 'Lãnh đạo'})` : 'Chưa chỉ định',
          'Từ ngày': l.start_date,
          'Đến ngày': l.end_date,
          'Khung giờ': timeRange,
          'Số giờ (h)': l.hours_spent,
          'Trạng thái tiến độ': l.status === 'completed' ? 'Đã hoàn thành' : 'Đang thực hiện',
          'Trạng thái duyệt': approvalText,
          'Người duyệt': l.approved_by_name || '',
          'Thời gian duyệt': l.approved_at || '',
          'Ý kiến / Ghi chú duyệt': l.approval_comment || '',
          'Phân loại công việc': l.activity_type || 'Công tác chuyên môn',
          'Tên đầu việc / Nội dung': l.title,
          'Chi tiết thực hiện': l.description,
          'Địa điểm': l.location || 'Tại Trường ĐT CB Agribank',
          'Nhiệm vụ liên quan': l.task_title || l.task_name || 'Việc phát sinh ngoài kế hoạch'
        };
      });

      const ws = XLSX.utils.json_to_sheet(excelData);
      ws['!cols'] = [
        { wch: 6 },  // STT
        { wch: 22 }, // Tên cán bộ
        { wch: 18 }, // Chức vụ
        { wch: 30 }, // Phòng ban
        { wch: 25 }, // Lãnh đạo phụ trách
        { wch: 14 }, // Từ ngày
        { wch: 14 }, // Đến ngày
        { wch: 16 }, // Khung giờ
        { wch: 12 }, // Số giờ
        { wch: 18 }, // Tiến độ
        { wch: 16 }, // Trạng thái duyệt
        { wch: 22 }, // Người duyệt
        { wch: 20 }, // Thời gian duyệt
        { wch: 30 }, // Ghi chú duyệt
        { wch: 22 }, // Phân loại
        { wch: 35 }, // Tên việc
        { wch: 45 }, // Chi tiết
        { wch: 25 }, // Địa điểm
        { wch: 30 }  // Nhiệm vụ
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Bản kê khai nhật ký');

      const fileName = `Ban_ke_khai_nhat_ky_${scopeTitle}_${this.fromDate}_${this.toDate}.xlsx`;
      XLSX.writeFile(wb, fileName);

      App.showToast('Xuất bản kê khai Excel thành công!', 'success');
    } catch (err) {
      console.error(err);
      alert('Lỗi xuất Excel: ' + err.message);
    }
  },

  async checkMissingDays(targetMonth = null, selectedUserId = null) {
    try {
      App.showToast('Đang rà soát dữ liệu kê khai ngày công...', 'info');

      // 1. Determine Month: format 'YYYY-MM'
      let monthStr = targetMonth;
      if (!monthStr) {
        if (this.fromDate) {
          monthStr = this.fromDate.substring(0, 7);
        } else {
          monthStr = new Date().toISOString().substring(0, 7);
        }
      }

      const [yearStr, mStr] = monthStr.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(mStr); // 1-12

      // Start & End of month
      const firstDayDate = new Date(year, month - 1, 1);
      const lastDayDate = new Date(year, month, 0); // last day of month
      const fromDate = `${monthStr}-01`;
      const toDate = `${monthStr}-${String(lastDayDate.getDate()).padStart(2, '0')}`;
      const todayStr = new Date().toISOString().split('T')[0];

      // 2. Determine target user / scope
      const isStaff = Auth.isStaff();
      const isManager = Auth.isManager();
      const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();

      let activeUserId = selectedUserId;
      if (!activeUserId) {
        if (isStaff) {
          activeUserId = Auth.user.id;
        } else {
          activeUserId = this.targetUserId || Auth.user.id;
        }
      }

      // Fetch all logs for this month
      let query = `?from_date=${fromDate}&to_date=${toDate}`;
      if (isStaff) {
        query += `&user_id=${Auth.user.id}`;
      } else if (isManager) {
        if (activeUserId && activeUserId !== 'all') {
          query += `&user_id=${activeUserId}`;
        } else {
          query += `&department_id=${Auth.user.department_id}`;
        }
      } else {
        if (activeUserId && activeUserId !== 'all') {
          query += `&user_id=${activeUserId}`;
        } else {
          query += `&all_dept=1`;
        }
      }

      const [monthLogs, allUsers] = await Promise.all([
        apiFetch(`/api/personal-logs${query}`),
        this.cachedMembers.length ? Promise.resolve(this.cachedMembers) : apiFetch('/api/users')
      ]);
      this.cachedMembers = allUsers || [];

      // Calculate working days in month (Mon-Fri)
      const daysInMonth = lastDayDate.getDate();
      const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      const fullDayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

      const workingDays = []; // array of { date, day, dayOfWeek, dayName, fullDayName, isFuture, isPastOrToday }
      for (let d = 1; d <= daysInMonth; d++) {
        const dStr = `${monthStr}-${String(d).padStart(2, '0')}`;
        const dt = new Date(year, month - 1, d);
        const dow = dt.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
        const isWeekend = dow === 0 || dow === 6;
        const isFuture = dStr > todayStr;
        const isPastOrToday = dStr <= todayStr;

        if (!isWeekend) {
          workingDays.push({
            date: dStr,
            day: d,
            dayOfWeek: dow,
            dayName: dayNames[dow],
            fullDayName: fullDayNames[dow],
            isFuture,
            isPastOrToday
          });
        }
      }

      const totalWorkingDays = workingDays.length;
      const passedWorkingDays = workingDays.filter(w => w.isPastOrToday).length;

      // Function to analyze a user's compliance
      const analyzeUser = (uId) => {
        const uLogs = (monthLogs || []).filter(l => l.user_id == uId);
        const dayMap = {}; // date -> total hours

        uLogs.forEach(l => {
          const s = l.start_date;
          const e = l.end_date;
          const h = parseFloat(l.hours_spent) || 0;

          if (s === e) {
            dayMap[s] = (dayMap[s] || 0) + h;
          } else {
            for (let d = 1; d <= daysInMonth; d++) {
              const curDate = `${monthStr}-${String(d).padStart(2, '0')}`;
              if (curDate >= s && curDate <= e) {
                dayMap[curDate] = (dayMap[curDate] || 0) + h;
              }
            }
          }
        });

        const dayDetails = workingDays.map(wd => {
          const hours = dayMap[wd.date] || 0;
          let status = 'missing'; // 'missing' | 'partial' | 'full'
          if (hours >= 8) status = 'full';
          else if (hours > 0) status = 'partial';
          return {
            ...wd,
            hours,
            status
          };
        });

        const fullDays = dayDetails.filter(d => d.status === 'full').length;
        const partialDays = dayDetails.filter(d => d.status === 'partial').length;
        const missingDays = dayDetails.filter(d => d.status === 'missing').length;
        const passedMissingDays = dayDetails.filter(d => d.isPastOrToday && d.status === 'missing').length;
        const passedPartialDays = dayDetails.filter(d => d.isPastOrToday && d.status === 'partial').length;

        return {
          userId: uId,
          dayDetails,
          fullDays,
          partialDays,
          missingDays,
          passedMissingDays,
          passedPartialDays,
          totalHours: Object.values(dayMap).reduce((a, b) => a + b, 0)
        };
      };

      // If activeUserId is 'all' (Manager/Director viewing whole department)
      const isViewingAll = activeUserId === 'all' && (isManager || isDirectorOrAdmin);

      // Render Modal
      const modalContainer = document.getElementById('modal-container');
      
      // Generate month options (last 12 months)
      let monthOptions = '';
      const now = new Date();
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const optVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const optLabel = `Tháng ${d.getMonth() + 1}/${d.getFullYear()}${i === 0 ? ' (Hiện tại)' : ''}`;
        monthOptions += `<option value="${optVal}" ${optVal === monthStr ? 'selected' : ''}>${optLabel}</option>`;
      }

      // Member selector options for modal
      let userSelectHtml = '';
      if (!isStaff) {
        userSelectHtml = `
          <div class="flex items-center gap-2">
            <label class="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Xem cán bộ:</label>
            <select id="modal-missing-user-select" onchange="PersonalLogs.checkMissingDays('${monthStr}', this.value)" class="px-3 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold dark:text-white">
              <option value="all" ${activeUserId === 'all' ? 'selected' : ''}>👥 Tất cả cán bộ trong phòng / đơn vị</option>
              <option value="${Auth.user.id}" ${activeUserId == Auth.user.id ? 'selected' : ''}>👤 ${Auth.user.full_name} (Bản thân tôi)</option>
              ${this.cachedMembers.filter(m => m.id !== Auth.user.id && (isDirectorOrAdmin || m.department_id == Auth.user.department_id)).map(m => `
                <option value="${m.id}" ${activeUserId == m.id ? 'selected' : ''}>👤 ${m.full_name} (${m.position || m.role})</option>
              `).join('')}
            </select>
          </div>
        `;
      }

      let contentHtml = '';

      if (isViewingAll) {
        // Table view of all members in department
        const targetMembers = this.cachedMembers.filter(m => isDirectorOrAdmin || m.department_id == Auth.user.department_id);
        const memberStats = targetMembers.map(m => {
          const analysis = analyzeUser(m.id);
          return {
            ...m,
            ...analysis
          };
        });

        contentHtml = `
          <div class="space-y-4">
            <div class="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800/60 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 flex items-center justify-center text-xl">
                  <i class="ph-bold ph-users-three"></i>
                </div>
                <div>
                  <h4 class="font-bold text-sm text-slate-800 dark:text-white">Tổng hợp tình hình kê khai tháng ${month}/${year}</h4>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    Toàn bộ <b>${targetMembers.length} cán bộ</b> • Tổng số <b>${totalWorkingDays} ngày làm việc tiêu chuẩn</b> trong tháng (đã qua ${passedWorkingDays} ngày).
                  </p>
                </div>
              </div>
            </div>

            <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
              <table class="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead class="bg-slate-50 dark:bg-slate-700/50 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th class="px-4 py-3">Họ và tên cán bộ</th>
                    <th class="px-4 py-3">Phòng ban</th>
                    <th class="px-4 py-3 text-center">Tổng giờ kê khai</th>
                    <th class="px-4 py-3 text-center">Đủ 8h (ngày)</th>
                    <th class="px-4 py-3 text-center">Thiếu giờ (&lt;8h)</th>
                    <th class="px-4 py-3 text-center">Chưa kê (0h)</th>
                    <th class="px-4 py-3 text-center">Tình trạng</th>
                    <th class="px-4 py-3 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-700/60">
                  ${memberStats.map(ms => {
                    const isAllDone = ms.passedMissingDays === 0 && ms.passedPartialDays === 0;
                    return `
                      <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                        <td class="px-4 py-3 font-bold text-slate-800 dark:text-white whitespace-nowrap">
                          👤 ${ms.full_name}
                          <div class="text-[10px] text-slate-400 font-normal">${ms.position || ms.role} • ${ms.employee_code || ''}</div>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">${ms.department_name || 'Phòng ban'}</td>
                        <td class="px-4 py-3 text-center font-bold text-slate-800 dark:text-white">${ms.totalHours}h</td>
                        <td class="px-4 py-3 text-center">
                          <span class="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 font-bold">${ms.fullDays}</span>
                        </td>
                        <td class="px-4 py-3 text-center">
                          <span class="px-2 py-0.5 rounded-md ${ms.passedPartialDays > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-bold' : 'text-slate-400'}">${ms.partialDays}</span>
                        </td>
                        <td class="px-4 py-3 text-center">
                          <span class="px-2 py-0.5 rounded-md ${ms.passedMissingDays > 0 ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 font-extrabold animate-pulse' : 'text-slate-400'}">${ms.missingDays}</span>
                        </td>
                        <td class="px-4 py-3 text-center whitespace-nowrap">
                          ${isAllDone ? `
                            <span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold"><i class="ph-bold ph-check-circle"></i> Đầy đủ</span>
                          ` : `
                            <span class="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold"><i class="ph-bold ph-warning-circle"></i> Thiếu ${ms.passedMissingDays + ms.passedPartialDays} ngày</span>
                          `}
                        </td>
                        <td class="px-4 py-3 text-right whitespace-nowrap">
                          <button onclick="PersonalLogs.checkMissingDays('${monthStr}', ${ms.id})" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg font-bold transition">
                            Xem lịch →
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } else {
        // Individual View (Staff or Manager viewing single member)
        const currentMember = this.cachedMembers.find(m => m.id == activeUserId) || Auth.user;
        const analysis = analyzeUser(activeUserId);
        const { dayDetails, fullDays, partialDays, missingDays, passedMissingDays, passedPartialDays } = analysis;

        const missingOrPartialDays = dayDetails.filter(d => d.status !== 'full');

        contentHtml = `
          <div class="space-y-5">
            <!-- Target Member Info Banner -->
            <div class="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-slate-800 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 class="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                  <span>👤 Cán bộ: <b>${currentMember.full_name}</b></span>
                  <span class="text-xs px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">${currentMember.position || currentMember.role}</span>
                </h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Đơn vị: ${currentMember.department_name || 'Phòng ban'} • Mã cán bộ: <b>${currentMember.employee_code || 'Chưa cập nhật'}</b>
                </p>
              </div>
              <div class="text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                Tháng ${month}/${year} (${totalWorkingDays} ngày làm việc chuẩn)
              </div>
            </div>

            <!-- Summary KPI 4 Cards -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="p-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-600">
                <div class="text-[10px] uppercase font-bold text-slate-400">Ngày làm việc chuẩn</div>
                <div class="text-2xl font-extrabold text-slate-800 dark:text-white mt-1">${totalWorkingDays}</div>
                <div class="text-[10px] text-slate-400 mt-0.5">Đã qua ${passedWorkingDays} ngày</div>
              </div>

              <div class="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                <div class="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Đã đủ 8h/ngày</div>
                <div class="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">${fullDays}</div>
                <div class="text-[10px] text-emerald-600/80 mt-0.5">Đạt chuẩn ngày công</div>
              </div>

              <div class="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800">
                <div class="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">Kê khai thiếu giờ</div>
                <div class="text-2xl font-extrabold text-amber-700 dark:text-amber-400 mt-1">${partialDays}</div>
                <div class="text-[10px] text-amber-600/80 mt-0.5">&gt; 0h nhưng &lt; 8h</div>
              </div>

              <div class="p-3.5 ${missingDays > 0 ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800' : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200'} rounded-2xl border">
                <div class="text-[10px] uppercase font-bold ${missingDays > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400'}">Chưa kê khai (0h)</div>
                <div class="text-2xl font-extrabold ${missingDays > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-800 dark:text-white'} mt-1">${missingDays}</div>
                <div class="text-[10px] ${missingDays > 0 ? 'text-rose-600/80' : 'text-slate-400'} mt-0.5">Cần kê khai bổ sung</div>
              </div>
            </div>

            <!-- Missing Days Action List -->
            <div>
              <h5 class="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-2.5 flex items-center justify-between">
                <span class="flex items-center gap-1.5">
                  <i class="ph-bold ph-list-dashes text-rose-500"></i> Danh sách các ngày làm việc cần kê khai bổ sung:
                </span>
                <span class="text-[11px] font-normal text-slate-400 lowercase">
                  (${missingOrPartialDays.length} ngày chưa hoàn thiện)
                </span>
              </h5>

              ${missingOrPartialDays.length === 0 ? `
                <div class="p-6 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-center text-emerald-800 dark:text-emerald-300">
                  <i class="ph-bold ph-check-circle text-4xl mb-2 inline-block"></i>
                  <p class="text-sm font-bold">Tuyệt vời! Tất cả các ngày làm việc trong tháng đã được kê khai đủ 8h.</p>
                  <p class="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Cán bộ đã hoàn thành đầy đủ nghĩa vụ kê khai nhật ký công việc.</p>
                </div>
              ` : `
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1">
                  ${missingOrPartialDays.map(d => {
                    const isZero = d.hours === 0;
                    return `
                      <div class="p-3 bg-white dark:bg-slate-800 rounded-xl border ${isZero ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/20' : 'border-amber-200 dark:border-amber-900/60 bg-amber-50/20'} flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs transition">
                        <div>
                          <div class="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                            <span class="${isZero ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}">${d.fullDayName}</span>
                            <span class="font-mono text-slate-500">(${d.date.split('-').reverse().join('/')})</span>
                          </div>
                          <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            ${isZero ? '<span class="text-rose-600 font-semibold">🔴 Chưa có nhật ký (0/8h)</span>' : `<span class="text-amber-600 font-semibold">🟡 Mới kê khai ${d.hours}h (thiếu ${8 - d.hours}h)</span>`}
                            ${d.isFuture ? '<span class="italic text-slate-400 ml-1">(Ngày tới)</span>' : ''}
                          </div>
                        </div>

                        <button onclick="App.closeModal(); PersonalLogs.openCreateModal('${d.date}');" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-2xs transition shrink-0" title="Kê khai nhanh cho ngày ${d.date}">
                          <i class="ph-bold ph-plus text-xs"></i> Kê khai bù
                        </button>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          </div>
        `;
      }

      modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col">
            <!-- Modal Header -->
            <div class="p-5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center text-lg">
                  <i class="ph-bold ph-calendar-check"></i>
                </div>
                <div>
                  <h3 class="text-base font-bold text-slate-800 dark:text-white">Rà Soát Ngày Chưa Kê Khai Trong Tháng</h3>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">Kiểm tra tính đầy đủ của ngày công (Thứ 2 đến Thứ 6) theo quy định</p>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <select id="modal-missing-month-select" onchange="PersonalLogs.checkMissingDays(this.value, '${activeUserId}')" class="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-800 dark:text-white">
                  ${monthOptions}
                </select>
                <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700">
                  <i class="ph-bold ph-x text-lg"></i>
                </button>
              </div>
            </div>

            <!-- Member Switcher (if Manager) -->
            ${userSelectHtml ? `
              <div class="px-5 py-2.5 bg-slate-50 dark:bg-slate-700/40 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                ${userSelectHtml}
              </div>
            ` : ''}

            <!-- Modal Body Content -->
            <div class="p-5 overflow-y-auto">
              ${contentHtml}
            </div>

            <!-- Modal Footer -->
            <div class="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between rounded-b-2xl">
              <div class="text-[11px] text-slate-500 dark:text-slate-400 italic">
                * Tiêu chuẩn: 8 giờ công / ngày làm việc (trừ Thứ Bảy, Chủ Nhật).
              </div>
              <button onclick="App.closeModal()" class="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold rounded-xl text-xs transition">
                Đóng
              </button>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error(err);
      alert('Lỗi rà soát ngày chưa kê khai: ' + err.message);
    }
  }
};
