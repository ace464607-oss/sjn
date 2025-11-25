import { getManagers, getCustomersByManager, updateCustomerStatus, createShortQuote, assignCustomerToManager, getFullData, update, ref, db } from './data-service.js';

// ============================================================
// [1] 전역 변수 및 설정
// ============================================================
let currentManager = null;
let currentView = 'my'; // 'my' or 'unassigned'
let globalTelecomData = null; // DB 데이터 캐싱
let editingCustomer = null; // 현재 작업 중인 고객
let expertResults = []; // 견적 결과 저장
let mobileLines = []; // 가족 구성원 요금제 배열 (스마트 태그)

// ============================================================
// [2] 핵심 할인 정책 상수 (계산 로직의 기준)
// ============================================================

// [LG U+]
const LG_TOGETHER_MIN_PRICE = 80000; 
const LG_TOGETHER_PER_LINE = { 2: 10000, 3: 14000, 4: 20000, 5: 20000 }; 
const LG_CHAM_MATRIX = { 
    1: [0, 0, 0], 2: [2200, 3300, 4400], 3: [3300, 5500, 6600], 
    4: [4400, 6600, 8800], 5: [4400, 6600, 8800] 
}; 
const LG_TOGETHER_YOUTH_DISCOUNT = 10000; // 청소년 추가 할인

// [KT]
const KT_PREMIUM_MIN_PRICE = 77000; 
const KT_TOTAL_TIERS = { 
    tiers: [22000, 64900, 108900, 141900, 174900, Infinity], 
    '100M': { internet: [1650, 3300, 5500, 5500, 5500, 5500], mobile: [0, 0, 3300, 14300, 18700, 23100] }, 
    '500M+': { internet: [2200, 5500, 5500, 5500, 5500, 5500], mobile: [0, 0, 5500, 16610, 22110, 27610] } 
}; 
const KT_YOUTH_DISCOUNT = 5500; // 청소년 추가 할인

// [SK] 요즘가족결합 (이미지 기반 정확한 금액 반영)
const SK_FAMILY_MOBILE = { 
    1: 0, 
    2: 9900, 
    3: 19800, 
    4: 30800, 
    5: 41800 
}; 

