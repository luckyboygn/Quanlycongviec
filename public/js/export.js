// Excel Export Module (Sử dụng SheetJS / XLSX)
const Export = {
  // 1. Xuất Bản Kê Khai Nhật Ký (Tự động áp dụng RBAC phân quyền)
  async exportPersonalLogsToExcel() {
    try {
      App.showToast('Đang tạo bản kê khai Excel...', 'info');

      const isStaff = Auth.isStaff();
      const isManager = Auth.isManager();
      const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();

      let query = '';
      let scopeTitle = '';

      if (isStaff) {
        query = `?user_id=${Auth.user.id}`;
        scopeTitle = `Nhan_vien_${Auth.user.full_name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      } else if (isManager) {
        query = `?department_id=${Auth.user.department_id}`;
        const rawDeptName = Auth.user.department_name || 'Phong_ban';
        const cleanDeptName = rawDeptName.startsWith('Phòng') ? rawDeptName : ('Phòng ' + rawDeptName);
        scopeTitle = cleanDeptName.replace(/[^a-zA-Z0-9]/g, '_');
      } else {
        query = `?all_dept=1`;
        scopeTitle = `Toan_Truong_5_Phong_Ban`;
      }

      const logs = await apiFetch(`/api/personal-logs${query}`);

      if (!logs || logs.length === 0) {
        alert('Không có dữ liệu bản kê khai để xuất!');
        return;
      }

      const excelData = logs.map((l, index) => {
        const timeRange = (l.start_time && l.end_time) ? `${l.start_time} - ${l.end_time}` : 'Cả ngày';
        return {
          'STT': index + 1,
          'Họ và tên cán bộ': l.user_name,
          'Chức vụ': l.user_position || l.user_role,
          'Phòng ban': l.department_name,
          'Từ ngày': l.start_date,
          'Đến ngày': l.end_date,
          'Khung giờ': timeRange,
          'Số giờ (h)': l.hours_spent,
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
        { wch: 14 }, // Từ ngày
        { wch: 14 }, // Đến ngày
        { wch: 16 }, // Khung giờ
        { wch: 12 }, // Số giờ
        { wch: 22 }, // Phân loại
        { wch: 35 }, // Tên việc
        { wch: 45 }, // Chi tiết
        { wch: 25 }, // Địa điểm
        { wch: 30 }  // Nhiệm vụ
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Bản kê khai nhật ký');

      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Ban_ke_khai_nhat_ky_${scopeTitle}_${today}.xlsx`);

      App.showToast('Xuất bản kê khai Excel thành công!', 'success');
    } catch (err) {
      console.error('Export personal logs error:', err);
      alert('Lỗi xuất Excel: ' + err.message);
    }
  },

  // 2. Xuất Danh Sách Công Việc (Tự động áp dụng RBAC phân quyền)
  async exportTasksToExcel() {
    try {
      App.showToast('Đang tạo file Excel...', 'info');

      const isDirectorOrAdmin = Auth.isDirector() || Auth.isAdmin();
      const taskQuery = isDirectorOrAdmin ? '?all_dept=1' : '';
      const tasks = await apiFetch(`/api/tasks${taskQuery}`);

      if (!tasks || tasks.length === 0) {
        alert('Không có dữ liệu công việc để xuất!');
        return;
      }

      const priorityMap = {
        urgent: 'Khẩn cấp',
        high: 'Cao',
        medium: 'Trung bình',
        low: 'Thấp'
      };

      const statusMap = {
        pending: 'Chưa bắt đầu',
        in_progress: 'Đang thực hiện',
        reviewing: 'Chờ duyệt',
        completed: 'Hoàn thành',
        overdue: 'Trễ hạn'
      };

      // Prepare Excel rows
      const excelData = tasks.map((t, index) => {
        const leader = t.assignees?.find(a => a.is_leader) || t.assignees?.[0];
        const coordinators = t.assignees?.filter(a => !a.is_leader).map(a => a.full_name).join(', ');
        const links = (t.attachment_links || []).map(l => l.name ? `${l.name} (${l.url})` : l.url).join('; ');

        return {
          'STT': index + 1,
          'Tên công việc': t.title,
          'Phòng ban': t.department_name,
          'Người phụ trách chính': leader ? leader.full_name : 'Chưa gán',
          'Người phối hợp': coordinators || 'Không có',
          'Mức độ ưu tiên': priorityMap[t.priority] || t.priority,
          'Trạng thái': statusMap[t.status] || t.status,
          'Tiến độ (%)': `${t.progress}%`,
          'Ngày bắt đầu': t.start_date,
          'Hạn chót (Deadline)': t.due_date,
          'Ngày hoàn thành': t.completed_at ? t.completed_at.slice(0, 10) : '—',
          'Mô tả chi tiết': t.description || '',
          'Tài liệu / Link đính kèm': links
        };
      });

      // Create Worksheet and Workbook
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Auto width columns
      const colWidths = [
        { wch: 6 },  // STT
        { wch: 40 }, // Tên việc
        { wch: 25 }, // Phòng ban
        { wch: 22 }, // Người phụ trách
        { wch: 25 }, // Người phối hợp
        { wch: 14 }, // Ưu tiên
        { wch: 16 }, // Trạng thái
        { wch: 12 }, // Tiến độ
        { wch: 14 }, // Bắt đầu
        { wch: 16 }, // Hạn chót
        { wch: 16 }, // Hoàn thành
        { wch: 35 }, // Mô tả
        { wch: 30 }  // Link
      ];
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Danh sách công việc');

      const today = new Date().toISOString().split('T')[0];
      const scopeName = isDirectorOrAdmin ? 'Toan_truong' : (Auth.user?.department_name || 'Phong_ban').replace(/[^a-zA-Z0-9]/g, '_');
      XLSX.writeFile(wb, `Danh_sach_cong_viec_${scopeName}_${today}.xlsx`);

      App.showToast('Xuất file Excel thành công!', 'success');
    } catch (err) {
      console.error('Export error:', err);
      alert('Lỗi xuất Excel: ' + err.message);
    }
  },

  async exportMonthlySummary() {
    try {
      App.showToast('Đang tổng hợp báo cáo giao ban...', 'info');

      const [stats, deptData, tasks, reports] = await Promise.all([
        apiFetch('/api/dashboard/stats'),
        apiFetch('/api/dashboard/departments-comparison'),
        apiFetch('/api/tasks?all_dept=1'),
        apiFetch('/api/reports?all_dept=1')
      ]);

      const wb = XLSX.utils.book_new();

      // Sheet 1: Bảng tổng hợp 5 Phòng Ban
      const deptSummaryRows = deptData.map((d, index) => ({
        'STT': index + 1,
        'Phòng ban': d.name,
        'Mã viết tắt': d.code,
        'Tổng số công việc': d.total_tasks,
        'Đã hoàn thành': d.completed_tasks,
        'Đang thực hiện': d.in_progress_tasks,
        'Trễ hạn': d.overdue_tasks,
        'Tiến độ trung bình (%)': `${Math.round(d.avg_progress)}%`,
        'Tỷ lệ hoàn thành (%)': `${d.completion_rate}%`
      }));

      const wsDept = XLSX.utils.json_to_sheet(deptSummaryRows);
      wsDept['!cols'] = [
        { wch: 6 },
        { wch: 32 },
        { wch: 12 },
        { wch: 18 },
        { wch: 15 },
        { wch: 16 },
        { wch: 12 },
        { wch: 22 },
        { wch: 20 }
      ];
      XLSX.utils.book_append_sheet(wb, wsDept, 'Tổng hợp 5 Phòng ban');

      // Sheet 2: Báo cáo công việc gần nhất
      const reportRows = reports.slice(0, 50).map((r, index) => ({
        'STT': index + 1,
        'Ngày báo cáo': r.report_date,
        'Loại báo cáo': r.type === 'daily' ? 'Ngày' : r.type === 'weekly' ? 'Tuần' : 'Tháng',
        'Người báo cáo': r.author_name,
        'Phòng ban': r.department_name,
        'Tiêu đề': r.title,
        'Việc đã làm': r.content_done,
        'Việc tiếp theo': r.content_inprogress || '—',
        'Vướng mắc / Kiến nghị': r.content_issues || '—',
        'Trạng thái duyệt': r.status === 'approved' ? 'Đã duyệt' : r.status === 'revision_requested' ? 'Yêu cầu sửa' : 'Chờ duyệt',
        'Nhận xét của Trưởng phòng': r.review_comment || '—'
      }));

      const wsReports = XLSX.utils.json_to_sheet(reportRows);
      wsReports['!cols'] = [
        { wch: 6 },
        { wch: 14 },
        { wch: 12 },
        { wch: 22 },
        { wch: 25 },
        { wch: 35 },
        { wch: 40 },
        { wch: 30 },
        { wch: 30 },
        { wch: 16 },
        { wch: 30 }
      ];
      XLSX.utils.book_append_sheet(wb, wsReports, 'Báo cáo công việc');

      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Bao_cao_giao_ban_tong_hop_${today}.xlsx`);

      App.showToast('Xuất báo cáo giao ban thành công!', 'success');
    } catch (err) {
      console.error('Monthly export error:', err);
      alert('Lỗi xuất báo cáo giao ban: ' + err.message);
    }
  }
};

window.ExportModule = Export;

