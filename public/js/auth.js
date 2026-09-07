// Authentication and Role Management Module - Trường Đào tạo cán bộ Agribank
const Auth = {
  token: localStorage.getItem('wt_token') || null,
  user: JSON.parse(localStorage.getItem('wt_user') || 'null'),

  init() {
    const urlParams = new URLSearchParams(window.location.search);
    const autoUser = urlParams.get('auto_user');

    if (urlParams.get('show_login') === '1') {
      localStorage.removeItem('wt_token');
      localStorage.removeItem('wt_user');
      this.token = null;
      this.user = null;
      this.renderLoginPage();
      return false;
    }

    if (autoUser && (!this.token || !this.user)) {
      const uMap = {
        director: 'hanguyenthithu',
        admin: 'admin',
        manager: 'truongphong_dt',
        staff: 'nhanvien_dt'
      };
      const uname = uMap[autoUser] || autoUser;
      this.quickLogin(uname, '123456', false);
      return true;
    }

    if (!this.token || !this.user) {
      this.renderLoginPage();
      return false;
    }
    this.startInactivityTimer();
    this.startSessionHeartbeat();
    return true;
  },

  isAdmin() {
    return (this.user && (this.user.role === 'admin' || this.user.username === 'admin')) || 
           sessionStorage.getItem('wt_is_admin_session') === 'true' ||
           localStorage.getItem('wt_is_admin_session') === 'true';
  },

  isDirector() {
    return this.user && this.user.role === 'director';
  },

  isManager() {
    return this.user && this.user.role === 'manager';
  },

  isStaff() {
    return this.user && this.user.role === 'staff';
  },

  async login(username, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại');

      if (data.user && (data.user.role === 'admin' || data.user.username === 'admin')) {
        sessionStorage.setItem('wt_is_admin_session', 'true');
        localStorage.setItem('wt_is_admin_session', 'true');
        sessionStorage.setItem('wt_admin_user_id', data.user.id);
      } else {
        sessionStorage.removeItem('wt_is_admin_session');
        localStorage.removeItem('wt_is_admin_session');
        sessionStorage.removeItem('wt_admin_user_id');
      }

      this.setSession(data.token, data.user);
      return data;
    } catch (err) {
      throw err;
    }
  },

  async quickLogin(username, password = '123456', shouldReload = true) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại');

      if (data.user && (data.user.role === 'admin' || data.user.username === 'admin')) {
        sessionStorage.setItem('wt_is_admin_session', 'true');
        localStorage.setItem('wt_is_admin_session', 'true');
        sessionStorage.setItem('wt_admin_user_id', data.user.id);
      }

      this.setSession(data.token, data.user);
      if (shouldReload) {
        window.location.reload();
      }
      return data;
    } catch (e) {
      console.error('Đăng nhập thất bại: ' + e.message);
    }
  },

  async quickSwitch(username) {
    await this.quickLogin(username, '123456');
  },

  async switchUser(userId) {
    try {
      if (this.isAdmin()) {
        sessionStorage.setItem('wt_is_admin_session', 'true');
        localStorage.setItem('wt_is_admin_session', 'true');
      }
      const res = await fetch('/api/auth/quick-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi chuyển tài khoản');

      this.setSession(data.token, data.user);
      sessionStorage.setItem('wt_is_admin_session', 'true');
      localStorage.setItem('wt_is_admin_session', 'true');
      window.location.reload();
    } catch (err) {
      alert('Không thể chuyển tài khoản: ' + err.message);
    }
  },

  async switchToAdmin() {
    try {
      sessionStorage.setItem('wt_is_admin_session', 'true');
      localStorage.setItem('wt_is_admin_session', 'true');
      const res = await fetch('/api/auth/quick-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin', username: 'admin' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi quay lại Admin');

      this.setSession(data.token, data.user);
      sessionStorage.setItem('wt_is_admin_session', 'true');
      localStorage.setItem('wt_is_admin_session', 'true');
      window.location.reload();
    } catch (err) {
      alert('Không thể quay lại Admin: ' + err.message);
    }
  },

  async switchMyRole(newRole) {
    try {
      if (this.isAdmin()) {
        sessionStorage.setItem('wt_is_admin_session', 'true');
        localStorage.setItem('wt_is_admin_session', 'true');
      }

      let headers = { 'Content-Type': 'application/json' };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      let res = await fetch('/api/auth/switch-my-role', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          role: newRole,
          userId: this.user?.id,
          username: this.user?.username
        })
      });

      let data = await res.json();
      if (!res.ok || !data.token) {
        // Fallback to quick-switch
        const resFallback = await fetch('/api/auth/quick-switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole, userId: this.user?.id, username: this.user?.username })
        });
        data = await resFallback.json();
      }

      if (data && data.token) {
        this.setSession(data.token, data.user);
        sessionStorage.setItem('wt_is_admin_session', 'true');
        localStorage.setItem('wt_is_admin_session', 'true');
        App.showToast(`Đã chuyển vai trò sang: ${newRole.toUpperCase()}!`, 'success');
        setTimeout(() => {
          window.location.reload();
        }, 300);
      } else {
        App.showToast('Không thể chuyển vai trò. Vui lòng thử lại.', 'error');
      }
    } catch (err) {
      console.error('switchMyRole error:', err);
      App.showToast('Lỗi khi chuyển đổi quyền hạn: ' + err.message, 'error');
    }
  },

  inactivityTimer: null,
  INACTIVITY_LIMIT: 15 * 60 * 1000, // 15 phút (900.000 ms) không tương tác

  startInactivityTimer() {
    this.stopInactivityTimer();
    if (!this.token || !this.user) return;

    const resetHandler = () => {
      this.resetInactivityTimer();
    };

    window._authResetInactivity = resetHandler;
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(evt => {
      window.addEventListener(evt, resetHandler, { passive: true });
    });

    this.resetInactivityTimer();
  },

  resetInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    if (!this.token || !this.user) return;

    this.inactivityTimer = setTimeout(() => {
      console.warn('⏰ Inactivity timeout reached (15 minutes). Auto logging out.');
      this.logout('inactivity');
    }, this.INACTIVITY_LIMIT);
  },

  stopInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    if (window._authResetInactivity) {
      events.forEach(evt => {
        window.removeEventListener(evt, window._authResetInactivity);
      });
      window._authResetInactivity = null;
    }
  },

  sessionHeartbeatTimer: null,

  startSessionHeartbeat() {
    this.stopSessionHeartbeat();
    if (!this.token || !this.user) return;

    // Check session validity every 3 seconds to instantly kick out old session if logged in on another device
    this.sessionHeartbeatTimer = setInterval(async () => {
      if (!this.token || !this.user) {
        this.stopSessionHeartbeat();
        return;
      }
      try {
        await apiFetch('/api/auth/me');
      } catch (err) {
        // apiFetch automatically triggers Auth.logout('session_terminated') on SESSION_TAKEN_OVER
      }
    }, 3000);
  },

  stopSessionHeartbeat() {
    if (this.sessionHeartbeatTimer) {
      clearInterval(this.sessionHeartbeatTimer);
      this.sessionHeartbeatTimer = null;
    }
  },

  setSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('wt_token', token);
    localStorage.setItem('wt_user', JSON.stringify(user));
    if (user && (user.role === 'admin' || user.username === 'admin')) {
      sessionStorage.setItem('wt_is_admin_session', 'true');
      localStorage.setItem('wt_is_admin_session', 'true');
      sessionStorage.setItem('wt_admin_user_id', user.id);
    }
    this.startInactivityTimer();
    this.startSessionHeartbeat();
  },

  logout(reason = null) {
    this.stopInactivityTimer();
    this.stopSessionHeartbeat();
    localStorage.removeItem('wt_token');
    localStorage.removeItem('wt_user');
    sessionStorage.removeItem('wt_is_admin_session');
    localStorage.removeItem('wt_is_admin_session');
    sessionStorage.removeItem('wt_admin_user_id');
    if (reason) {
      sessionStorage.setItem('wt_logout_reason', reason);
    }
    this.token = null;
    this.user = null;
    window.location.href = '/?show_login=1';
  },

  getRoleBadgeHTML(role) {
    if (role === 'director') {
      return `<span class="px-2.5 py-1 text-xs font-extrabold bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300 rounded-lg flex items-center gap-1"><i class="ph-bold ph-shield-star"></i> Ban Giám đốc</span>`;
    } else if (role === 'admin') {
      return `<span class="px-2.5 py-1 text-xs font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 rounded-lg flex items-center gap-1"><i class="ph-bold ph-crown"></i> Admin</span>`;
    } else if (role === 'manager') {
      return `<span class="px-2.5 py-1 text-xs font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded-lg flex items-center gap-1"><i class="ph-bold ph-star"></i> Trưởng phòng</span>`;
    } else {
      return `<span class="px-2.5 py-1 text-xs font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-lg flex items-center gap-1"><i class="ph-bold ph-user"></i> Nhân viên</span>`;
    }
  },

  // Render Full Login Screen
  renderLoginPage() {
    const header = document.getElementById('app-header');
    const sidebar = document.getElementById('app-sidebar-container');

    if (header) header.innerHTML = '';
    if (sidebar) sidebar.classList.add('hidden');

    const logoutReason = sessionStorage.getItem('wt_logout_reason');
    sessionStorage.removeItem('wt_logout_reason');

    const savedUsername = localStorage.getItem('agy_saved_username') || '';
    const savedPassword = localStorage.getItem('agy_saved_password') || '';
    const isRemembered = localStorage.getItem('agy_remember_me') === 'true';

    let alertBanner = '';
    if (logoutReason === 'inactivity') {
      alertBanner = `
        <div class="p-4 rounded-2xl bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-semibold flex items-center gap-3 mb-4 animate-bounce">
          <i class="ph-bold ph-clock-countdown text-2xl text-amber-400 shrink-0"></i>
          <div>
            <div class="font-bold text-sm text-white">TỰ ĐỘNG ĐĂNG XUẤT DO HẾT THỜI GIAN</div>
            <div>Bạn đã không tương tác trong vòng <b>15 phút</b>. Hệ thống tự động đăng xuất để bảo đảm an toàn dữ liệu nội bộ.</div>
          </div>
        </div>
      `;
    } else if (logoutReason === 'session_terminated') {
      alertBanner = `
        <div class="p-4 rounded-2xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-semibold flex items-center gap-3 mb-4">
          <i class="ph-bold ph-shield-warning text-2xl text-rose-400 shrink-0"></i>
          <div>
            <div class="font-bold text-sm text-white">CẢNH BÁO BẢO MẬT: ĐĂNG NHẬP THIẾT BỊ KHÁC</div>
            <div>Tài khoản của bạn vừa được đăng nhập trên một thiết bị hoặc trình duyệt khác. Phiên làm việc này đã được kết thúc!</div>
          </div>
        </div>
      `;
    } else if (logoutReason === 'locked') {
      alertBanner = `
        <div class="p-4 rounded-2xl bg-red-600/20 border border-red-500/50 text-red-300 text-xs font-semibold flex items-center gap-3 mb-4">
          <i class="ph-bold ph-lock-key text-2xl text-red-400 shrink-0"></i>
          <div>
            <div class="font-bold text-sm text-white">TÀI KHOẢN ĐÃ BỊ KHÓA</div>
            <div>Tài khoản cán bộ này đã bị khóa bởi Quản trị viên. Vui lòng liên hệ để được hỗ trợ mở khóa.</div>
          </div>
        </div>
      `;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const bgImage = urlParams.get('preview_bg') || localStorage.getItem('agy_login_bg') || '/images/login-bg.jpg';

    const bgLayerHTML = `
      <!-- Agribank Golden Wheat & Emerald Silk Background -->
      <div class="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-700" style="background-image: url('${bgImage}');"></div>
      <!-- Subtle Dark Vignette & Frosted Overlay for high readability -->
      <div class="absolute inset-0 z-0 bg-slate-950/60 backdrop-blur-[2px]"></div>
      <div class="absolute inset-0 z-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-950/80"></div>
    `;

    document.body.innerHTML = `
      <div class="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
        ${bgLayerHTML}

        <!-- Contact Support Floating Popover in Top Right Corner -->
        <div class="absolute top-4 right-4 sm:top-6 sm:right-6 z-30 flex flex-col items-end">
          <!-- Contact Button -->
          <button id="btn-contact-toggle" type="button" onclick="Auth.toggleContactPopup(event)" class="px-4 py-2 rounded-xl bg-emerald-950/85 hover:bg-emerald-900/90 border border-emerald-500/40 hover:border-emerald-400 backdrop-blur-md shadow-xl shadow-emerald-950/50 flex items-center gap-2 group transition-all duration-200 cursor-pointer">
            <i class="ph-bold ph-phone-call text-emerald-400 text-sm group-hover:scale-110 transition-transform"></i>
            <span class="text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-300 via-emerald-300 to-teal-300 bg-clip-text text-transparent tracking-wide">
              Hỗ trợ kỹ thuật và Liên hệ
            </span>
          </button>

          <!-- Smooth Floating Popover Card (Spawns Right Next to / Below Button) -->
          <div id="contact-popover" class="invisible opacity-0 scale-95 translate-y-2 pointer-events-none origin-top-right transition-all duration-300 ease-out mt-2 w-84 sm:w-92 max-w-[calc(100vw-24px)] bg-slate-900/95 border border-emerald-500/50 rounded-2xl p-5 shadow-2xl shadow-emerald-950/80 backdrop-blur-xl space-y-3.5 z-40 text-center">
            
            <!-- Top Row with Title & Close button -->
            <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div class="flex items-center gap-2 text-left">
                <div class="w-8 h-8 rounded-lg bg-emerald-900/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <i class="ph-bold ph-headset text-base"></i>
                </div>
                <div>
                  <h4 class="text-xs font-black text-white uppercase tracking-tight">Hỗ trợ kỹ thuật</h4>
                  <span class="text-[10px] text-emerald-400 font-medium">Trường Đào tạo cán bộ Agribank</span>
                </div>
              </div>
              <button type="button" onclick="Auth.closeContactPopup(event)" class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition">
                <i class="ph-bold ph-x text-sm"></i>
              </button>
            </div>

            <!-- Contact Box -->
            <div class="bg-slate-800/90 border border-emerald-500/30 rounded-xl p-3.5 text-left space-y-2.5">
              <!-- Name / Liên hệ -->
              <div class="flex items-center gap-2.5">
                <div class="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <i class="ph-bold ph-user text-sm"></i>
                </div>
                <div>
                  <div class="text-[10px] uppercase font-bold text-slate-400">Liên hệ</div>
                  <div class="text-xs sm:text-sm font-extrabold text-white">Nguyễn Giang Ngọc</div>
                </div>
              </div>

              <!-- Phone / Zalo -->
              <div class="flex items-center gap-2.5 pt-2 border-t border-slate-700/60">
                <div class="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <i class="ph-bold ph-phone text-sm"></i>
                </div>
                <div class="flex-1">
                  <div class="text-[10px] uppercase font-bold text-slate-400">Điện thoại / Zalo</div>
                  <div class="text-sm sm:text-base font-black text-amber-300 font-mono tracking-wide">0975.142.242</div>
                </div>
              </div>

              <!-- Email -->
              <div class="flex items-center gap-2.5 pt-2 border-t border-slate-700/60">
                <div class="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <i class="ph-bold ph-envelope text-sm"></i>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-[10px] uppercase font-bold text-slate-400">Email</div>
                  <div class="text-xs sm:text-sm font-semibold text-emerald-300 truncate font-mono">ngocnguyenagb@gmail.com</div>
                </div>
              </div>

              <!-- QR Code Zalo / Quét mã liên hệ -->
              <div class="pt-2.5 border-t border-slate-700/60 flex flex-col items-center justify-center text-center">
                <div class="text-[10px] uppercase font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                  <i class="ph-bold ph-qr-code text-emerald-400 text-xs"></i>
                  <span>Quét mã Zalo liên hệ</span>
                </div>
                <div class="p-1.5 bg-white rounded-xl shadow-lg border border-emerald-500/40 inline-flex items-center justify-center">
                  <img src="/images/contact-qr.jpg" alt="Mã QR Zalo Nguyễn Giang Ngọc" class="w-32 h-32 sm:w-36 sm:h-36 object-contain rounded-lg" />
                </div>
                <span class="text-[9px] sm:text-[10px] text-emerald-300/80 mt-1 font-medium">Mở Zalo hoặc Camera điện thoại để quét</span>
              </div>
            </div>

            <!-- Developer Attribution Note (Formatted as 2 Lines) -->
            <div class="pt-1.5 border-t border-slate-800/80">
              <div class="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center justify-center gap-2 shadow-inner text-center">
                <i class="ph-bold ph-sparkle text-amber-300 text-base shrink-0"></i>
                <div class="leading-relaxed text-slate-200 text-xs">
                  <div>Chương trình này được phát triển bởi</div>
                  <div class="font-bold text-amber-300">Nguyễn Giang Ngọc - ĐTCB Agribank</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center px-4">
          <div class="w-18 h-18 rounded-2xl mx-auto shadow-2xl shadow-emerald-950/50 bg-white p-2 border border-emerald-500/30 mb-4 inline-flex items-center justify-center">
            <img src="/images/agribank-logo.png" alt="Agribank Logo" class="w-14 h-14 object-contain" onerror="this.onerror=null; this.src='/images/logo.png';" />
          </div>
          <h2 class="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
            TRƯỜNG ĐÀO TẠO CÁN BỘ AGRIBANK
          </h2>
          <p class="mt-1.5 text-xs sm:text-sm text-emerald-400 font-semibold tracking-wide">
            Hệ thống Theo dõi & Kê khai Công việc Nội bộ
          </p>
        </div>

        <div class="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
          ${alertBanner}

          <!-- Error Alert Box -->
          <div id="login-error-box" class="hidden p-3.5 bg-rose-500/20 border border-rose-500/50 rounded-2xl text-xs text-rose-300 font-medium flex items-center gap-2.5 mb-4 animate-shake">
            <i class="ph-bold ph-warning-circle text-lg text-rose-400 shrink-0"></i>
            <span id="login-error-msg"></span>
          </div>

          <div class="bg-slate-900/90 backdrop-blur-2xl py-8 px-6 sm:px-8 shadow-2xl rounded-3xl border border-slate-800 space-y-5">
            <div class="border-b border-slate-800 pb-3">
              <h3 class="text-sm font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <i class="ph-bold ph-shield-check text-emerald-500 text-base"></i> Đăng nhập tài khoản
              </h3>
              <p class="text-[11px] text-slate-400 mt-0.5">Sử dụng tên đăng nhập và mật khẩu được cấp để truy cập</p>
            </div>

            <!-- Standard Form Login -->
            <form onsubmit="Auth.handleFormLogin(event)" class="space-y-4">
              <!-- Username -->
              <div>
                <label class="block text-xs font-bold uppercase text-slate-300 mb-1.5">Tên đăng nhập *</label>
                <div class="relative">
                  <i class="ph ph-user absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base"></i>
                  <input type="text" id="login-username" required value="${savedUsername}" placeholder="Nhập tên đăng nhập..." autofocus class="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition">
                </div>
              </div>

              <!-- Password -->
              <div>
                <label class="block text-xs font-bold uppercase text-slate-300 mb-1.5">Mật khẩu *</label>
                <div class="relative">
                  <i class="ph ph-lock-key absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base"></i>
                  <input type="password" id="login-password" required value="${savedPassword}" placeholder="Nhập mật khẩu..." class="w-full pl-10 pr-10 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono transition">
                  <button type="button" onclick="Auth.toggleLoginPasswordVisibility(this)" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1">
                    <i class="ph-bold ph-eye text-base"></i>
                  </button>
                </div>
              </div>

              <!-- Remember Credentials Checkbox -->
              <div class="pt-1">
                <label class="flex items-center gap-2.5 cursor-pointer select-none text-xs text-slate-300 hover:text-white transition group">
                  <input type="checkbox" id="login-remember-me" ${isRemembered ? 'checked' : ''} class="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900 cursor-pointer accent-emerald-600">
                  <span class="font-semibold group-hover:text-emerald-400 transition">Lưu tài khoản và mật khẩu</span>
                </label>
              </div>

              <!-- Submit Button -->
              <button type="submit" id="btn-login-submit" class="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/30 transition duration-150 flex items-center justify-center gap-2 cursor-pointer mt-2">
                <i class="ph-bold ph-sign-in text-base"></i>
                <span>Đăng nhập hệ thống</span>
              </button>
            </form>

            <div class="text-center pt-2 border-t border-slate-800/80 text-[11px] text-slate-500">
              🔒 Cổng thông tin nội bộ - Trường Đào tạo cán bộ Agribank
            </div>
          </div>
        </div>
      </div>
    `;

    if (urlParams.get('open_contact') === '1') {
      this.showContactModal();
    }
  },

  toggleLoginPasswordVisibility(btnEl) {
    const input = document.getElementById('login-password');
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    const icon = btnEl.querySelector('i');
    if (icon) {
      icon.className = isPass ? 'ph-bold ph-eye-slash text-base text-emerald-400' : 'ph-bold ph-eye text-base text-slate-400';
    }
  },

  async handleFormLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username')?.value.trim() || '';
    const password = document.getElementById('login-password')?.value || '';
    const rememberMe = document.getElementById('login-remember-me')?.checked || false;
    const errorBox = document.getElementById('login-error-box');
    const errorMsg = document.getElementById('login-error-msg');
    const submitBtn = document.getElementById('btn-login-submit');

    if (errorBox) errorBox.classList.add('hidden');

    if (!username || !password) {
      if (errorBox && errorMsg) {
        errorMsg.innerText = 'Vui lòng điền đầy đủ tên đăng nhập và mật khẩu';
        errorBox.classList.remove('hidden');
      }
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="ph ph-spinner animate-spin text-base"></i> Đang xác thực...';
      }

      await this.login(username, password);

      // Save or remove remember me credentials
      if (rememberMe) {
        localStorage.setItem('agy_saved_username', username);
        localStorage.setItem('agy_saved_password', password);
        localStorage.setItem('agy_remember_me', 'true');
      } else {
        localStorage.removeItem('agy_saved_username');
        localStorage.removeItem('agy_saved_password');
        localStorage.removeItem('agy_remember_me');
      }

      window.location.href = '/';
    } catch (err) {
      if (errorBox && errorMsg) {
        errorMsg.innerText = err.message || 'Tên đăng nhập hoặc mật khẩu không đúng';
        errorBox.classList.remove('hidden');
      } else {
        alert('Đăng nhập thất bại: ' + err.message);
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="ph-bold ph-sign-in text-base"></i> <span>Đăng nhập hệ thống</span>';
      }
    }
  },

  toggleContactPopup(e) {
    if (e) e.stopPropagation();
    const pop = document.getElementById('contact-popover');
    if (!pop) return;
    const isHidden = pop.classList.contains('invisible') || pop.classList.contains('opacity-0');
    if (isHidden) {
      this.openContactPopup();
    } else {
      this.closeContactPopup();
    }
  },

  openContactPopup() {
    const pop = document.getElementById('contact-popover');
    if (!pop) return;
    pop.classList.remove('invisible', 'opacity-0', 'scale-95', 'translate-y-2', 'pointer-events-none');
    pop.classList.add('opacity-100', 'scale-100', 'translate-y-0');
    
    // Auto close when clicking outside
    if (window._authCloseContactOnOutside) {
      document.removeEventListener('click', window._authCloseContactOnOutside);
    }
    const closeOnOutside = (e) => {
      const popover = document.getElementById('contact-popover');
      const toggleBtn = document.getElementById('btn-contact-toggle');
      if (popover && !popover.contains(e.target) && toggleBtn && !toggleBtn.contains(e.target)) {
        this.closeContactPopup();
        document.removeEventListener('click', closeOnOutside);
        window._authCloseContactOnOutside = null;
      }
    };
    window._authCloseContactOnOutside = closeOnOutside;
    setTimeout(() => {
      document.addEventListener('click', closeOnOutside);
    }, 50);
  },

  closeContactPopup(e) {
    if (e) e.stopPropagation();
    const pop = document.getElementById('contact-popover');
    if (!pop) return;
    pop.classList.remove('opacity-100', 'scale-100', 'translate-y-0');
    pop.classList.add('invisible', 'opacity-0', 'scale-95', 'translate-y-2', 'pointer-events-none');
    if (window._authCloseContactOnOutside) {
      document.removeEventListener('click', window._authCloseContactOnOutside);
      window._authCloseContactOnOutside = null;
    }
  },

  showContactModal() {
    this.openContactPopup();
  },

  closeContactModal() {
    this.closeContactPopup();
  },

  copyContactPhone(phone, btnEl) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(phone.replace(/\./g, '')).catch(() => {});
    }
    if (btnEl) {
      const originalHTML = btnEl.innerHTML;
      btnEl.innerHTML = '<i class="ph-bold ph-check text-emerald-400"></i> <span class="text-emerald-300">Đã chép!</span>';
      setTimeout(() => {
        btnEl.innerHTML = originalHTML;
      }, 2000);
    }
  }
};