// ============================================================
// [3] 초기화 및 이벤트 리스너
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const loginOverlay = document.getElementById('login-overlay');
    const crmApp = document.getElementById('crm-app');
    const managerSelect = document.getElementById('manager-select');
    const loginBtn = document.getElementById('btn-login');
    const pwInput = document.getElementById('manager-pw');

    try {
        globalTelecomData = await getFullData();
        console.log("통신사 데이터 로드 완료");
    } catch (e) {
        console.error("통신사 데이터 로드 실패", e);
    }

    try {
        const managers = await getManagers();
        managers.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${m.name} (${m.team})`;
            managerSelect.appendChild(opt);
        });
        
        // 로그인 유지 로직
        const savedManagerId = localStorage.getItem('activeManagerId');
        if (savedManagerId) {
            const savedManager = managers.find(m => m.id === savedManagerId);
            if (savedManager) {
                currentManager = savedManager;
                loginOverlay.style.display = 'none';
                crmApp.style.display = 'block';
                initDashboard();
            }
        }
        
        const handleLogin = () => {
            const selectedId = managerSelect.value;
            const pw = pwInput.value;

            if (pw === 'a0909' && selectedId) {
                currentManager = managers.find(m => m.id === selectedId);
                if(currentManager) {
                    localStorage.setItem('activeManagerId', selectedId);
                    localStorage.setItem('activeManagerInfo', JSON.stringify(currentManager));
                    
                    loginOverlay.style.display = 'none';
                    crmApp.style.display = 'block';
                    initDashboard();
                } else {
                    alert('상담사 정보를 찾을 수 없습니다.');
                }
            } else {
                alert('비밀번호가 틀렸거나 상담사를 선택하지 않았습니다.');
            }
        };

        loginBtn.addEventListener('click', handleLogin);
        pwInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') handleLogin();
        });

    } catch (e) {
        console.error("초기화 실패", e);
        alert("데이터를 불러오는데 실패했습니다.");
    }

    document.querySelectorAll('.btn-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-overlay').classList.remove('visible');
        });
    });
});

window.logout = function() {
    localStorage.removeItem('activeManagerId');
    localStorage.removeItem('activeManagerInfo');
    location.reload();
};

function initDashboard() {
    document.getElementById('display-name').textContent = currentManager.name;
    document.getElementById('display-team').textContent = currentManager.team;
    
    const imgEl = document.getElementById('display-img');
    if(imgEl) {
        const fallbackImg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYzAtMi42Ni01LjMzLTQtOC00eiIvPjwvc3ZnPg==';
        imgEl.onerror = function() { this.onerror = null; this.src = fallbackImg; };
        if (!currentManager.img || currentManager.img.trim() === '') imgEl.src = fallbackImg;
        else imgEl.src = currentManager.img;
    }
    switchTab('my');
}

// ============================================================
// [4] 고객 리스트 및 상태 관리
// ============================================================
window.switchTab = function(viewType) {
    currentView = viewType;
    document.getElementById('tab-my').classList.toggle('active', viewType === 'my');
    document.getElementById('tab-new').classList.toggle('active', viewType === 'unassigned');
    loadCustomers();
};

window.reloadCurrentTab = function() { loadCustomers(); };

window.loadCustomers = async function() {
    const listContainer = document.getElementById('customer-list');
    listContainer.innerHTML = '<div class="spinner"></div>';
    
    try {
        const targetId = currentView === 'my' ? (currentManager ? currentManager.id : null) : 'unassigned';
        if (!targetId) throw new Error("상담사 ID 확인 불가");

        const customers = await getCustomersByManager(targetId);
        
        if (currentView === 'my') updateStats(customers);
        else {
            const countEl = document.getElementById('list-count');
            if(countEl) countEl.textContent = customers ? customers.length : 0;
        }

        listContainer.innerHTML = ''; 

        if (!customers || customers.length === 0) {
            const msg = currentView === 'my' ? "배정된 고객이 없습니다." : "신규 문의가 없습니다.";
            listContainer.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><i class="far fa-folder-open"></i><p>${msg}</p></div>`;
            return;
        }

        customers.forEach(c => {
            const dateObj = new Date(c.createdAt);
            const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            let customerData = '{}';
            try { customerData = encodeURIComponent(JSON.stringify(c)); } catch (err) {}

            let actionButtons = '';
            if (currentView === 'unassigned') {
                actionButtons = `
                    <button class="btn-action" style="background:#10B981; color:white;" onclick="assignToMe('${c.id}')">
                        <i class="fas fa-download"></i> 내 고객으로 가져오기
                    </button>
                `;
            } else {
                actionButtons = `
                    <div style="display:flex; gap:5px; margin-bottom:5px;">
                        <select class="status-select" onchange="changeStatus('${c.id}', this.value)" style="flex:1;">
                            <option value="접수" ${c.status==='접수'?'selected':''}>🔵 접수</option>
                            <option value="상담중" ${c.status==='상담중'?'selected':''}>🟡 상담중</option>
                            <option value="가입완료" ${c.status==='가입완료'?'selected':''}>🟢 가입완료</option>
                            <option value="취소" ${c.status==='취소'?'selected':''}>🔴 취소</option>
                        </select>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button class="btn-action" style="background:#6B7280; color:white;" onclick="openQuoteBuilder('${c.id}')">
                            <i class="fas fa-edit"></i> 수정
                        </button>
                        <button class="btn-action" style="background:#4F46E5; color:white;" onclick="openExpertQuote('${c.id}')">
                            <i class="fas fa-calculator"></i> 비교
                        </button>
                        <button class="btn-action btn-sms" onclick="openSMSModal(JSON.parse(decodeURIComponent('${customerData}')))">
                            <i class="fas fa-comment-dots"></i> 문자
                        </button>
                    </div>
                `;
            }

            const div = document.createElement('div');
            div.className = 'customer-card';
            div.innerHTML = `
                <div class="card-header">
                    <div class="cust-name">${c.name || '고객'} <span style="font-size:12px; color:#666; font-weight:normal;">(${c.source || '웹'})</span></div>
                    <div class="cust-time">${dateStr}</div>
                </div>
                <div class="cust-details">
                    <div class="detail-item"><i class="fas fa-phone-alt"></i> ${c.phone || '-'}</div>
                    <div class="product-tag">${c.product || '상품 미정'}</div>
                </div>
                <div class="card-actions">${actionButtons}</div>
            `;
            listContainer.appendChild(div);
        });

    } catch (error) {
        console.error("로딩 실패:", error);
        listContainer.innerHTML = `<div class="empty-state" style="color: red;"><p>오류 발생: ${error.message}</p></div>`;
    }
};

window.assignToMe = async function(customerId) {
    if(!confirm("담당하시겠습니까?")) return;
    const success = await assignCustomerToManager(customerId, currentManager.id);
    if (success) { alert("배정되었습니다."); loadCustomers(); }
    else { alert("배정 실패"); loadCustomers(); }
};

function updateStats(customers) {
    if (!customers) customers = [];
    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setTxt('list-count', customers.length);
    setTxt('stat-total', customers.length);
    const today = new Date().toDateString();
    const todayCount = customers.filter(c => new Date(c.createdAt).toDateString() === today).length;
    setTxt('stat-today', todayCount);
    const pendingCount = customers.filter(c => c.status === '접수').length;
    setTxt('stat-pending', pendingCount);
}

window.changeStatus = async function(customerId, newStatus) {
    await updateCustomerStatus(currentManager.id, customerId, newStatus);
};

