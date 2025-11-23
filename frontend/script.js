const API_BASE = '/api';

let posts = [];
let chartInstance = null;
let map;
let markersLayer;
let sliderIndex = 0;
let authToken = localStorage.getItem('token') || '';
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');
let cachedCoords = null;

const els = {
  sliderTrack: document.getElementById('sliderTrack'),
  searchInput: document.getElementById('searchInput'),
  ratingFilter: document.getElementById('ratingFilter'),
  postsTableBody: document.getElementById('postsTableBody'),
  tableSearch: document.getElementById('tableSearch'),
  resetFilters: document.getElementById('resetFilters'),
  metricPosts: document.getElementById('metricPosts'),
  metricRating: document.getElementById('metricRating'),
  metricCities: document.getElementById('metricCities'),
  userChip: document.getElementById('userChip'),
  authStatus: document.getElementById('authStatus'),
  locateMe: document.getElementById('locateMe'),
  geoStatus: document.getElementById('geoStatus'),
  copyMyCoords: document.getElementById('copyMyCoords'),
  createForm: document.getElementById('createForm'),
  navToggle: document.querySelector('.nav-toggle'),
  navLinks: document.querySelector('.nav-links')
};

function smoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (els.navLinks.classList.contains('open')) {
        els.navLinks.classList.remove('open');
      }
    });
  });
}

function toggleNav() {
  els.navToggle.addEventListener('click', () => {
    els.navLinks.classList.toggle('open');
  });
}

function buildCard(post) {
  const card = document.createElement('article');
  card.className = 'card product-card';
  card.innerHTML = `
    <div class="product-media" aria-hidden="true">
      <img src="assets/${post.image || 'omega.png'}" alt="${post.title}">
    </div>
    <div class="product-meta">
      <div>
        <h3>${post.title}</h3>
        <p class="muted">${post.body || 'Описание появится после обновления.'}</p>
      </div>
      <div class="price">${post.price ? post.price.toLocaleString('ru-RU') + ' ₽' : '—'}</div>
    </div>
    <div class="product-meta">
      <span>⭐️ ${post.rating || 5}</span>
      <span class="muted">${post.city || 'Город'}</span>
    </div>
  `;
  return card;
}

function renderSlider(data) {
  els.sliderTrack.innerHTML = '';
  sliderIndex = 0;
  data.forEach((post) => {
    els.sliderTrack.appendChild(buildCard(post));
  });
}

function slide(delta = 1) {
  const cards = els.sliderTrack.children.length;
  if (!cards) return;
  sliderIndex = (sliderIndex + delta + cards) % cards;
  const cardWidth = els.sliderTrack.children[0].getBoundingClientRect().width + 14;
  els.sliderTrack.scrollTo({
    left: sliderIndex * cardWidth,
    behavior: 'smooth'
  });
}

function attachSliderControls() {
  document.getElementById('prevSlide').addEventListener('click', () => slide(-1));
  document.getElementById('nextSlide').addEventListener('click', () => slide(1));
  setInterval(() => slide(1), 4200);
}

