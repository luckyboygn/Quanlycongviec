const http = require('http');
const app = require('./server/app');
const { initDB } = require('./server/database/schema');
const { PORT } = require('./server/config/constants');
const { initSocket } = require('./server/socket');

async function bootstrap() {
  try {
    console.log('🚀 Initializing database schema...');
    await initDB();
    console.log('✅ Database initialization complete.');
  } catch (err) {
    console.error('⚠️ Database init error (continuing server startup):', err);
  }

  const server = http.createServer(app);
  
  // Initialize WebSocket Socket.IO Server
  initSocket(server);
  console.log('⚡ WebSocket (Socket.IO) Real-time Engine initialized.');

  server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 Server Trường Đào tạo cán bộ Agribank running on port ${PORT}`);
    console.log(`🌐 Access URL: http://localhost:${PORT}`);
    console.log(`⚡ Real-Time WebSocket: Active`);
    console.log(`🏛️ Modular Layered Architecture Active`);
    console.log(`==================================================`);
  });

  server.on('error', (e) => {
    console.error('❌ Server listen error:', e);
  });
}

bootstrap();

