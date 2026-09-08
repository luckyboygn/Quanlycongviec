const ChatRepository = require('../repositories/chat.repository');
const { createNotification } = require('../utils/logger');
const { broadcastChatMessage, broadcastMessageDeleted, broadcastMessageRecalled } = require('../socket');

const ChatController = {
  async getContacts(req, res) {
    try {
      const result = await ChatRepository.getContacts(req.user.id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi lấy danh bạ trò chuyện' });
    }
  },

  async getMessages(req, res) {
    try {
      const { receiverId, channel } = req.query;
      const msgs = await ChatRepository.getMessages(req.user.id, receiverId ? parseInt(receiverId) : null, channel || 'direct');
      res.json(msgs);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi lấy tin nhắn' });
    }
  },

  async sendMessage(req, res) {
    try {
      const { receiver_id, channel, content, attachment_url, attachment_name } = req.body;
      const cleanContent = (content || '').trim();
      
      if (!cleanContent && !attachment_url) {
        return res.status(400).json({ error: 'Nội dung tin nhắn hoặc tệp đính kèm không được để trống' });
      }

      const finalContent = cleanContent || (attachment_name ? `Đã gửi tệp: ${attachment_name}` : 'Đã gửi tệp đính kèm');

      const msgId = await ChatRepository.create({
        sender_id: req.user.id,
        receiver_id: receiver_id ? parseInt(receiver_id) : null,
        channel: channel || 'direct',
        content: finalContent,
        attachment_url: attachment_url || null,
        attachment_name: attachment_name || null,
        is_read: 0
      });

      const fullMessage = await ChatRepository.findById(msgId);

      // Real-time broadcast to WebSocket clients
      if (fullMessage) {
        broadcastChatMessage(fullMessage);
      }

      if (channel !== 'general' && (!channel || !channel.startsWith('dept_')) && receiver_id) {
        await createNotification(
          parseInt(receiver_id),
          'Tin nhắn mới',
          `${req.user.full_name}: ${finalContent.substring(0, 50)}${finalContent.length > 50 ? '...' : ''}`,
          'chat',
          msgId
        );
      }

      res.status(201).json({ id: msgId, status: 'sent', content: finalContent, attachment_url, attachment_name, message: fullMessage });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi gửi tin nhắn: ' + err.message });
    }
  },

  async getUnreadCount(req, res) {
    try {
      const count = await ChatRepository.getUnreadCount(req.user.id);
      res.json({ unread_count: count });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi đếm tin chưa đọc' });
    }
  },

  async deleteMessage(req, res) {
    try {
      const messageId = parseInt(req.params.id);
      const message = await ChatRepository.findById(messageId);
      if (!message) {
        return res.status(404).json({ error: 'Không tìm thấy tin nhắn hoặc đã bị xóa' });
      }

      // Chỉ người gửi hoặc Admin mới có quyền xóa tin nhắn
      if (message.sender_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Bạn chỉ có quyền xóa tin nhắn do chính mình gửi' });
      }

      await ChatRepository.delete(messageId);

      // Broadcast real-time deletion
      broadcastMessageDeleted(messageId, message.channel, message.receiver_id, message.sender_id);

      res.json({ message: 'Đã xóa tin nhắn thành công', id: messageId });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi xóa tin nhắn: ' + err.message });
    }
  },

  async recallMessage(req, res) {
    try {
      const messageId = parseInt(req.params.id);
      const message = await ChatRepository.findById(messageId);
      if (!message) {
        return res.status(404).json({ error: 'Không tìm thấy tin nhắn hoặc đã bị xóa' });
      }

      // Chỉ người gửi hoặc Admin mới có quyền thu hồi tin nhắn
      if (message.sender_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Bạn chỉ có quyền thu hồi tin nhắn do chính mình gửi' });
      }

      await ChatRepository.recall(messageId);

      // Broadcast real-time recall
      broadcastMessageRecalled(messageId, message.channel, message.receiver_id, message.sender_id);

      res.json({ message: 'Đã thu hồi tin nhắn thành công', id: messageId });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi thu hồi tin nhắn: ' + err.message });
    }
  }
};

module.exports = ChatController;
