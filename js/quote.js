import { getQuoteById } from './data-service.js';

/**
 * js/quote.js
 * 성지넷 모바일 견적서 페이지 로직
 * - 단축 ID (Firebase) 및 URL 파라미터 (Legacy) 지원
 * - [추가] 상세보기 모달 로직
 * - [수정] 가입하기 버튼 클릭 시 상품명(인터넷+TV) 분리 로직 추가
 */

document.addEventListener('DOMContentLoaded', () => {
    
    /* ==========================================================================
       1. [UI 효과] 자동 증가 로직 (누적 개통 / 고객 만족도)
       ========================================================================== */
    const BASE_DATE = new Date("2024-01-01T00:00:00");
    const CYCLE_HOURS = 8; 

    const OPENING_BASE = 140367;
    const OPENING_INC = 37;

    const REVIEW_BASE = 26577;
    const REVIEW_INC = 4;

    function updateCounts() {
        const now = new Date();
        const diffMs = now - BASE_DATE;
        const diffHours = diffMs / (1000 * 60 * 60);
        const cyclesPassed = Math.floor(diffHours / CYCLE_HOURS);
        
        const currentOpening = OPENING_BASE + (cyclesPassed * OPENING_INC);
        const openingEl = document.getElementById('opening-count');
        if(openingEl) openingEl.textContent = currentOpening.toLocaleString() + '건';

        const currentReview = REVIEW_BASE + (cyclesPassed * REVIEW_INC);
        const reviewEl = document.getElementById('review-count');
        if(reviewEl) reviewEl.textContent = `(${currentReview.toLocaleString()}건)`;
    }

    /* ==========================================================================
       2. [UI 효과] 현재 시간 표시
       ========================================================================== */
    function updateCurrentTime() {
        const now = new Date();
        const options = { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        const timeString = now.toLocaleDateString('ko-KR', options);
        const timeEl = document.getElementById('current-time');
        if(timeEl) timeEl.textContent = timeString;
    }
    
    /* ==========================================================================
       3. [핵심 로직] 데이터 주입 (단축 ID 및 URL 파라미터 지원)
       ========================================================================== */
    async function loadQuoteData() {
        const params = new URLSearchParams(window.location.search);
        const shortId = params.get('id'); 
        
        let data = {};

        // [Case A] 단축 ID가 있는 경우: Firebase에서 데이터 로드
        if (shortId) {
            try {
                const dbData = await getQuoteById(shortId);
                
                if (dbData) {
                    data = {
                        name: dbData.name,
                        carrier: dbData.carrier,
                        product: dbData.product,
                        tv: dbData.tv || '',
                        originalPrice: dbData.originalPrice,
                        finalPrice: dbData.price, 
                        baseGift: dbData.gift,
                        secretGift: dbData.secret,
                        saving: dbData.saving,
                        
                        manager: dbData.manager,
                        managerImg: dbData.managerImg,
                        phone: dbData.phone,
                        team: dbData.team,
                        role: dbData.role,
                        // [추가] DB에서 카톡 링크 읽기
                        managerKakao: dbData.managerKakao,
                    };
                } else {
                    alert("유효하지 않거나 만료된 견적서 링크입니다.");
                }
            } catch (e) {
                console.error("견적 데이터 로딩 실패:", e);
                alert("견적 정보를 불러오는 중 오류가 발생했습니다.");
            }
        } 
        // [Case B] ID가 없는 경우: URL 파라미터에서 직접 파싱
        else {
            data = {
                name: params.get('name') || params.get('customer') || '고객',
                carrier: params.get('carrier') || params.get('telecom') || '통신사',
                product: params.get('product') || params.get('internet') || '인터넷 + TV',
                tv: params.get('tv') || '', 
                originalPrice: params.get('originalPrice') || '0',
                finalPrice: params.get('price') || params.get('fee') || '0',
                baseGift: params.get('gift') || '0',
                secretGift: params.get('secret') || '0',
                saving: params.get('saving') || '0',
                manager: params.get('manager') || '상담사',
                managerImg: params.get('managerImg') || 'assets/images/manager_placeholder.png',
                phone: params.get('phone') || '1644-6780',
                team: params.get('team') || '솔루션제안팀',
                role: params.get('role') || 'MANAGER',
                // [추가] 파라미터에서 카톡 링크 읽기
                managerKakao: params.get('kakao'),
            };
        }

        // --- DOM 렌더링 ---
        const safeSetText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        safeSetText('customer-name', data.name);
        safeSetText('plan-carrier', data.carrier);
        safeSetText('telecom-name', data.carrier); 
        safeSetText('plan-product', data.product);
        safeSetText('internet-plan', data.product); 
        safeSetText('tv-plan', data.tv || '기본 TV');

        safeSetText('original-price', Number(data.originalPrice || 0).toLocaleString() + '원');
        safeSetText('final-price', Number(data.finalPrice || 0).toLocaleString() + '원');
        safeSetText('monthly-fee', Number(data.finalPrice || 0).toLocaleString() + '원'); 
        
        safeSetText('base-gift', Number(data.baseGift || 0).toLocaleString() + '원');
        safeSetText('gift-amount', Number(data.baseGift || 0).toLocaleString() + '원'); 
        
        safeSetText('secret-gift', Number(data.secretGift || 0).toLocaleString() + '원');
        safeSetText('total-saving', Number(data.saving || 0).toLocaleString() + '원');

        safeSetText('manager-name', data.manager);
        safeSetText('manager-team', data.team);
        safeSetText('manager-role', data.role);
        safeSetText('manager-position', data.role); 

        const imgEl = document.getElementById('manager-img') || document.getElementById('manager-photo');
        if(imgEl && data.managerImg) imgEl.src = data.managerImg;

        // --- [추가] 상세보기 모달 로직 ---
        const btnDetail = document.getElementById('btn-open-detail');
        const modal = document.getElementById('quote-detail-modal');
        const btnClose = modal ? modal.querySelector('.btn-close-modal') : null;

        if (btnDetail && modal) {
            btnDetail.addEventListener('click', () => {
                const original = Number(data.originalPrice || 0);
                const final = Number(data.finalPrice || 0);
                const discount = original - final;

                document.getElementById('modal-original-price').textContent = original.toLocaleString() + '원';
                document.getElementById('modal-discount-price').textContent = '-' + discount.toLocaleString() + '원';
                document.getElementById('modal-final-price').textContent = final.toLocaleString() + '원';
                
                modal.classList.add('visible');
            });
        }

        if (btnClose) {
            btnClose.addEventListener('click', () => {
                modal.classList.remove('visible');
            });
        }
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('visible');
            });
        }

        // --- [버튼 이벤트 1] 상담사 연결 ---
        const callBtns = document.querySelectorAll('#btn-call, .btn-call');
        callBtns.forEach(btn => {
            const cleanPhone = (data.phone || '1644-6780').replace(/[^0-9]/g, '');
            if (btn.tagName === 'A') {
                btn.href = `tel:${cleanPhone}`;
            } else {
                btn.addEventListener('click', () => {
                    window.location.href = `tel:${cleanPhone}`;
                });
            }
        });

        // --- [추가] 카톡 문의 버튼 링크 변경 로직 ---
        const kakaoBtn = document.querySelector('.btn-kakao');
        if (kakaoBtn) {
            if (data.managerKakao && data.managerKakao.trim() !== "") {
                // 상담사 전용 링크가 있으면 교체
                kakaoBtn.href = data.managerKakao;
                kakaoBtn.target = "_blank";
            } else {
                // 없으면 기본 채널 링크 유지 (HTML에 적힌 것)
                // 필요하다면 여기서 기본 링크를 강제로 지정해도 됨
                // kakaoBtn.href = "https://pf.kakao.com/_pqxnxmT"; 
            }
        }

        // --- [버튼 이벤트 2] 가입하기 (signup.html 연결) ---
        const signupBtn = document.getElementById('btn-self-signup') || document.getElementById('btn-apply');
        if(signupBtn) {
            signupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                
                const targetParams = new URLSearchParams();
                targetParams.set('telecom', data.carrier);

                // [수정] 상품명(product)에서 인터넷과 TV 정보 분리
                // 예: "500M + 이코노미" -> 인터넷: "500M", TV: "이코노미"
                let finalInternet = data.product;
                let finalTv = data.tv;

                // TV 정보가 없거나 'TV 정보 없음'이고, 상품명에 '+'가 포함된 경우 분리 시도
                if ((!finalTv || finalTv === 'TV 정보 없음') && finalInternet && finalInternet.includes('+')) {
                    const parts = finalInternet.split('+');
                    if (parts.length > 1) {
                        finalInternet = parts[0].trim();
                        // '+' 뒤에 있는 모든 내용을 TV 정보로 간주
                        finalTv = parts.slice(1).join('+').trim();
                    }
                }

                targetParams.set('internet', finalInternet);
                targetParams.set('tv', finalTv || '미신청'); // 값이 없으면 '미신청'으로 설정
                targetParams.set('totalPrice', data.finalPrice);
                targetParams.set('supportFund', data.baseGift);
                targetParams.set('mName', data.manager);

                window.location.href = `signup.html?${targetParams.toString()}`;
            });
        }
    }

    /* ==========================================================================
       4. [UI 효과] 비밀 혜택 인터랙션 (카드 뒤집기)
       ========================================================================== */
    const secretCard = document.getElementById('secret-card');
    if(secretCard) {
        secretCard.addEventListener('click', () => {
            if(!secretCard.classList.contains('unlocked')) {
                secretCard.classList.add('unlocked');
                if(navigator.vibrate) navigator.vibrate(50);
            }
        });
    }

    // 초기화 실행
    updateCounts();
    updateCurrentTime();
    loadQuoteData(); 
    
    setTimeout(() => {
        const container = document.querySelector('.quote-container') || document.querySelector('.container');
        if(container) container.classList.add('loaded');
    }, 100);
});