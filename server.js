const app = require('./server/app');
const { initDB } = require('./server/database/schema');
const { PORT } = require('./server/config/constants');

async function bootstrap() {
  try {
    console.log('🚀 Initializing database schema...');
    await initDB();
    console.log('✅ Database initialization complete.');
  } catch (err) {
    console.error('⚠️ Database init error (continuing server startup):', err);
  }

  const server = app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 Server Trường Đào tạo cán bộ Agribank running on port ${PORT}`);
    console.log(`🌐 Access URL: http://localhost:${PORT}`);
    console.log(`🏛️ Modular Layered Architecture Active`);
    console.log(`==================================================`);
  });

  server.on('error', (e) => {
    console.error('❌ Server listen error:', e);
  });
}

bootstrap();

