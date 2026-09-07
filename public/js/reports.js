// Work Reports Module (Báo cáo Ngày / Tuần / Tháng) - Trường Đào tạo cán bộ Agribank
const Reports = {
  activeType: 'daily', // 'daily', 'weekly', 'monthly'
  filterDept: '',
  filterStatus: '',
  reportViewTab: 'my_reports', // 'review_pending' (for Manager/Admin) or 'my_reports'

  async render() {
    const isManagerOrAdmin = Auth.isManager() || Auth.isAdmin();

    const container = document.getElementById('main-content');
    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
              <span class="p-2 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <i class="ph-bold ph-newspaper-clipping text-2xl"></i>
              </span>
              ${Auth.isManager() ? 'Duyệt & Quản lý Báo cáo Tiến độ' : Auth.isAdmin() ? 'Quản lý Báo cáo Toàn Trường' : 'Nộp & Theo dõi Báo cáo Tiến độ'}
            </h1>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
              ${Auth.isManager() ? `Phê duyệt báo cáo ngày, tuần của nhân sự Phòng ${Auth.user.department_name} và nộp báo cáo lên Ban Giám hiệu.` : Auth.isAdmin() ? 'Theo dõi báo cáo công việc và chỉ đạo thực hiện trên toàn hệ thống Trường Agribank.' : 'Nộp báo cáo ngày, tuần, tháng cho Trưởng phòng và nhận ý kiến chỉ đạo.'}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button onclick="Reports.openCreateModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition">
              <i class="ph-bold ph-plus text-base"></i> Nộp báo cáo mới
            </button>
          </div>
        </div>

        <!-- Manager / Admin Sub-tabs if applicable -->
        ${isManagerOrAdmin ? `
          <div class="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 pb-2">
            <button onclick="Reports.setReportViewTab('all_dept')" id="tab-sub-all" class="px-4 py-2 text-xs font-bold rounded-xl transition ${this.reportViewTab === 'all_dept' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}">
              <i class="ph-bold ph-list-checks"></i> ${Auth.isAdmin() ? 'Tất cả báo cáo 5 Phòng' : `Báo cáo nhân viên Phòng ${Auth.user.department_code || ''}`}
            </button>
            <button onclick="Reports.setReportViewTab('my_reports')" id="tab-sub-mine" class="px-4 py-2 text-xs font-bold rounded-xl transition ${this.reportViewTab === 'my_reports' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}">
              <i class="ph-bold ph-user"></i> Báo cáo cá nhân tôi đã nộp
            </button>
          </div>
        ` : ''}

        <!-- Filter & Period Tabs -->
        <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <!-- Type Tabs -->
          <div class="flex items-center bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
            <button onclick="Reports.setType('daily')" id="tab-daily" class="px-4 py-1.5 rounded-lg text-xs font-bold transition bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm">
              <i class="ph-bold ph-sun"></i> Báo cáo Ngày
            </button>
            <button onclick="Reports.setType('weekly')" id="tab-weekly" class="px-4 py-1.5 rounded-lg text-xs font-bold transition text-slate-600 dark:text-slate-300">
              <i class="ph-bold ph-calendar-blank"></i> Báo cáo Tuần
            </button>
            <button onclick="Reports.setType('monthly')" id="tab-monthly" class="px-4 py-1.5 rounded-lg text-xs font-bold transition text-slate-600 dark:text-slate-300">
              <i class="ph-bold ph-calendar-check"></i> Báo cáo Tháng
            </button>
          </div>

          <!-- Status Filter -->
          <div class="flex items-center gap-3">
            <select id="report-filter-status" onchange="Reports.handleStatusFilter(this.value)" class="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs text-slate-700 dark:text-slate-200">
              <option value="">-- Tất cả trạng thái --</option>
              <option value="submitted">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="revision_requested">Yêu cầu sửa</option>
              <option value="rejected">Từ chối</option>
            </select>
          </div>
        </div>

        <!-- Reports List -->
        <div id="reports-list-container">
          <div class="flex items-center justify-center py-12 text-slate-400">
            <i class="ph ph-spinner animate-spin text-3xl mr-2"></i> Đang tải danh sách báo cáo...
          </div>
        </div>
      </div>
    `;

    await this.loadReports();
  },

  setReportViewTab(tab) {
    this.reportViewTab = tab;
    const btnAll = document.getElementById('tab-sub-all');
    const btnMine = document.getElementById('tab-sub-mine');
    if (btnAll && btnMine) {
      if (tab === 'all_dept') {
        btnAll.className = 'px-4 py-2 text-xs font-bold rounded-xl transition bg-emerald-600 text-white shadow-sm';
        btnMine.className = 'px-4 py-2 text-xs font-bold rounded-xl transition text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';
      } else {
        btnMine.className = 'px-4 py-2 text-xs font-bold rounded-xl transition bg-emerald-600 text-white shadow-sm';
        btnAll.className = 'px-4 py-2 text-xs font-bold rounded-xl transition text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';
      }
    }
    this.loadReports();
  },

  setType(type) {
    this.activeType = type;
    ['daily', 'weekly', 'monthly'].forEach(t => {
      const el = document.getElementById(`tab-${t}`);
      if (el) {
        if (t === type) {
          el.className = 'px-4 py-1.5 rounded-lg text-xs font-bold transition bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm';
        } else {
          el.className = 'px-4 py-1.5 rounded-lg text-xs font-bold transition text-slate-600 dark:text-slate-300';
        }
      }
    });
    this.loadReports();
  },

  handleStatusFilter(val) {
    this.filterStatus = val;
    this.loadReports();
  },

  async loadReports() {
    try {
      let query = `?type=${this.activeType}`;
      if (this.filterStatus) query += `&status=${this.filterStatus}`;

      if (Auth.isAdmin() && this.reportViewTab !== 'my_reports') {
        query += `&all_dept=1`;
      } else if (Auth.isManager() && this.reportViewTab === 'all_dept') {
        query += `&department_id=${Auth.user.department_id}`;
      } else if (this.reportViewTab === 'my_reports' || Auth.isStaff()) {
        query += `&user_id=${Auth.user.id}`;
      }

      const reports = await apiFetch(`/api/reports${query}`);
      const container = document.getElementById('reports-list-container');
      if (!container) return;

      if (reports.length === 0) {
        container.innerHTML = `
          <div class="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center text-slate-400 border border-slate-200 dark:border-slate-700">
            <i class="ph ph-notepad text-5xl mb-2 text-slate-300"></i>
            <p>Chưa có báo cáo nào trong mục này</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${reports.map(r => this.renderReportCard(r)).join('')}
        </div>
      `;
    } catch (err) {
      console.error('Error loading reports:', err);
    }
  },

  renderReportCard(r) {
    const statusMap = {
      submitted: { label: 'Chờ duyệt', class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
      approved: { label: 'Đã phê duyệt', class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
      revision_requested: { label: 'Yêu cầu sửa', class: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
      rejected: { label: 'Từ chối', class: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' }
    };
    const s = statusMap[r.status] || statusMap.submitted;

    // Check if current user can review this report (Admin can review any; Manager can review reports in their dept from others)
    const canReview = Auth.isAdmin() || (Auth.isManager() && r.department_id === Auth.user.department_id && r.user_id !== Auth.user.id);

    return `
      <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-4">
        <div>
          <!-- Header -->
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                ${r.department_name}
              </span>
              <span class="text-xs text-slate-400">
                <i class="ph ph-calendar"></i> ${r.report_date}
              </span>
            </div>
            <span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${s.class}">
              ${s.label}
            </span>
          </div>

          <h3 class="text-base font-bold text-slate-800 dark:text-white">
            ${r.title}
          </h3>

          <div class="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <span>Người nộp: <b class="text-slate-700 dark:text-slate-200">${r.author_name}</b> (${r.author_position || 'Cán bộ'})</span>
          </div>

          <!-- Content Snippets -->
          <div class="mt-4 space-y-2 text-xs">
            <div class="p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-100 dark:border-slate-700">
              <div class="font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1">
                <i class="ph-bold ph-check text-emerald-600"></i> Công việc đã thực hiện:
              </div>
              <p class="text-slate-600 dark:text-slate-300 whitespace-pre-line">${r.content_done}</p>
            </div>

            ${r.content_inprogress ? `
              <div class="p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-100 dark:border-slate-700">
                <div class="font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1">
                  <i class="ph-bold ph-arrow-circle-right text-blue-600"></i> Kế hoạch tiếp theo:
                </div>
                <p class="text-slate-600 dark:text-slate-300 whitespace-pre-line">${r.content_inprogress}</p>
              </div>
            ` : ''}

            ${r.content_issues ? `
              <div class="p-3 bg-rose-50/50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-900/30">
                <div class="font-bold text-rose-700 dark:text-rose-400 mb-1 flex items-center gap-1">
                  <i class="ph-bold ph-warning text-rose-600"></i> Khó khăn / Kiến nghị:
                </div>
                <p class="text-rose-600 dark:text-rose-300 whitespace-pre-line">${r.content_issues}</p>
              </div>
            ` : ''}

            ${r.review_comment ? `
              <div class="p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <div class="font-bold text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1">
                  <i class="ph-bold ph-chat-circle-dots text-blue-600"></i> Ý kiến Trưởng phòng (${r.reviewer_name || 'Lãnh đạo'}):
                </div>
                <p class="text-blue-600 dark:text-blue-300">${r.review_comment}</p>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Actions -->
        <div class="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <span class="text-[11px] text-slate-400">Nộp lúc: ${new Date(r.created_at).toLocaleTimeString('vi-VN')}</span>
          <div>
            ${canReview ? `
              <button onclick="Reports.openReviewModal(${r.id}, '${r.status}', \`${encodeURIComponent(r.title)}\`)" class="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-bold rounded-lg transition flex items-center gap-1">
                <i class="ph-bold ph-seal-check"></i> Duyệt / Nhận xét
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  // Open Create Report Modal
  openCreateModal() {
    const modalContainer = document.getElementById('modal-container');
    const today = new Date().toISOString().split('T')[0];

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-700">
          <div class="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10">
            <h3 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <i class="ph-bold ph-file-plus text-emerald-600"></i> Nộp báo cáo công việc
            </h3>
            <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700">
              <i class="ph-bold ph-x text-lg"></i>
            </button>
          </div>

          <form onsubmit="Reports.submitReport(event)" class="p-6 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Loại báo cáo <span class="text-red-500">*</span></label>
                <select id="report-type" onchange="Reports.onReportTypeChange(this.value)" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white font-semibold">
                  <option value="daily">Báo cáo ngày</option>
                  <option value="weekly">Báo cáo tuần</option>
                  <option value="monthly">Báo cáo tháng</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Ngày lập báo cáo <span class="text-red-500">*</span></label>
                <input type="date" id="report-date" value="${today}" required class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white">
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Tiêu đề báo cáo <span class="text-red-500">*</span></label>
              <input type="text" id="report-title" required value="Báo cáo ngày ${today} - ${Auth.user.full_name}" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white">
            </div>

            <!-- Auto Aggregate Button for Weekly / Monthly -->
            <div class="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-4">
              <div>
                <div class="font-bold text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <i class="ph-bold ph-lightning"></i> Tự động tổng hợp số liệu
                </div>
                <div class="text-[11px] text-emerald-600 dark:text-emerald-400">
                  Tự động trích xuất các nhật ký công việc và đầu việc đã hoàn thành trong kỳ.
                </div>
              </div>
              <button type="button" onclick="Reports.autoAggregate()" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm whitespace-nowrap transition">
                ⚡ Tổng hợp ngay
              </button>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-1">1. Công việc đã thực hiện <span class="text-red-500">*</span></label>
              <textarea id="report-done" rows="4" required placeholder="- Đầu việc 1: tiến độ, kết quả..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white"></textarea>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-1">2. Kế hoạch tiếp theo / Đang thực hiện</label>
              <textarea id="report-inprogress" rows="3" placeholder="- Dự kiến ngày mai / tuần tới sẽ làm..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white"></textarea>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-1">3. Khó khăn, vướng mắc & Kiến nghị</label>
              <textarea id="report-issues" rows="2" placeholder="Ghi rõ đề xuất hỗ trợ từ Trưởng phòng hoặc Ban Giám hiệu..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white"></textarea>
            </div>

            <div class="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button type="button" onclick="App.closeModal()" class="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-sm">
                Hủy
              </button>
              <button type="submit" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm shadow-sm transition">
                Gửi báo cáo
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  onReportTypeChange(type) {
    const titleInput = document.getElementById('report-title');
    const today = document.getElementById('report-date').value;
    if (type === 'daily') {
      titleInput.value = `Báo cáo ngày ${today} - ${Auth.user.full_name}`;
    } else if (type === 'weekly') {
      titleInput.value = `Báo cáo tuần (${today}) - ${Auth.user.full_name}`;
    } else {
      titleInput.value = `Báo cáo tháng (${today.slice(0, 7)}) - ${Auth.user.full_name}`;
    }
  },

  async autoAggregate() {
    try {
      const type = document.getElementById('report-type').value;
      const today = new Date();
      let fromDate = today.toISOString().split('T')[0];

      if (type === 'weekly') {
        const pastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        fromDate = pastWeek.toISOString().split('T')[0];
      } else if (type === 'monthly') {
        const pastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        fromDate = pastMonth.toISOString().split('T')[0];
      }

      const toDate = today.toISOString().split('T')[0];
      const data = await apiFetch(`/api/reports/aggregate-data?from_date=${fromDate}&to_date=${toDate}&type=${type}`);

      document.getElementById('report-done').value = data.content_done;
      document.getElementById('report-inprogress').value = data.content_inprogress;

      App.showToast('Đã tự động tổng hợp số liệu thành công!', 'success');
    } catch (err) {
      alert(err.message);
    }
  },

  async submitReport(e) {
    e.preventDefault();
    try {
      const type = document.getElementById('report-type').value;
      const report_date = document.getElementById('report-date').value;
      const title = document.getElementById('report-title').value;
      const content_done = document.getElementById('report-done').value;
      const content_inprogress = document.getElementById('report-inprogress').value;
      const content_issues = document.getElementById('report-issues').value;

      await apiFetch('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          type,
          report_date,
          title,
          content_done,
          content_inprogress,
          content_issues
        })
      });

      App.showToast('Nộp báo cáo thành công!', 'success');
      App.closeModal();
      this.loadReports();
    } catch (err) {
      alert(err.message);
    }
  },

  // Open Review / Comment Modal (Manager / Admin)
  openReviewModal(reportId, currentStatus, titleEncoded) {
    const title = decodeURIComponent(titleEncoded);
    const modalContainer = document.getElementById('modal-container');

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700">
          <div class="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <i class="ph-bold ph-seal-check text-indigo-600"></i> Phê duyệt & Nhận xét Báo cáo
            </h3>
            <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700">
              <i class="ph-bold ph-x text-lg"></i>
            </button>
          </div>

          <form onsubmit="Reports.submitReview(event, ${reportId})" class="p-6 space-y-4">
            <div class="text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">
              ${title}
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-2">Quyết định phê duyệt</label>
              <div class="grid grid-cols-3 gap-2">
                <label class="p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl flex flex-col items-center gap-2 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                  <input type="radio" name="review_status" value="approved" checked class="text-emerald-600 focus:ring-emerald-500">
                  <span class="text-xs font-bold text-emerald-600">Duyệt đạt</span>
                </label>
                <label class="p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl flex flex-col items-center gap-2 cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/30">
                  <input type="radio" name="review_status" value="revision_requested" class="text-orange-600 focus:ring-orange-500">
                  <span class="text-xs font-bold text-orange-600">Yêu cầu sửa</span>
                </label>
                <label class="p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl flex flex-col items-center gap-2 cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/30">
                  <input type="radio" name="review_status" value="rejected" class="text-rose-600 focus:ring-rose-500">
                  <span class="text-xs font-bold text-rose-600">Từ chối</span>
                </label>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Ý kiến chỉ đạo / Nhận xét của Lãnh đạo</label>
              <textarea id="review-comment" rows="3" placeholder="Nhập ý kiến đánh giá hoặc nội dung cần điều chỉnh..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white"></textarea>
            </div>

            <div class="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button type="button" onclick="App.closeModal()" class="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-sm">
                Đóng
              </button>
              <button type="submit" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow-sm transition">
                Xác nhận
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitReview(e, reportId) {
    e.preventDefault();
    try {
      const status = document.querySelector('input[name="review_status"]:checked').value;
      const review_comment = document.getElementById('review-comment').value;

      await apiFetch(`/api/reports/${reportId}/review`, {
        method: 'PUT',
        body: JSON.stringify({ status, review_comment })
      });

      App.showToast('Đã cập nhật trạng thái phê duyệt báo cáo!', 'success');
      App.closeModal();
      this.loadReports();
    } catch (err) {
      alert(err.message);
    }
  }
};
