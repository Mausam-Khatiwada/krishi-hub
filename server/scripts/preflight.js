const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const validateEnv = require('../config/validateEnv');
const connectDB = require('../config/db');
const app = require('../app');

const requestJson = (port, path) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'GET',
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, body: data });
        });
      },
    );

    req.on('error', reject);
    req.end();
  });

const run = async () => {
  validateEnv();
  await connectDB();
  await mongoose.connection.close();

  const server = app.listen(0);

  try {
    const port = server.address().port;
    const [health, root] = await Promise.all([requestJson(port, '/health'), requestJson(port, '/')]);

    if (health.statusCode !== 200) {
      throw new Error(`/health failed with status ${health.statusCode}`);
    }

    if (root.statusCode !== 200) {
      throw new Error(`/ failed with status ${root.statusCode}`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('Preflight checks passed.');
};

run().catch((error) => {
  console.error('Preflight checks failed:', error.message || error);
  process.exit(1);
});
