import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Требуется авторизация' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.id, email: payload.email, name: payload.name };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Невалидный токен' });
  }
}
