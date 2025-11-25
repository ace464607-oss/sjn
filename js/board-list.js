// js/board-list.js
// 꿀팁 게시판 목록 + 검색/필터 + 스켈레톤 + 빈 상태 + 썸네일 + 하이라이트

import { firebaseConfig } from "./config.js";
import {
  initializeApp,
  getApp,
  getApps,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

// ---------------- Firebase 기본 설정 ----------------
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);

// ---------------- DOM 요소 ----------------
const searchInput = document.querySelector("[data-role='tips-search']");
const listEl = document.querySelector("[data-role='tips-list']");
const emptyEl = document.getElementById("tips-empty");
const filterButtons = document.querySelectorAll("[data-filter]");

// ---------------- 상태 값 ----------------
let allPosts = [];
let currentCategory = "all";
let currentKeyword = "";

// ---------------- 유틸 ----------------
function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}

function highlight(text = "", keyword = "") {
  if (!keyword) return escapeHtml(text);

  const lower = String(text);
  const q = keyword.toLowerCase();
  const idx = lower.toLowerCase().indexOf(q);

  if (idx === -1) return escapeHtml(lower);

  const before = lower.slice(0, idx);
  const match = lower.slice(idx, idx + q.length);
  const after = lower.slice(idx + q.length);

  return (
    escapeHtml(before) +
    `<span class="search-highlight">${escapeHtml(match)}</span>` +
    escapeHtml(after)
  );
}

// ---------------- 스켈레톤 / 빈 상태 ----------------
function showSkeleton() {
  if (!listEl) return;

  listEl.innerHTML = "";

  for (let i = 0; i < 6; i += 1) {
    const card = document.createElement("article");
    card.className = "tip-card tip-card--skeleton";

    card.innerHTML = `
      <div class="tip-card__thumb skeleton-animate"></div>
      <div class="tip-card__body">
        <div class="skeleton-block skeleton-animate"></div>
        <div class="skeleton-line w-40 skeleton-animate"></div>
        <div class="skeleton-line w-80 skeleton-animate"></div>
        <div class="skeleton-line w-60 skeleton-animate"></div>
      </div>
    `;

    listEl.appendChild(card);
  }
}

function showEmpty() {
  if (listEl) listEl.innerHTML = "";
  if (emptyEl) emptyEl.hidden = false;
}

function hideEmpty() {
  if (emptyEl) emptyEl.hidden = true;
}

// ---------------- 렌더링 ----------------
function renderPosts() {
  if (!listEl) return;

  listEl.innerHTML = "";

  const keyword = currentKeyword.trim().toLowerCase();

  const filtered = allPosts.filter((post) => {
    if (currentCategory !== "all" && post.category !== currentCategory) {
      return false;
    }

    if (!keyword) return true;

    const haystack = `${post.title || ""} ${post.summary || ""} ${post.category || ""
      }`.toLowerCase();

    return haystack.includes(keyword);
  });

  if (!filtered.length) {
    showEmpty();
    return;
  }

  hideEmpty();

  filtered.forEach((post) => {
    const card = document.createElement("article");
    card.className = "tip-card";

    card.addEventListener("click", () => {
      openModal(post);
    });

    const titleHtml = highlight(post.title || "", keyword);
    const summaryHtml = highlight(post.summary || "", keyword);

    const badge =
      (post.commentsCount || 0) > 0
        ? `<span class="tip-card__badge">댓글 ${post.commentsCount}</span>`
        : "";

    // 썸네일: DB에 thumbnailUrl 없으면 기본 이미지 사용
    const thumbnailUrl =
      post.thumbnailUrl ||
      "https://picsum.photos/seed/sgnet-tip/400/250"; // 필요하면 나중에 파일로 교체

    card.innerHTML = `
      <div class="tip-card__thumb">
        <img
          src="${escapeHtml(thumbnailUrl)}"
          alt="${escapeHtml(post.title || "썸네일")}"
          loading="lazy"
        />
      </div>
      <div class="tip-card__body">
        <div class="tip-card__category">${escapeHtml(
      post.category || "인터넷"
    )}</div>
        <h2 class="tip-card__title">${titleHtml}</h2>
        <p class="tip-card__summary">${summaryHtml}</p>
        <div class="tip-card__meta">
          <span>${escapeHtml(post.nickname || "성지넷")}</span>
          <span class="tip-card__meta-dot"></span>
          <span>조회 ${post.views || 0}</span>
          <span class="tip-card__meta-dot"></span>
          <span>${formatDate(post.createdAt)}</span>
          ${badge}
        </div>
      </div>
    `;

    listEl.appendChild(card);
  });
}

// ---------------- 데이터 로딩 ----------------
async function loadPosts() {
  if (!listEl) return;

  showSkeleton();

  try {
    const snap = await get(ref(db, "/boards/tips"));

    if (!snap.exists()) {
      showEmpty();
      return;
    }

    const raw = snap.val() || {};

    allPosts = Object.entries(raw)
      .map(([id, value]) => ({
        id,
        ...value,
      }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    renderPosts();
  } catch (err) {
    console.error("게시글 목록 로딩 오류:", err);
    if (listEl) {
      listEl.innerHTML =
        '<p style="padding:40px 0;text-align:center;color:#9ca3af;font-size:14px;">게시글을 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.</p>';
    }
  }
}

// ---------------- 이벤트 바인딩 ----------------
filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterButtons.forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    currentCategory = btn.dataset.filter || "all";
    renderPosts();
  });
});

if (searchInput) {
  let timer = null;

  searchInput.addEventListener("input", (e) => {
    currentKeyword = e.target.value || "";
    clearTimeout(timer);
    timer = setTimeout(() => {
      renderPosts();
    }, 120);
  });
}

// ---------------- 모달 로직 ----------------
const viewModal = document.getElementById('view-modal');
const viewCloseBtn = document.getElementById('view-modal-close');

function openModal(post) {
  if (!viewModal) return;

  document.getElementById('view-title').textContent = post.title || '';
  document.getElementById('view-category').textContent = post.category || '기타';
  document.getElementById('view-author').textContent = post.nickname || '성지넷';
  document.getElementById('view-date').textContent = formatDate(post.createdAt);

  // 기존 데이터는 summary 필드 사용, 새 데이터는 contentHtml 사용
  const content = post.contentHtml || post.summary || post.content || '내용이 없습니다.';
  document.getElementById('view-content').innerHTML = content;

  const imgWrapper = document.getElementById('view-img-wrapper');
  const viewImg = document.getElementById('view-img');

  if (post.thumbnailUrl) {
    viewImg.src = post.thumbnailUrl;
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

// ---------------- 초기 실행 ----------------
loadPosts();
