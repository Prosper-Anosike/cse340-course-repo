import 'dotenv/config';
import app from './src/app.js';
import { safeDatabaseErrorCode, testConnection } from './src/models/db.js';

const port = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await testConnection();
    console.info('PostgreSQL connection verified.');
  } catch (error) {
    console.warn(`PostgreSQL connection check failed (${safeDatabaseErrorCode(error)}); database-backed routes may be unavailable.`);
  }

  app.listen(port, () => {
    console.log(`CSE 340 volunteer site listening on port ${port}`);
  });
};

await startServer();
