const db = require('../database/connection');
const PresenceTracker = require('../utils/presence');

const ChatRepository = {
  async getContacts(currentUserId) {
    const contacts = await db.allAsync(`
      SELECT u.id, u.full_name, u.position, u.role, u.department_id,
             d.name as department_name, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id != ? AND (u.status = 'active' OR u.status IS NULL OR u.status != 'locked')
    `, [currentUserId]);

    for (const c of contacts) {
      c.is_online = PresenceTracker.isOnline(c.id);

      const lastMsg = await db.getAsync(`
        SELECT content, created_at, sender_id
        FROM messages
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at DESC LIMIT 1
      `, [currentUserId, c.id, c.id, currentUserId]);
      c.last_message = lastMsg ? lastMsg.content : '';
      c.last_message_time = lastMsg ? lastMsg.created_at : null;
      c.last_sender_id = lastMsg ? lastMsg.sender_id : null;

      const unread = await db.getAsync(`
        SELECT COUNT(*) as count FROM messages
        WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
      `, [c.id, currentUserId]);
      c.unread_count = unread ? unread.count : 0;
    }

    // Sắp xếp: Cán bộ có tin nhắn mới nhất / tin nhắn chưa đọc nổi lên ĐẦU TIÊN
    contacts.sort((a, b) => {
      if (a.unread_count > 0 && b.unread_count === 0) return -1;
      if (b.unread_count > 0 && a.unread_count === 0) return 1;
      if (a.last_message_time && b.last_message_time) {
        return new Date(b.last_message_time) - new Date(a.last_message_time);
      }
      if (a.last_message_time && !b.last_message_time) return -1;
      if (!a.last_message_time && b.last_message_time) return 1;
      return (a.department_id || 0) - (b.department_id || 0) || a.full_name.localeCompare(b.full_name);
    });

    const lastGenMsg = await db.getAsync(`
      SELECT m.content, m.created_at, u.full_name as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.channel = 'general'
      ORDER BY m.created_at DESC LIMIT 1
    `);

    const generalChannel = {
      id: 'general',
      name: '🏛️ Kênh Toàn Trường (Chung)',
      description: 'Trao đổi, chia sẻ thông tin công tác nội bộ toàn thể cán bộ',
      last_message: lastGenMsg ? `${lastGenMsg.sender_name}: ${lastGenMsg.content}` : 'Chưa có thông tin trao đổi...',
      last_message_time: lastGenMsg ? lastGenMsg.created_at : null
    };

    // Lấy thông tin Kênh phòng ban của cán bộ hiện tại
    const currentUser = await db.getAsync(`
      SELECT u.id, u.department_id, u.role, d.name as department_name, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `, [currentUserId]);

    let departmentChannel = null;
    let departmentChannels = [];

    if (currentUser && currentUser.department_id) {
      const dId = currentUser.department_id;
      const rawDeptName = currentUser.department_name || 'Phòng ban';
      const cleanDeptName = rawDeptName.startsWith('Phòng') ? rawDeptName : ('Phòng ' + rawDeptName);

      const lastDeptMsg = await db.getAsync(`
        SELECT m.content, m.created_at, u.full_name as sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.channel = ?
        ORDER BY m.created_at DESC LIMIT 1
      `, [`dept_${dId}`]);

      departmentChannel = {
        id: `dept_${dId}`,
        dept_id: dId,
        name: `🏢 Kênh ${cleanDeptName}`,
        department_name: cleanDeptName,
        department_code: currentUser.department_code,
        description: `Trao đổi, thảo luận công tác nội bộ ${cleanDeptName}`,
        last_message: lastDeptMsg ? `${lastDeptMsg.sender_name}: ${lastDeptMsg.content}` : 'Chưa có tin nhắn trong phòng...',
        last_message_time: lastDeptMsg ? lastDeptMsg.created_at : null
      };
    }

    // Nếu là Ban Giám đốc hoặc Admin, lấy danh sách tất cả các kênh phòng ban
    if (currentUser && (currentUser.role === 'director' || currentUser.role === 'admin')) {
      const allDepts = await db.allAsync(`SELECT id, name, code FROM departments ORDER BY id ASC`);
      for (const d of allDepts) {
        const cleanDName = d.name.startsWith('Phòng') ? d.name : ('Phòng ' + d.name);
        const lMsg = await db.getAsync(`
          SELECT m.content, m.created_at, u.full_name as sender_name
          FROM messages m
          JOIN users u ON m.sender_id = u.id
          WHERE m.channel = ?
          ORDER BY m.created_at DESC LIMIT 1
        `, [`dept_${d.id}`]);

        departmentChannels.push({
          id: `dept_${d.id}`,
          dept_id: d.id,
          name: `🏢 Kênh ${cleanDName}`,
          department_name: cleanDName,
          department_code: d.code,
          description: `Trao đổi nội bộ ${cleanDName}`,
          last_message: lMsg ? `${lMsg.sender_name}: ${lMsg.content}` : 'Chưa có tin nhắn...',
          last_message_time: lMsg ? lMsg.created_at : null
        });
      }
    }

    return {
      contacts,
      general_channel: generalChannel,
      department_channel: departmentChannel,
      department_channels: departmentChannels
    };
  },

  async getMessages(currentUserId, receiverId, channel = 'direct') {
    if (channel === 'general') {
      return await db.allAsync(`
        SELECT m.*, u.full_name as sender_name, u.position as sender_position, u.role as sender_role
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.channel = 'general'
        ORDER BY m.created_at ASC
      `);
    } else if (channel && channel.startsWith('dept_')) {
      return await db.allAsync(`
        SELECT m.*, u.full_name as sender_name, u.position as sender_position, u.role as sender_role
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.channel = ?
        ORDER BY m.created_at ASC
      `, [channel]);
    } else {
      await db.runAsync(`
        UPDATE messages SET is_read = 1
        WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
      `, [receiverId, currentUserId]);

      return await db.allAsync(`
        SELECT m.*, u.full_name as sender_name, u.position as sender_position, u.role as sender_role
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.created_at ASC
      `, [currentUserId, receiverId, receiverId, currentUserId]);
    }
  },

  async findById(messageId) {
    return await db.getAsync(`
      SELECT m.*, u.full_name as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `, [messageId]);
  },

  async delete(messageId) {
    return await db.runAsync(`DELETE FROM messages WHERE id = ?`, [messageId]);
  },

  async recall(messageId) {
    return await db.runAsync(`
      UPDATE messages
      SET content = 'Tin nhắn đã được thu hồi',
          attachment_url = NULL,
          attachment_name = NULL,
          is_recalled = 1
      WHERE id = ?
    `, [messageId]);
  },

  async create(messageData) {
    const res = await db.runAsync(`
      INSERT INTO messages (sender_id, receiver_id, channel, content, attachment_url, attachment_name, is_read)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      messageData.sender_id, messageData.receiver_id || null, messageData.channel || 'direct',
      messageData.content, messageData.attachment_url || null, messageData.attachment_name || null,
      messageData.is_read || 0
    ]);
    return res.lastID;
  },

  async getUnreadCount(currentUserId) {
    const row = await db.getAsync(`
      SELECT COUNT(*) as count FROM messages
      WHERE receiver_id = ? AND is_read = 0
    `, [currentUserId]);
    return row ? row.count : 0;
  }
};

module.exports = ChatRepository;