// ============================================================
// [5] 문자 발송 (SMS)
// ============================================================
window.openSMSModal = async function(customer) {
    const modal = document.getElementById('sms-modal');
    const contentBox = document.getElementById('sms-content');
    const linkBtn = document.getElementById('sms-link-btn');
    
    contentBox.innerText = "단축 링크 생성 중...";
    modal.classList.add('visible');

    try {
        const defaultProduct = '500M + TV베이직 (기본추천)';
        const defaultPrice = '37400'; 
        const q = customer.quoteData || {};

        const quoteData = {
            name: customer.name || '고객',
            manager: currentManager.name || '',
            phone: currentManager.phone || '',
            managerImg: currentManager.img || '',
            team: currentManager.team || '',
            role: currentManager.role || '',
            managerKakao: currentManager.kakao || '', 
            carrier: q.carrier || '',
            product: q.product || defaultProduct,
            price: String(q.price || defaultPrice),
            gift: String(q.gift || '0'),
            originalPrice: String(q.originalPrice || '0'),
            saving: String(q.saving || '0'),
            secret: String(q.secret || '0')
        };

        const shortId = await createShortQuote(quoteData);
        if (!shortId) throw new Error("ID 생성 실패");

        const baseUrl = window.location.origin + "/quote.html";
        const shortUrl = `${baseUrl}?id=${shortId}`;
        
        const text = `[성지넷] 안녕하세요 ${customer.name} 고객님!
요청하신 인터넷/TV 최저가 견적서입니다.

▶ 견적 확인하기:
${shortUrl}

확인 후 궁금하신 점은 언제든 편하게 연락주세요!
담당자: ${currentManager.name} (${currentManager.phone})`;

        contentBox.innerText = text;
        linkBtn.href = `sms:${customer.phone}?body=${encodeURIComponent(text)}`;

    } catch (error) {
        console.error("SMS 오류:", error);
        contentBox.innerHTML = `오류가 발생했습니다.<br>(${error.message})`;
    }
};

window.copySMS = function() {
    const text = document.getElementById('sms-content').innerText;
    navigator.clipboard.writeText(text).then(() => alert('복사되었습니다.'));
};

// ============================================================
// [6] 간편 견적 수정 (Mini Builder)
// ============================================================
window.openQuoteBuilder = async function(customerId) {
    const customers = await getCustomersByManager(currentManager.id);
    editingCustomer = customers.find(c => c.id === customerId);
    if (!editingCustomer) return;

    const q = editingCustomer.quoteData || {};
    document.getElementById('qb-customer-id').value = customerId;
    setCarrier(q.carrier || 'LG');
    
    if (q.price) {
        document.getElementById('qb-price').value = q.price;
        document.getElementById('qb-gift').value = q.gift;
    } else {
        autoCalculate(); 
    }
    document.getElementById('qb-secret').value = q.secret || '';
    document.getElementById('quote-builder-modal').classList.add('visible');
};

window.closeQuoteBuilder = function() {
    document.getElementById('quote-builder-modal').classList.remove('visible');
};

window.setCarrier = function(carrier) {
    document.getElementById('qb-carrier').value = carrier;
    document.querySelectorAll('.btn-tab').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === carrier);
    });
    autoCalculate();
};

window.autoCalculate = function() {
    if (!globalTelecomData) return;
    const carrier = document.getElementById('qb-carrier').value;
    const speed = document.getElementById('qb-internet').value;
    const tvType = document.getElementById('qb-tv').value;
    const data = globalTelecomData[carrier];
    if (!data || !data.internet) return;

    const internetItem = data.internet.find(i => i.id.includes(speed)) || data.internet[0];
    let price = internetItem ? internetItem.price : 0;

    let tvPrice = 0;
    if (tvType !== 'none' && data.tv) {
        const tvItem = (tvType === 'premium') ? (data.tv[1] || data.tv[0]) : data.tv[0];
        tvPrice = tvItem ? tvItem.price : 0;
    }
    price += tvPrice;
    let discount = (tvType !== 'none') ? 5500 : 0; 
    let gift = 0;
    if (data.giftPolicy) {
        gift = data.giftPolicy[`base_${speed}`] || 0;
        if (tvType !== 'none') gift += (data.giftPolicy[`tv_bundle_add_${speed}`] || 0);
    }

    document.getElementById('qb-price').value = price - discount;
    document.getElementById('qb-gift').value = gift;
};

window.saveQuoteAndClose = async function() {
    const customerId = document.getElementById('qb-customer-id').value;
    const carrier = document.getElementById('qb-carrier').value;
    const speed = document.getElementById('qb-internet').options[document.getElementById('qb-internet').selectedIndex].text;
    const tv = document.getElementById('qb-tv').options[document.getElementById('qb-tv').selectedIndex].text;
    
    const productName = `${speed} + ${tv}`;
    const price = document.getElementById('qb-price').value;
    const gift = document.getElementById('qb-gift').value;
    const secret = document.getElementById('qb-secret').value;

    const newQuoteData = {
        carrier, product: productName, price, gift, secret,
        originalPrice: parseInt(price) + 20000,
        saving: parseInt(gift) + (parseInt(secret)||0)
    };

    try {
        await update(ref(db, `/customers/${currentManager.id}/${customerId}`), {
            quoteData: newQuoteData, product: productName
        });
        alert('저장되었습니다.');
        document.getElementById('quote-builder-modal').classList.remove('visible');
        
        if(editingCustomer) {
            editingCustomer.quoteData = newQuoteData;
            editingCustomer.product = productName;
            loadCustomers();
            openSMSModal(editingCustomer);
        }
    } catch (error) {
        console.error(error);
        alert('저장 실패');
    }
};

