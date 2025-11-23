import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

const createTablesSQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  body TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  price NUMERIC(12,2),
  city VARCHAR(120),
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
`;

export async function runMigrations() {
  await pool.query(createTablesSQL);
}

export async function seedDemoData() {
  const { rows: userCountRows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  const userCount = userCountRows[0]?.count || 0;

  let demoUserId;
  if (userCount === 0) {
    const passwordHash = await bcrypt.hash('demo1234', 10);
    const insertUserQuery = `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, $2, $3) RETURNING id
    `;
    const { rows } = await pool.query(insertUserQuery, [
      'Demo Manager',
      'demo@elitetime.ru',
      passwordHash
    ]);
    demoUserId = rows[0].id;
  } else {
    const { rows } = await pool.query('SELECT id FROM users LIMIT 1');
    demoUserId = rows[0].id;
  }

  const { rows: postCountRows } = await pool.query('SELECT COUNT(*)::int AS count FROM posts');
  const postCount = postCountRows[0]?.count || 0;

  if (postCount === 0) {
    const samplePosts = [
      {
        title: 'Rolex Submariner — топовая сталь',
        body: 'Отличное состояние, полный комплект, свежий сервис.',
        rating: 5,
        price: 1200000,
        city: 'Москва',
        latitude: 55.7558,
        longitude: 37.6173
      },
      {
        title: 'Omega Seamaster Diver 300M',
        body: 'Синий циферблат, заводская гарантия, без сколов.',
        rating: 4,
        price: 860000,
        city: 'Санкт-Петербург',
        latitude: 59.9311,
        longitude: 30.3609
      },
      {
        title: 'Patek Philippe Nautilus 5711',
        body: 'Коллекционное состояние, в сейфе, оригинальные бумаги.',
        rating: 5,
        price: 2450000,
        city: 'Сочи',
        latitude: 43.6028,
        longitude: 39.7342
      }
    ];

    const insertPostQuery = `
      INSERT INTO posts (user_id, title, body, rating, price, city, latitude, longitude)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `;

    await Promise.all(
      samplePosts.map((post) =>
        pool.query(insertPostQuery, [
          demoUserId,
          post.title,
          post.body,
          post.rating,
          post.price,
          post.city,
          post.latitude,
          post.longitude
        ])
      )
    );
  }
}