// Global API Fetch helper with JWT Bearer header & Security Interceptors
async function apiFetch(url, options = {}) {
  const headers = options.headers || {};
  if (Auth.token) {
    headers['Authorization'] = `Bearer ${Auth.token}`;
  }
  if (!headers['Content-Type'] && !(options.body instanceof FormData) && options.method && options.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  // Any API call also refreshes the inactivity timer
  Auth.resetInactivityTimer();

  const response = await fetch(url, { credentials: 'include', ...options, headers });
  
  const contentType = response.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (response.status === 401 || response.status === 403) {
    const code = (typeof data === 'object' && data) ? data.code : null;
    const errorMsg = (typeof data === 'object' && data.error) ? data.error : (typeof data === 'string' && data ? data : response.statusText);

    if (code === 'SESSION_TERMINATED' || code === 'SESSION_TAKEN_OVER' || (typeof errorMsg === 'string' && errorMsg.includes('đăng nhập ở thiết bị khác'))) {
      Auth.logout('session_terminated');
      throw new Error(errorMsg || 'Tài khoản của bạn đã được đăng nhập từ một thiết bị khác.');
    } else if (code === 'ACCOUNT_LOCKED' || (typeof errorMsg === 'string' && errorMsg.includes('bị khóa'))) {
      Auth.logout('locked');
      throw new Error(errorMsg || 'Tài khoản đã bị khóa.');
    } else if (response.status === 401) {
      Auth.logout('expired');
      throw new Error('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
    }
  }

  if (!response.ok) {
    const errorMsg = (typeof data === 'object' && data.error) ? data.error : (typeof data === 'string' && data ? data : response.statusText);
    throw new Error(errorMsg);
  }

  return data;
}
