import express from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const baseSelect = `
  SELECT p.id, p.title, p.body, p.rating, p.price, p.city,
         p.latitude, p.longitude, p.created_at,
         u.name AS author
  FROM posts p
  LEFT JOIN users u ON p.user_id = u.id
`;

router.get('/', async (req, res) => {
  const { search = '', minRating, city, sort = 'new' } = req.query;
  const conditions = [];
  const values = [];
  let index = 1;

  if (search) {
    conditions.push(`(LOWER(p.title) LIKE $${index} OR LOWER(p.body) LIKE $${index})`);
    values.push(`%${search.toLowerCase()}%`);
    index += 1;
  }

  if (minRating) {
    conditions.push(`p.rating >= $${index}`);
    values.push(Number(minRating));
    index += 1;
  }

  if (city) {
    conditions.push(`LOWER(p.city) = $${index}`);
    values.push(city.toLowerCase());
    index += 1;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderClause = sort === 'price'
    ? 'ORDER BY p.price DESC NULLS LAST'
    : 'ORDER BY p.created_at DESC';

  const query = `${baseSelect} ${whereClause} ${orderClause} LIMIT 100`;

  try {
    const { rows } = await pool.query(query, values);
    return res.json(rows);
  } catch (err) {
    console.error('Get posts error', err);
    return res.status(500).json({ message: 'Не удалось загрузить ленту' });
  }
});

router.get('/:id', async (req, res) => {
  const postId = Number(req.params.id);
  if (Number.isNaN(postId)) {
    return res.status(400).json({ message: 'Некорректный ID' });
  }

  try {
    const { rows } = await pool.query(`${baseSelect} WHERE p.id = $1`, [postId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Запись не найдена' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Get post error', err);
    return res.status(500).json({ message: 'Ошибка при получении записи' });
  }
});

router.post('/', authenticate, async (req, res) => {
  const { title, body, rating = 5, price, city, latitude, longitude } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Введите заголовок' });
  }

  const ratingValue = Number(rating);
  if (Number.isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
    return res.status(400).json({ message: 'Рейтинг должен быть от 1 до 5' });
  }

  const insertQuery = `
    INSERT INTO posts (user_id, title, body, rating, price, city, latitude, longitude)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING id
  `;

  try {
    const { rows } = await pool.query(insertQuery, [
      req.user.id,
      title,
      body || '',
      ratingValue,
      price ?? null,
      city || null,
      latitude ?? null,
      longitude ?? null
    ]);

    const createdId = rows[0].id;
    const { rows: createdRows } = await pool.query(`${baseSelect} WHERE p.id = $1`, [createdId]);
    return res.status(201).json(createdRows[0]);
  } catch (err) {
    console.error('Create post error', err);
    return res.status(500).json({ message: 'Не удалось создать запись' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  const postId = Number(req.params.id);
  if (Number.isNaN(postId)) {
    return res.status(400).json({ message: 'Некорректный ID' });
  }

  const { title, body, rating, price, city, latitude, longitude } = req.body;

  try {
    const { rows: existingRows } = await pool.query(
      'SELECT id, user_id FROM posts WHERE id = $1',
      [postId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Запись не найдена' });
    }

    if (existingRows[0].user_id !== req.user.id) {
      return res.status(403).json({ message: 'Можно изменять только свои записи' });
    }

    const ratingValue = rating !== undefined ? Number(rating) : null;
    if (ratingValue !== null && (Number.isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5)) {
      return res.status(400).json({ message: 'Рейтинг должен быть от 1 до 5' });
    }

    const updateQuery = `
      UPDATE posts
      SET title = COALESCE($1, title),
          body = COALESCE($2, body),
          rating = COALESCE($3, rating),
          price = COALESCE($4, price),
          city = COALESCE($5, city),
          latitude = COALESCE($6, latitude),
          longitude = COALESCE($7, longitude)
      WHERE id = $8
      RETURNING id
    `;

    await pool.query(updateQuery, [
      title || null,
      body || null,
      ratingValue,
      price ?? null,
      city || null,
      latitude ?? null,
      longitude ?? null,
      postId
    ]);

    const { rows } = await pool.query(`${baseSelect} WHERE p.id = $1`, [postId]);
    return res.json(rows[0]);
  } catch (err) {
    console.error('Update post error', err);
    return res.status(500).json({ message: 'Не удалось обновить запись' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  const postId = Number(req.params.id);
  if (Number.isNaN(postId)) {
    return res.status(400).json({ message: 'Некорректный ID' });
  }

  try {
    const { rows: existingRows } = await pool.query(
      'SELECT user_id FROM posts WHERE id = $1',
      [postId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Запись не найдена' });
    }

    if (existingRows[0].user_id !== req.user.id) {
      return res.status(403).json({ message: 'Можно удалять только свои записи' });
    }

    await pool.query('DELETE FROM posts WHERE id = $1', [postId]);
    return res.status(204).send();
  } catch (err) {
    console.error('Delete post error', err);
    return res.status(500).json({ message: 'Не удалось удалить запись' });
  }
});

export default router;