// ============================================================
// [7] 전문가용 견적 비교 센터 (Expert Center) - 최종 완성본
// ============================================================

// 1. 모달 열기 및 초기화
window.openExpertQuote = async function(customerId) {
    const customers = await getCustomersByManager(currentManager.id);
    editingCustomer = customers.find(c => c.id === customerId);
    if (!editingCustomer) return;

    document.getElementById('qb-customer-id').value = customerId; 
    document.getElementById('expert-quote-modal').classList.add('visible');
    
    resetMobileLines(); // 초기화
    document.getElementById('eq-secret').value = ''; // 비밀지원금 초기화
    
    if (!globalTelecomData) {
        try {
            globalTelecomData = await getFullData();
        } catch(e) {
            console.error("데이터 로드 실패", e);
        }
    }
    
    runExpertAnalysis();
};

window.closeExpertQuote = function() {
    document.getElementById('expert-quote-modal').classList.remove('visible');
};

// 2. 스마트 태그 관리 함수
window.addMobileLine = function(price) {
    const isYouth = document.getElementById('is-youth-mode').checked;
    mobileLines.push({ price: price, isYouth: isYouth });
    renderMobileChips();
};

window.removeMobileLine = function(index) {
    mobileLines.splice(index, 1);
    renderMobileChips();
};

window.resetMobileLines = function() {
    mobileLines = [];
    renderMobileChips();
};

function renderMobileChips() {
    const container = document.getElementById('mobile-chips-area');
    container.innerHTML = '';

    if (mobileLines.length === 0) {
        container.innerHTML = '<span class="mobile-chip-placeholder">가족 구성원을 추가해주세요</span>';
    } else {
        mobileLines.forEach((item, index) => {
            const chip = document.createElement('div');
            chip.className = `mobile-chip ${item.isYouth ? 'youth' : ''}`;
            const label = item.isYouth ? '청소년' : '';
            chip.innerHTML = `${label} ${(item.price/10000).toFixed(1)}만 <i class="fas fa-times"></i>`;
            chip.onclick = () => removeMobileLine(index);
            container.appendChild(chip);
        });
    }
    
    // [핵심] 태그 변경 시 즉시 재계산
    runExpertAnalysis();
}

