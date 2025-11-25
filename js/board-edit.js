// js/board-edit.js
// 꿀팁 수정 페이지

import { firebaseConfig } from './config.js';
import {
  initializeApp,
  getApps,
  getApp
} from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js';
import {
  getDatabase,
  ref,
  get,
  update
} from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);

const params = new URLSearchParams(location.search);
const postId = params.get('id');

const form = document.getElementById('tip-edit-form');
const msgEl = document.getElementById('save-message');
const cancelBtn = document.getElementById('btn-cancel');

let currentPost = null;

function showMessage(text, isError = false) {
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.style.color = isError ? '#dc2626' : '#6b7280';
}

function setRadio(name, value) {
  const list = document.querySelectorAll(`input[name="${name}"]`);
  list.forEach((el) => {
    el.checked = el.value === value;
  });
}

function htmlToTextareaContent(html) {
  if (!html) return '';
  // <br> 또는 <br />를 줄바꿈으로
  return html
    .replace(/<br\s*\/?>(\r?\n)?/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}

async function loadPost() {
  if (!postId) {
    showMessage('잘못된 접근입니다.', true);
    return;
  }

  try {
    const snap = await get(ref(db, `/boards/tips/${postId}`));
    if (!snap.exists()) {
      showMessage('게시글을 찾을 수 없습니다.', true);
      return;
    }

    currentPost = snap.val();

    setRadio('category', currentPost.category || '인터넷');
    form.title.value = currentPost.title || '';
    form.summary.value = currentPost.summary || '';
    form.thumbnailUrl.value = currentPost.thumbnailUrl || '';
    form.nickname.value = currentPost.nickname || '';
    form.content.value = htmlToTextareaContent(currentPost.contentHtml);

  } catch (err) {
    console.error('게시글 불러오기 오류:', err);
    showMessage('게시글을 불러오는 중 오류가 발생했습니다.', true);
  }
}

cancelBtn?.addEventListener('click', () => {
  if (postId) {
    location.href = `tip-view.html?id=${postId}`;
  } else {
    history.back();
  }
});

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!postId || !currentPost) {
    showMessage('잘못된 접근입니다.', true);
    return;
  }

  const formData = new FormData(form);
  const category = formData.get('category') || '인터넷';
  const title = (formData.get('title') || '').toString().trim();
  const summary = (formData.get('summary') || '').toString().trim();
  const thumbnailUrl = (formData.get('thumbnailUrl') || '').toString().trim();
  const nickname = (formData.get('nickname') || '').toString().trim() || '성지넷';
  const content = (formData.get('content') || '').toString().trim();

  if (!title) {
    showMessage('제목을 입력해 주세요.', true);
    return;
  }
  if (!content) {
    showMessage('본문 내용을 입력해 주세요.', true);
    return;
  }

  showMessage('수정 내용을 저장 중입니다...');

  const updated = {
    category,
    title,
    summary,
    thumbnailUrl: thumbnailUrl || currentPost.thumbnailUrl || '',
    nickname,
    contentHtml: content.replace(/\n/g, '<br />')
  };

  try {
    await update(ref(db, `/boards/tips/${postId}`), updated);
    showMessage('수정이 완료되었습니다. 잠시 후 상세 페이지로 이동합니다.');

    setTimeout(() => {
      location.href = `tip-view.html?id=${postId}`;
    }, 600);
  } catch (err) {
    console.error('게시글 수정 오류:', err);
    showMessage('수정 저장 중 오류가 발생했습니다.', true);
  }
});

loadPost();
