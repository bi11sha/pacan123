import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

function isEmailValid(email) {
  return /\S+@\S+\.\S+/.test(email);
}

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Имя, email и пароль обязательны' });
  }

  if (!isEmailValid(email)) {
    return res.status(400).json({ message: 'Некорректный email' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Пароль должен быть не короче 6 символов' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ message: 'Пользователь с таким email уже есть' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insertQuery = `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, name, email
    `;
    const { rows } = await pool.query(insertQuery, [name, email, passwordHash]);
    const user = rows[0];
    const token = createToken(user);

    return res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error', err);
    return res.status(500).json({ message: 'Не удалось зарегистрировать пользователя' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Введите email и пароль' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    const token = createToken(user);
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('Login error', err);
    return res.status(500).json({ message: 'Ошибка при входе' });
  }
});

router.get('/profile', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Profile error', err);
    return res.status(500).json({ message: 'Ошибка при получении профиля' });
  }
});

export default router;