function renderTable(data) {
  els.postsTableBody.innerHTML = '';
  data.forEach((post) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${post.title}</td>
      <td>${post.rating ?? '—'}</td>
      <td>${post.price ? post.price.toLocaleString('ru-RU') + ' ₽' : '—'}</td>
      <td>${post.city || '—'}</td>
      <td>${post.author || '—'}</td>
    `;
    els.postsTableBody.appendChild(tr);
  });
}

function updateMetrics(data) {
  const ratingAvg =
    data.length === 0
      ? 0
      : (data.reduce((acc, p) => acc + (p.rating || 0), 0) / data.length).toFixed(1);
  const cities = new Set(data.map((p) => (p.city || '').toLowerCase()).filter(Boolean));

  els.metricPosts.textContent = data.length;
  els.metricRating.textContent = ratingAvg || '—';
  els.metricCities.textContent = cities.size;
}

function updateChart(data) {
  const grouped = data.reduce((acc, post) => {
    const city = post.city || 'Без города';
    acc[city] = (acc[city] || 0) + 1;
    return acc;
  }, {});

  const labels = Object.keys(grouped);
  const values = Object.values(grouped);

  if (chartInstance) {
    chartInstance.destroy();
  }

  const ctx = document.getElementById('postsChart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Кол-во объявлений',
          data: values,
          backgroundColor: labels.map((_, i) =>
            i % 2 === 0 ? 'rgba(243,198,83,0.6)' : 'rgba(108,212,255,0.5)'
          ),
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { ticks: { color: '#e9ecf5' }, grid: { color: '#222837' } },
        x: { ticks: { color: '#e9ecf5' }, grid: { display: false } }
      }
    }
  });
}

function initMap() {
  map = L.map('mapCanvas', { zoomControl: false }).setView([55.75, 37.6], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

function renderMarkers(data) {
  markersLayer.clearLayers();
  data.forEach((post) => {
    if (!post.latitude || !post.longitude) return;
    const marker = L.marker([post.latitude, post.longitude]);
    marker.bindPopup(`
      <strong>${post.title}</strong><br>
      ${post.city || ''}<br>
      ⭐️ ${post.rating || '—'} · ${post.price ? post.price.toLocaleString('ru-RU') + ' ₽' : '—'}
    `);
    markersLayer.addLayer(marker);
  });
}

function getFilteredPosts() {
  const search = els.searchInput.value.trim().toLowerCase();
  const rating = Number(els.ratingFilter.value);
  const tableSearch = els.tableSearch.value.trim().toLowerCase();

  return posts
    .filter((post) => {
      const matchName = post.title?.toLowerCase().includes(search);
      const matchRating = !rating || (post.rating || 0) >= rating;
      const tableMatch =
        !tableSearch ||
        post.city?.toLowerCase().includes(tableSearch) ||
        post.author?.toLowerCase().includes(tableSearch);
      return matchName && matchRating && tableMatch;
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function applyFilters() {
  const filtered = getFilteredPosts();
  renderSlider(filtered);
  renderTable(filtered);
  updateMetrics(filtered);
  updateChart(filtered);
  renderMarkers(filtered);
}

async function fetchPosts() {
  addLoader(true);
  try {
    const res = await fetch(`${API_BASE}/posts`);
    if (!res.ok) throw new Error('Не удалось загрузить ленту');
    posts = await res.json();
    applyFilters();
  } catch (err) {
    console.error(err);
    showToast(err.message);
  } finally {
    addLoader(false);
  }
}

function addLoader(show) {
  const card = document.querySelector('.chart-card');
  if (!card) return;
  const existing = card.querySelector('.loader');
  if (show && !existing) {
    const loader = document.createElement('div');
    loader.className = 'loader';
    card.appendChild(loader);
  } else if (!show && existing) {
    existing.remove();
  }
}

function showToast(text) {
  const toast = document.createElement('div');
  toast.textContent = text;
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.left = '20px';
  toast.style.padding = '12px 16px';
  toast.style.background = 'rgba(15,16,20,0.9)';
  toast.style.border = '1px solid var(--border)';
  toast.style.color = 'var(--text)';
  toast.style.borderRadius = '12px';
  toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.35)';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

async function registerUser(event) {
  event.preventDefault();
  const form = event.target;
  const payload = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    password: form.password.value
  };
  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Не удалось зарегистрироваться');
    setAuth(data);
    showToast('Профиль создан, ты в системе');
  } catch (err) {
    showToast(err.message);
  }
}

async function loginUser(event) {
  event.preventDefault();
  const form = event.target;
  const payload = {
    email: form.email.value.trim(),
    password: form.password.value
  };
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Не удалось войти');
    setAuth(data);
    showToast('Успешный вход');
  } catch (err) {
    showToast(err.message);
  }
}

function setAuth(data) {
  authToken = data.token;
  currentUser = data.user;
  localStorage.setItem('token', authToken);
  localStorage.setItem('user', JSON.stringify(currentUser));
  els.userChip.textContent = currentUser?.name || 'Пользователь';
  els.authStatus.textContent = 'Готово к созданию';
  els.authStatus.classList.add('success');
  toggleCreateAvailability(true);
}

function toggleCreateAvailability(enabled) {
  els.createForm.querySelectorAll('input, textarea, button').forEach((el) => {
    if (el.id === 'copyMyCoords') return;
    el.disabled = !enabled;
  });
}

async function createPost(event) {
  event.preventDefault();
  if (!authToken) {
    showToast('Войдите, чтобы создавать записи');
    return;
  }
  const form = event.target;
  const payload = {
    title: form.title.value.trim(),
    body: form.body.value.trim(),
    rating: Number(form.rating.value),
    price: Number(form.price.value) || null,
    city: form.city.value.trim(),
    latitude: form.latitude.value ? Number(form.latitude.value) : null,
    longitude: form.longitude.value ? Number(form.longitude.value) : null
  };

  try {
    const res = await fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Не удалось создать запись');
    posts.unshift(data);
    form.reset();
    applyFilters();
    showToast('Запись создана и добавлена в карту');
  } catch (err) {
    showToast(err.message);
  }
}

function attachSorting() {
  let currentSort = { key: null, direction: 'asc' };
  document.querySelectorAll('th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (currentSort.key === key) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort = { key, direction: 'asc' };
      }
      const filtered = getFilteredPosts().sort((a, b) => {
        const valA = a[key] ?? '';
        const valB = b[key] ?? '';
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        return 0;
      });
      renderTable(filtered);
    });
  });
}

function attachFilters() {
  [els.searchInput, els.ratingFilter, els.tableSearch].forEach((el) =>
    el.addEventListener('input', applyFilters)
  );
  els.resetFilters.addEventListener('click', () => {
    els.searchInput.value = '';
    els.ratingFilter.value = '';
    els.tableSearch.value = '';
    applyFilters();
  });
}

function animateHero() {
  if (!window.gsap) return;
  gsap.from('.hero-content > *', { opacity: 0, y: 20, duration: 0.9, stagger: 0.08 });
}

function initAuthState() {
  if (authToken && currentUser) {
    els.userChip.textContent = currentUser.name;
    els.authStatus.textContent = 'Готово к созданию';
    els.authStatus.classList.add('success');
    toggleCreateAvailability(true);
  } else {
    toggleCreateAvailability(false);
  }
}

function handleGeo() {
  if (!navigator.geolocation) {
    showToast('Браузер не поддерживает геолокацию');
    return;
  }
  els.geoStatus.textContent = 'Запрашиваем координаты...';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      cachedCoords = { latitude, longitude };
      els.geoStatus.textContent = `Твоя точка: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      map.setView([latitude, longitude], 10);
      L.circleMarker([latitude, longitude], {
        radius: 8,
        color: '#f3c653'
      }).addTo(markersLayer);
    },
    (err) => {
      els.geoStatus.textContent = 'Не удалось получить геопозицию';
      showToast(err.message);
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function copyCoordsToForm() {
  if (!cachedCoords) {
    showToast('Сначала нажми «Определить меня»');
    return;
  }
  els.createForm.latitude.value = cachedCoords.latitude.toFixed(6);
  els.createForm.longitude.value = cachedCoords.longitude.toFixed(6);
}

function attachForms() {
  document.getElementById('registerForm').addEventListener('submit', registerUser);
  document.getElementById('loginForm').addEventListener('submit', loginUser);
  els.createForm.addEventListener('submit', createPost);
  els.copyMyCoords.addEventListener('click', copyCoordsToForm);
}

function init() {
  smoothAnchors();
  toggleNav();
  initMap();
  fetchPosts();
  attachSliderControls();
  attachFilters();
  attachSorting();
  attachForms();
  initAuthState();
  animateHero();
  els.locateMe.addEventListener('click', handleGeo);
}

document.addEventListener('DOMContentLoaded', init);
