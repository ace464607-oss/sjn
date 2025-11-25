import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, query, orderByChild } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import { firebaseConfig } from './config.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);

let currentBoard = 'tips';
let selectedFile = null;
let unsubscribe = null;

const state = { allPosts: [], currentPage: 1, itemsPerPage: 9 };

const listContainer = document.getElementById('board-list-container');
const paginationContainer = document.getElementById('pagination');
const writeModal = document.getElementById('write-modal');
const viewModal = document.getElementById('view-modal');
const writeForm = document.getElementById('write-form');
const imgInput = document.getElementById('write-image');
const imgPreview = document.getElementById('img-preview');
const previewContainer = document.getElementById('preview-container');

export function initBoard() {
    console.log("Board System Initialized");

    window.addEventListener('boardTabChanged', (e) => {
        const newType = e.detail.boardType;
        if (currentBoard !== newType) {
            currentBoard = newType;
            state.currentPage = 1;
            loadPosts();
        }
    });

    const writeBtn = document.getElementById('btn-open-write');
    if (writeBtn) {
        writeBtn.addEventListener('click', () => {
            if (writeForm) writeForm.reset();
            selectedFile = null;
            if (previewContainer) previewContainer.style.display = 'none';
            writeModal.classList.add('visible');
            writeModal.style.display = 'flex';
        });
    }

    setupWriteFormListeners();
    loadPosts();
}

function loadPosts() {
    if (unsubscribe) unsubscribe();
    const postsRef = query(ref(db, `boards/${currentBoard}`), orderByChild('createdAt'));

    unsubscribe = onValue(postsRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            state.allPosts = [];
        } else {
            state.allPosts = Object.entries(data)
                .map(([key, value]) => ({ id: key, ...value }))
                .sort((a, b) => b.createdAt - a.createdAt);
        }
        renderBoardList();
    });
}

function renderBoardList() {
    if (!listContainer) return;
    listContainer.innerHTML = "";

    if (state.allPosts.length === 0) {
        listContainer.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:60px 20px; color:#888;"><i class="fas fa-folder-open" style="font-size:40px; margin-bottom:15px; color:#ddd;"></i><p>등록된 게시글이 없습니다.<br>첫 번째 글을 작성해보세요!</p></div>`;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    const currentItems = state.allPosts.slice(startIndex, endIndex);

    currentItems.forEach(post => {
        listContainer.appendChild(createCardHTML(post));
    });
    renderPagination(state.allPosts.length);
}

function createCardHTML(post) {
    const div = document.createElement('div');
    div.className = 'board-card';

    const hasImage = (post.imageUrl && post.imageUrl !== '') || (post.thumbnailUrl && post.thumbnailUrl !== '');
    const thumbContent = hasImage
        ? `<img src="${post.imageUrl || post.thumbnailUrl}" alt="썸네일">`
        : `<div style="width:100%; height:100%; background:#f1f3f5; display:flex; align-items:center; justify-content:center; color:#adb5bd;"><i class="fas fa-image" style="font-size:40px;"></i></div>`;

    const dateStr = new Date(post.createdAt).toLocaleDateString();

    div.innerHTML = `
        <div class="board-thumb">${thumbContent}<span class="board-tag">${post.category}</span></div>
        <div class="board-info">
            <h3 class="board-title">${escapeHtml(post.title)}</h3>
            <p class="board-desc">${escapeHtml(post.summary || post.content)}</p>
            <div class="board-meta"><span>${escapeHtml(post.author || post.nickname || '익명')}</span><span>${dateStr}</span></div>
        </div>
    `;
    div.addEventListener('click', () => openViewModal(post));
    return div;
}

function renderPagination(totalItems) {
    if (!paginationContainer) return;
    paginationContainer.innerHTML = "";
    const totalPages = Math.ceil(totalItems / state.itemsPerPage);
    if (totalPages <= 1) return;

    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="page-btn ${i === state.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    paginationContainer.innerHTML = html;

    paginationContainer.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            state.currentPage = parseInt(e.target.dataset.page);
            renderBoardList();
            listContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

function setupWriteFormListeners() {
    if (imgInput) {
        imgInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                selectedFile = e.target.files[0];
                const reader = new FileReader();
                reader.onload = (evt) => {
                    if (imgPreview) imgPreview.src = evt.target.result;
                    if (previewContainer) previewContainer.style.display = 'block';
                };
                reader.readAsDataURL(selectedFile);
            }
        });
    }

    const removeImgBtn = document.getElementById('btn-remove-img');
    if (removeImgBtn) {
        removeImgBtn.addEventListener('click', () => {
            if (imgInput) imgInput.value = '';
            selectedFile = null;
            if (previewContainer) previewContainer.style.display = 'none';
        });
    }

    if (writeForm) {
        writeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await savePost();
        });
    }
}

