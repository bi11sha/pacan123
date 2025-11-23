import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { runMigrations, seedDemoData } from './db/init.js';
import authRoutes from './routes/auth.js';
import postsRoutes from './routes/posts.js';

const app = express();

app.use(cors());
app.use(morgan(config.isDev ? 'dev' : 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.use('/api', authRoutes);
app.use('/api/posts', postsRoutes);

app.use(express.static(config.frontendDir));

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'Маршрут не найден' });
  }

  return res.sendFile(path.join(config.frontendDir, 'index.html'));
});

async function start() {
  try {
    await runMigrations();
    await seedDemoData();

    app.listen(config.port, () => {
      console.log(`API listening on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