// 3. [핵심] 스마트 태그 기반 계산 로직 (AI 플래너 로직 완벽 이식 + 청소년)
window.runExpertAnalysis = async function() {
    const btn = document.getElementById('btn-run-expert');
    if(btn) btn.textContent = "계산 중...";

    if (!globalTelecomData) {
        try {
            globalTelecomData = await getFullData();
        } catch (e) {
            alert("데이터 로드 실패: " + e.message);
            if(btn) btn.textContent = "전체 비교 산출";
            return;
        }
    }

    const speed = document.getElementById('eq-internet').value;
    const tvType = document.getElementById('eq-tv').value;
    const addTvCount = parseInt(document.getElementById('eq-add-tv').value) || 0; // [추가] TV 추가 대수
    
    // [수정] 비밀지원금 단위 수정 (입력값 * 10000)
    const secretInput = document.getElementById('eq-secret').value.replace(/,/g, '');
    const secretValue = (parseInt(secretInput) || 0) * 10000; 
    
    // [변경] 스마트 태그 배열에서 정보 추출 (객체 구조 반영)
    const mobileCount = mobileLines.length;
    const highPlanCount = mobileLines.filter(m => m.price >= 80000).length; // 8만원 이상
    const ktHighPlanCount = mobileLines.filter(m => m.price >= 77000).length; // 7.7만원 이상 (KT용)
    const totalMobilePrice = mobileLines.reduce((a, b) => a + b.price, 0); // 총 요금 합계
    const youthCount = mobileLines.filter(m => m.isYouth).length; // 청소년 수

    expertResults = []; 

    const carriers = ['LG', 'SK', 'KT', 'SKB', 'Skylife', 'HelloVision'];

    carriers.forEach(carrier => {
        const data = globalTelecomData[carrier];
        if (!data || !data.internet || !Array.isArray(data.internet) || data.internet.length === 0) return;

        const internetItem = data.internet.find(i => i.id.includes(speed)) || data.internet[0];
        if (!internetItem) return; 

        let tvItem = null;
        if (tvType !== 'none' && data.tv && Array.isArray(data.tv) && data.tv.length > 0) {
            // [수정] 기본형(basic) 선택 시 2번째 상품(Pop 180, 베이직 등)을 우선 선택 (Index 1)
            // SKB만 Index 1, 나머지는 Index 0 (최저가)
            if (tvType === 'premium') {
                tvItem = data.tv[2] || data.tv[1] || data.tv[0]; 
            } else {
                if (carrier === 'SKB') {
                    tvItem = data.tv[1] || data.tv[0]; // SKB: Pop 180 (Index 1)
                } else {
                    tvItem = data.tv[0]; // Others: Lowest (Index 0)
                }
            }
        }
        
        let basePrice = internetItem.price + (tvItem ? tvItem.price : 0);
        
        // [추가] TV 추가 요금 계산
        let addTvPrice = 0;
        let addTvStr = '';
        if (addTvCount > 0 && data.additionalTv && Array.isArray(data.additionalTv)) {
            const addTvItem = data.additionalTv.find(i => i.id.includes('1')) || data.additionalTv[1] || data.additionalTv[0];
            if (addTvItem) {
                addTvPrice = addTvItem.price * addTvCount;
                addTvStr = ` + 추가TV ${addTvCount}대`;
            }
        }
        basePrice += addTvPrice;

        // B. 사은품 계산
        let gift = 0;
        if (data.giftPolicy) {
            gift = data.giftPolicy[`base_${speed}`] || 0;
            if (tvItem) {
                gift += (data.giftPolicy[`tv_bundle_add_${speed}`] || 0);
                // [추가] TV 추가 사은품
                if (addTvCount > 0) {
                    const addTvGiftUnit = (tvType === 'premium') ? (data.giftPolicy.add_tv_premium || 0) : (data.giftPolicy.add_tv_basic || 0);
                    gift += (addTvGiftUnit * addTvCount);
                }
            }
        }

        // C. 결합 상품별 시뮬레이션
        let combinations = [];
        if (mobileCount > 0) {
            // [수정] 스카이라이프는 모바일 결합 제외 (홈결합, 미결합만)
            if (carrier === 'Skylife') {
                combinations = [{ name: '홈결합(30%)' }, { name: '미결합 (사은품형)' }];
            } else {
                // DB 데이터 무시하고 강제로 표준 결합상품 생성 (누락 방지)
                if (carrier === 'LG') combinations = [{ name: '참쉬운가족결합' }, { name: '투게더결합' }];
                else if (carrier === 'KT') combinations = [{ name: '총액결합할인' }, { name: '프리미엄가족결합' }, { name: '프리미엄싱글결합' }];
                else if (carrier === 'SK' || carrier === 'SKB') combinations = [{ name: '요즘가족결합' }];
                else if (carrier === 'HelloVision') combinations = [{ name: '모바일결합' }];
            }
        } else {
            combinations = [{ name: '기본 3년 약정' }];
        }

        combinations.forEach(combo => {
            let internetDiscount = 0;
            let mobileDiscount = 0;
            let note = '';
            let isValid = true; 
            // [수정] 반복문 내에서 사은품 변수 분리 (스카이라이프 오류 해결)
            let finalGift = gift; 

            if (mobileCount > 0) {
                // [LG U+]
                if (carrier === 'LG') {
                    if (combo.name.includes('투게더')) {
                        // 투게더: 8만원 이상 2인 이상
                        if (highPlanCount < 2) {
                            isValid = false; 
                        } else {
                            const count = Math.min(highPlanCount, 5);
                            const perLine = LG_TOGETHER_PER_LINE[count] || 0;
                            mobileDiscount = perLine * count;
                            internetDiscount = (speed === '100') ? 5500 : 11000;
                            // [청소년] 추가 할인
                            if (youthCount > 0) mobileDiscount += (youthCount * LG_TOGETHER_YOUTH_DISCOUNT);
                            note = `투게더(${count}인) 적용`;
                        }
                    } else if (combo.name.includes('참쉬운')) {
                        internetDiscount = (speed === '100') ? 5500 : 9900;
                        const discountRow = LG_CHAM_MATRIX[Math.min(mobileCount, 5)];
                        if (discountRow) {
                            mobileLines.forEach(m => {
                                let pIdx = 0;
                                if (m.price >= 88000) pIdx = 2;
                                else if (m.price >= 69000) pIdx = 1;
                                else pIdx = 0; 
                                mobileDiscount += discountRow[pIdx];
                            });
                        }
                        note = '참쉬운결합 적용';
                    }
                } 
                // [KT]
                else if (carrier === 'KT') {
                    if (combo.name.includes('프리미엄가족')) { 
                        // [수정] 필터링 제거 (조건 미달이어도 표시하되 할인 0원)
                        if (mobileCount < 2) {
                            note = '조건 미달 (2인 이상)';
                        } else {
                            internetDiscount = 5500;
                            let discountableLines = mobileLines.filter(m => m.price >= 77000).sort((a,b) => b.price - a.price);
                            // 베이스 회선 제외 나머지 25% 할인
                            for(let i=1; i<discountableLines.length; i++) {
                                mobileDiscount += (discountableLines[i].price * 0.25);
                            }
                            // [청소년] 추가 할인
                            if (youthCount > 0) mobileDiscount += (youthCount * KT_YOUTH_DISCOUNT);
                            note = '프리미엄가족 결합';
                        }
                    } else if (combo.name.includes('프리미엄싱글')) {
                        if (mobileCount !== 1 || ktHighPlanCount !== 1) {
                            note = '조건 미달 (1인 7.7만↑)';
                        } else {
                            internetDiscount = 5500; 
                            mobileDiscount = mobileLines[0].price * 0.25; 
                            note = '프리미엄싱글 결합';
                        }
                    } else if (combo.name.includes('총액')) {
                        const speedKey = (speed === '100') ? '100M' : '500M+';
                        const tiers = KT_TOTAL_TIERS.tiers;
                        let tierIndex = tiers.findIndex(t => totalMobilePrice < t);
                        if (tierIndex === -1) tierIndex = tiers.length - 1;
                        
                        internetDiscount = KT_TOTAL_TIERS[speedKey].internet[tierIndex] || 0;
                        mobileDiscount = KT_TOTAL_TIERS[speedKey].mobile[tierIndex] || 0;
                        // [청소년] 추가 할인
                        if (youthCount > 0) mobileDiscount += (youthCount * KT_YOUTH_DISCOUNT);
                        note = '총액결합';
                    }
                } 
                // [SK]
                else if (carrier === 'SK' || carrier === 'SKB') {
                    if (combo.name.includes('요즘가족') || combo.name.includes('패밀리')) {
                        // [수정] SKB(B알뜰) 요즘가족결합 인터넷 할인 로직 변경
                        if (carrier === 'SKB') {
                            if (mobileCount >= 1) {
                                if (speed === '100') internetDiscount = 2200;
                                else if (speed === '500') internetDiscount = 5500;
                                else if (speed === '1000') internetDiscount = 7700;
                            }
                        } 
                        // [수정] SKT 본사 로직 (1대 이상이면 속도별 할인 적용)
                        else {
                            if (mobileCount >= 1) {
                                if (speed === '100') internetDiscount = 3300;
                                else if (speed === '500') internetDiscount = 6600;
                                else if (speed === '1000') internetDiscount = 8800;
                            }
                        }
                        
                        mobileDiscount = SK_FAMILY_MOBILE[Math.min(mobileCount, 5)] || 0;
                        note = `요즘가족결합(${mobileCount}인)`;
                    }
                }
                // [HelloVision]
                else if (carrier === 'HelloVision') {
                    internetDiscount = 0;
                    mobileDiscount = mobileCount * 3300; 
                    note = '모바일 결합 할인';
                }
                // [Skylife]
                else if (carrier === 'Skylife') {
                    if (combo.name.includes('홈결합')) {
                        // [수정] 스카이라이프 홈결합 30% 할인 적용
                        internetDiscount = Math.round(internetItem.price * 0.3 / 10) * 10;
                        note = '홈결합 30% 할인';
                        // [수정] 홈결합 시 사은품 10만원 고정 (변수 분리 적용)
                        finalGift = 100000;
                    } else {
                        note = '미결합 (사은품형)';
                        // 미결합 시에는 기존 gift 유지
                    }
                }
            }

            // [수정] isValid 체크 제거 (모든 상품 표시)
            // if (!isValid) return;

            const finalPrice = basePrice - internetDiscount;
            // [수정] 총 혜택에 비밀지원금 합산
            const totalBenefit = finalGift + ((internetDiscount + mobileDiscount) * 36) + secretValue;
            // [신규] 3년 실비용 계산 (월납부금*36 - 총지원금)
            const realTotalCost = (finalPrice * 36) - (finalGift + secretValue);
            
            const fullProductName = `${internetItem.name} + ${tvItem ? tvItem.name : 'TV없음'}${addTvStr} (${combo.name})`;

            expertResults.push({
                carrier: carrier,
                productName: fullProductName,
                finalPrice: finalPrice,
                gift: finalGift,
                mobileDiscount: mobileDiscount,
                totalBenefit: totalBenefit,
                realTotalCost: realTotalCost, // [신규] 3년 실비용
                note: note,
                internetDiscount: internetDiscount,
                basePrice: basePrice,
                raw: {
                    carrier, 
                    product: fullProductName, 
                    price: finalPrice, 
                    gift: finalGift, 
                    secret: secretValue // 비밀지원금 저장
                }
            });
        });

        // [추가] SKB 전용 '선납 할인' 상품 강제 추가
        if (carrier === 'SKB') {
            const prepaidDiscount = 5500;
            const prepaidGift = 100000; 
            
            let bestMobileDiscount = 0;
            if (mobileCount > 0) {
                bestMobileDiscount = SK_FAMILY_MOBILE[Math.min(mobileCount, 5)] || 0;
            }

            // [수정] 선납 할인 적용 시 최종 납부금 계산 (기본료 - 선납할인 - 인터넷할인)
            // SKB 선납은 인터넷 할인과 중복 적용 가능 (단, 인터넷 할인은 결합 조건 충족 시)
            let internetDiscountForPrepaid = 0;
            if (mobileCount >= 1) {
                if (speed === '100') internetDiscountForPrepaid = 2200;
                else if (speed === '500') internetDiscountForPrepaid = 5500;
                else if (speed === '1000') internetDiscountForPrepaid = 7700;
            }

            const finalPricePrepaid = basePrice - prepaidDiscount - internetDiscountForPrepaid;
            
            // [수정] 총 혜택에 비밀지원금 합산
            const totalBenefitPrepaid = prepaidGift + ((prepaidDiscount + bestMobileDiscount + internetDiscountForPrepaid) * 36) + secretValue;
            
            // [신규] 3년 실비용 계산
            const realTotalCostPrepaid = (finalPricePrepaid * 36) - (prepaidGift + secretValue);
            
            let prepaidName = `${internetItem.name} + ${tvItem ? tvItem.name : 'TV없음'}${addTvStr} (B알뜰 선납)`;
            if (bestMobileDiscount > 0) prepaidName += ` + 요즘가족(${mobileCount}인)`;

            expertResults.push({
                carrier: 'SKB',
                productName: prepaidName,
                finalPrice: finalPricePrepaid,
                gift: prepaidGift, 
                mobileDiscount: bestMobileDiscount, 
                totalBenefit: totalBenefitPrepaid,
                realTotalCost: realTotalCostPrepaid, // [신규] 3년 실비용
                note: '선납 할인 + 결합',
                internetDiscount: internetDiscountForPrepaid, // 인터넷 할인도 표기
                prepaidDiscount: prepaidDiscount, // [신규] 선납 할인 금액 별도 저장
                basePrice: basePrice,
                raw: {
                    carrier: 'SKB', 
                    product: prepaidName, 
                    price: finalPricePrepaid, 
                    gift: prepaidGift, 
                    secret: secretValue // 비밀지원금 저장
                }
            });
        }
    });

    sortResults('benefit');
    if(btn) btn.textContent = "전체 비교 산출";
};

