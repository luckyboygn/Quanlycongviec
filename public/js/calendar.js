/**
 * Calendar Module - Lịch Công Việc & Tiến Độ Nhiệm Vụ Toàn Diện
 * Hỗ trợ tất cả cán bộ: Ban Giám đốc, Admin, Trưởng phòng, Chuyên viên/Giảng viên
 * Tích hợp: Lịch Tháng (Month), Lịch Tuần (Week), Lịch Ngày (Day), Mini-Calendar Sidebar
 */
const Calendar = {
  currentDate: new Date(),
  selectedDate: new Date(),
  viewMode: 'month', // 'month', 'week', 'day'
  filterType: 'all', // 'all', 'tasks', 'logs'
  tasks: [],
  logs: [],
  isLoading: false,

  async init() {
    // Initial fetch if needed
  },

  async render(targetDate = null) {
    const container = document.getElementById('main-content');
    if (!container) return;

    if (targetDate) {
      this.currentDate = new Date(targetDate);
      this.selectedDate = new Date(targetDate);
    }

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header Banner -->
        <div class="bg-gradient-to-r from-[#005d39] via-[#007043] to-emerald-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div class="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
            <i class="ph-bold ph-calendar text-[220px]"></i>
          </div>
          
          <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-emerald-100 text-xs font-bold mb-3">
                <i class="ph-bold ph-calendar-check"></i>
                <span>Lịch Công Tác & Kê Khai Nhiệm Vụ</span>
              </div>
              <h1 class="text-2xl sm:text-3xl font-black tracking-tight">
                Lịch Công Việc - Agribank
              </h1>
              <p class="text-emerald-100/90 text-xs sm:text-sm mt-1 max-w-2xl">
                Theo dõi trực quan thời hạn hoàn thành các đầu việc giao phòng và lịch trình nhật ký tự kê khai của cán bộ.
              </p>
            </div>

            <!-- Header Quick Actions -->
            <div class="flex items-center flex-wrap gap-2.5">
              <button onclick="Calendar.today()" class="px-4 py-2.5 bg-white text-[#005d39] hover:bg-emerald-50 rounded-2xl font-bold text-xs shadow-md transition flex items-center gap-1.5">
                <i class="ph-bold ph-calendar-star text-base"></i> Hôm nay
              </button>
              <button onclick="PersonalLogs.openCreateModal()" class="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-bold text-xs shadow-md transition flex items-center gap-1.5">
                <i class="ph-bold ph-plus-circle text-base"></i> Kê khai việc mới
              </button>
            </div>
          </div>
        </div>

        <!-- Top Statistics Cards -->
        <div id="calendar-kpi-cards" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <div class="text-[11px] font-bold text-slate-400 uppercase">Tổng sự kiện tháng này</div>
            <div id="cal-stat-total" class="text-2xl font-black text-slate-800 dark:text-white mt-1">--</div>
            <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">Việc giao & Tự kê khai</div>
          </div>
          <div class="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <div class="text-[11px] font-bold text-amber-500 uppercase">Đang thực hiện</div>
            <div id="cal-stat-in-progress" class="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">--</div>
            <div class="text-[10px] text-slate-400 font-semibold mt-1">Cần đẩy nhanh tiến độ</div>
          </div>
          <div class="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <div class="text-[11px] font-bold text-emerald-600 uppercase">Đã hoàn thành</div>
            <div id="cal-stat-completed" class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">--</div>
            <div class="text-[10px] text-slate-400 font-semibold mt-1">Nhiệm vụ xong đúng hạn</div>
          </div>
          <div class="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <div class="text-[11px] font-bold text-purple-600 uppercase">Tổng giờ công kê khai</div>
            <div id="cal-stat-hours" class="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">--</div>
            <div class="text-[10px] text-slate-400 font-semibold mt-1">Quy đổi ngày công chuẩn</div>
          </div>
        </div>

        <!-- Main Calendar Container -->
        <div class="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 sm:p-6 space-y-5">
          
          <!-- Calendar Toolbar -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700">
            <!-- Navigation (Prev, Next, Title) -->
            <div class="flex items-center gap-3">
              <div class="flex items-center bg-slate-100 dark:bg-slate-700 p-1 rounded-2xl">
                <button onclick="Calendar.prev()" class="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-xl text-slate-600 dark:text-slate-300 transition" title="Tháng trước">
                  <i class="ph-bold ph-caret-left text-base"></i>
                </button>
                <button onclick="Calendar.today()" class="px-3 py-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition">
                  Hiện tại
                </button>
                <button onclick="Calendar.next()" class="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-xl text-slate-600 dark:text-slate-300 transition" title="Tháng sau">
                  <i class="ph-bold ph-caret-right text-base"></i>
                </button>
              </div>

              <h2 id="calendar-title" class="text-lg sm:text-xl font-black text-slate-800 dark:text-white capitalize">
                <!-- Title dynamically injected -->
              </h2>
            </div>

            <!-- Filters & View Switcher -->
            <div class="flex items-center flex-wrap gap-2">
              <!-- Filter Type -->
              <div class="flex items-center bg-slate-100 dark:bg-slate-700 p-1 rounded-2xl text-xs font-bold">
                <button onclick="Calendar.setFilter('all')" id="cal-filter-all" class="px-3 py-1.5 rounded-xl transition ${this.filterType === 'all' ? 'bg-[#005d39] text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}">
                  Tất cả
                </button>
                <button onclick="Calendar.setFilter('tasks')" id="cal-filter-tasks" class="px-3 py-1.5 rounded-xl transition ${this.filterType === 'tasks' ? 'bg-[#005d39] text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}">
                  📋 Việc giao
                </button>
                <button onclick="Calendar.setFilter('logs')" id="cal-filter-logs" class="px-3 py-1.5 rounded-xl transition ${this.filterType === 'logs' ? 'bg-[#005d39] text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'}">
                  📝 Tự kê khai
                </button>
              </div>

              <!-- View Mode -->
              <div class="flex items-center bg-slate-100 dark:bg-slate-700 p-1 rounded-2xl text-xs font-bold">
                <button onclick="Calendar.setViewMode('month')" id="cal-view-month" class="px-3 py-1.5 rounded-xl transition ${this.viewMode === 'month' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500'}">
                  Tháng
                </button>
                <button onclick="Calendar.setViewMode('week')" id="cal-view-week" class="px-3 py-1.5 rounded-xl transition ${this.viewMode === 'week' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500'}">
                  Tuần
                </button>
                <button onclick="Calendar.setViewMode('day')" id="cal-view-day" class="px-3 py-1.5 rounded-xl transition ${this.viewMode === 'day' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500'}">
                  Ngày
                </button>
              </div>
            </div>
          </div>

          <!-- Calendar Body Grid -->
          <div id="calendar-grid-container" class="min-h-[500px]">
            <!-- Rendered grid -->
          </div>

          <!-- Color Legend Footer -->
          <div class="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center flex-wrap gap-4 text-xs font-semibold text-slate-500">
            <span class="text-[11px] font-extrabold uppercase text-slate-400">Chú thích trạng thái:</span>
            <div class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span>Đã hoàn thành / Xong</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded-full bg-amber-500"></span>
              <span>Đang thực hiện</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded-full bg-rose-500"></span>
              <span>Quá hạn / Cần gấp</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded-full bg-purple-500"></span>
              <span>Nhật ký tự kê khai</span>
            </div>
          </div>

        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    try {
      this.isLoading = true;
      const [tasksRes, logsRes] = await Promise.all([
        apiFetch('/api/tasks'),
        apiFetch('/api/personal-logs')
      ]);

      this.tasks = tasksRes || [];
      this.logs = logsRes || [];
      this.isLoading = false;

      this.updateStats();
      this.renderCurrentView();
    } catch (err) {
      console.error('Calendar load data error:', err);
    }
  },

  updateStats() {
    const currentM = this.currentDate.getMonth();
    const currentY = this.currentDate.getFullYear();

    // Filter tasks & logs belonging to current displayed month
    const mTasks = this.tasks.filter(t => {
      const d = t.due_date ? new Date(t.due_date) : (t.created_at ? new Date(t.created_at) : null);
      return d && d.getMonth() === currentM && d.getFullYear() === currentY;
    });

    const mLogs = this.logs.filter(l => {
      const d = l.work_date ? new Date(l.work_date) : (l.created_at ? new Date(l.created_at) : null);
      return d && d.getMonth() === currentM && d.getFullYear() === currentY;
    });

    const totalEvents = mTasks.length + mLogs.length;
    const completedCount = mTasks.filter(t => t.status === 'completed').length + mLogs.filter(l => l.status === 'completed').length;
    const inProgressCount = mTasks.filter(t => t.status === 'in_progress' || t.status === 'pending').length + mLogs.filter(l => l.status === 'in_progress').length;
    
    let totalHours = 0;
    mLogs.forEach(l => totalHours += (parseFloat(l.actual_hours) || 0));

    const elTotal = document.getElementById('cal-stat-total');
    const elInProg = document.getElementById('cal-stat-in-progress');
    const elComp = document.getElementById('cal-stat-completed');
    const elHours = document.getElementById('cal-stat-hours');

    if (elTotal) elTotal.innerText = totalEvents;
    if (elInProg) elInProg.innerText = inProgressCount;
    if (elComp) elComp.innerText = completedCount;
    if (elHours) elHours.innerText = totalHours.toFixed(1) + 'h';
  },

  renderCurrentView() {
    const titleEl = document.getElementById('calendar-title');
    const gridEl = document.getElementById('calendar-grid-container');
    if (!gridEl) return;

    const monthNames = [
      'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
      'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ];

    if (this.viewMode === 'month') {
      if (titleEl) {
        titleEl.innerText = `${monthNames[this.currentDate.getMonth()]} năm ${this.currentDate.getFullYear()}`;
      }
      this.renderMonthGrid(gridEl);
    } else if (this.viewMode === 'week') {
      if (titleEl) {
        titleEl.innerText = `Tuần ${this.getWeekNumber(this.currentDate)} • ${monthNames[this.currentDate.getMonth()]} năm ${this.currentDate.getFullYear()}`;
      }
      this.renderWeekGrid(gridEl);
    } else if (this.viewMode === 'day') {
      if (titleEl) {
        const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        titleEl.innerText = `${days[this.currentDate.getDay()]}, Ngày ${this.currentDate.getDate()} ${monthNames[this.currentDate.getMonth()]} năm ${this.currentDate.getFullYear()}`;
      }
      this.renderDayView(gridEl);
    }
  },

  renderMonthGrid(container) {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon
    // Shift so Monday is index 0
    const startDayOffset = (firstDayIndex === 0 ? 6 : firstDayIndex - 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const today = new Date();
    const dayHeaders = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

    let html = `
      <div class="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xs">
        <!-- Day Headers -->
        ${dayHeaders.map((dh, idx) => `
          <div class="bg-slate-100 dark:bg-slate-800/90 py-2.5 text-center text-xs font-extrabold ${idx >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}">
            ${dh}
          </div>
        `).join('')}
    `;

    // 1. Previous month trailing days
    for (let i = startDayOffset - 1; i >= 0; i--) {
      const pDay = prevMonthDays - i;
      html += `
        <div class="bg-slate-50/50 dark:bg-slate-900/30 p-2 min-h-[110px] text-slate-300 dark:text-slate-600 select-none">
          <span class="text-xs font-semibold">${pDay}</span>
        </div>
      `;
    }

    // 2. Current month days
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
      const isSelected = this.selectedDate.getFullYear() === year && this.selectedDate.getMonth() === month && this.selectedDate.getDate() === day;

      const events = this.getEventsForDate(dateStr);

      html += `
        <div onclick="Calendar.selectDate('${dateStr}')" class="bg-white dark:bg-slate-800 p-2 min-h-[110px] transition group hover:bg-emerald-50/40 dark:hover:bg-slate-700/50 cursor-pointer relative flex flex-col justify-between ${isSelected ? 'ring-2 ring-emerald-500 z-10' : ''}">
          <!-- Day Header -->
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold ${isToday ? 'w-6 h-6 rounded-full bg-[#005d39] text-white flex items-center justify-center shadow-xs' : 'text-slate-700 dark:text-slate-300'}">
              ${day}
            </span>
            ${events.length > 0 ? `
              <span class="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.2 rounded-full">
                ${events.length}
              </span>
            ` : ''}
          </div>

          <!-- Events List for this Day -->
          <div class="space-y-1 my-1 overflow-y-auto max-h-[72px] custom-scrollbar">
            ${events.slice(0, 3).map(ev => {
              const isTask = ev._type === 'task';
              const isDone = ev.status === 'completed';
              const isOverdue = isTask && ev.due_date && new Date(ev.due_date) < new Date() && !isDone;
              
              const badgeBg = isDone ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' :
                              isOverdue ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300' :
                              isTask ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300' :
                              'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300';

              return `
                <div onclick="event.stopPropagation(); Calendar.openEventDetail('${ev._type}', ${ev.id})" class="px-1.5 py-0.5 rounded text-[10px] font-bold truncate border ${badgeBg} hover:scale-[1.02] transition shadow-2xs cursor-pointer" title="${ev.title || ev.task_name}">
                  ${isTask ? '📋' : '📝'} ${ev.title || ev.task_name}
                </div>
              `;
            }).join('')}
            ${events.length > 3 ? `
              <div class="text-[9px] text-slate-400 font-bold text-center">
                +${events.length - 3} việc khác
              </div>
            ` : ''}
          </div>

          <div class="text-[9px] text-slate-400 flex items-center justify-end opacity-0 group-hover:opacity-100 transition">
            <span class="text-emerald-600 font-bold hover:underline">Chi tiết</span>
          </div>
        </div>
      `;
    }

    // 3. Next month leading days
    const totalCells = startDayOffset + totalDays;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      html += `
        <div class="bg-slate-50/50 dark:bg-slate-900/30 p-2 min-h-[110px] text-slate-300 dark:text-slate-600 select-none">
          <span class="text-xs font-semibold">${i}</span>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;
  },

  renderWeekGrid(container) {
    const startOfWeek = new Date(this.currentDate);
    const dayIndex = startOfWeek.getDay();
    const diff = (dayIndex === 0 ? -6 : 1) - dayIndex;
    startOfWeek.setDate(startOfWeek.getDate() + diff);

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      weekDays.push(d);
    }

    const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
    const today = new Date();

    let html = `
      <div class="grid grid-cols-1 md:grid-cols-7 gap-3">
        ${weekDays.map((wd, idx) => {
          const dateStr = wd.toISOString().split('T')[0];
          const isToday = today.toDateString() === wd.toDateString();
          const events = this.getEventsForDate(dateStr);

          return `
            <div class="bg-slate-50 dark:bg-slate-700/40 rounded-2xl p-3 border border-slate-200 dark:border-slate-600 flex flex-col min-h-[350px]">
              <!-- Header -->
              <div class="text-center pb-2 border-b border-slate-200 dark:border-slate-600 mb-2">
                <div class="text-[11px] font-extrabold text-slate-400 uppercase">${dayNames[idx]}</div>
                <div class="text-base font-black ${isToday ? 'text-white bg-[#005d39] w-7 h-7 rounded-full flex items-center justify-center mx-auto my-1 shadow-sm' : 'text-slate-800 dark:text-white my-1'}">
                  ${wd.getDate()}
                </div>
                <div class="text-[10px] text-slate-400 font-semibold">${events.length} nhiệm vụ</div>
              </div>

              <!-- Events -->
              <div class="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
                ${events.length === 0 ? `
                  <div class="text-center py-8 text-slate-400 text-[11px]">Không có lịch</div>
                ` : events.map(ev => {
                  const isTask = ev._type === 'task';
                  const isDone = ev.status === 'completed';
                  return `
                    <div onclick="Calendar.openEventDetail('${ev._type}', ${ev.id})" class="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-2xs hover:border-emerald-500 transition cursor-pointer">
                      <div class="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                        <span>${isTask ? '📋 VIỆC GIAO' : '📝 TỰ KÊ KHAI'}</span>
                        <span class="${isDone ? 'text-emerald-600' : 'text-amber-500'}">${isDone ? 'Hoàn tất' : 'Đang làm'}</span>
                      </div>
                      <div class="font-bold text-xs text-slate-800 dark:text-white leading-tight">${ev.title || ev.task_name}</div>
                      <div class="text-[10px] text-slate-400 mt-1 truncate">${ev.department_name || ev.full_name || 'Phòng ban'}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.innerHTML = html;
  },

  renderDayView(container) {
    const dateStr = this.currentDate.toISOString().split('T')[0];
    const events = this.getEventsForDate(dateStr);

    let html = `
      <div class="max-w-3xl mx-auto space-y-4">
        <div class="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="p-3 bg-emerald-600 text-white rounded-2xl text-xl">
              <i class="ph-bold ph-calendar-star"></i>
            </span>
            <div>
              <h3 class="font-extrabold text-sm text-emerald-900 dark:text-emerald-200">Lịch trình công việc trong ngày</h3>
              <p class="text-xs text-emerald-700 dark:text-emerald-400">Có tổng cộng ${events.length} đầu việc & bản kê khai được ghi nhận</p>
            </div>
          </div>
          <button onclick="PersonalLogs.openCreateModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition">
            + Kê khai việc ngày này
          </button>
        </div>

        <div class="space-y-3">
          ${events.length === 0 ? `
            <div class="text-center py-16 text-slate-400">
              <i class="ph-bold ph-calendar-blank text-5xl mb-2 text-slate-300"></i>
              <p class="font-bold text-sm">Chưa có công việc nào trong ngày này</p>
            </div>
          ` : events.map(ev => {
            const isTask = ev._type === 'task';
            const isDone = ev.status === 'completed';
            return `
              <div onclick="Calendar.openEventDetail('${ev._type}', ${ev.id})" class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 shadow-2xs transition cursor-pointer flex items-center justify-between gap-4">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-10 h-10 rounded-xl ${isTask ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'} font-bold flex items-center justify-center text-lg shrink-0">
                    ${isTask ? '📋' : '📝'}
                  </div>
                  <div class="min-w-0">
                    <div class="font-bold text-sm text-slate-800 dark:text-white truncate">${ev.title || ev.task_name}</div>
                    <div class="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                      <span>${ev.department_name || ev.full_name || 'Agribank'}</span>
                      ${ev.actual_hours ? `<span>• <b>${ev.actual_hours}h</b> thực hiện</span>` : ''}
                      ${ev.due_date ? `<span>• Hạn chót: <b>${new Date(ev.due_date).toLocaleDateString('vi-VN')}</b></span>` : ''}
                    </div>
                  </div>
                </div>
                <div class="shrink-0 flex items-center gap-2">
                  <span class="px-3 py-1 rounded-full text-xs font-bold ${isDone ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}">
                    ${isDone ? 'Đã hoàn thành' : 'Đang thực hiện'}
                  </span>
                  <i class="ph-bold ph-caret-right text-slate-400"></i>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  getEventsForDate(dateStr) {
    const list = [];

    // Filter Tasks
    if (this.filterType === 'all' || this.filterType === 'tasks') {
      this.tasks.forEach(t => {
        const dueDate = t.due_date ? t.due_date.split('T')[0] : null;
        const createdDate = t.created_at ? t.created_at.split(' ')[0] : null;
        if (dueDate === dateStr || (!dueDate && createdDate === dateStr)) {
          list.push({ ...t, _type: 'task' });
        }
      });
    }

    // Filter Personal Logs
    if (this.filterType === 'all' || this.filterType === 'logs') {
      this.logs.forEach(l => {
        const workDate = l.work_date ? l.work_date.split('T')[0] : (l.created_at ? l.created_at.split(' ')[0] : null);
        if (workDate === dateStr) {
          list.push({ ...l, _type: 'log' });
        }
      });
    }

    return list;
  },

  selectDate(dateStr) {
    this.selectedDate = new Date(dateStr);
    this.currentDate = new Date(dateStr);
    this.setViewMode('day');
  },

  prev() {
    if (this.viewMode === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    } else if (this.viewMode === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() - 7);
    } else if (this.viewMode === 'day') {
      this.currentDate.setDate(this.currentDate.getDate() - 1);
    }
    this.updateStats();
    this.renderCurrentView();
  },

  next() {
    if (this.viewMode === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    } else if (this.viewMode === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() + 7);
    } else if (this.viewMode === 'day') {
      this.currentDate.setDate(this.currentDate.getDate() + 1);
    }
    this.updateStats();
    this.renderCurrentView();
  },

  today() {
    this.currentDate = new Date();
    this.selectedDate = new Date();
    this.updateStats();
    this.renderCurrentView();
  },

  setFilter(type) {
    this.filterType = type;
    this.renderCurrentView();
  },

  setViewMode(mode) {
    this.viewMode = mode;
    this.renderCurrentView();
  },

  getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  },

  openEventDetail(type, id) {
    if (type === 'task') {
      if (window.Tasks) Tasks.openTaskDetailModal(id);
    } else {
      if (window.PersonalLogs) PersonalLogs.openDetailModal(id);
    }
  },

  // ----------------------------------------------------------------
  // MINI CALENDAR WIDGET TRÊN SIDEBAR (DƯỚI CÙNG GÓC TRÁI ỨNG DỤNG)
  // ----------------------------------------------------------------
  renderSidebarMiniCalendar() {
    const container = document.getElementById('sidebar-mini-calendar');
    if (!container) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();

    const monthNames = ['Th.1', 'Th.2', 'Th.3', 'Th.4', 'Th.5', 'Th.6', 'Th.7', 'Th.8', 'Th.9', 'Th.10', 'Th.11', 'Th.12'];
    const firstDayIndex = new Date(year, month, 1).getDay();
    const startDayOffset = (firstDayIndex === 0 ? 6 : firstDayIndex - 1);
    const totalDays = new Date(year, month + 1, 0).getDate();

    const dayCols = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    let cellsHtml = '';
    for (let i = 0; i < startDayOffset; i++) {
      cellsHtml += `<span class="text-[10px] text-slate-300 dark:text-slate-700 py-1 text-center select-none">•</span>`;
    }
    for (let d = 1; d <= totalDays; d++) {
      const isToday = d === today;
      cellsHtml += `
        <button onclick="App.navigateTo('calendar'); setTimeout(() => Calendar.selectDate('${year}-${String(month+1).padStart(2, '0')}-${String(d).padStart(2, '0')}'), 100);" class="text-[10px] py-1 text-center rounded-lg transition font-bold ${isToday ? 'bg-[#005d39] text-white shadow-2xs scale-105' : 'text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-700'}">
          ${d}
        </button>
      `;
    }

    container.innerHTML = `
      <div class="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 shadow-2xs">
        <div class="flex items-center justify-between text-xs font-black text-slate-800 dark:text-white">
          <div class="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <i class="ph-bold ph-calendar-dots text-sm"></i>
            <span>${monthNames[month]} ${year}</span>
          </div>
          <button onclick="App.navigateTo('calendar')" class="text-[10px] text-[#005d39] dark:text-emerald-400 font-bold hover:underline" title="Xem lịch đầy đủ">
            Mở lịch →
          </button>
        </div>

        <div class="grid grid-cols-7 gap-1 text-[9px] font-extrabold text-slate-400 text-center uppercase">
          ${dayCols.map(c => `<div>${c}</div>`).join('')}
        </div>

        <div class="grid grid-cols-7 gap-1">
          ${cellsHtml}
        </div>

        <div class="pt-2 border-t border-slate-200/60 dark:border-slate-700 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between font-semibold">
          <span>Hôm nay: ${now.toLocaleDateString('vi-VN')}</span>
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
      </div>
    `;
  }
};

window.Calendar = Calendar;
