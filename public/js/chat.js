/**
 * Chat Module (Công cụ Trao đổi / Trò chuyện Nội bộ giữa các Cán bộ Agribank)
 * Hỗ trợ: Chat 1-1, Kênh Toàn Trường (Chung), Kênh Phòng làm việc (Nội bộ), Xóa tin nhắn, Gửi file đính kèm (Tối đa 5MB)
 */
const Chat = {
  activeContactId: 'general', // 'general', 'dept_1', or user_id
  activeContact: null,
  contacts: [],
  generalChannel: null,
  departmentChannel: null,
  departmentChannels: [],
  messages: [],
  pollTimer: null,
  globalPollTimer: null,
  unreadCount: 0,
  selectedFile: null,
  socketListening: false,

  init() {
    this.checkUnreadCount();
    this.setupSocketListeners();

    // Fallback slow unread check: only runs every 60s if WebSocket is offline and page is visible
    if (this.globalPollTimer) clearInterval(this.globalPollTimer);
    this.globalPollTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && (!window.AppSocket || !window.AppSocket.connected)) {
        this.checkUnreadCount();
      }
    }, 60000);
  },

  setupSocketListeners() {
    if (!window.AppSocket || this.socketListening) return;
    this.socketListening = true;

    const socket = window.AppSocket;

    // 1. Live Chat Message Received
    socket.on('chat:message', (msg) => {
      // Check if message belongs to currently active chat
      const isCurrentChat = 
        (this.activeContactId === 'general' && msg.channel === 'general') ||
        (this.activeContactId === msg.channel) ||
        (this.activeContactId === msg.sender_id || (msg.channel === 'direct' && this.activeContactId === msg.receiver_id));

      if (isCurrentChat) {
        const exists = this.messages.some(m => m.id === msg.id);
        if (!exists) {
          this.messages.push(msg);
          this.renderMessages();
          const container = document.getElementById('chat-messages-container');
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        }
      }

      // Update contact list last message
      this.updateContactLastMessage(msg);

      // If direct message from another user and not currently viewing that chat, update unread count
      if (msg.channel === 'direct' && Auth.user && msg.receiver_id === Auth.user.id && this.activeContactId !== msg.sender_id) {
        const contact = this.contacts.find(c => c.id === msg.sender_id);
        if (contact) {
          contact.unread_count = (contact.unread_count || 0) + 1;
          this.renderContactsList();
        }
        this.unreadCount = (this.unreadCount || 0) + 1;
        this.updateUnreadBadges();
      }
    });

    // 2. Live Message Deleted
    socket.on('chat:deleted', (data) => {
      const idx = this.messages.findIndex(m => m.id === data.messageId);
      if (idx !== -1) {
        this.messages.splice(idx, 1);
        this.renderMessages();
      }
    });

    // 3. Live Message Recalled
    socket.on('chat:recalled', (data) => {
      const msg = this.messages.find(m => m.id === data.messageId);
      if (msg) {
        msg.is_recalled = 1;
        msg.content = 'Tin nhắn đã được thu hồi';
        msg.attachment_url = null;
        msg.attachment_name = null;
        this.renderMessages();
      }
    });

    // 4. Live User Online/Offline Status Change
    socket.on('user:online_change', (data) => {
      const contact = this.contacts.find(c => c.id === data.userId);
      if (contact) {
        contact.is_online = data.isOnline;
        this.renderContactsList();
      }
      this.updateOnlineBadges(data.onlineCount);
    });

    // 5. Initial Online Users List
    socket.on('system:online_list', (data) => {
      if (data && Array.isArray(data.onlineUserIds)) {
        this.contacts.forEach(c => {
          c.is_online = data.onlineUserIds.includes(c.id);
        });
        this.renderContactsList();
        this.updateOnlineBadges(data.onlineUserIds.length);
      }
    });

    // 6. Unread Sync
    socket.on('chat:unread_update', () => {
      this.checkUnreadCount();
    });
  },

  updateContactLastMessage(msg) {
    if (msg.channel === 'general' && this.generalChannel) {
      this.generalChannel.last_message = msg.content;
      this.generalChannel.last_message_time = msg.created_at;
    } else if (msg.channel && msg.channel.startsWith('dept_')) {
      const dChan = (this.departmentChannels || []).find(d => d.id === msg.channel);
      if (dChan) {
        dChan.last_message = msg.content;
        dChan.last_message_time = msg.created_at;
      }
    } else {
      const otherId = (Auth.user && msg.sender_id === Auth.user.id) ? msg.receiver_id : msg.sender_id;
      const contact = this.contacts.find(c => c.id === otherId);
      if (contact) {
        contact.last_message = msg.content;
        contact.last_message_time = msg.created_at;
      }
    }
    if (document.getElementById('chat-contacts-list')) {
      this.renderContactsList();
    }
  },

  updateOnlineBadges(count) {
    const badge = document.getElementById('chat-online-count-badge');
    if (badge) {
      const onlineTotal = count !== undefined ? count : this.contacts.filter(c => c.is_online).length;
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span>${onlineTotal} trực tuyến</span>`;
    }
    const tabCount = document.getElementById('chat-tab-online-count');
    if (tabCount) {
      const onlineTotal = this.contacts.filter(c => c.is_online).length;
      tabCount.innerText = onlineTotal;
    }
  },

  async checkUnreadCount() {
    if (!Auth.token) return;
    try {
      const res = await apiFetch('/api/chat/unread-count');
      this.unreadCount = res.unread_count || 0;
      this.updateUnreadBadges();
    } catch (e) {}
  },

  updateUnreadBadges() {
    const sideBadge = document.getElementById('sidebar-chat-badge');
    if (sideBadge) {
      if (this.unreadCount > 0) {
        sideBadge.innerText = this.unreadCount > 99 ? '99+' : this.unreadCount;
        sideBadge.classList.remove('hidden');
      } else {
        sideBadge.classList.add('hidden');
      }
    }
  },

  contactFilterTab: 'all', // 'all' | 'online' | 'recent'
  contactsPollTimer: null,

  async renderView(container) {
    if (this.contactsPollTimer) clearInterval(this.contactsPollTimer);

    container.innerHTML = `
      <div class="h-[calc(100vh-130px)] min-h-[500px] max-h-[calc(100vh-100px)] bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col md:flex-row">
        <!-- Left Sidebar: Contacts & Channels -->
        <div class="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 flex flex-col bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
          
          <!-- Search & Filter Header -->
          <div class="p-4 border-b border-slate-200 dark:border-slate-700 space-y-2.5">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <i class="ph-bold ph-chats-circle text-emerald-600 text-xl"></i> Chat nội bộ
              </h2>
              <span id="chat-online-count-badge" class="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>0 trực tuyến</span>
              </span>
            </div>
            
            <div class="relative">
              <i class="ph-bold ph-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
              <input type="text" id="chat-search-input" oninput="Chat.filterContacts(this.value)" placeholder="Tìm kiếm cán bộ, phòng ban, chức vụ..." class="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs">
            </div>

            <!-- Fast Segment Filter Tabs -->
            <div class="flex items-center bg-slate-100 dark:bg-slate-700/80 p-1 rounded-xl text-[11px] font-bold shadow-inner">
              <button onclick="Chat.setFilterTab('all')" id="btn-chat-tab-all" class="flex-1 py-1 rounded-lg transition text-center ${this.contactFilterTab === 'all' ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'}">
                👥 Danh bạ (<span id="chat-tab-all-count">0</span>)
              </button>
              <button onclick="Chat.setFilterTab('online')" id="btn-chat-tab-online" class="flex-1 py-1 rounded-lg transition text-center ${this.contactFilterTab === 'online' ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'}">
                🟢 Online (<span id="chat-tab-online-count">0</span>)
              </button>
              <button onclick="Chat.setFilterTab('recent')" id="btn-chat-tab-recent" class="flex-1 py-1 rounded-lg transition text-center ${this.contactFilterTab === 'recent' ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'}">
                💬 Gần đây
              </button>
            </div>
          </div>

          <!-- Contacts & Channels List -->
          <div id="chat-contacts-list" class="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            <div class="p-6 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <i class="ph ph-spinner animate-spin text-2xl text-emerald-600"></i>
              <span>Đang tải danh bạ toàn thể cán bộ...</span>
            </div>
          </div>
        </div>

        <!-- Right Main: Active Chat Window -->
        <div id="chat-main-window" class="flex-1 flex flex-col bg-white dark:bg-slate-800 min-w-0">
          <div class="flex-1 flex items-center justify-center p-8 text-center text-slate-400">
            <div>
              <i class="ph-bold ph-chat-circle-dots text-5xl text-emerald-500 mb-2"></i>
              <p class="font-bold text-slate-600 dark:text-slate-300 text-sm">Chọn một cán bộ hoặc Kênh Toàn Trường / Kênh Phòng để bắt đầu trao đổi</p>
              <p class="text-xs text-slate-400 mt-1">Tin nhắn tức thì phục vụ công việc và phối hợp chuyên môn</p>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.loadContacts();
    this.setupSocketListeners();

    const urlParams = new URLSearchParams(window.location.search);
    const chatContactParam = urlParams.get('chat_contact');
    if (chatContactParam) {
      this.activeContactId = (chatContactParam === 'general' || chatContactParam.startsWith('dept_')) ? chatContactParam : parseInt(chatContactParam);
    }
    if (this.activeContactId) {
      this.selectContact(this.activeContactId);
    }
  },

  setFilterTab(tab) {
    this.contactFilterTab = tab;
    const tabs = ['all', 'online', 'recent'];
    tabs.forEach(t => {
      const btn = document.getElementById(`btn-chat-tab-${t}`);
      if (btn) {
        if (t === tab) {
          btn.className = 'flex-1 py-1 rounded-lg transition text-center bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs font-black';
        } else {
          btn.className = 'flex-1 py-1 rounded-lg transition text-center text-slate-600 dark:text-slate-400 hover:text-slate-800 font-bold';
        }
      }
    });

    const searchVal = document.getElementById('chat-search-input')?.value || '';
    if (searchVal) {
      this.filterContacts(searchVal);
    } else {
      this.renderContactsList();
    }
  },

  async loadContacts(silent = false) {
    try {
      const res = await apiFetch('/api/chat/contacts');
      this.contacts = res.contacts || [];
      this.generalChannel = res.general_channel || { id: 'general', name: '🏛️ Kênh Toàn Trường (Chung)' };
      this.departmentChannel = res.department_channel || null;
      this.departmentChannels = res.department_channels || [];

      // Update online count & tab counts
      const onlineCount = this.contacts.filter(c => c.is_online).length;
      const onlineBadge = document.getElementById('chat-online-count-badge');
      if (onlineBadge) {
        onlineBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span>${onlineCount} trực tuyến</span>`;
      }

      const allCountEl = document.getElementById('chat-tab-all-count');
      if (allCountEl) allCountEl.innerText = this.contacts.length;

      const onlineCountEl = document.getElementById('chat-tab-online-count');
      if (onlineCountEl) onlineCountEl.innerText = onlineCount;

      // Also update active contact online status if currently chatting 1-1
      if (this.activeContact && typeof this.activeContactId === 'number') {
        const found = this.contacts.find(c => c.id === this.activeContactId);
        if (found) {
          this.activeContact.is_online = found.is_online;
        }
      }

      const searchVal = document.getElementById('chat-search-input')?.value || '';
      if (searchVal) {
        this.filterContacts(searchVal);
      } else {
        this.renderContactsList();
      }
    } catch (e) {
      if (!silent) console.error('Load contacts error:', e);
    }
  },

  formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins}p trước`;
    if (diffHours < 24 && now.getDate() === date.getDate()) {
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  },

  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  getFileIcon(filename) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'ph-file-image text-emerald-600';
    if (['pdf'].includes(ext)) return 'ph-file-pdf text-rose-600';
    if (['doc', 'docx'].includes(ext)) return 'ph-file-doc text-blue-600';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'ph-file-xls text-emerald-700';
    if (['ppt', 'pptx'].includes(ext)) return 'ph-file-ppt text-amber-600';
    if (['zip', 'rar', '7z'].includes(ext)) return 'ph-file-zip text-purple-600';
    return 'ph-file text-slate-500';
  },

  renderContactsList(filtered = null) {
    const listEl = document.getElementById('chat-contacts-list');
    if (!listEl) return;

    let list = filtered || this.contacts;
    const isSearching = filtered !== null;
    const isGeneralActive = this.activeContactId === 'general';

    // Apply Filter Tab if not currently searching with text
    if (!isSearching) {
      if (this.contactFilterTab === 'online') {
        list = this.contacts.filter(c => c.is_online);
      } else if (this.contactFilterTab === 'recent') {
        list = this.contacts.filter(c => c.last_message || c.unread_count > 0);
      }
    }

    let html = `
      <!-- KÊNH CHUNG & KÊNH PHÒNG BAN (Luôn ghim ở trên đầu) -->
      ${!isSearching ? `
        <div class="space-y-1 mb-2">
          <!-- 1. Kênh Toàn Trường (Chung) -->
          <button onclick="Chat.selectContact('general')" class="w-full text-left p-3 rounded-2xl transition flex items-center justify-between ${isGeneralActive ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 shadow-2xs' : 'hover:bg-slate-100 dark:hover:bg-slate-700/60'}">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-bold flex items-center justify-center text-lg shrink-0 shadow-2xs">
                🏛️
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-bold text-slate-800 dark:text-white text-xs truncate flex items-center justify-between gap-1">
                  <span class="flex items-center gap-1 truncate">
                    <span>Kênh Toàn Trường</span>
                    <span class="text-[9px] bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 px-1 py-0.2 rounded font-semibold">Chung</span>
                  </span>
                  <span class="text-[10px] text-slate-400 font-normal shrink-0">
                    ${this.formatTime(this.generalChannel?.last_message_time)}
                  </span>
                </div>
                <div class="text-[11px] text-slate-400 truncate mt-0.5 font-normal">
                  ${this.generalChannel?.last_message || 'Thông tin trao đổi chung toàn trường...'}
                </div>
              </div>
            </div>
          </button>

          <!-- 2. Kênh Phòng Làm Việc (Nội bộ phòng) -->
          ${this.departmentChannel ? `
            <button onclick="Chat.selectContact('${this.departmentChannel.id}')" class="w-full text-left p-3 rounded-2xl transition flex items-center justify-between ${this.activeContactId === this.departmentChannel.id ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 shadow-2xs' : 'hover:bg-slate-100 dark:hover:bg-slate-700/60'}">
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-lg shrink-0 shadow-2xs">
                  🏢
                </div>
                <div class="min-w-0 flex-1">
                  <div class="font-bold text-slate-800 dark:text-white text-xs truncate flex items-center justify-between gap-1">
                    <span class="flex items-center gap-1 truncate">
                      <span>${this.departmentChannel.name.replace('🏢 ', '')}</span>
                      <span class="text-[9px] bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-1 py-0.2 rounded font-semibold">Phòng</span>
                    </span>
                    <span class="text-[10px] text-slate-400 font-normal shrink-0">
                      ${this.formatTime(this.departmentChannel?.last_message_time)}
                    </span>
                  </div>
                  <div class="text-[11px] text-slate-400 truncate mt-0.5 font-normal">
                    ${this.departmentChannel?.last_message || 'Trao đổi nghiệp vụ nội bộ phòng...'}
                  </div>
                </div>
              </div>
            </button>
          ` : ''}

          <!-- 3. Kênh các phòng ban khác (Dành cho Ban Giám đốc / Admin) -->
          ${(Auth.isDirector() || Auth.isAdmin()) && this.departmentChannels && this.departmentChannels.length > 0 ? `
            <div class="pt-2 pb-1 px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <i class="ph-bold ph-buildings"></i> Kênh các phòng khác (${this.departmentChannels.filter(d => d.id !== this.departmentChannel?.id).length})
            </div>
            ${this.departmentChannels.filter(d => d.id !== this.departmentChannel?.id).map(d => `
              <button onclick="Chat.selectContact('${d.id}')" class="w-full text-left p-2.5 rounded-2xl transition flex items-center justify-between ${this.activeContactId === d.id ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-800 shadow-2xs' : 'hover:bg-slate-100 dark:hover:bg-slate-700/60'}">
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                  <div class="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs shrink-0">
                    🏢
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-bold text-slate-800 dark:text-white text-xs truncate flex items-center justify-between gap-1">
                      <span class="truncate">${d.name.replace('🏢 ', '')}</span>
                      <span class="text-[9px] text-slate-400">${this.formatTime(d.last_message_time)}</span>
                    </div>
                    <div class="text-[10px] text-slate-400 truncate mt-0.5">${d.last_message || d.description}</div>
                  </div>
                </div>
              </button>
            `).join('')}
          ` : ''}
        </div>
      ` : ''}
    `;

    // DANH BẠ CÁN BỘ
    if (this.contactFilterTab === 'all' && !isSearching) {
      // Group by Department for full institute directory
      const deptsMap = {};
      list.forEach(c => {
        let deptName = c.department_name;
        if (!deptName || c.role === 'director' || c.role === 'admin' || (c.position && c.position.toLowerCase().includes('giám đốc'))) {
          deptName = '🏛️ Ban Giám đốc & Quản trị';
        } else if (!deptName.startsWith('Phòng') && !deptName.startsWith('🏛️')) {
          deptName = '🏢 Phòng ' + deptName;
        } else if (!deptName.startsWith('🏛️')) {
          deptName = '🏢 ' + deptName;
        }

        if (!deptsMap[deptName]) deptsMap[deptName] = [];
        deptsMap[deptName].push(c);
      });

      // Render each department group
      const deptKeys = Object.keys(deptsMap).sort((a, b) => {
        if (a.includes('Ban Giám đốc')) return -1;
        if (b.includes('Ban Giám đốc')) return 1;
        return a.localeCompare(b);
      });

      deptKeys.forEach(dKey => {
        const members = deptsMap[dKey];
        const onlineInDept = members.filter(m => m.is_online).length;

        html += `
          <div class="pt-3 pb-1 px-2.5 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700/60 bg-slate-100/40 dark:bg-slate-700/20 rounded-xl my-1">
            <span class="flex items-center gap-1.5 truncate">
              <span>${dKey}</span>
            </span>
            <span class="text-[10px] text-slate-400 font-bold shrink-0">
              ${members.length} CB ${onlineInDept > 0 ? `<span class="text-emerald-600 dark:text-emerald-400 font-extrabold">(${onlineInDept} online)</span>` : ''}
            </span>
          </div>
          <div class="space-y-1">
            ${members.map(c => this.renderContactItem(c)).join('')}
          </div>
        `;
      });
    } else {
      // Flat list for Online tab / Recent tab / Search results
      if (list.length > 0) {
        const titleLabel = isSearching ? `Kết quả tìm kiếm (${list.length})` : (this.contactFilterTab === 'online' ? `Cán bộ đang trực tuyến (${list.length})` : `Hội thoại gần đây (${list.length})`);
        html += `
          <div class="pt-3 pb-1 px-2.5 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 border-t border-slate-100 dark:border-slate-700/60">
            <span>${titleLabel}</span>
          </div>
          <div class="space-y-1">
            ${list.map(c => this.renderContactItem(c)).join('')}
          </div>
        `;
      }
    }

    if (list.length === 0) {
      html += `
        <div class="p-8 text-center text-slate-400 text-xs">
          <i class="ph-bold ph-user-circle text-3xl mb-1 text-slate-300"></i>
          <p class="font-semibold">${this.contactFilterTab === 'online' ? 'Hiện không có cán bộ nào đang online' : 'Không có cán bộ phù hợp'}</p>
        </div>
      `;
    }

    listEl.innerHTML = html;
  },

  renderContactItem(c) {
    if (!c) return '';
    const isActive = this.activeContactId === c.id;
    const fullName = c.full_name || 'Cán bộ';
    const initial = (fullName.trim().split(' ').pop() || 'U')[0]?.toUpperCase() || 'U';
    const roleTag = c.role === 'director' ? 'BGD' : c.role === 'admin' ? 'Admin' : c.role === 'manager' ? (c.position || 'Trưởng phòng') : (c.position || 'Nhân viên');
    const tagColor = c.role === 'director' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300' : c.role === 'admin' ? 'bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300' : c.role === 'manager' ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300' : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300';
    const hasUnread = (c.unread_count || 0) > 0;

    return `
      <button onclick="Chat.selectContact(${c.id})" class="w-full text-left p-2.5 rounded-2xl transition flex items-center justify-between ${isActive ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 shadow-2xs' : 'hover:bg-slate-100 dark:hover:bg-slate-700/60'}">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <!-- Avatar with Initial & Status Dot -->
          <div class="relative shrink-0">
            <div class="w-9 h-9 rounded-xl ${c.role === 'director' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : c.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' : c.role === 'manager' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'} font-bold flex items-center justify-center text-xs shadow-2xs">
              ${initial}
            </div>
            ${c.is_online ? `
              <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full ring-1 ring-emerald-400/40 shadow-xs animate-pulse" title="Đang trực tuyến"></span>
            ` : ''}
          </div>

          <!-- Name & Online Indicator next to name -->
          <div class="min-w-0 flex-1 pr-1">
            <div class="font-bold text-slate-800 dark:text-white text-xs truncate flex items-center justify-between gap-1.5">
              <div class="flex items-center gap-1.5 truncate min-w-0">
                <span class="truncate ${hasUnread ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : ''}">${fullName}</span>
                ${c.is_online ? `
                  <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-950/90 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0" title="Đang trực tuyến">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
                  </span>
                ` : `
                  <span class="inline-flex items-center gap-1 px-1 py-0.2 rounded-full text-[9px] font-medium text-slate-400 shrink-0" title="Ngoại tuyến">
                    <span class="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span> Offline
                  </span>
                `}
              </div>
              ${c.last_message_time ? `<span class="text-[9px] text-slate-400 font-normal shrink-0">${this.formatTime(c.last_message_time)}</span>` : ''}
            </div>

            <div class="text-[10px] ${hasUnread ? 'text-slate-700 dark:text-slate-200 font-bold' : 'text-slate-400'} truncate mt-0.5 flex items-center justify-between">
              <span class="truncate">${c.last_message ? (c.last_sender_id === (Auth.user && Auth.user.id) ? `Bạn: ${c.last_message}` : c.last_message) : (c.position ? `${c.position} • ${c.department_name || ''}` : (c.department_name || roleTag))}</span>
            </div>
          </div>
        </div>

        <div class="shrink-0 pl-1 flex items-center gap-1">
          ${hasUnread ? `
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-2xs animate-pulse">
              ${c.unread_count}
            </span>
          ` : `
            <span class="text-[9px] px-1.5 py-0.5 rounded font-bold ${tagColor}">
              ${c.department_code || roleTag}
            </span>
          `}
        </div>
      </button>
    `;
  },

  filterDebounceTimer: null,
  filterContacts(query) {
    if (this.filterDebounceTimer) clearTimeout(this.filterDebounceTimer);
    this.filterDebounceTimer = setTimeout(() => {
      const q = (query || '').toLowerCase().trim();
      if (!q) {
        this.renderContactsList();
        return;
      }
      const filtered = this.contacts.filter(c => 
        ((c.full_name || '') + ' ' + (c.department_name || '') + ' ' + (c.position || '') + ' ' + (c.role || '')).toLowerCase().includes(q)
      );
      this.renderContactsList(filtered);
    }, 120);
  },

  async selectContact(contactId) {
    this.activeContactId = contactId;
    this.selectedFile = null;

    if (contactId === 'general') {
      this.activeContact = this.generalChannel;
    } else if (typeof contactId === 'string' && contactId.startsWith('dept_')) {
      this.activeContact = (this.departmentChannels || []).find(d => d.id === contactId) || this.departmentChannel || { id: contactId, name: 'Kênh Phòng ban', description: 'Trao đổi nội bộ phòng' };
    } else {
      this.activeContact = this.contacts.find(c => c.id === contactId);
      if (this.activeContact) {
        this.activeContact.unread_count = 0;
      }
    }

    this.renderContactsList();
    this.renderActiveChatWindow();
    await this.fetchMessages();
    this.setupSocketListeners();
  },

  renderActiveChatWindow() {
    const windowEl = document.getElementById('chat-main-window');
    if (!windowEl || !this.activeContact) return;

    const isGeneral = this.activeContactId === 'general';
    const isDept = typeof this.activeContactId === 'string' && this.activeContactId.startsWith('dept_');
    const c = this.activeContact;

    windowEl.innerHTML = `
      <!-- Chat Header -->
      <div class="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl ${isGeneral ? 'bg-gradient-to-tr from-emerald-600 to-teal-600 text-white' : isDept ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white' : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'} font-bold flex items-center justify-center text-sm shadow-2xs">
            ${isGeneral ? '🏛️' : isDept ? '🏢' : (c.full_name ? c.full_name.split(' ').pop()[0] : 'U')}
          </div>
          <div>
            <h3 class="font-extrabold text-slate-800 dark:text-white text-sm flex items-center gap-1.5">
              <span>${isGeneral ? 'Kênh Toàn Trường (Chung)' : isDept ? (c.name || 'Kênh Phòng làm việc') : c.full_name}</span>
              ${isGeneral ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.2 rounded font-semibold">Chung</span>' : isDept ? '<span class="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.2 rounded font-semibold">Nội bộ phòng</span>' : `<span class="text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-1.5 py-0.2 rounded font-semibold">${c.position || c.role}</span>`}
              ${!isGeneral && !isDept ? (c.is_online ? '<span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Trực tuyến</span>' : '<span class="text-[10px] text-slate-400 font-normal">Ngoại tuyến</span>') : ''}
            </h3>
            <p class="text-[11px] text-slate-400">
              ${isGeneral ? 'Trao đổi, chia sẻ thông tin công tác nội bộ toàn thể cán bộ' : isDept ? (c.description || 'Trao đổi, thảo luận nghiệp vụ nội bộ phòng') : (c.department_name || 'Ban Giám đốc')}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="Chat.fetchMessages()" class="p-2 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition" title="Làm mới tin nhắn">
            <i class="ph-bold ph-arrows-clockwise text-base"></i>
          </button>
        </div>
      </div>

      <!-- Messages Body -->
      <div id="chat-messages-container" class="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40 dark:bg-slate-900/40 custom-scrollbar">
        <div class="text-center p-8 text-slate-400 text-xs">Đang tải lịch sử tin nhắn...</div>
      </div>

      <!-- Quick Preset Actions -->
      <div class="px-4 py-2 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-1.5 overflow-x-auto custom-scrollbar text-xs">
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Tin nhanh:</span>
        <button onclick="Chat.sendPreset('👍 Đã tiếp nhận công việc, tôi sẽ xử lý ngay!')" class="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 font-medium whitespace-nowrap transition shadow-2xs">
          👍 Đã tiếp nhận
        </button>
        <button onclick="Chat.sendPreset('📊 Tôi vừa cập nhật tiến độ công việc trên hệ thống.')" class="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 font-medium whitespace-nowrap transition shadow-2xs">
          📊 Đã cập nhật tiến độ
        </button>
        <button onclick="Chat.sendPreset('🤝 Đồng chí kiểm tra và duyệt giúp bản kê khai nhật ký nhé.')" class="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 font-medium whitespace-nowrap transition shadow-2xs">
          🤝 Nhờ duyệt kê khai
        </button>
      </div>

      <!-- File Attachment Preview Area (If selected) -->
      <div id="chat-file-preview-box" class="hidden px-4 py-2 bg-emerald-50/70 dark:bg-emerald-950/40 border-t border-emerald-100 dark:border-emerald-900/60 flex items-center justify-between text-xs">
        <div class="flex items-center gap-2 min-w-0">
          <i id="chat-file-preview-icon" class="ph-bold ph-file text-emerald-600 text-lg shrink-0"></i>
          <div class="min-w-0">
            <div id="chat-file-preview-name" class="font-bold text-slate-800 dark:text-white truncate">tài liệu.pdf</div>
            <div id="chat-file-preview-size" class="text-[10px] text-slate-400 font-mono">0 KB</div>
          </div>
        </div>
        <button type="button" onclick="Chat.removeSelectedFile()" class="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition" title="Gỡ file này">
          <i class="ph-bold ph-x text-sm"></i>
        </button>
      </div>

      <!-- Input Bar -->
      <div class="p-3 sm:p-3.5 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
        <form onsubmit="Chat.submitMessage(event)" class="flex items-center gap-2">
          
          <!-- Hidden File Input -->
          <input type="file" id="chat-file-input" onchange="Chat.handleFileSelect(event)" class="hidden">

          <!-- Attachment Clip Button (Max 5MB) -->
          <button type="button" onclick="document.getElementById('chat-file-input').click()" class="p-2.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition shrink-0" title="Đính kèm file (Tối đa 5MB)">
            <i class="ph-bold ph-paperclip text-lg"></i>
          </button>

          <!-- Text Input -->
          <div class="flex-1 relative">
            <input type="text" id="chat-input-text" autocomplete="off" placeholder="Nhập tin nhắn trao đổi... (Đính kèm file tối đa 5MB)" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner">
          </div>

          <!-- Submit Button -->
          <button type="submit" id="btn-chat-send" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 shrink-0">
            <i class="ph-bold ph-paper-plane-tilt text-sm"></i>
            <span class="hidden sm:inline">Gửi</span>
          </button>
        </form>
      </div>
    `;

    setTimeout(() => {
      const input = document.getElementById('chat-input-text');
      if (input) input.focus();
    }, 100);
  },

  handleFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    // Giới hạn dung lượng file: TỐI ĐA 5MB
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      alert(`⚠️ Dung lượng file "${file.name}" (${this.formatFileSize(file.size)}) vượt quá giới hạn 5MB cho phép.\n\nVui lòng nén hoặc chọn file nhỏ hơn 5MB!`);
      event.target.value = '';
      this.selectedFile = null;
      this.renderAttachmentPreview();
      return;
    }

    this.selectedFile = file;
    this.renderAttachmentPreview();
  },

  renderAttachmentPreview() {
    const previewBox = document.getElementById('chat-file-preview-box');
    const nameEl = document.getElementById('chat-file-preview-name');
    const sizeEl = document.getElementById('chat-file-preview-size');
    const iconEl = document.getElementById('chat-file-preview-icon');

    if (!previewBox) return;

    if (!this.selectedFile) {
      previewBox.classList.add('hidden');
      return;
    }

    previewBox.classList.remove('hidden');
    if (nameEl) nameEl.innerText = this.selectedFile.name;
    if (sizeEl) sizeEl.innerText = this.formatFileSize(this.selectedFile.size);
    if (iconEl) iconEl.className = `ph-bold ${this.getFileIcon(this.selectedFile.name)} text-lg shrink-0`;
  },

  removeSelectedFile() {
    this.selectedFile = null;
    const fileInput = document.getElementById('chat-file-input');
    if (fileInput) fileInput.value = '';
    this.renderAttachmentPreview();
  },

  async fetchMessages(isSilent = false) {
    if (!this.activeContactId) return;
    try {
      let params = '';
      if (this.activeContactId === 'general') {
        params = 'channel=general';
      } else if (typeof this.activeContactId === 'string' && this.activeContactId.startsWith('dept_')) {
        params = `channel=${this.activeContactId}`;
      } else {
        params = `receiverId=${this.activeContactId}`;
      }
      const msgs = await apiFetch(`/api/chat/messages?${params}`);
      
      if (!isSilent || msgs.length !== this.messages.length) {
        this.messages = msgs;
        this.renderMessages();
      }
    } catch (e) {
      console.error('Fetch messages error:', e);
    }
  },

  renderMessages() {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    if (this.messages.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 text-slate-400 text-xs">
          <i class="ph-bold ph-chats text-4xl text-slate-300 dark:text-slate-600 mb-2"></i>
          <p>Chưa có tin nhắn nào trong cuộc trò chuyện này.</p>
          <p class="text-[11px] mt-1">Hãy gửi tin nhắn hoặc đính kèm tài liệu để bắt đầu trao đổi!</p>
        </div>
      `;
      return;
    }

    const isGroup = this.activeContactId === 'general' || (typeof this.activeContactId === 'string' && this.activeContactId.startsWith('dept_'));
    let lastDate = '';
    let html = '';

    this.messages.forEach(m => {
      const isMe = Auth.user && m.sender_id === Auth.user.id;
      const canManage = isMe || (Auth.user && Auth.user.role === 'admin');
      const isRecalled = m.is_recalled === 1 || m.content === 'Tin nhắn đã được thu hồi';
      const msgDate = new Date(m.created_at).toLocaleDateString('vi-VN');
      const msgTime = new Date(m.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const senderInitial = (m.sender_name ? m.sender_name.trim().split(' ').pop() : 'U')?.[0]?.toUpperCase() || 'U';

      if (msgDate !== lastDate) {
        lastDate = msgDate;
        html += `
          <div class="text-center my-3">
            <span class="px-3 py-1 bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 rounded-full text-[10px] font-bold">
              ${msgDate}
            </span>
          </div>
        `;
      }

      if (isRecalled) {
        html += `
          <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} group/msg">
            ${!isMe && isGroup ? `
              <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 px-1">
                ${m.sender_name || 'Cán bộ'} (${m.sender_position || m.sender_role || ''})
              </span>
            ` : ''}
            <div class="flex items-center gap-1.5 max-w-[85%] sm:max-w-[75%] ${isMe ? 'flex-row-reverse' : 'flex-row'}">
              ${!isMe ? `
                <div class="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-[10px] shrink-0 mb-0.5">
                  ${senderInitial}
                </div>
              ` : ''}

              <!-- Recalled Bubble -->
              <div class="p-2.5 px-3.5 rounded-2xl text-xs italic text-slate-400 dark:text-slate-500 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 flex items-center gap-2 shadow-2xs">
                <i class="ph-bold ph-arrow-u-up-left text-sm text-slate-400"></i>
                <span>Tin nhắn đã được thu hồi</span>
                <span class="text-[9px] text-slate-400 font-normal ml-1">${msgTime}</span>
              </div>

              ${canManage ? `
                <button onclick="Chat.deleteMessage(${m.id})" class="opacity-0 group-hover/msg:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition shrink-0" title="Xóa vĩnh viễn tin nhắn">
                  <i class="ph-bold ph-trash text-xs"></i>
                </button>
              ` : ''}
            </div>
          </div>
        `;
        return;
      }

      const hasAttachment = !!m.attachment_url;
      const isImg = hasAttachment && (
        /\.(jpg|jpeg|png|gif|webp)$/i.test(m.attachment_url) ||
        /\.(jpg|jpeg|png|gif|webp)$/i.test(m.attachment_name || '')
      );

      html += `
        <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} group/msg">
          ${!isMe && isGroup ? `
            <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 px-1">
              ${m.sender_name || 'Cán bộ'} (${m.sender_position || m.sender_role || ''})
            </span>
          ` : ''}
          <div class="flex items-center gap-1.5 max-w-[85%] sm:max-w-[75%] ${isMe ? 'flex-row-reverse' : 'flex-row'}">
            ${!isMe ? `
              <div class="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-[10px] shrink-0 mb-0.5">
                ${senderInitial}
              </div>
            ` : ''}

            <!-- Message Bubble -->
            <div class="p-3 rounded-2xl text-xs leading-relaxed ${isMe ? 'bg-gradient-to-tr from-emerald-600 to-teal-600 text-white rounded-br-2xs shadow-sm' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600 rounded-bl-2xs shadow-2xs'}">
              
              <!-- Content Text (If not placeholder) -->
              ${m.content && !m.content.startsWith('Đã gửi tệp:') ? `<div>${m.content.replace(/\n/g, '<br>')}</div>` : ''}

              <!-- Attachment Rendering -->
              ${hasAttachment ? `
                <div class="${m.content && !m.content.startsWith('Đã gửi tệp:') ? 'mt-2 pt-2 border-t ' + (isMe ? 'border-white/20' : 'border-slate-200 dark:border-slate-600') : ''}">
                  ${isImg ? `
                    <a href="${m.attachment_url}" target="_blank" class="block rounded-xl overflow-hidden max-w-xs group/img">
                      <img src="${m.attachment_url}" alt="${m.attachment_name || 'Ảnh'}" class="w-full max-h-48 object-cover rounded-xl hover:opacity-90 transition">
                    </a>
                  ` : `
                    <a href="${m.attachment_url}" download="${m.attachment_name || 'tai_lieu'}" target="_blank" class="flex items-center gap-2 p-2 rounded-xl ${isMe ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600'} transition group/file">
                      <i class="ph-bold ${this.getFileIcon(m.attachment_name || m.attachment_url)} text-xl shrink-0"></i>
                      <div class="min-w-0 flex-1">
                        <div class="font-bold truncate text-[11px]">${m.attachment_name || 'Tài liệu đính kèm'}</div>
                        <div class="text-[9px] opacity-70 flex items-center gap-1">
                          <i class="ph-bold ph-download-simple"></i> Bấm để tải về
                        </div>
                      </div>
                    </a>
                  `}
                </div>
              ` : ''}

              <!-- Time and Status -->
              <div class="text-[9px] ${isMe ? 'text-emerald-100 text-right' : 'text-slate-400 text-left'} mt-1 flex items-center justify-end gap-1">
                <span>${msgTime}</span>
                ${isMe ? '<i class="ph-bold ph-check text-[10px]"></i>' : ''}
              </div>
            </div>

            <!-- Action Buttons: Recall & Delete -->
            ${canManage ? `
              <div class="opacity-0 group-hover/msg:opacity-100 flex items-center gap-0.5 shrink-0 bg-white dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition">
                <button onclick="Chat.recallMessage(${m.id})" class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition" title="Thu hồi tin nhắn (với mọi người)">
                  <i class="ph-bold ph-arrow-u-up-left text-xs"></i>
                </button>
                <button onclick="Chat.deleteMessage(${m.id})" class="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition" title="Xóa tin nhắn">
                  <i class="ph-bold ph-trash text-xs"></i>
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  },

  async recallMessage(msgId) {
    if (!confirm('Bạn có chắc chắn muốn thu hồi tin nhắn này với tất cả mọi người?')) return;
    try {
      await apiFetch(`/api/chat/messages/${msgId}/recall`, { method: 'PUT' });
      App.showToast('Đã thu hồi tin nhắn thành công', 'success');
      await this.fetchMessages();
      await this.loadContacts();
    } catch (err) {
      alert('Lỗi thu hồi tin nhắn: ' + err.message);
    }
  },

  async deleteMessage(msgId) {
    if (!confirm('Bạn có chắc chắn muốn xóa tin nhắn này khỏi cuộc trò chuyện?')) return;
    try {
      await apiFetch(`/api/chat/messages/${msgId}`, { method: 'DELETE' });
      App.showToast('Đã xóa tin nhắn', 'info');
      await this.fetchMessages();
      await this.loadContacts();
    } catch (err) {
      alert('Lỗi xóa tin nhắn: ' + err.message);
    }
  },

  async submitMessage(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('chat-input-text');
    const sendBtn = document.getElementById('btn-chat-send');
    const content = input ? input.value.trim() : '';

    if (!content && !this.selectedFile) return;

    let attachment_url = null;
    let attachment_name = null;

    if (this.selectedFile) {
      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Gửi...';
      }

      try {
        const formData = new FormData();
        formData.append('file', this.selectedFile);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + Auth.token
          },
          body: formData
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || 'Lỗi tải tệp lên');
        }

        const uploadData = await uploadRes.json();
        attachment_url = uploadData.url;
        attachment_name = uploadData.filename;
      } catch (uploadErr) {
        alert('Lỗi upload file: ' + uploadErr.message);
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.innerHTML = '<i class="ph-bold ph-paper-plane-tilt text-sm"></i> Gửi';
        }
        return;
      }
    }

    if (input) input.value = '';
    this.removeSelectedFile();

    await this.postMessage(content, attachment_url, attachment_name);

    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<i class="ph-bold ph-paper-plane-tilt text-sm"></i> <span class="hidden sm:inline">Gửi</span>';
    }
  },

  async sendPreset(text) {
    await this.postMessage(text);
  },

  async postMessage(content, attachment_url = null, attachment_name = null) {
    try {
      const payload = { content, attachment_url, attachment_name };
      if (this.activeContactId === 'general') {
        payload.channel = 'general';
      } else if (typeof this.activeContactId === 'string' && this.activeContactId.startsWith('dept_')) {
        payload.channel = this.activeContactId;
      } else {
        payload.receiver_id = this.activeContactId;
        payload.channel = 'direct';
      }

      await apiFetch('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      await this.fetchMessages();
      await this.loadContacts();
    } catch (err) {
      alert('Lỗi gửi tin nhắn: ' + err.message);
    }
  }
};

window.Chat = Chat;
