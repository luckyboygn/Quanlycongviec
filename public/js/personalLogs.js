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
    const currentUser = Auth.user;
    const userDeptId = currentUser?.department_id;
    const isDirectorOrAdmin = currentUser && ['director', 'admin'].includes(currentUser.role);
    const allMembers = this.cachedMembers || [];

    // 1. Ban Giám đốc & Quản trị
    const directors = allMembers.filter(u => 
      ['director', 'admin'].includes(u.role) || 
      (u.position && u.position.toLowerCase().includes('giám đốc'))
    );

    // 2. Lãnh đạo của chính phòng người dùng (Trưởng phòng, Phó phòng)
    const deptLeaders = allMembers.filter(u => {
      if (['director', 'admin'].includes(u.role) || (u.position && u.position.toLowerCase().includes('giám đốc'))) {
        return false;
      }
      const isLeader = u.role === 'manager' || (u.position && (u.position.toLowerCase().includes('trưởng') || u.position.toLowerCase().includes('phó')));
      if (!isLeader) return false;

      // Nhân viên/Trưởng phòng chỉ thấy Lãnh đạo của chính phòng mình
      if (isDirectorOrAdmin) return true;
      return u.department_id == userDeptId;
    });

    let html = `<option value="">-- Không gắn lãnh đạo / Chưa chỉ định --</option>`;

    // Nhóm 1: Lãnh đạo phòng của cán bộ
    if (deptLeaders.length > 0) {
      const rawDeptName = currentUser?.department_name || 'Phòng ban';
      const cleanDeptName = rawDeptName.startsWith('Phòng') ? rawDeptName : ('Phòng ' + rawDeptName);
      html += `<optgroup label="🏢 Lãnh đạo ${cleanDeptName}">`;
      
      // Sắp xếp: Trưởng phòng lên trước, Phó phòng sau
      const sortedDeptLeaders = [...deptLeaders].sort((a, b) => {
        const isHeadA = a.position?.toLowerCase().includes('trưởng') ? 1 : 0;
        const isHeadB = b.position?.toLowerCase().includes('trưởng') ? 1 : 0;
        return isHeadB - isHeadA;
      });

      sortedDeptLeaders.forEach(u => {
        let isSel = false;
        if (selectedId !== null && selectedId !== undefined && selectedId !== '') {
          isSel = (u.id == selectedId);
        } else {
          // Mặc định chọn Trưởng phòng (hoặc Phó phòng nếu bản thân là Trưởng phòng)
          isSel = (u.department_id == userDeptId && u.position?.toLowerCase().includes('trưởng') && u.id !== currentUser?.id);
        }
        const rolePos = u.position || (u.role === 'manager' ? 'Trưởng/Phó phòng' : 'Cán bộ');
        html += `<option value="${u.id}" ${isSel ? 'selected' : ''}>👔 ${u.full_name} (${rolePos})</option>`;
      });
      html += `</optgroup>`;
    }

    // Nhóm 2: Ban Giám đốc
    if (directors.length > 0) {
      html += `<optgroup label="🏛️ Ban Giám đốc & Quản trị">`;
      directors.forEach(u => {
        const isSel = (selectedId !== null && selectedId !== undefined && selectedId !== '') ? (u.id == selectedId) : false;
        const rolePos = u.position || (u.role === 'director' ? 'Ban Giám đốc' : 'Ban Giám đốc / Quản trị');
        html += `<option value="${u.id}" ${isSel ? 'selected' : ''}>🏛️ ${u.full_name} (${rolePos})</option>`;
      });
      html += `</optgroup>`;
    }

    // Nếu đã có selectedId trước đó mà không nằm trong danh sách trên thì thêm vào để không bị mất giá trị
    if (selectedId && !directors.some(u => u.id == selectedId) && !deptLeaders.some(u => u.id == selectedId)) {
      const otherUser = allMembers.find(u => u.id == selectedId);
      if (otherUser) {
        html += `<option value="${otherUser.id}" selected>👔 ${otherUser.full_name} (${otherUser.position || otherUser.role} - ${otherUser.department_name || ''})</option>`;
      }
    }

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
        <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <!-- Top Row: Title + Primary Action Buttons -->
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div class="flex items-start gap-3.5">
              <span class="p-2.5 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex-shrink-0 mt-0.5 shadow-xs">
                <i class="ph-bold ph-calendar-check text-2xl"></i>
              </span>
              <div>
                <h1 class="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                  Bản Kê Khai Nhật Ký Công Việc Cá Nhân
                </h1>
                <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Ghi nhận chi tiết thời gian, nội dung, địa điểm, kết quả và lãnh đạo phụ trách phục vụ theo dõi, xác nhận giờ công và đánh giá KPI.
                </p>
              </div>
            </div>
            
            <!-- Primary Action Buttons (Right) -->
            <div class="flex flex-wrap items-center gap-2.5 flex-shrink-0">
              <button onclick="PersonalLogs.exportToExcel()" class="px-3.5 py-2 bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 border border-slate-200 dark:border-slate-600 transition shadow-xs">
                <i class="ph-bold ph-file-xls text-emerald-600 text-base"></i> Xuất Excel
              </button>
              <button onclick="PersonalLogs.openCreateModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 shadow-sm shadow-emerald-600/20 transition">
                <i class="ph-bold ph-plus-circle text-base"></i> Kê khai công việc mới
              </button>
            </div>
          </div>

          <!-- Bottom Row: Utility / Feature Quick Buttons -->
          <div class="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-slate-100 dark:border-slate-700/60">
            <div class="flex flex-wrap items-center gap-2.5 text-xs">
              <span class="text-slate-400 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1 mr-1">
                <i class="ph-bold ph-squares-four text-slate-400"></i> Tiện ích:
              </span>
              <button onclick="PersonalLogs.openSelfEvaluationModal()" class="px-3.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold rounded-xl border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 transition shadow-xs">
                <i class="ph-bold ph-star text-amber-500 text-sm"></i> Tự chấm điểm (Mẫu 01A)
              </button>
              <button onclick="PersonalLogs.checkMissingDays()" class="px-3.5 py-1.5 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-bold rounded-xl border border-amber-200 dark:border-amber-800 flex items-center gap-1.5 transition shadow-xs">
                <i class="ph-bold ph-calendar-magnifying-glass text-amber-600 text-sm"></i> Rà soát ngày thiếu
              </button>
            </div>

            ${(Auth.isManager() || Auth.isDirector() || Auth.isAdmin()) ? `
              <div class="flex items-center gap-2">
                <button onclick="PersonalLogs.batchApprovePending()" class="px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 transition shadow-xs">
                  <i class="ph-bold ph-checks text-emerald-600 text-sm"></i> Duyệt nhanh việc chờ duyệt
                </button>
              </div>
            ` : ''}
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
                  <div class="font-extrabold text-sm text-slate-800 dark:text-white">${l.hours_spent} phút</div>
                  <div class="text-[10px] text-slate-400">${Math.round((parseFloat(l.hours_spent || 0) / 60) * 10) / 10} giờ</div>
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
    return diffMins;
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
                <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Số phút thực hiện (phút) <span class="text-red-500">*</span></label>
                <input type="number" id="modal-log-hours" step="1" min="1" max="100000" value="480" placeholder="VD: 60, 90, 480..." required class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold dark:text-white">
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
                <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Số phút thực hiện (phút) <span class="text-red-500">*</span></label>
                <input type="number" id="edit-log-hours" step="1" min="1" max="100000" value="${log.hours_spent}" required class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold dark:text-white">
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
          'Thời lượng (phút)': l.hours_spent,
          'Quy đổi (giờ)': Math.round((parseFloat(l.hours_spent || 0) / 60) * 10) / 10,
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
        { wch: 18 }, // Số phút
        { wch: 14 }, // Quy đổi giờ
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
  },

  /**
   * PHIẾU ĐÁNH GIÁ MỨC ĐỘ HOÀN THÀNH CÔNG VIỆC (MẪU 01A)
   */
  evalTargetUserId: null,
  evalMonth: null,
  evalYear: null,

  formatUserPosition(position, role) {
    if (position && position.trim() && !['staff', 'manager', 'director', 'admin', 'auditor'].includes(position.trim().toLowerCase())) {
      return position.trim();
    }
    const map = {
      'admin': 'Quản trị hệ thống',
      'director': 'Ban Giám đốc',
      'manager': 'Lãnh đạo phòng',
      'staff': 'Nhân viên',
      'auditor': 'Kiểm tra & Giám sát'
    };
    return map[role] || position || 'Cán bộ';
  },

  getUserEvaluationColumn(user) {
    if (!user) return 'staff';
    const role = user.role || '';
    const pos = (user.position || '').toLowerCase();

    if (pos.includes('phó giám đốc') || pos.includes('phó trưởng đơn vị') || pos.includes('phó thủ trưởng')) {
      return 'deputy'; // Cột 3
    }
    if (role === 'director' || role === 'admin' || pos.includes('giám đốc') || pos.includes('trưởng đơn vị') || pos.includes('thủ trưởng')) {
      return 'head'; // Cột 4
    }
    if (role === 'manager' || pos.includes('phó phòng') || pos.includes('trưởng phòng') || pos.includes('lãnh đạo')) {
      return 'manager'; // Cột 2
    }
    return 'staff'; // Cột 1
  },

  validateAndClamp(input, max) {
    if (!input) return;
    let val = parseFloat(input.value);
    if (isNaN(val)) {
      input.value = '';
    } else if (val > max) {
      input.value = max;
      input.classList.add('ring-2', 'ring-rose-500');
      setTimeout(() => input.classList.remove('ring-2', 'ring-rose-500'), 800);
    } else if (val < 0) {
      input.value = 0;
    }
    this.recalcEvalScores();
  },

  async openSelfEvaluationModal(selectedMonth = null, selectedYear = null, selectedUserId = null) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const now = new Date();
    const month = selectedMonth ? parseInt(selectedMonth) : (this.evalMonth || (now.getMonth() + 1));
    const year = selectedYear ? parseInt(selectedYear) : (this.evalYear || now.getFullYear());
    
    // Target user to evaluate: default current target or logged-in user
    let targetUserId = selectedUserId ? parseInt(selectedUserId) : (this.evalTargetUserId || (this.targetUserId !== 'all' && typeof this.targetUserId === 'number' ? this.targetUserId : Auth.user.id));
    if (isNaN(targetUserId) || targetUserId <= 0) {
      targetUserId = Auth.user.id;
    }

    this.evalTargetUserId = targetUserId;
    this.evalMonth = month;
    this.evalYear = year;

    const isSelf = (targetUserId == Auth.user.id);
    
    // Phân quyền chấm điểm trực tiếp theo vị trí chức vụ của người dùng đang thao tác:
    const userCol = this.getUserEvaluationColumn(Auth.user);
    const canEditSelfCol = (userCol === 'staff');      // Nhân viên / Chuyên viên -> Cột 1
    const canEditMgrCol = (userCol === 'manager');     // Lãnh đạo phòng (Phó phòng, Trưởng phòng) -> Cột 2
    const canEditDeputyCol = (userCol === 'deputy');   // Phó trưởng đơn vị (Phó Giám đốc) -> Cột 3
    const canEditHeadCol = (userCol === 'head');       // Trưởng đơn vị (Giám đốc, Admin) -> Cột 4

    const isStaff = Auth.isStaff();
    const isManager = Auth.isManager();
    const isDirector = Auth.isDirector();
    const isAdmin = Auth.isAdmin();

    // Member options for Manager / Director / Admin
    let memberSelectHtml = '';
    if (isManager || isDirector || isAdmin) {
      const users = this.cachedMembers || [];
      let availableMembers = [];
      if (isManager) {
        availableMembers = users.filter(u => u.department_id == Auth.user.department_id && (u.status === 'active' || !u.status));
      } else {
        availableMembers = users.filter(u => u.status === 'active' || !u.status);
      }

      memberSelectHtml = `
        <div class="flex items-center gap-1.5 bg-white dark:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
          <span class="text-xs text-slate-500 font-semibold shrink-0">Cán bộ được đánh giá:</span>
          <select id="modal-eval-user-select" onchange="PersonalLogs.openSelfEvaluationModal(${month}, ${year}, this.value)" class="bg-transparent text-xs font-extrabold text-emerald-700 dark:text-emerald-400 focus:outline-none cursor-pointer max-w-[200px] truncate">
            ${availableMembers.map(u => `
              <option value="${u.id}" ${u.id == targetUserId ? 'selected' : ''}>👤 ${u.full_name} (${this.formatUserPosition(u.position, u.role)})</option>
            `).join('')}
          </select>
        </div>
      `;
    }

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-5xl w-full max-h-[95vh] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col animate-in fade-in zoom-in-95 duration-200">
          
          <!-- Top Modal Action Bar -->
          <div class="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/90 shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xl shadow-md shadow-blue-500/20">
                <i class="ph-bold ph-star"></i>
              </div>
              <div>
                <h3 class="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  Phiếu Đánh Giá Mức Độ Hoàn Thành Công Việc
                  <span class="text-[11px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">MẪU 01A</span>
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  ${isSelf ? 'Cá nhân tự chấm điểm kết quả công tác trong kỳ' : 'Lãnh đạo thẩm định & chấm điểm cho cán bộ'}
                </p>
              </div>
            </div>

            <!-- Member & Month Selector & Actions -->
            <div class="flex flex-wrap items-center gap-2">
              ${memberSelectHtml}
              <div class="flex items-center gap-1.5 bg-white dark:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
                <span class="text-xs text-slate-500 font-semibold">Kỳ đánh giá:</span>
                <select id="modal-eval-month-select" onchange="PersonalLogs.openSelfEvaluationModal(this.value, ${year}, ${targetUserId})" class="bg-transparent text-xs font-extrabold text-blue-600 dark:text-blue-400 focus:outline-none cursor-pointer">
                  ${Array.from({length: 12}, (_, i) => i + 1).map(m => `
                    <option value="${m}" ${m === month ? 'selected' : ''}>Tháng ${m}/${year}</option>
                  `).join('')}
                </select>
              </div>
              <button onclick="PersonalLogs.printSelfEvaluation()" class="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition">
                <i class="ph-bold ph-printer text-sm text-emerald-600"></i> <span class="hidden sm:inline">In Phiếu</span>
              </button>
              <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                <i class="ph-bold ph-x text-lg"></i>
              </button>
            </div>
          </div>

          <!-- Loading Spinner -->
          <div id="eval-modal-loading" class="py-20 text-center text-slate-400">
            <i class="ph ph-spinner animate-spin text-4xl text-blue-600 mb-3"></i>
            <p class="text-sm font-semibold">Đang tải dữ liệu biểu mẫu MẪU 01A...</p>
          </div>

          <!-- Printable Document Container -->
          <div id="eval-modal-content" class="hidden flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60 dark:bg-slate-900/60 custom-scrollbar">
            <!-- Document Paper Sheet -->
            <div id="printable-eval-form" class="bg-white text-slate-900 p-6 sm:p-10 rounded-2xl shadow-lg max-w-4xl mx-auto border border-slate-200 font-sans text-xs sm:text-sm leading-normal">
              
              <!-- Form Top Bar -->
              <div class="flex justify-end mb-2">
                <div class="border border-slate-800 px-3 py-1 text-[11px] font-bold tracking-wider uppercase text-slate-800">
                  MẪU 01A (Lưu tại đơn vị)
                </div>
              </div>

              <!-- Header Left & Right -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                <div class="text-center font-bold uppercase text-[12px] leading-tight text-slate-800">
                  <div>NGÂN HÀNG NÔNG NGHIỆP</div>
                  <div>VÀ PHÁT TRIỂN NÔNG THÔN VIỆT NAM</div>
                  <div id="eval-header-dept" class="mt-1 text-emerald-800 font-extrabold underline tracking-wide">
                    PHÒNG QUẢN LÝ ĐÀO TẠO VÀ THƯ VIỆN
                  </div>
                </div>
                <div class="text-center text-[12px] leading-tight text-slate-800">
                  <div class="font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                  <div class="font-bold">Độc lập – Tự do – Hạnh phúc</div>
                  <div class="w-28 h-0.5 bg-slate-800 mx-auto my-1.5"></div>
                  <div class="italic text-[11px] text-slate-600">
                    Hà Nội, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}
                  </div>
                </div>
              </div>

              <!-- Document Title -->
              <div class="text-center my-6">
                <h2 class="text-base sm:text-lg font-black uppercase tracking-wide text-slate-900">
                  PHIẾU ĐÁNH GIÁ MỨC ĐỘ HOÀN THÀNH CÔNG VIỆC
                </h2>
                <div id="eval-title-period" class="font-bold text-xs sm:text-sm text-slate-700 mt-1.5 flex items-center justify-center gap-1.5 flex-wrap">
                  <span>Kỳ tạm ứng thù lao theo hiệu quả công việc V2 tháng</span>
                  <select id="eval-title-month-select" onchange="PersonalLogs.openSelfEvaluationModal(this.value, ${year}, ${targetUserId})" class="px-2 py-0.5 bg-blue-50 dark:bg-slate-700 border border-blue-300 dark:border-blue-600 rounded-lg font-black text-blue-700 dark:text-blue-300 cursor-pointer focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm">
                    ${Array.from({length: 12}, (_, i) => i + 1).map(m => `
                      <option value="${m}" ${m === month ? 'selected' : ''}>${m}</option>
                    `).join('')}
                  </select>
                  <span>năm ${year}</span>
                </div>
                <div class="italic text-xs text-slate-500 mt-1" id="eval-title-subtitle">
                  ${canEditMgrCol ? '(Áp dụng cho Lãnh đạo phòng/nghiệp vụ)' : canEditDeputyCol ? '(Áp dụng cho Phó trưởng đơn vị)' : canEditHeadCol ? '(Áp dụng cho Trưởng đơn vị)' : '(Áp dụng cho nhân viên)'}
                </div>
              </div>

              <!-- Personnel Information -->
              <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 space-y-1.5 text-xs sm:text-sm">
                <div class="flex flex-wrap gap-2">
                  <span class="font-bold text-slate-700 min-w-[120px]">Họ và tên:</span>
                  <span id="eval-info-name" class="font-bold text-blue-900 text-sm">--</span>
                </div>
                <div class="flex flex-wrap gap-2">
                  <span class="font-bold text-slate-700 min-w-[120px]">Chức vụ:</span>
                  <span id="eval-info-position" class="font-medium text-slate-800">--</span>
                </div>
                <div class="flex flex-wrap gap-2">
                  <span class="font-bold text-slate-700 min-w-[120px]">Phòng/Bộ phận:</span>
                  <span id="eval-info-dept" class="font-medium text-slate-800">--</span>
                </div>
              </div>

              <!-- Evaluation Form Table -->
              <div class="overflow-x-auto">
                <table class="w-full border-collapse border border-slate-400 text-xs leading-relaxed text-slate-800">
                  <thead>
                    <tr class="bg-slate-100 text-center font-bold">
                      <th rowspan="2" class="border border-slate-400 p-2 w-10">TT</th>
                      <th rowspan="2" class="border border-slate-400 p-2 text-left min-w-[200px]">Tiêu chí đánh giá</th>
                      <th colspan="5" class="border border-slate-400 p-1.5 bg-blue-50/60 text-blue-950">Điểm đánh giá</th>
                      <th rowspan="2" class="border border-slate-400 p-2 w-28">Ghi chú</th>
                    </tr>
                    <tr class="bg-slate-100 text-center font-bold text-[11px]">
                      <th class="border border-slate-400 p-1.5 w-24 ${canEditSelfCol ? 'bg-blue-100/70 text-blue-900' : 'text-slate-600'}">
                        NLĐ (Tự đánh giá)
                      </th>
                      <th class="border border-slate-400 p-1.5 w-24 ${canEditMgrCol ? 'bg-amber-100/70 text-amber-900' : 'text-slate-600'}">
                        LĐ phòng / nghiệp vụ
                      </th>
                      <th class="border border-slate-400 p-1.5 w-22 ${canEditDeputyCol ? 'bg-purple-100/70 text-purple-900' : 'text-slate-600'}">
                        Phó trưởng đơn vị
                      </th>
                      <th class="border border-slate-400 p-1.5 w-22 ${canEditHeadCol ? 'bg-emerald-100/70 text-emerald-900' : 'text-slate-600'}">
                        Trưởng đơn vị
                      </th>
                      <th class="border border-slate-400 p-1.5 w-22 bg-slate-200/60 text-slate-800">
                        Điểm bình quân
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <!-- Row 1 -->
                    <tr>
                      <td class="border border-slate-400 p-2 text-center font-bold">1</td>
                      <td class="border border-slate-400 p-2">
                        <span class="font-bold">Khối lượng công việc</span> (Khối lượng công việc hoàn thành so với khối lượng công việc cần thực hiện trong tháng)
                      </td>
                      
                      <!-- Col 1: NLĐ -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditSelfCol ? 'bg-blue-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        ${canEditSelfCol ? `
                          <input type="number" id="eval-input-volume" min="0" max="20" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 20)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-blue-400 rounded text-blue-900 focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-input-volume-text" class="font-bold text-sm text-blue-900">0</span>
                        `}
                      </td>

                      <!-- Col 2: LĐ Phòng -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditMgrCol ? 'bg-amber-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        ${canEditMgrCol ? `
                          <input type="number" id="eval-mgr-volume-input" min="0" max="20" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 20)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-amber-400 rounded text-amber-900 focus:ring-2 focus:ring-amber-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-mgr-volume" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 3: Phó Trưởng ĐV -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditDeputyCol ? 'bg-purple-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        ${canEditDeputyCol ? `
                          <input type="number" id="eval-deputy-volume-input" min="0" max="20" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 20)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-purple-400 rounded text-purple-900 focus:ring-2 focus:ring-purple-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-deputy-volume" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 4: Trưởng ĐV -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditHeadCol ? 'bg-emerald-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        ${canEditHeadCol ? `
                          <input type="number" id="eval-head-volume-input" min="0" max="20" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 20)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-emerald-400 rounded text-emerald-900 focus:ring-2 focus:ring-emerald-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-head-volume" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 5: Điểm BQ -->
                      <td class="border border-slate-400 p-1.5 text-center bg-slate-100 font-bold">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        <span id="eval-avg-volume" class="font-bold text-sm text-slate-900">0</span>
                      </td>

                      <td class="border border-slate-400 p-1">
                        <input type="text" id="eval-note-1" class="w-full px-1.5 py-1 text-xs border border-slate-200 rounded" placeholder="Ghi chú...">
                      </td>
                    </tr>

                    <!-- Row 2 -->
                    <tr>
                      <td class="border border-slate-400 p-2 text-center font-bold">2</td>
                      <td class="border border-slate-400 p-2">
                        <span class="font-bold">Chất lượng công việc</span> (Chất lượng, kết quả, sự chính xác...trong thực hiện công việc)
                      </td>

                      <!-- Col 1: NLĐ -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditSelfCol ? 'bg-blue-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        ${canEditSelfCol ? `
                          <input type="number" id="eval-input-quality" min="0" max="20" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 20)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-blue-400 rounded text-blue-900 focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-input-quality-text" class="font-bold text-sm text-blue-900">0</span>
                        `}
                      </td>

                      <!-- Col 2: LĐ Phòng -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditMgrCol ? 'bg-amber-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        ${canEditMgrCol ? `
                          <input type="number" id="eval-mgr-quality-input" min="0" max="20" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 20)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-amber-400 rounded text-amber-900 focus:ring-2 focus:ring-amber-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-mgr-quality" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 3: Phó Trưởng ĐV -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditDeputyCol ? 'bg-purple-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        ${canEditDeputyCol ? `
                          <input type="number" id="eval-deputy-quality-input" min="0" max="20" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 20)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-purple-400 rounded text-purple-900 focus:ring-2 focus:ring-purple-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-deputy-quality" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 4: Trưởng ĐV -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditHeadCol ? 'bg-emerald-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        ${canEditHeadCol ? `
                          <input type="number" id="eval-head-quality-input" min="0" max="20" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 20)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-emerald-400 rounded text-emerald-900 focus:ring-2 focus:ring-emerald-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-head-quality" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 5: Điểm BQ -->
                      <td class="border border-slate-400 p-1.5 text-center bg-slate-100 font-bold">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        <span id="eval-avg-quality" class="font-bold text-sm text-slate-900">0</span>
                      </td>

                      <td class="border border-slate-400 p-1">
                        <input type="text" id="eval-note-2" class="w-full px-1.5 py-1 text-xs border border-slate-200 rounded" placeholder="Ghi chú...">
                      </td>
                    </tr>

                    <!-- Row 3 -->
                    <tr>
                      <td class="border border-slate-400 p-2 text-center font-bold">3</td>
                      <td class="border border-slate-400 p-2">
                        <span class="font-bold">Tiến độ thực hiện công việc</span> (Tiến độ thực hiện công việc theo thời hạn được phân công)
                      </td>

                      <!-- Col 1: NLĐ -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditSelfCol ? 'bg-blue-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        ${canEditSelfCol ? `
                          <input type="number" id="eval-input-progress" min="0" max="20" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 20)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-blue-400 rounded text-blue-900 focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-input-progress-text" class="font-bold text-sm text-blue-900">0</span>
                        `}
                      </td>

                      <!-- Col 2: LĐ Phòng -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditMgrCol ? 'bg-amber-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        ${canEditMgrCol ? `
                          <input type="number" id="eval-mgr-progress-input" min="0" max="20" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 20)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-amber-400 rounded text-amber-900 focus:ring-2 focus:ring-amber-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-mgr-progress" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 3: Phó Trưởng ĐV -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditDeputyCol ? 'bg-purple-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        ${canEditDeputyCol ? `
                          <input type="number" id="eval-deputy-progress-input" min="0" max="20" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 20)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-purple-400 rounded text-purple-900 focus:ring-2 focus:ring-purple-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-deputy-progress" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 4: Trưởng ĐV -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditHeadCol ? 'bg-emerald-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        ${canEditHeadCol ? `
                          <input type="number" id="eval-head-progress-input" min="0" max="20" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 20)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-emerald-400 rounded text-emerald-900 focus:ring-2 focus:ring-emerald-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-head-progress" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 5: Điểm BQ -->
                      <td class="border border-slate-400 p-1.5 text-center bg-slate-100 font-bold">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        <span id="eval-avg-progress" class="font-bold text-sm text-slate-900">0</span>
                      </td>

                      <td class="border border-slate-400 p-1">
                        <input type="text" id="eval-note-3" class="w-full px-1.5 py-1 text-xs border border-slate-200 rounded" placeholder="Ghi chú...">
                      </td>
                    </tr>

                    <!-- Row 4 -->
                    <tr>
                      <td class="border border-slate-400 p-2 text-center font-bold">4</td>
                      <td class="border border-slate-400 p-2">
                        <span class="font-bold">Năng lực, thái độ thực hiện</span> (Khả năng tham mưu lãnh đạo; Khả năng xây dựng cơ chế, quy chế...; Khả năng xử lý tình huống; Ý thức làm việc; Phối hợp công tác...)
                      </td>

                      <!-- Col 1: NLĐ -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditSelfCol ? 'bg-blue-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        ${canEditSelfCol ? `
                          <input type="number" id="eval-input-attitude" min="0" max="20" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 20)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-blue-400 rounded text-blue-900 focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-input-attitude-text" class="font-bold text-sm text-blue-900">0</span>
                        `}
                      </td>

                      <!-- Col 2: LĐ Phòng -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditMgrCol ? 'bg-amber-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        ${canEditMgrCol ? `
                          <input type="number" id="eval-mgr-attitude-input" min="0" max="20" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 20)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-amber-400 rounded text-amber-900 focus:ring-2 focus:ring-amber-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-mgr-attitude" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 3: Phó Trưởng ĐV -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditDeputyCol ? 'bg-purple-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        ${canEditDeputyCol ? `
                          <input type="number" id="eval-deputy-attitude-input" min="0" max="20" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 20)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-purple-400 rounded text-purple-900 focus:ring-2 focus:ring-purple-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-deputy-attitude" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 4: Trưởng ĐV -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditHeadCol ? 'bg-emerald-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        ${canEditHeadCol ? `
                          <input type="number" id="eval-head-attitude-input" min="0" max="20" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 20)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-emerald-400 rounded text-emerald-900 focus:ring-2 focus:ring-emerald-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-head-attitude" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 5: Điểm BQ -->
                      <td class="border border-slate-400 p-1.5 text-center bg-slate-100 font-bold">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 20)</div>
                        <span id="eval-avg-attitude" class="font-bold text-sm text-slate-900">0</span>
                      </td>

                      <td class="border border-slate-400 p-1">
                        <input type="text" id="eval-note-4" class="w-full px-1.5 py-1 text-xs border border-slate-200 rounded" placeholder="Ghi chú...">
                      </td>
                    </tr>

                    <!-- Row II -->
                    <tr>
                      <td class="border border-slate-400 p-2 text-center font-bold">II</td>
                      <td class="border border-slate-400 p-2">
                        <span class="font-bold">Ý thức chấp hành kỷ luật, nội quy lao động</span>
                      </td>

                      <!-- Col 1: NLĐ -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditSelfCol ? 'bg-blue-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 10)</div>
                        ${canEditSelfCol ? `
                          <input type="number" id="eval-input-discipline" min="0" max="10" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 10)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-blue-400 rounded text-blue-900 focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-input-discipline-text" class="font-bold text-sm text-blue-900">0</span>
                        `}
                      </td>

                      <!-- Col 2: LĐ Phòng -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditMgrCol ? 'bg-amber-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 10)</div>
                        ${canEditMgrCol ? `
                          <input type="number" id="eval-mgr-discipline-input" min="0" max="10" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 10)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-amber-400 rounded text-amber-900 focus:ring-2 focus:ring-amber-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-mgr-discipline" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 3: Phó Trưởng ĐV -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditDeputyCol ? 'bg-purple-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 10)</div>
                        ${canEditDeputyCol ? `
                          <input type="number" id="eval-deputy-discipline-input" min="0" max="10" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 10)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-purple-400 rounded text-purple-900 focus:ring-2 focus:ring-purple-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-deputy-discipline" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 4: Trưởng ĐV -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditHeadCol ? 'bg-emerald-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 10)</div>
                        ${canEditHeadCol ? `
                          <input type="number" id="eval-head-discipline-input" min="0" max="10" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 10)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-emerald-400 rounded text-emerald-900 focus:ring-2 focus:ring-emerald-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-head-discipline" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 5: Điểm BQ -->
                      <td class="border border-slate-400 p-1.5 text-center bg-slate-100 font-bold">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 10)</div>
                        <span id="eval-avg-discipline" class="font-bold text-sm text-slate-900">0</span>
                      </td>

                      <td class="border border-slate-400 p-1">
                        <input type="text" id="eval-note-5" class="w-full px-1.5 py-1 text-xs border border-slate-200 rounded" placeholder="Ghi chú...">
                      </td>
                    </tr>

                    <!-- Row III -->
                    <tr>
                      <td class="border border-slate-400 p-2 text-center font-bold">III</td>
                      <td class="border border-slate-400 p-2">
                        <span class="font-bold">Kết quả kiểm tra nghiệp vụ</span>
                      </td>

                      <!-- Col 1: NLĐ -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditSelfCol ? 'bg-blue-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 10)</div>
                        ${canEditSelfCol ? `
                          <input type="number" id="eval-input-test" min="0" max="10" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 10)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-blue-400 rounded text-blue-900 focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-input-test-text" class="font-bold text-sm text-blue-900">0</span>
                        `}
                      </td>

                      <!-- Col 2: LĐ Phòng -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditMgrCol ? 'bg-amber-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 10)</div>
                        ${canEditMgrCol ? `
                          <input type="number" id="eval-mgr-test-input" min="0" max="10" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 10)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-amber-400 rounded text-amber-900 focus:ring-2 focus:ring-amber-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-mgr-test" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 3: Phó Trưởng ĐV -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditDeputyCol ? 'bg-purple-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 10)</div>
                        ${canEditDeputyCol ? `
                          <input type="number" id="eval-deputy-test-input" min="0" max="10" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 10)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-purple-400 rounded text-purple-900 focus:ring-2 focus:ring-purple-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-deputy-test" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 4: Trưởng ĐV -->
                      <td class="border border-slate-400 p-1.5 text-center ${canEditHeadCol ? 'bg-emerald-50/40' : 'bg-slate-50/50'}">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 10)</div>
                        ${canEditHeadCol ? `
                          <input type="number" id="eval-head-test-input" min="0" max="10" step="0.5" oninput="PersonalLogs.validateAndClamp(this, 10)" class="w-16 mx-auto px-1.5 py-1 text-center font-bold text-sm bg-white border border-emerald-400 rounded text-emerald-900 focus:ring-2 focus:ring-emerald-500 shadow-inner" placeholder="0">
                        ` : `
                          <span id="eval-head-test" class="font-bold text-sm text-slate-700">0</span>
                        `}
                      </td>

                      <!-- Col 5: Điểm BQ -->
                      <td class="border border-slate-400 p-1.5 text-center bg-slate-100 font-bold">
                        <div class="text-[10px] text-slate-400 mb-0.5">(Tối đa 10)</div>
                        <span id="eval-avg-test" class="font-bold text-sm text-slate-900">0</span>
                      </td>

                      <td class="border border-slate-400 p-1">
                        <input type="text" id="eval-note-6" class="w-full px-1.5 py-1 text-xs border border-slate-200 rounded" placeholder="Ghi chú...">
                      </td>
                    </tr>

                    <!-- Total Row -->
                    <tr class="bg-blue-50/80 font-bold text-xs">
                      <td class="border border-slate-400 p-2 text-center"></td>
                      <td class="border border-slate-400 p-2.5 font-extrabold text-sm text-slate-900 flex items-center justify-between">
                        <span>Tổng điểm:</span>
                        <span id="eval-badge-rating" class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Loại A (Xuất sắc)
                        </span>
                      </td>
                      
                      <!-- Total Col 1 -->
                      <td class="border border-slate-400 p-2 text-center text-sm font-black text-blue-900 bg-blue-100">
                        <span id="eval-score-total">0</span>
                      </td>

                      <!-- Total Col 2 -->
                      <td class="border border-slate-400 p-2 text-center text-sm font-black text-amber-900 bg-amber-100/70">
                        <span id="eval-mgr-total">0</span>
                      </td>

                      <!-- Total Col 3 -->
                      <td class="border border-slate-400 p-2 text-center text-sm font-black text-purple-900 bg-purple-100/70">
                        <span id="eval-deputy-total">0</span>
                      </td>

                      <!-- Total Col 4 -->
                      <td class="border border-slate-400 p-2 text-center text-sm font-black text-emerald-900 bg-emerald-100/70">
                        <span id="eval-head-total">0</span>
                      </td>

                      <!-- Total Col 5 -->
                      <td class="border border-slate-400 p-2 text-center text-sm font-black text-slate-900 bg-slate-200">
                        <span id="eval-avg-total">0</span>
                      </td>

                      <td class="border border-slate-400 p-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- General Comments & Notes -->
              <div class="mt-4">
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  ${isSelf ? 'Ý kiến / Giải trình thêm của cán bộ:' : 'Ý kiến nhận xét & đánh giá của Lãnh đạo:'}
                </label>
                <textarea id="eval-input-notes" rows="2" class="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="${isSelf ? 'Nhập tóm tắt thành tích nổi bật hoặc kiến nghị trong tháng (nếu có)...' : 'Nhập nhận xét của lãnh đạo đối với cán bộ trong kỳ đánh giá...'}"></textarea>
              </div>

              <!-- Signatures Section -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center mt-10 pt-4 border-t border-slate-200">
                <div>
                  <div class="font-bold uppercase text-xs text-slate-800">NGƯỜI TỰ ĐÁNH GIÁ</div>
                  <div class="italic text-[11px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                  <div class="h-16 flex items-end justify-center">
                    <span id="eval-sign-user" class="font-bold text-xs text-slate-800 underline">--</span>
                  </div>
                </div>
                <div>
                  <div class="font-bold uppercase text-xs text-slate-800">LÃNH ĐẠO PHÒNG</div>
                  <div class="italic text-[11px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                  <div class="h-16 flex items-end justify-center">
                    <span id="eval-sign-mgr" class="font-semibold text-xs text-slate-600">
                      ${isManager ? Auth.user.full_name : '<span class="text-slate-400 italic">(Chưa ký)</span>'}
                    </span>
                  </div>
                </div>
                <div>
                  <div class="font-bold uppercase text-xs text-slate-800">TRƯỞNG ĐƠN VỊ</div>
                  <div class="italic text-[11px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                  <div class="h-16 flex items-end justify-center">
                    <span id="eval-sign-head" class="font-semibold text-xs text-slate-600">
                      ${isDirector ? Auth.user.full_name : '<span class="text-slate-400 italic">(Chưa ký)</span>'}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <!-- Modal Footer Actions -->
          <div class="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-500 dark:text-slate-400">
                Điểm tự chấm: <strong id="eval-footer-self-total" class="text-blue-600 dark:text-blue-400 font-black text-sm">0</strong> / 100
              </span>
              <span class="text-slate-300 dark:text-slate-600">|</span>
              <span class="text-xs text-slate-500 dark:text-slate-400">
                Điểm bình quân: <strong id="eval-footer-avg-total" class="text-emerald-600 dark:text-emerald-400 font-black text-sm">0</strong> / 100
              </span>
            </div>
            <div class="flex items-center gap-2.5">
              <button onclick="App.closeModal()" class="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition">
                Đóng
              </button>
              <button onclick="PersonalLogs.saveSelfEvaluation(${month}, ${year}, ${targetUserId})" id="btn-save-eval" class="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 flex items-center gap-2 transition">
                <i class="ph-bold ph-floppy-disk text-base"></i> Lưu phiếu đánh giá
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    // Fetch and populate evaluation data
    try {
      const data = await apiFetch(`/api/evaluations/my?month=${month}&year=${year}&user_id=${targetUserId}`);
      
      const loadingEl = document.getElementById('eval-modal-loading');
      const contentEl = document.getElementById('eval-modal-content');
      if (loadingEl) loadingEl.classList.add('hidden');
      if (contentEl) contentEl.classList.remove('hidden');

      const rawDeptName = data.department_name || Auth.user?.department_name || 'Phòng Quản lý Đào tạo và Thư viện';
      const cleanDeptName = rawDeptName.toUpperCase().startsWith('PHÒNG') ? rawDeptName.toUpperCase() : ('PHÒNG ' + rawDeptName.toUpperCase());
      
      const headerDept = document.getElementById('eval-header-dept');
      if (headerDept) headerDept.innerText = cleanDeptName;

      const infoName = document.getElementById('eval-info-name');
      if (infoName) infoName.innerText = data.full_name || '--';

      const infoPos = document.getElementById('eval-info-position');
      if (infoPos) infoPos.innerText = this.formatUserPosition(data.position, data.role);

      const infoDept = document.getElementById('eval-info-dept');
      if (infoDept) infoDept.innerText = rawDeptName;

      const signUser = document.getElementById('eval-sign-user');
      if (signUser) signUser.innerText = data.full_name || '--';

      // 1. Set NLĐ (Self) score inputs or text displays
      if (canEditSelfCol) {
        if (document.getElementById('eval-input-volume')) document.getElementById('eval-input-volume').value = data.score_volume || 0;
        if (document.getElementById('eval-input-quality')) document.getElementById('eval-input-quality').value = data.score_quality || 0;
        if (document.getElementById('eval-input-progress')) document.getElementById('eval-input-progress').value = data.score_progress || 0;
        if (document.getElementById('eval-input-attitude')) document.getElementById('eval-input-attitude').value = data.score_attitude || 0;
        if (document.getElementById('eval-input-discipline')) document.getElementById('eval-input-discipline').value = data.score_discipline || 0;
        if (document.getElementById('eval-input-test')) document.getElementById('eval-input-test').value = data.score_test || 0;
      } else {
        if (document.getElementById('eval-input-volume-text')) document.getElementById('eval-input-volume-text').innerText = data.score_volume || 0;
        if (document.getElementById('eval-input-quality-text')) document.getElementById('eval-input-quality-text').innerText = data.score_quality || 0;
        if (document.getElementById('eval-input-progress-text')) document.getElementById('eval-input-progress-text').innerText = data.score_progress || 0;
        if (document.getElementById('eval-input-attitude-text')) document.getElementById('eval-input-attitude-text').innerText = data.score_attitude || 0;
        if (document.getElementById('eval-input-discipline-text')) document.getElementById('eval-input-discipline-text').innerText = data.score_discipline || 0;
        if (document.getElementById('eval-input-test-text')) document.getElementById('eval-input-test-text').innerText = data.score_test || 0;
      }

      // 2. Set LĐ Phòng inputs or text displays
      if (canEditMgrCol) {
        if (document.getElementById('eval-mgr-volume-input')) document.getElementById('eval-mgr-volume-input').value = data.mgr_score_volume !== null && data.mgr_score_volume !== undefined ? data.mgr_score_volume : (data.score_volume || 0);
        if (document.getElementById('eval-mgr-quality-input')) document.getElementById('eval-mgr-quality-input').value = data.mgr_score_quality !== null && data.mgr_score_quality !== undefined ? data.mgr_score_quality : (data.score_quality || 0);
        if (document.getElementById('eval-mgr-progress-input')) document.getElementById('eval-mgr-progress-input').value = data.mgr_score_progress !== null && data.mgr_score_progress !== undefined ? data.mgr_score_progress : (data.score_progress || 0);
        if (document.getElementById('eval-mgr-attitude-input')) document.getElementById('eval-mgr-attitude-input').value = data.mgr_score_attitude !== null && data.mgr_score_attitude !== undefined ? data.mgr_score_attitude : (data.score_attitude || 0);
        if (document.getElementById('eval-mgr-discipline-input')) document.getElementById('eval-mgr-discipline-input').value = data.mgr_score_discipline !== null && data.mgr_score_discipline !== undefined ? data.mgr_score_discipline : (data.score_discipline || 0);
        if (document.getElementById('eval-mgr-test-input')) document.getElementById('eval-mgr-test-input').value = data.mgr_score_test !== null && data.mgr_score_test !== undefined ? data.mgr_score_test : (data.score_test || 0);
      } else {
        if (document.getElementById('eval-mgr-volume')) document.getElementById('eval-mgr-volume').innerText = data.mgr_score_volume !== null && data.mgr_score_volume !== undefined ? data.mgr_score_volume : 0;
        if (document.getElementById('eval-mgr-quality')) document.getElementById('eval-mgr-quality').innerText = data.mgr_score_quality !== null && data.mgr_score_quality !== undefined ? data.mgr_score_quality : 0;
        if (document.getElementById('eval-mgr-progress')) document.getElementById('eval-mgr-progress').innerText = data.mgr_score_progress !== null && data.mgr_score_progress !== undefined ? data.mgr_score_progress : 0;
        if (document.getElementById('eval-mgr-attitude')) document.getElementById('eval-mgr-attitude').innerText = data.mgr_score_attitude !== null && data.mgr_score_attitude !== undefined ? data.mgr_score_attitude : 0;
        if (document.getElementById('eval-mgr-discipline')) document.getElementById('eval-mgr-discipline').innerText = data.mgr_score_discipline !== null && data.mgr_score_discipline !== undefined ? data.mgr_score_discipline : 0;
        if (document.getElementById('eval-mgr-test')) document.getElementById('eval-mgr-test').innerText = data.mgr_score_test !== null && data.mgr_score_test !== undefined ? data.mgr_score_test : 0;
      }

      // 3. Set Deputy inputs or text displays
      if (canEditDeputyCol) {
        if (document.getElementById('eval-deputy-volume-input')) document.getElementById('eval-deputy-volume-input').value = data.deputy_score_volume || 0;
        if (document.getElementById('eval-deputy-quality-input')) document.getElementById('eval-deputy-quality-input').value = data.deputy_score_quality || 0;
        if (document.getElementById('eval-deputy-progress-input')) document.getElementById('eval-deputy-progress-input').value = data.deputy_score_progress || 0;
        if (document.getElementById('eval-deputy-attitude-input')) document.getElementById('eval-deputy-attitude-input').value = data.deputy_score_attitude || 0;
        if (document.getElementById('eval-deputy-discipline-input')) document.getElementById('eval-deputy-discipline-input').value = data.deputy_score_discipline || 0;
        if (document.getElementById('eval-deputy-test-input')) document.getElementById('eval-deputy-test-input').value = data.deputy_score_test || 0;
      } else {
        if (document.getElementById('eval-deputy-volume')) document.getElementById('eval-deputy-volume').innerText = data.deputy_score_volume || 0;
        if (document.getElementById('eval-deputy-quality')) document.getElementById('eval-deputy-quality').innerText = data.deputy_score_quality || 0;
        if (document.getElementById('eval-deputy-progress')) document.getElementById('eval-deputy-progress').innerText = data.deputy_score_progress || 0;
        if (document.getElementById('eval-deputy-attitude')) document.getElementById('eval-deputy-attitude').innerText = data.deputy_score_attitude || 0;
        if (document.getElementById('eval-deputy-discipline')) document.getElementById('eval-deputy-discipline').innerText = data.deputy_score_discipline || 0;
        if (document.getElementById('eval-deputy-test')) document.getElementById('eval-deputy-test').innerText = data.deputy_score_test || 0;
      }

      // 4. Set Head inputs or text displays
      if (canEditHeadCol) {
        if (document.getElementById('eval-head-volume-input')) document.getElementById('eval-head-volume-input').value = data.head_score_volume || 0;
        if (document.getElementById('eval-head-quality-input')) document.getElementById('eval-head-quality-input').value = data.head_score_quality || 0;
        if (document.getElementById('eval-head-progress-input')) document.getElementById('eval-head-progress-input').value = data.head_score_progress || 0;
        if (document.getElementById('eval-head-attitude-input')) document.getElementById('eval-head-attitude-input').value = data.head_score_attitude || 0;
        if (document.getElementById('eval-head-discipline-input')) document.getElementById('eval-head-discipline-input').value = data.head_score_discipline || 0;
        if (document.getElementById('eval-head-test-input')) document.getElementById('eval-head-test-input').value = data.head_score_test || 0;
      } else {
        if (document.getElementById('eval-head-volume')) document.getElementById('eval-head-volume').innerText = data.head_score_volume || 0;
        if (document.getElementById('eval-head-quality')) document.getElementById('eval-head-quality').innerText = data.head_score_quality || 0;
        if (document.getElementById('eval-head-progress')) document.getElementById('eval-head-progress').innerText = data.head_score_progress || 0;
        if (document.getElementById('eval-head-attitude')) document.getElementById('eval-head-attitude').innerText = data.head_score_attitude || 0;
        if (document.getElementById('eval-head-discipline')) document.getElementById('eval-head-discipline').innerText = data.head_score_discipline || 0;
        if (document.getElementById('eval-head-test')) document.getElementById('eval-head-test').innerText = data.head_score_test || 0;
      }

      // Notes
      if (document.getElementById('eval-input-notes')) {
        document.getElementById('eval-input-notes').value = (isSelf ? data.notes : (data.mgr_notes || data.notes)) || '';
      }

      this.recalcEvalScores();
    } catch (err) {
      console.error(err);
      const loadingEl = document.getElementById('eval-modal-loading');
      if (loadingEl) {
        loadingEl.innerHTML = `
          <div class="text-rose-500 py-10 font-bold text-sm">
            <i class="ph-bold ph-warning-circle text-3xl mb-2"></i>
            <p>Không thể tải phiếu đánh giá: ${err.message}</p>
          </div>
        `;
      }
    }
  },

  getVal(id, defaultVal = 0) {
    const el = document.getElementById(id);
    if (!el) return defaultVal;
    if (el.tagName === 'INPUT') {
      const v = parseFloat(el.value);
      return isNaN(v) ? defaultVal : v;
    }
    const v = parseFloat(el.innerText);
    return isNaN(v) ? defaultVal : v;
  },

  recalcEvalScores() {
    // 1. Col 1 (NLĐ Self)
    const sv = Math.min(20, Math.max(0, this.getVal('eval-input-volume', this.getVal('eval-input-volume-text'))));
    const sq = Math.min(20, Math.max(0, this.getVal('eval-input-quality', this.getVal('eval-input-quality-text'))));
    const sp = Math.min(20, Math.max(0, this.getVal('eval-input-progress', this.getVal('eval-input-progress-text'))));
    const sa = Math.min(20, Math.max(0, this.getVal('eval-input-attitude', this.getVal('eval-input-attitude-text'))));
    const sd = Math.min(10, Math.max(0, this.getVal('eval-input-discipline', this.getVal('eval-input-discipline-text'))));
    const st = Math.min(10, Math.max(0, this.getVal('eval-input-test', this.getVal('eval-input-test-text'))));
    const selfTotal = parseFloat((sv + sq + sp + sa + sd + st).toFixed(2));

    const selfTotalEl = document.getElementById('eval-score-total');
    if (selfTotalEl) selfTotalEl.innerText = selfTotal;
    const footerSelfTotal = document.getElementById('eval-footer-self-total');
    if (footerSelfTotal) footerSelfTotal.innerText = selfTotal;

    // 2. Col 2 (LĐ Phòng)
    const mv = Math.min(20, Math.max(0, this.getVal('eval-mgr-volume-input', this.getVal('eval-mgr-volume'))));
    const mq = Math.min(20, Math.max(0, this.getVal('eval-mgr-quality-input', this.getVal('eval-mgr-quality'))));
    const mp = Math.min(20, Math.max(0, this.getVal('eval-mgr-progress-input', this.getVal('eval-mgr-progress'))));
    const ma = Math.min(20, Math.max(0, this.getVal('eval-mgr-attitude-input', this.getVal('eval-mgr-attitude'))));
    const md = Math.min(10, Math.max(0, this.getVal('eval-mgr-discipline-input', this.getVal('eval-mgr-discipline'))));
    const mt = Math.min(10, Math.max(0, this.getVal('eval-mgr-test-input', this.getVal('eval-mgr-test'))));
    const mgrTotal = parseFloat((mv + mq + mp + ma + md + mt).toFixed(2));

    const mgrTotalEl = document.getElementById('eval-mgr-total');
    if (mgrTotalEl) mgrTotalEl.innerText = mgrTotal;

    // 3. Col 3 (Deputy)
    const dv = Math.min(20, Math.max(0, this.getVal('eval-deputy-volume-input', this.getVal('eval-deputy-volume'))));
    const dq = Math.min(20, Math.max(0, this.getVal('eval-deputy-quality-input', this.getVal('eval-deputy-quality'))));
    const dp = Math.min(20, Math.max(0, this.getVal('eval-deputy-progress-input', this.getVal('eval-deputy-progress'))));
    const da = Math.min(20, Math.max(0, this.getVal('eval-deputy-attitude-input', this.getVal('eval-deputy-attitude'))));
    const dd = Math.min(10, Math.max(0, this.getVal('eval-deputy-discipline-input', this.getVal('eval-deputy-discipline'))));
    const dt = Math.min(10, Math.max(0, this.getVal('eval-deputy-test-input', this.getVal('eval-deputy-test'))));
    const depTotal = parseFloat((dv + dq + dp + da + dd + dt).toFixed(2));

    const depTotalEl = document.getElementById('eval-deputy-total');
    if (depTotalEl) depTotalEl.innerText = depTotal;

    // 4. Col 4 (Head)
    const hv = Math.min(20, Math.max(0, this.getVal('eval-head-volume-input', this.getVal('eval-head-volume'))));
    const hq = Math.min(20, Math.max(0, this.getVal('eval-head-quality-input', this.getVal('eval-head-quality'))));
    const hp = Math.min(20, Math.max(0, this.getVal('eval-head-progress-input', this.getVal('eval-head-progress'))));
    const ha = Math.min(20, Math.max(0, this.getVal('eval-head-attitude-input', this.getVal('eval-head-attitude'))));
    const hd = Math.min(10, Math.max(0, this.getVal('eval-head-discipline-input', this.getVal('eval-head-discipline'))));
    const ht = Math.min(10, Math.max(0, this.getVal('eval-head-test-input', this.getVal('eval-head-test'))));
    const headTotal = parseFloat((hv + hq + hp + ha + hd + ht).toFixed(2));

    const headTotalEl = document.getElementById('eval-head-total');
    if (headTotalEl) headTotalEl.innerText = headTotal;

    // 5. Col 5 (Average Criteria Scores)
    const calcAvgItem = (arr) => {
      const active = arr.filter(n => n > 0);
      return active.length > 0 ? parseFloat((active.reduce((a, b) => a + b, 0) / active.length).toFixed(1)) : 0;
    };

    const avgV = calcAvgItem([sv, mv, dv, hv]);
    const avgQ = calcAvgItem([sq, mq, dq, hq]);
    const avgP = calcAvgItem([sp, mp, dp, hp]);
    const avgA = calcAvgItem([sa, ma, da, ha]);
    const avgD = calcAvgItem([sd, md, dd, hd]);
    const avgT = calcAvgItem([st, mt, dt, ht]);

    if (document.getElementById('eval-avg-volume')) document.getElementById('eval-avg-volume').innerText = avgV;
    if (document.getElementById('eval-avg-quality')) document.getElementById('eval-avg-quality').innerText = avgQ;
    if (document.getElementById('eval-avg-progress')) document.getElementById('eval-avg-progress').innerText = avgP;
    if (document.getElementById('eval-avg-attitude')) document.getElementById('eval-avg-attitude').innerText = avgA;
    if (document.getElementById('eval-avg-discipline')) document.getElementById('eval-avg-discipline').innerText = avgD;
    if (document.getElementById('eval-avg-test')) document.getElementById('eval-avg-test').innerText = avgT;

    const totalsArr = [selfTotal, mgrTotal, depTotal, headTotal].filter(t => t > 0);
    const avgTotal = totalsArr.length > 0 ? parseFloat((totalsArr.reduce((a, b) => a + b, 0) / totalsArr.length).toFixed(2)) : 0;

    const avgTotalEl = document.getElementById('eval-avg-total');
    if (avgTotalEl) avgTotalEl.innerText = avgTotal;
    const footerAvgTotal = document.getElementById('eval-footer-avg-total');
    if (footerAvgTotal) footerAvgTotal.innerText = avgTotal;

    // Benchmark Rating against standard
    const evalBenchmark = avgTotal > 0 ? avgTotal : selfTotal;
    const ratingBadge = document.getElementById('eval-badge-rating');
    if (ratingBadge) {
      if (evalBenchmark >= 90) {
        ratingBadge.className = 'text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300';
        ratingBadge.innerText = '🏆 Loại A (Xuất sắc)';
      } else if (evalBenchmark >= 80) {
        ratingBadge.className = 'text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300';
        ratingBadge.innerText = '⭐ Loại B (Hoàn thành Tốt)';
      } else if (evalBenchmark >= 70) {
        ratingBadge.className = 'text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300';
        ratingBadge.innerText = '✅ Loại C (Hoàn thành)';
      } else {
        ratingBadge.className = 'text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300';
        ratingBadge.innerText = '⚠️ Loại D (Chưa hoàn thành)';
      }
    }
  },

  async saveSelfEvaluation(month, year, targetUserId) {
    const saveBtn = document.getElementById('btn-save-eval');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="ph ph-spinner animate-spin text-base"></i> Đang lưu...';
    }

    try {
      const userCol = this.getUserEvaluationColumn(Auth.user);

      const payload = {
        user_id: targetUserId,
        month,
        year,
        period_name: `Kỳ tạm ứng thù lao theo hiệu quả công việc V2 tháng ${month} năm ${year}`
      };

      // 1. NHÂN VIÊN / CHUYÊN VIÊN -> KÊ CỘT 1 (NLĐ)
      if (userCol === 'staff') {
        payload.score_volume = Math.min(20, Math.max(0, this.getVal('eval-input-volume', this.getVal('eval-input-volume-text'))));
        payload.score_quality = Math.min(20, Math.max(0, this.getVal('eval-input-quality', this.getVal('eval-input-quality-text'))));
        payload.score_progress = Math.min(20, Math.max(0, this.getVal('eval-input-progress', this.getVal('eval-input-progress-text'))));
        payload.score_attitude = Math.min(20, Math.max(0, this.getVal('eval-input-attitude', this.getVal('eval-input-attitude-text'))));
        payload.score_discipline = Math.min(10, Math.max(0, this.getVal('eval-input-discipline', this.getVal('eval-input-discipline-text'))));
        payload.score_test = Math.min(10, Math.max(0, this.getVal('eval-input-test', this.getVal('eval-input-test-text'))));
        payload.notes = (document.getElementById('eval-input-notes')?.value || '').trim();
      } 
      // 2. LÃNH ĐẠO PHÒNG (Trưởng phòng, Phó phòng) -> KÊ CỘT 2
      else if (userCol === 'manager') {
        payload.mgr_score_volume = Math.min(20, Math.max(0, this.getVal('eval-mgr-volume-input', this.getVal('eval-mgr-volume'))));
        payload.mgr_score_quality = Math.min(20, Math.max(0, this.getVal('eval-mgr-quality-input', this.getVal('eval-mgr-quality'))));
        payload.mgr_score_progress = Math.min(20, Math.max(0, this.getVal('eval-mgr-progress-input', this.getVal('eval-mgr-progress'))));
        payload.mgr_score_attitude = Math.min(20, Math.max(0, this.getVal('eval-mgr-attitude-input', this.getVal('eval-mgr-attitude'))));
        payload.mgr_score_discipline = Math.min(10, Math.max(0, this.getVal('eval-mgr-discipline-input', this.getVal('eval-mgr-discipline'))));
        payload.mgr_score_test = Math.min(10, Math.max(0, this.getVal('eval-mgr-test-input', this.getVal('eval-mgr-test'))));
        payload.mgr_notes = (document.getElementById('eval-input-notes')?.value || '').trim();
      } 
      // 3. PHÓ TRƯỞNG ĐƠN VỊ (Phó Giám đốc) -> KÊ CỘT 3
      else if (userCol === 'deputy') {
        payload.deputy_score_volume = Math.min(20, Math.max(0, this.getVal('eval-deputy-volume-input', this.getVal('eval-deputy-volume'))));
        payload.deputy_score_quality = Math.min(20, Math.max(0, this.getVal('eval-deputy-quality-input', this.getVal('eval-deputy-quality'))));
        payload.deputy_score_progress = Math.min(20, Math.max(0, this.getVal('eval-deputy-progress-input', this.getVal('eval-deputy-progress'))));
        payload.deputy_score_attitude = Math.min(20, Math.max(0, this.getVal('eval-deputy-attitude-input', this.getVal('eval-deputy-attitude'))));
        payload.deputy_score_discipline = Math.min(10, Math.max(0, this.getVal('eval-deputy-discipline-input', this.getVal('eval-deputy-discipline'))));
        payload.deputy_score_test = Math.min(10, Math.max(0, this.getVal('eval-deputy-test-input', this.getVal('eval-deputy-test'))));
        payload.deputy_notes = (document.getElementById('eval-input-notes')?.value || '').trim();
      } 
      // 4. TRƯỞNG ĐƠN VỊ (Giám đốc, Admin) -> KÊ CỘT 4
      else if (userCol === 'head') {
        payload.head_score_volume = Math.min(20, Math.max(0, this.getVal('eval-head-volume-input', this.getVal('eval-head-volume'))));
        payload.head_score_quality = Math.min(20, Math.max(0, this.getVal('eval-head-quality-input', this.getVal('eval-head-quality'))));
        payload.head_score_progress = Math.min(20, Math.max(0, this.getVal('eval-head-progress-input', this.getVal('eval-head-progress'))));
        payload.head_score_attitude = Math.min(20, Math.max(0, this.getVal('eval-head-attitude-input', this.getVal('eval-head-attitude'))));
        payload.head_score_discipline = Math.min(10, Math.max(0, this.getVal('eval-head-discipline-input', this.getVal('eval-head-discipline'))));
        payload.head_score_test = Math.min(10, Math.max(0, this.getVal('eval-head-test-input', this.getVal('eval-head-test'))));
        payload.head_notes = (document.getElementById('eval-input-notes')?.value || '').trim();
      }

      const res = await apiFetch('/api/evaluations/my', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (window.showToast) {
        showToast('success', `Đã lưu phiếu đánh giá tháng ${month}/${year} thành công!`);
      } else {
        alert(`✅ Đã lưu phiếu đánh giá tháng ${month}/${year} thành công!`);
      }

      App.closeModal();
    } catch (err) {
      console.error(err);
      alert('Lỗi lưu phiếu đánh giá: ' + err.message);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="ph-bold ph-floppy-disk text-base"></i> Lưu phiếu đánh giá';
      }
    }
  },

  printSelfEvaluation() {
    const printContent = document.getElementById('printable-eval-form');
    if (!printContent) return;

    const now = new Date();
    const win = window.open('', '_blank', 'width=900,height=800');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Phiếu Đánh Giá Mức Độ Hoàn Thành Công Việc - Mẫu 01A</title>
        <meta charset="utf-8">
        <style>
          @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
          body { font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.3; color: #000; margin: 0; padding: 20px; }
          .header-table { width: 100%; border: none; margin-bottom: 20px; }
          .header-table td { vertical-align: top; text-align: center; }
          .badge-box { border: 1px solid #000; padding: 4px 8px; font-weight: bold; font-size: 10pt; display: inline-block; margin-bottom: 10px; }
          .title { text-align: center; margin: 20px 0; }
          .title h2 { font-size: 15pt; font-weight: bold; margin: 0; text-transform: uppercase; }
          .title p { margin: 4px 0; font-size: 13pt; font-weight: bold; }
          .info-table { width: 100%; margin-bottom: 15px; }
          .info-table td { padding: 4px 0; font-size: 13pt; }
          table.eval-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          table.eval-table th, table.eval-table td { border: 1px solid #000; padding: 6px 8px; font-size: 11pt; }
          table.eval-table th { font-weight: bold; text-align: center; background-color: #f2f2f2; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .signatures { width: 100%; margin-top: 30px; text-align: center; }
          .signatures td { width: 33.33%; vertical-align: top; padding-top: 10px; }
          input { border: none; font-weight: bold; text-align: center; font-size: 11pt; background: transparent; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div style="text-align: right; margin-bottom: 10px;">
          <div class="badge-box">MẪU 01A (Lưu tại đơn vị)</div>
        </div>
        <table class="header-table">
          <tr>
            <td style="width: 50%;">
              <strong>NGÂN HÀNG NÔNG NGHIỆP<br>VÀ PHÁT TRIỂN NÔNG THÔN VIỆT NAM</strong><br>
              <u style="font-weight: bold;">${document.getElementById('eval-header-dept')?.innerText || 'PHÒNG QUẢN LÝ ĐÀO TẠO VÀ THƯ VIỆN'}</u>
            </td>
            <td style="width: 50%;">
              <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br>
              <strong>Độc lập – Tự do – Hạnh phúc</strong><br>
              <div style="width: 110px; height: 1px; background: #000; margin: 5px auto;"></div>
              <em style="font-size: 11pt;">Hà Nội, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}</em>
            </td>
          </tr>
        </table>

        <div class="title">
          <h2>PHIẾU ĐÁNH GIÁ MỨC ĐỘ HOÀN THÀNH CÔNG VIỆC</h2>
          <p>${document.getElementById('eval-title-period')?.innerText || 'Kỳ tạm ứng thù lao theo hiệu quả công việc V2'}</p>
          <em style="font-size: 11pt;">(Áp dụng cho nhân viên)</em>
        </div>

        <table class="info-table">
          <tr>
            <td style="width: 120px;"><strong>Họ và tên:</strong></td>
            <td><strong>${document.getElementById('eval-info-name')?.innerText || ''}</strong></td>
          </tr>
          <tr>
            <td><strong>Chức vụ:</strong></td>
            <td>${document.getElementById('eval-info-position')?.innerText || ''}</td>
          </tr>
          <tr>
            <td><strong>Phòng/Bộ phận:</strong></td>
            <td>${document.getElementById('eval-info-dept')?.innerText || ''}</td>
          </tr>
        </table>

        <table class="eval-table">
          <thead>
            <tr>
              <th rowspan="2" style="width: 30px;">TT</th>
              <th rowspan="2">Tiêu chí đánh giá</th>
              <th colspan="5">Điểm đánh giá</th>
              <th rowspan="2" style="width: 80px;">Ghi chú</th>
            </tr>
            <tr>
              <th style="width: 80px;">NLĐ (Tự đánh giá)</th>
              <th style="width: 70px;">LĐ phòng / NV</th>
              <th style="width: 70px;">Phó trưởng ĐV</th>
              <th style="width: 70px;">Trưởng ĐV</th>
              <th style="width: 70px;">Điểm BQ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-center font-bold">1</td>
              <td><strong>Khối lượng công việc</strong> (Khối lượng công việc hoàn thành so với khối lượng công việc cần thực hiện trong tháng)</td>
              <td class="text-center font-bold"><div>(Tối đa 20)</div>${this.getVal('eval-input-volume', this.getVal('eval-input-volume-text'))}</td>
              <td class="text-center"><div>(Tối đa 20)</div>${this.getVal('eval-mgr-volume-input', this.getVal('eval-mgr-volume'))}</td>
              <td class="text-center"><div>(Tối đa 20)</div>${this.getVal('eval-deputy-volume-input', this.getVal('eval-deputy-volume'))}</td>
              <td class="text-center"><div>(Tối đa 20)</div>${this.getVal('eval-head-volume-input', this.getVal('eval-head-volume'))}</td>
              <td class="text-center font-bold"><div>(Tối đa 20)</div>${document.getElementById('eval-avg-volume')?.innerText || 0}</td>
              <td>${document.getElementById('eval-note-1')?.value || ''}</td>
            </tr>
            <tr>
              <td class="text-center font-bold">2</td>
              <td><strong>Chất lượng công việc</strong> (Chất lượng, kết quả, sự chính xác...trong thực hiện công việc)</td>
              <td class="text-center font-bold"><div>(Tối đa 20)</div>${this.getVal('eval-input-quality', this.getVal('eval-input-quality-text'))}</td>
              <td class="text-center"><div>(Tối đa 20)</div>${this.getVal('eval-mgr-quality-input', this.getVal('eval-mgr-quality'))}</td>
              <td class="text-center"><div>(Tối đa 20)</div>${this.getVal('eval-deputy-quality-input', this.getVal('eval-deputy-quality'))}</td>
              <td class="text-center"><div>(Tối đa 20)</div>${this.getVal('eval-head-quality-input', this.getVal('eval-head-quality'))}</td>
              <td class="text-center font-bold"><div>(Tối đa 20)</div>${document.getElementById('eval-avg-quality')?.innerText || 0}</td>
              <td>${document.getElementById('eval-note-2')?.value || ''}</td>
            </tr>
            <tr>
              <td class="text-center font-bold">3</td>
              <td><strong>Tiến độ thực hiện công việc</strong> (Tiến độ thực hiện công việc theo thời hạn được phân công)</td>
              <td class="text-center font-bold"><div>(Tối đa 20)</div>${this.getVal('eval-input-progress', this.getVal('eval-input-progress-text'))}</td>
              <td class="text-center"><div>(Tối đa 20)</div>${this.getVal('eval-mgr-progress-input', this.getVal('eval-mgr-progress'))}</td>
              <td class="text-center"><div>(Tối đa 20)</div>${this.getVal('eval-deputy-progress-input', this.getVal('eval-deputy-progress'))}</td>
              <td class="text-center"><div>(Tối đa 20)</div>${this.getVal('eval-head-progress-input', this.getVal('eval-head-progress'))}</td>
              <td class="text-center font-bold"><div>(Tối đa 20)</div>${document.getElementById('eval-avg-progress')?.innerText || 0}</td>
              <td>${document.getElementById('eval-note-3')?.value || ''}</td>
            </tr>
            <tr>
              <td class="text-center font-bold">4</td>
              <td><strong>Năng lực, thái độ thực hiện</strong> (Khả năng tham mưu lãnh đạo; Khả năng xây dựng cơ chế, quy chế...; Khả năng xử lý tình huống; Ý thức làm việc; Phối hợp công tác...)</td>
              <td class="text-center font-bold"><div>(Tối đa 20)</div>${this.getVal('eval-input-attitude', this.getVal('eval-input-attitude-text'))}</td>
              <td class="text-center"><div>(Tối đa 20)</div>${this.getVal('eval-mgr-attitude-input', this.getVal('eval-mgr-attitude'))}</td>
              <td class="text-center"><div>(Tối đa 20)</div>${this.getVal('eval-deputy-attitude-input', this.getVal('eval-deputy-attitude'))}</td>
              <td class="text-center"><div>(Tối đa 20)</div>${this.getVal('eval-head-attitude-input', this.getVal('eval-head-attitude'))}</td>
              <td class="text-center font-bold"><div>(Tối đa 20)</div>${document.getElementById('eval-avg-attitude')?.innerText || 0}</td>
              <td>${document.getElementById('eval-note-4')?.value || ''}</td>
            </tr>
            <tr>
              <td class="text-center font-bold">II</td>
              <td><strong>Ý thức chấp hành kỷ luật, nội quy lao động</strong></td>
              <td class="text-center font-bold"><div>(Tối đa 10)</div>${this.getVal('eval-input-discipline', this.getVal('eval-input-discipline-text'))}</td>
              <td class="text-center"><div>(Tối đa 10)</div>${this.getVal('eval-mgr-discipline-input', this.getVal('eval-mgr-discipline'))}</td>
              <td class="text-center"><div>(Tối đa 10)</div>${this.getVal('eval-deputy-discipline-input', this.getVal('eval-deputy-discipline'))}</td>
              <td class="text-center"><div>(Tối đa 10)</div>${this.getVal('eval-head-discipline-input', this.getVal('eval-head-discipline'))}</td>
              <td class="text-center font-bold"><div>(Tối đa 10)</div>${document.getElementById('eval-avg-discipline')?.innerText || 0}</td>
              <td>${document.getElementById('eval-note-5')?.value || ''}</td>
            </tr>
            <tr>
              <td class="text-center font-bold">III</td>
              <td><strong>Kết quả kiểm tra nghiệp vụ</strong></td>
              <td class="text-center font-bold"><div>(Tối đa 10)</div>${this.getVal('eval-input-test', this.getVal('eval-input-test-text'))}</td>
              <td class="text-center"><div>(Tối đa 10)</div>${this.getVal('eval-mgr-test-input', this.getVal('eval-mgr-test'))}</td>
              <td class="text-center"><div>(Tối đa 10)</div>${this.getVal('eval-deputy-test-input', this.getVal('eval-deputy-test'))}</td>
              <td class="text-center"><div>(Tối đa 10)</div>${this.getVal('eval-head-test-input', this.getVal('eval-head-test'))}</td>
              <td class="text-center font-bold"><div>(Tối đa 10)</div>${document.getElementById('eval-avg-test')?.innerText || 0}</td>
              <td>${document.getElementById('eval-note-6')?.value || ''}</td>
            </tr>
            <tr style="background-color: #f2f2f2; font-weight: bold;">
              <td></td>
              <td><strong>Tổng điểm:</strong> (${document.getElementById('eval-badge-rating')?.innerText || ''})</td>
              <td class="text-center" style="font-size: 12pt;"><strong>${document.getElementById('eval-score-total')?.innerText || 0}</strong></td>
              <td class="text-center" style="font-size: 12pt;"><strong>${document.getElementById('eval-mgr-total')?.innerText || 0}</strong></td>
              <td class="text-center"><strong>${document.getElementById('eval-deputy-total')?.innerText || 0}</strong></td>
              <td class="text-center"><strong>${document.getElementById('eval-head-total')?.innerText || 0}</strong></td>
              <td class="text-center" style="font-size: 13pt; color: #005a36;"><strong>${document.getElementById('eval-avg-total')?.innerText || 0}</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>

        ${(document.getElementById('eval-input-notes')?.value) ? `
          <div style="margin-top: 15px; font-size: 11pt;">
            <strong>Ý kiến / Nhận xét:</strong> ${document.getElementById('eval-input-notes').value}
          </div>
        ` : ''}

        <table class="signatures">
          <tr>
            <td>
              <strong>NGƯỜI TỰ ĐÁNH GIÁ</strong><br>
              <em>(Ký, ghi rõ họ tên)</em>
              <div style="height: 60px;"></div>
              <strong>${document.getElementById('eval-info-name')?.innerText || ''}</strong>
            </td>
            <td>
              <strong>LÃNH ĐẠO PHÒNG</strong><br>
              <em>(Ký, ghi rõ họ tên)</em>
              <div style="height: 60px;"></div>
              <strong>${document.getElementById('eval-sign-mgr')?.innerText || ''}</strong>
            </td>
            <td>
              <strong>TRƯỞNG ĐƠN VỊ</strong><br>
              <em>(Ký, ghi rõ họ tên)</em>
              <div style="height: 60px;"></div>
              <strong>${document.getElementById('eval-sign-head')?.innerText || ''}</strong>
            </td>
          </tr>
        </table>

        <div class="no-print" style="margin-top: 30px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; font-weight: bold; background: #005a36; color: #fff; border: none; border-radius: 8px; cursor: pointer;">
            🖨️ In ra máy in / Lưu PDF
          </button>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => {
      win.focus();
    }, 250);
  }
};