async function savePost() {
    const submitBtn = document.getElementById('btn-submit-post');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장 중...';

    try {
        const title = document.getElementById('write-title').value;
        const author = document.getElementById('write-author').value;
        const password = document.getElementById('write-password').value;
        const content = document.getElementById('write-content').value;
        const category = document.getElementById('write-category').value;
        let imageUrl = '';

        if (selectedFile) {
            const fileName = `${Date.now()}_${selectedFile.name}`;
            const storageRef = sRef(storage, `board_images/${currentBoard}/${fileName}`);
            const snapshot = await uploadBytes(storageRef, selectedFile);
            imageUrl = await getDownloadURL(snapshot.ref);
        }

        const newPostRef = push(ref(db, `boards/${currentBoard}`));
        await set(newPostRef, {
            title, author, password, content, category, imageUrl,
            createdAt: Date.now(), views: 0
        });

        alert('게시글이 등록되었습니다!');
        closeModal(writeModal);
        writeForm.reset();
        selectedFile = null;
        if (previewContainer) previewContainer.style.display = 'none';

    } catch (error) {
        console.error(error);
        alert('저장 실패: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = '등록하기';
    }
}

function openViewModal(post) {
    if (!viewModal) return;
    document.getElementById('view-title').innerText = post.title;
    document.getElementById('view-author').innerText = post.author || post.nickname || '익명';
    document.getElementById('view-date').innerText = new Date(post.createdAt).toLocaleDateString();
    document.getElementById('view-category').innerText = post.category;

    // 다양한 필드명 지원 (contentHtml, summary, content)
    const content = post.contentHtml || post.summary || post.content || '내용이 없습니다.';
    document.getElementById('view-content').innerHTML = content;

    const imgWrapper = document.getElementById('view-img-wrapper');
    const viewImg = document.getElementById('view-img');

    if (post.imageUrl || post.thumbnailUrl) {
        viewImg.src = post.imageUrl || post.thumbnailUrl;
        imgWrapper.style.display = 'block';
    } else {
        imgWrapper.style.display = 'none';
    }

    // [신규] 게시글 하단 상담 유도 배너 추가
    let banner = document.getElementById('board-consult-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'board-consult-banner';
        banner.className = 'board-consult-banner';
        document.getElementById('view-content').after(banner);
    }

    banner.innerHTML = `
        <div class="banner-content">
            <p>이 후기처럼 <strong>최대 혜택</strong> 받고 싶다면?</p>
            <button onclick="window.openConsultationModal('게시판_${post.category}')">
                내 혜택 확인하기 <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;

    const oldBtn = document.getElementById('btn-delete-post');
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    newBtn.addEventListener('click', () => deletePost(post));

    viewModal.classList.add('visible');
    viewModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

async function deletePost(post) {
    const inputPw = prompt('비밀번호를 입력하세요:');
    if (inputPw === null) return;

    if (inputPw === post.password) {
        if (confirm('정말 삭제하시겠습니까?')) {
            try {
                await remove(ref(db, `boards/${currentBoard}/${post.id}`));
                alert('삭제되었습니다.');
                closeModal(viewModal);
            } catch (error) {
                alert('오류 발생: ' + error.message);
            }
        }
    } else {
        alert('비밀번호가 일치하지 않습니다.');
    }
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ========== 모달 닫기 로직 ==========
function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('visible');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// 모달 닫기 버튼들 연결
if (writeModal) {
    const writeCloseBtn = writeModal.querySelector('.modal-close-btn');
    if (writeCloseBtn) {
        writeCloseBtn.addEventListener('click', () => closeModal(writeModal));
    }
    writeModal.addEventListener('click', (e) => {
        if (e.target === writeModal) closeModal(writeModal);
    });
}

if (viewModal) {
    const viewCloseBtn = viewModal.querySelector('.modal-close-btn');
    if (viewCloseBtn) {
        viewCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeModal(viewModal);
        });
    }
    viewModal.addEventListener('click', (e) => {
        if (e.target === viewModal) closeModal(viewModal);
    });
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (viewModal && viewModal.classList.contains('visible')) {
            closeModal(viewModal);
        }
        if (writeModal && writeModal.classList.contains('visible')) {
            closeModal(writeModal);
        }
    }
});