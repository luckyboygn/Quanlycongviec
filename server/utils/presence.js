const userLastSeen = new Map();

const PresenceTracker = {
  touch(userId) {
    if (userId) {
      userLastSeen.set(parseInt(userId), Date.now());
    }
  },

  isOnline(userId) {
    if (!userId) return false;
    const last = userLastSeen.get(parseInt(userId));
    if (!last) return false;
    // Considered online if active within last 3 minutes (180,000 ms)
    return (Date.now() - last) < 3 * 60 * 1000;
  },

  getOnlineUserIds() {
    const now = Date.now();
    const online = [];
    for (const [uid, last] of userLastSeen.entries()) {
      if (now - last < 3 * 60 * 1000) {
        online.push(uid);
      }
    }
    return online;
  }
};

module.exports = PresenceTracker;
