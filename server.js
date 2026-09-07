const app = require('./server/app');
const { initDB } = require('./server/database/schema');
const { PORT } = require('./server/config/constants');

async function bootstrap() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(`🚀 Server Trường Đào tạo cán bộ Agribank running`);
      console.log(`🌐 Access URL: http://localhost:${PORT}`);
      console.log(`🏛️ Modular Layered Architecture Active`);
      console.log(`==================================================`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();
