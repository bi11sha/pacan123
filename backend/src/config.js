import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const dbUser = process.env.DB_USER || 'elitetime';
const dbPassword = process.env.DB_PASSWORD || 'elitetime';
const dbName = process.env.DB_NAME || 'elitetime';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || '5432';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultFrontendDir = path.resolve(__dirname, '../../frontend');

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  dbUrl:
    process.env.DATABASE_URL ||
    `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`,
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-prod',
  frontendDir: process.env.FRONTEND_DIR
    ? path.resolve(process.env.FRONTEND_DIR)
    : defaultFrontendDir,
  isDev: process.env.NODE_ENV !== 'production'
};
