import { initializeUI } from './ui-interactions.js';
import { getFullData, getManagers, addCustomerLead } from './data-service.js';
import { initMainCalculator } from './main-calculator.js';
import { initAiCalculator } from './ai-calculator.js';
import { initBoard } from './board.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const telecomData = await getFullData();
        initializeUI(telecomData);
        initMainCalculator(telecomData);
        initAiCalculator(telecomData);
        initBoard();

        setupManagerMode();
        setupBoardTabs();

        setupQuickConsultWidget();
        setupExitIntent();
        setupEventButtons();
        setupConsultationModal();

        console.log("All systems initialized successfully.");
    } catch (error) {
        console.error("애플리케이션 초기화 중 오류 발생:", error);
    }
});

// --- 1. 퀵메뉴 간편 상담 위젯 로직 ---
function setupQuickConsultWidget() {
    const form = document.getElementById('quick-sidebar-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('quick-sb-name');
        const phoneInput = document.getElementById('quick-sb-phone');
        const btn = form.querySelector('button');

        if (!nameInput.value || !phoneInput.value) { alert('이름과 연락처를 입력해주세요.'); return; }

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '전송 중...';

        const savedInfo = localStorage.getItem('activeManagerInfo');
        const managerId = savedInfo ? JSON.parse(savedInfo).id : null;

        const leadData = {
            name: nameInput.value,
            phone: phoneInput.value,
            product: '간편상담요청(사이드바)',
            source: 'quick_widget'
        };

        try {
            const success = await addCustomerLead(managerId, leadData);

            if (success) {
                alert('상담 신청이 접수되었습니다.\\n빠르게 연락드리겠습니다!');
                nameInput.value = '';
                phoneInput.value = '';
            } else {
                alert('오류가 발생했습니다. 다시 시도해주세요.');
            }
        } catch (error) {
            console.error(error);
            alert('오류가 발생했습니다.');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}

// --- 2. 이탈 방지 팝업 (Exit Intent) ---
function setupExitIntent() {
    if (sessionStorage.getItem('exitPopupShown')) return;

    const showExitPopup = () => {
        if (sessionStorage.getItem('exitPopupShown')) return;

        if (window.globalModal) {
            window.globalModal.open('exit-intent-modal');
            sessionStorage.setItem('exitPopupShown', 'true');
        }
    };

    document.addEventListener('mouseleave', (e) => {
        if (e.clientY < 0) {
            showExitPopup();
        }
    });

    const stayBtn = document.getElementById('btn-exit-stay');
    if (stayBtn) {
        stayBtn.addEventListener('click', () => {
            if (window.globalModal) {
                window.globalModal.close('exit-intent-modal');
                openConsultationModal('이탈방지팝업');
            }
        });
    }
}

// --- 3. 이벤트/배너 등에서 상담 신청 연결 ---
function setupEventButtons() {
    document.querySelectorAll('.btn-event-details').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const eventName = btn.dataset.event === 'event1' ? '지인추천이벤트' : '후기이벤트';
            openConsultationModal(`이벤트신청_${eventName}`);
        });
    });
}

// --- 4. 공통 상담 신청 모달 로직 ---
function setupConsultationModal() {
    const form = document.getElementById('consult-form');
    const phoneInput = document.getElementById('consult-phone');

    if (!form) return;

    // 연락처 자동 하이픈
    const autoHyphen = (target) => {
        target.value = target.value
            .replace(/[^0-9]/g, '')
            .replace(/^(\d{0,3})(\d{0,4})(\d{0,4})$/g, "$1-$2-$3").replace(/(\-{1,2})$/g, "");
    }
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => autoHyphen(e.target));
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('consult-name');
        const sourceInput = document.getElementById('consult-source');
        const btn = form.querySelector('button');

        if (!nameInput.value || !phoneInput.value) return;

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '접수 중...';

        const savedInfo = localStorage.getItem('activeManagerInfo');
        const managerId = savedInfo ? JSON.parse(savedInfo).id : null;

        const leadData = {
            name: nameInput.value,
            phone: phoneInput.value,
            product: `상담요청(${sourceInput.value})`,
            source: 'consult_modal'
        };

        try {
            const success = await addCustomerLead(managerId, leadData);

            if (success) {
                alert('신청이 완료되었습니다.\\n담당자가 확인 후 연락드리겠습니다.');
                if (window.globalModal) window.globalModal.close('consultation-modal');
                nameInput.value = '';
                phoneInput.value = '';
            } else {
                alert('오류가 발생했습니다.');
            }
        } catch (error) {
            console.error(error);
            alert('오류가 발생했습니다.');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}

// 전역 함수로 등록
window.openConsultationModal = function (sourceName) {
    const modal = document.getElementById('consultation-modal');
    const sourceInput = document.getElementById('consult-source');
    const title = document.getElementById('consult-modal-title');

    if (modal && window.globalModal) {
        if (sourceInput) sourceInput.value = sourceName || '일반';

        // 이탈방지팝업에서 호출된 경우 타이틀 변경
        if (sourceName === '이탈방지팝업') {
            if (title) title.textContent = '쉿! 비밀지원금 즉시문의';
        } else {
            if (title) title.textContent = sourceName ? `${sourceName} 상담` : '무료 상담 신청';
        }

        window.globalModal.open('consultation-modal');
    }
};