window.sortResults = function(criteria) {
    if (criteria === 'price') expertResults.sort((a, b) => a.finalPrice - b.finalPrice); 
    else if (criteria === 'gift') expertResults.sort((a, b) => b.gift - a.gift); 
    else if (criteria === 'benefit') expertResults.sort((a, b) => b.totalBenefit - a.totalBenefit); 
    else if (criteria === 'realCost') expertResults.sort((a, b) => a.realTotalCost - b.realTotalCost); // [신규] 실비용 정렬
    renderExpertTable();
};

function renderExpertTable() {
    const tbody = document.getElementById('expert-list-body');
    tbody.innerHTML = '';

    if (expertResults.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">계산된 결과가 없습니다.</td></tr>';
        return;
    }

    expertResults.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #eee';
        tr.style.cursor = 'pointer';
        tr.onmouseover = () => tr.style.background = '#f0f8ff';
        tr.onmouseout = () => tr.style.background = 'white';
        
        tr.onclick = (e) => {
            if(e.target.tagName !== 'BUTTON') selectExpertQuote(index);
        };

        tr.innerHTML = `
            <td style="padding:12px; font-weight:bold; color:${getCarrierColor(item.carrier)}">${item.carrier}</td>
            <td style="padding:12px;">
                ${item.productName}
                <div style="font-size:11px; color:#888;">${item.note}</div>
            </td>
            <td style="padding:12px; font-weight:bold; text-align:right;">${item.finalPrice.toLocaleString()}원</td>
            <td style="padding:12px; color:#d63384; font-weight:bold; text-align:right;">${(item.gift/10000).toFixed(0)}만원</td>
            <td style="padding:12px; text-align:right;">${item.mobileDiscount > 0 ? '-' + item.mobileDiscount.toLocaleString() : '-'}</td>
            <td style="padding:12px; color:#007bff; font-weight:bold; text-align:right;">${(item.totalBenefit/10000).toFixed(0)}만원</td>
            <td style="padding:12px; font-weight:bold; text-align:right; color:#333;">${(item.realTotalCost/10000).toFixed(0)}만원</td>
            <td style="padding:12px; text-align:center;">
                <button class="btn-action" style="padding:5px 10px; font-size:12px; background:#6B7280; margin-right:5px;" onclick="openExpertDetail(${index})">상세</button>
                <button class="btn-action" style="padding:5px 10px; font-size:12px;" onclick="selectExpertQuote(${index})">선택</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// [수정] 상세 견적 보기 함수 (휴대폰 할인 위치 이동 및 선납 분리)
window.openExpertDetail = function(index) {
    const item = expertResults[index];
    if (!item) return;

    const modal = document.getElementById('expert-detail-modal');
    const body = document.getElementById('expert-detail-body');
    
    // 선납 할인 여부 확인
    const prepaidDiscount = item.prepaidDiscount || 0;
    const internetDiscountReal = item.internetDiscount || 0;

    let discountRows = '';
    
    // 1. 인터넷 요금 할인
    if (internetDiscountReal > 0) {
        discountRows += `
            <tr class="discount-row">
                <th>인터넷 요금 할인</th>
                <td>-${internetDiscountReal.toLocaleString()}원</td>
            </tr>`;
    }

    // 2. 선납 요금 할인 (별도 표기)
    if (prepaidDiscount > 0) {
        discountRows += `
            <tr class="discount-row" style="color:#007bff;">
                <th>선납 요금 할인</th>
                <td>-${prepaidDiscount.toLocaleString()}원</td>
            </tr>`;
    }

    body.innerHTML = `
        <h3 style="margin-bottom:15px; color:${getCarrierColor(item.carrier)}">${item.carrier} 상세 견적</h3>
        <p style="font-size:14px; font-weight:bold; margin-bottom:10px;">${item.productName}</p>
        
        <table class="detail-table">
            <tr>
                <th>기본 요금 (인터넷+TV)</th>
                <td>${item.basePrice.toLocaleString()}원</td>
            </tr>
            ${discountRows}
            <tr class="total-row">
                <th>월 최종 납부금</th>
                <td>${item.finalPrice.toLocaleString()}원</td>
            </tr>
            <tr class="benefit-row" style="border-top:1px dashed #ccc;">
                <th>현금 사은품</th>
                <td>${item.gift.toLocaleString()}원</td>
            </tr>
            ${item.raw.secret > 0 ? `
            <tr class="secret-row">
                <th>비밀 지원금</th>
                <td>+${item.raw.secret.toLocaleString()}원</td>
            </tr>` : ''}
            ${item.mobileDiscount > 0 ? `
            <tr class="benefit-row">
                <th>휴대폰 결합 할인 (월)</th>
                <td>${item.mobileDiscount.toLocaleString()}원</td>
            </tr>` : ''}
            <tr class="benefit-row" style="background:#f0fdf4;">
                <th>3년 총 혜택 환산</th>
                <td style="font-size:16px; font-weight:800;">${item.totalBenefit.toLocaleString()}원</td>
            </tr>
            <tr class="benefit-row" style="background:#fff7ed; color:#c2410c;">
                <th>3년 실질 비용 (납부-지원금)</th>
                <td style="font-size:16px; font-weight:800;">${item.realTotalCost.toLocaleString()}원</td>
            </tr>
        </table>
        <p style="font-size:12px; color:#888; margin-top:10px; text-align:right;">* 부가세 포함, 3년 약정 기준</p>
    `;
    
    modal.classList.add('visible');
};

window.closeExpertDetail = function() {
    document.getElementById('expert-detail-modal').classList.remove('visible');
};

function getCarrierColor(carrier) {
    const colors = { 'SK': '#E60012', 'KT': '#000000', 'LG': '#E6007E', 'SKB': '#0050A0' };
    return colors[carrier] || '#333';
}

window.selectExpertQuote = async function(index) {
    const selected = expertResults[index];
    if (!selected || !editingCustomer) return;

    if (!confirm(`[${selected.carrier}] ${selected.productName}\n월 ${selected.finalPrice.toLocaleString()}원 / 사은품 ${selected.gift.toLocaleString()}원\n\n이 견적으로 고객 정보를 업데이트하시겠습니까?`)) return;

    const newQuoteData = {
        carrier: selected.carrier,
        product: selected.raw.product, 
        price: selected.finalPrice,
        gift: selected.gift,
        secret: selected.raw.secret, // 비밀지원금 저장
        originalPrice: selected.finalPrice + 15000,
        saving: selected.totalBenefit
    };

    try {
        await update(ref(db, `/customers/${currentManager.id}/${editingCustomer.id}`), {
            quoteData: newQuoteData,
            product: selected.raw.product
        });

        alert('적용되었습니다. 문자 발송 창으로 이동합니다.');
        closeExpertQuote();
        
        editingCustomer.quoteData = newQuoteData;
        editingCustomer.product = selected.raw.product;
        loadCustomers();
        openSMSModal(editingCustomer);

    } catch (error) {
        console.error(error);
        alert('오류가 발생했습니다.');
    }
};

// [신규] 엑셀 다운로드 기능
window.downloadExcel = function() {
    if (!expertResults || expertResults.length === 0) {
        alert("다운로드할 데이터가 없습니다. 먼저 비교 산출을 진행해주세요.");
        return;
    }

    const excelData = expertResults.map(item => {
        const prepaid = item.prepaidDiscount || 0;
        const internetDisc = (item.internetDiscount || 0); // 인터넷 할인 (선납 제외)

        return {
            '통신사': item.carrier,
            '상품명': item.productName,
            '기본요금': item.basePrice.toLocaleString(),
            '인터넷할인': internetDisc.toLocaleString(),
            '선납할인': prepaid.toLocaleString(),
            '모바일할인': item.mobileDiscount.toLocaleString(),
            '월납부금': item.finalPrice.toLocaleString(),
            '현금사은품': item.gift.toLocaleString(),
            '비밀지원금': (item.raw.secret || 0).toLocaleString(),
            '3년총혜택': item.totalBenefit.toLocaleString(),
            '3년실비용': item.realTotalCost.toLocaleString(), // [신규] 엑셀 추가
            '비고': item.note
        };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "견적비교결과");
    
    const date = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, `성지넷_견적비교_${date}.xlsx`);
};