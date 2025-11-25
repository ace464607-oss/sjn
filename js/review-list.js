// js/review-list.js
// 후기게시판 목록 + 검색 + 카테고리 필터

import { firebaseConfig } from './config.js';
import {
  initializeApp,
  getApp,
  getApps,
} from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js';
import {
  getDatabase,
  ref,
  get,
} from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);

const listEl = document.querySelector('[data-role="reviews-list"]');
const emptyEl = document.getElementById('reviews-empty');
const searchInput = document.querySelector('[data-role="reviews-search"]');
const filterButtons = document.querySelectorAll('.filter-chip');

let allReviews = [];
let currentFilter = 'all';
let currentSearch = '';

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function render() {
  if (!listEl) return;

  let filtered = allReviews.slice();

  if (currentFilter !== 'all') {
    filtered = filtered.filter((r) => r.category === currentFilter);
  }

  if (currentSearch.trim()) {
    const q = currentSearch.trim().toLowerCase();
    filtered = filtered.filter((r) => {
      return (
        (r.title || '').toLowerCase().includes(q) ||
        (r.contentText || '').toLowerCase().includes(q) ||
        (r.nickname || '').toLowerCase().includes(q)
      );
    });
  }

  filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  listEl.innerHTML = '';

  if (!filtered.length) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  filtered.forEach((review) => {
    const card = document.createElement('article');
    card.className = 'review-card';
    card.addEventListener('click', () => {
      openModal(review);
    });

    const top = document.createElement('div');
    top.className = 'review-card__top';

    const cat = document.createElement('span');
    cat.className = 'review-card__category';
    cat.textContent = review.category || '기타';

    const nick = document.createElement('span');
    nick.textContent = review.nickname || '익명';

    const rating = document.createElement('span');
    rating.className = 'review-card__rating';
    const stars = '★★★★★☆☆☆☆☆'.slice(5 - (review.rating || 0), 10 - (review.rating || 0));
    rating.textContent = '★'.repeat(review.rating || 0);

    top.appendChild(cat);
    top.appendChild(nick);
    top.appendChild(rating);

    const title = document.createElement('h3');
    title.className = 'review-card__title';
    title.textContent = review.title || '(제목 없음)';

    const snippet = document.createElement('p');
    snippet.className = 'review-card__snippet';
    snippet.textContent = review.contentText || '';

    const meta = document.createElement('div');
    meta.className = 'review-card__meta';
    meta.innerHTML = `
      <span>${review.nickname || '익명'}</span>
      <span class="review-card__meta-dot"></span>
      <span>조회 ${review.views || 0}</span>
      <span class="review-card__meta-dot"></span>
      <span>${formatDate(review.createdAt)}</span>
    `;

    card.appendChild(top);
    card.appendChild(title);
    card.appendChild(snippet);
    card.appendChild(meta);

    listEl.appendChild(card);
  });
}

async function loadReviews() {
  try {
    const snap = await get(ref(db, '/boards/reviews'));
    if (!snap.exists()) {
      allReviews = [];
      render();
      return;
    }

    const raw = snap.val();
    allReviews = Object.entries(raw).map(([id, r]) => ({
      id,
      ...r,
      contentText: (r.contentHtml || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .slice(0, 120),
    }));

    render();
  } catch (err) {
    console.error('후기 목록 로딩 오류:', err);
  }
}

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterButtons.forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    currentFilter = btn.dataset.filter || 'all';
    render();
  });
});

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    render();
  });
}

// ---------------- 모달 로직 ----------------
const viewModal = document.getElementById('view-modal');
const viewCloseBtn = document.getElementById('view-modal-close');

function openModal(post) {
  if (!viewModal) return;

  document.getElementById('view-title').textContent = post.title || '';
  document.getElementById('view-category').textContent = post.category || '기타';
  document.getElementById('view-author').textContent = post.nickname || '익명';
  document.getElementById('view-date').textContent = formatDate(post.createdAt);

  // 다양한 필드명 지원
  const content = post.contentHtml || post.contentText || post.summary || post.content || '내용이 없습니다.';
  document.getElementById('view-content').innerHTML = content;

  const imgWrapper = document.getElementById('view-img-wrapper');
  const viewImg = document.getElementById('view-img');

  if (post.imageUrl) {
    viewImg.src = post.imageUrl;
    imgWrapper.style.display = 'block';
  } else {
    imgWrapper.style.display = 'none';
  }

  viewModal.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  if (!viewModal) return;
  viewModal.classList.remove('visible');
  document.body.style.overflow = '';
}

// 닫기 버튼 이벤트
if (viewCloseBtn) {
  viewCloseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });
}

// 배경 클릭 시 닫기
if (viewModal) {
  viewModal.addEventListener('click', (e) => {
    if (e.target === viewModal) {
      closeModal();
    }
  });
}

// ESC 키로 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && viewModal && viewModal.classList.contains('visible')) {
    closeModal();
  }
});

loadReviews();