// --- 게시판 탭 로직 + 네비게이션 ---
function setupBoardTabs() {
    const tabs = document.querySelectorAll('.board-tab');

    if (tabs.length > 0) {
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const boardType = tab.dataset.board;
                const titleEl = document.getElementById('board-title');
                const subtitleEl = document.getElementById('board-subtitle');

                if (boardType === 'tips') {
                    if (titleEl) titleEl.textContent = '꿀팁 게시판';
                    if (subtitleEl) subtitleEl.textContent = '인터넷 가입 전 꼭 알아야 할 알짜 정보만 모았습니다.';
                } else if (boardType === 'reviews') {
                    if (titleEl) titleEl.textContent = '생생 후기';
                    if (subtitleEl) subtitleEl.textContent = '실제 고객들의 생생한 가입 후기를 확인하세요.';
                }

                window.dispatchEvent(new CustomEvent('boardTabChanged', { detail: { boardType } }));
            });
        });
    }

    // 네비게이션 메뉴에서 게시판 링크 클릭 시 처리
    const tipsNavLink = document.getElementById('tips-board-nav-link');
    const reviewsNavLink = document.getElementById('reviews-board-nav-link');
    const boardViewWrapper = document.getElementById('board-view-wrapper');

    function showBoardSection(boardType) {
        // 모든 섹션 숨기기
        const sectionsToHide = ['hero-section', 'quick-nav-section', 'ai-scanner-section', 'calculator-section'];
        sectionsToHide.forEach(id => {
            const section = document.getElementById(id);
            if (section) section.style.display = 'none';
        });

        // 게시판 섹션 표시
        if (boardViewWrapper) {
            boardViewWrapper.style.display = 'block';

            // 탭 활성화
            const targetTab = document.querySelector(`.board-tab[data-board="${boardType}"]`);
            if (targetTab) {
                tabs.forEach(t => t.classList.remove('active'));
                targetTab.classList.add('active');
                targetTab.click();
            }

            // 스크롤
            setTimeout(() => {
                boardViewWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }

    if (tipsNavLink) {
        tipsNavLink.addEventListener('click', (e) => {
            e.preventDefault();
            showBoardSection('tips');
        });
    }

    if (reviewsNavLink) {
        reviewsNavLink.addEventListener('click', (e) => {
            e.preventDefault();
            showBoardSection('reviews');
        });
    }
}

// --- 상담사 모드 로직 ---
function setupManagerMode() {
    const secretTrigger = document.getElementById('admin-secret-trigger');
    const modal = document.getElementById('manager-login-modal');
    const saveBtn = document.getElementById('btn-manager-save');
    const select = document.getElementById('manager-select-input');
    const passwordInput = document.getElementById('manager-password');
    const closeBtn = modal ? modal.querySelector('.modal-close-btn') : null;

    if (!secretTrigger || !modal) return;

    const savedManagerInfo = localStorage.getItem('activeManagerInfo');
    if (savedManagerInfo) {
        try {
            const manager = JSON.parse(savedManagerInfo);
            activateManagerMode(manager);
        } catch (e) {
            localStorage.removeItem('activeManagerInfo');
        }
    }

    let clickCount = 0;
    let clickTimer = null;

    secretTrigger.addEventListener('click', () => {
        clickCount++;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickCount = 0; }, 2000);

        if (clickCount >= 5) {
            clickCount = 0;
            openModal();
        }
    });

    async function openModal() {
        modal.classList.add('visible');
        modal.style.display = 'flex';
        if (passwordInput) passwordInput.value = '';

        select.innerHTML = '<option value="">로딩 중...</option>';
        select.disabled = true;

        try {
            const managers = await getManagers();
            select.innerHTML = '<option value="">선택해주세요</option>';
            select.disabled = false;

            if (!managers || managers.length === 0) {
                const opt = document.createElement('option');
                opt.text = "등록된 상담사가 없습니다";
                select.add(opt);
            } else {
                managers.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = `${m.name} (${m.team})`;
                    select.appendChild(opt);
                });
            }

            const savedId = localStorage.getItem('activeManagerId');
            if (savedId) {
                const exists = managers.some(m => String(m.id) === String(savedId));
                if (exists) select.value = savedId;
            }

        } catch (error) {
            console.error("상담사 목록 로딩 실패:", error);
            select.innerHTML = '<option value="">목록 로딩 실패</option>';
        }
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const selectedId = select.value;
            const password = passwordInput ? passwordInput.value : '';
            const ADMIN_PASSWORD = "a0909";

            if (!selectedId) {
                if (confirm("상담사 설정을 해제하시겠습니까?")) {
                    localStorage.removeItem('activeManagerId');
                    localStorage.removeItem('activeManagerInfo');
                    document.body.classList.remove('manager-mode');
                    closeModal();
                    alert("일반 고객 모드로 전환되었습니다.");
                }
                return;
            }

            if (password !== ADMIN_PASSWORD) {
                alert("비밀번호가 일치하지 않습니다.");
                return;
            }

            try {
                const managers = await getManagers();
                const selectedManager = managers.find(m => String(m.id) === String(selectedId));

                if (selectedManager) {
                    localStorage.setItem('activeManagerId', selectedId);
                    localStorage.setItem('activeManagerInfo', JSON.stringify(selectedManager));

                    activateManagerMode(selectedManager);
                    closeModal();
                    alert(`[인증 성공] ${selectedManager.name}님 환영합니다.`);
                } else {
                    alert("선택하신 상담사 정보를 찾을 수 없습니다.");
                }
            } catch (e) {
                alert("인증 처리 중 오류가 발생했습니다.");
            }
        });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    function closeModal() {
        modal.classList.remove('visible');
        modal.style.display = 'none';
    }

    function activateManagerMode(manager) {
        document.body.classList.add('manager-mode');
        secretTrigger.style.color = '#007bff';
        secretTrigger.innerHTML = `&copy; 2024 성지넷. All Rights Reserved. <span style="font-size:10px;">(Manager: ${manager.name})</span>`;
    }
}