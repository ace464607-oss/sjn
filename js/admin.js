import { getFullData, saveData, getManagers, addManager, updateManager, deleteManager, db, ref, get, query, limitToLast, orderByChild } from './data-service.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- [공통] 요소 선택 ---
    const loginContainer = document.getElementById('login-container');
    const adminContainer = document.getElementById('admin-container');
    const loginButton = document.getElementById('login-button');
    const passwordInput = document.getElementById('password-input');
    const loginMessage = document.getElementById('login-message');
    
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    const adminForm = document.getElementById('admin-form');
    const telecomSelector = document.getElementById('telecom-selector');
    
    const managerForm = document.getElementById('manager-form');
    const managerListBody = document.getElementById('manager-list');
    const btnSaveManager = document.getElementById('btn-save-manager');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    const managerFormTitle = document.getElementById('manager-form-title');

    const adminPassword = "a0909"; 
    let fullData = null;
    let currentTelecom = null;
    let isFormDirty = false;

    // --- [1] 로그인 로직 ---
    const handleLogin = () => {
        if (passwordInput.value === adminPassword) {
            loginContainer.style.display = 'none';
            adminContainer.style.display = 'block';
            document.body.classList.add('logged-in');
            initializeApp();
        } else {
            loginMessage.textContent = "비밀번호가 틀렸습니다.";
            passwordInput.value = '';
            passwordInput.focus();
        }
    };

    loginButton.addEventListener('click', handleLogin);
    passwordInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleLogin(); });

    // --- [2] 앱 초기화 ---
    const initializeApp = async () => {
        try {
            fullData = await getFullData();
            loadDashboardData();
            loadActivityLog();
            initTelecomSelector();
            populateAllForms();
        } catch (error) {
            console.error("데이터 로딩 실패:", error);
            alert("데이터 로딩 실패: " + error.message);
        }
        await renderManagerList();
        initTabs();
    };

    function initTabs() {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const targetId = btn.dataset.target;
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === targetId) content.classList.add('active');
                });
            });
        });
    }

    // ============================================================
    // [파트 A] 통신사/요금 설정 로직
    // ============================================================
    
    function initTelecomSelector() {
        const telecomKeys = ['KT', 'LG', 'SK', 'SKB', 'Skylife', 'HelloVision'];
        currentTelecom = telecomKeys[0];

        telecomSelector.innerHTML = '';
        telecomKeys.forEach(key => {
            const btn = document.createElement('button');
            btn.dataset.telecom = key;
            btn.textContent = (fullData && fullData[key]) ? fullData[key].name : key;
            if (key === currentTelecom) btn.classList.add('active');
            telecomSelector.appendChild(btn);
        });

        telecomSelector.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('active')) {
                if (isFormDirty && !confirm("저장되지 않은 변경사항이 있습니다. 이동하시겠습니까?")) return;
                
                const activeBtn = telecomSelector.querySelector('.active');
                if(activeBtn) activeBtn.classList.remove('active');
                
                e.target.classList.add('active');
                currentTelecom = e.target.dataset.telecom;
                populateAllForms();
                isFormDirty = false;
            }
        });
    }

    async function loadDashboardData() {
        document.getElementById('dashboard-content').innerHTML = `<p>통계 데이터 준비 중...</p>`;
    }

    async function loadActivityLog() {
        const logContent = document.getElementById('log-content');
        try {
            const logRef = query(ref(db, 'activityLog'), orderByChild('timestamp'), limitToLast(10));
            const snapshot = await get(logRef);
            if (snapshot.exists()) {
                const logs = Object.values(snapshot.val()).reverse();
                logContent.innerHTML = logs.map(log => 
                    `<p style="margin:0 0 8px; border-bottom:1px solid #eee; padding-bottom:5px; font-size:0.9em;">
                        <strong>${new Date(log.timestamp).toLocaleString()}</strong>: ${log.message}
                    </p>`
                ).join('');
            } else { logContent.textContent = '이력이 없습니다.'; }
        } catch (e) { logContent.textContent = '로그 로딩 실패'; }
    }

    function populateAllForms() {
        if (!fullData) fullData = {};
        if (!fullData[currentTelecom]) {
            fullData[currentTelecom] = { name: currentTelecom, internet: [], tv: [], settop: [], additionalTv: [], giftPolicy: {} };
        }
        const data = fullData[currentTelecom];
        
        renderList('internet', data.internet);
        renderList('tv', data.tv);
        renderList('settop', data.settop);
        renderList('additionalTv', data.additionalTv);

        const giftGrid = document.getElementById('gift-policy-form-grid');
        const gp = data.giftPolicy || {};
        giftGrid.innerHTML = `
            <div class="policy-group"><h3 class="group-title">기본 사은품</h3><div class="form-grid">
                ${createFormGroup('gift-base_100', '100M', gp.base_100, 'gift').outerHTML}
                ${createFormGroup('gift-base_500', '500M', gp.base_500, 'gift').outerHTML}
                ${createFormGroup('gift-base_1000', '1G', gp.base_1000, 'gift').outerHTML}
            </div></div>
            <div class="policy-group"><h3 class="group-title">TV 결합 추가</h3><div class="form-grid">
                ${createFormGroup('gift-tv_bundle_add_100', '100M+TV', gp.tv_bundle_add_100, 'gift').outerHTML}
                ${createFormGroup('gift-tv_bundle_add_500', '500M+TV', gp.tv_bundle_add_500, 'gift').outerHTML}
                ${createFormGroup('gift-tv_bundle_add_1000', '1G+TV', gp.tv_bundle_add_1000, 'gift').outerHTML}
            </div></div>
            <div class="policy-group"><h3 class="group-title">기타 추가</h3><div class="form-grid">
                ${createFormGroup('gift-premium_tv_add', '프리미엄TV', gp.premium_tv_add, 'gift').outerHTML}
                ${createFormGroup('gift-add_tv_basic', 'TV추가(기본)', gp.add_tv_basic, 'gift').outerHTML}
                ${createFormGroup('gift-usim_add', '유심', gp.usim_add, 'gift').outerHTML}
            </div></div>
        `;
    }

    function renderList(type, items) {
        const container = document.getElementById(`${type}-list-container`);
        container.innerHTML = '';
        (items || []).forEach((item, index) => {
            container.appendChild(createDynamicRow(type, item.id || `${type}_${index}`, item.name, item.price));
        });
    }

    // [핵심] 동적 행 생성 (확인 버튼 로직 포함)
    function createDynamicRow(type, id, name, price) {
        const div = document.createElement('div');
        div.className = 'dynamic-row';
        div.dataset.type = type;
        div.dataset.id = id;
        
        div.innerHTML = `
            <div class="input-wrapper">
                <span class="input-label">상품명</span>
                <input type="text" class="name-input" value="${name || ''}" placeholder="상품명">
            </div>
            <div class="input-wrapper" style="flex: 0.5;">
                <span class="input-label">가격 (원)</span>
                <input type="text" class="price-input" value="${(price || 0).toLocaleString()}" placeholder="0">
            </div>
            <button type="button" class="btn-row-action btn-confirm-item" title="확인 (임시저장)">
                <i class="fas fa-check"></i>
            </button>
            <button type="button" class="btn-row-action btn-remove-item" onclick="this.closest('.dynamic-row').remove(); isFormDirty=true;" title="삭제">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        
        const nameInput = div.querySelector('.name-input');
        const priceInput = div.querySelector('.price-input');
        const confirmBtn = div.querySelector('.btn-confirm-item');

        // 입력 감지 -> 수정 상태 표시
        const handleInput = () => {
            div.classList.add('modified');
            div.classList.remove('confirmed');
            confirmBtn.classList.add('active');
            isFormDirty = true;
        };

        nameInput.addEventListener('input', handleInput);
        priceInput.addEventListener('input', (e) => {
            const raw = e.target.value.replace(/[^0-9]/g, '');
            e.target.value = Number(raw).toLocaleString();
            handleInput();
        });

        // 확인 버튼 클릭 -> 확정 상태 표시
        confirmBtn.addEventListener('click', () => {
            div.classList.remove('modified');
            div.classList.add('confirmed');
            confirmBtn.classList.remove('active');
            // 여기서 실제 데이터 객체(fullData)를 업데이트하지는 않고, 
            // 시각적으로만 확정됨을 보여줍니다. 최종 저장은 하단 버튼으로 일괄 처리.
        });

        return div;
    }

    window.addRateItem = function(type) {
        const container = document.getElementById(`${type}-list-container`);
        const newRow = createDynamicRow(type, `${type}_${Date.now()}`, '', 0);
        // 새 항목은 바로 수정 상태로 시작
        newRow.classList.add('modified');
        newRow.querySelector('.btn-confirm-item').classList.add('active');
        container.appendChild(newRow);
        isFormDirty = true;
    };

    function createFormGroup(id, label, value, type) {
        const div = document.createElement('div');
        div.className = 'form-group';
        if(type === 'gift') div.classList.add('gift-group');
        let val = value || 0;
        if(type === 'gift') val = val / 10000;
        div.innerHTML = `<label>${label}</label><input type="text" id="${id}" value="${val.toLocaleString()}" data-type="${type}">`;
        return div;
    }

    adminForm.addEventListener('input', (e) => {
        if(e.target.tagName === 'INPUT') isFormDirty = true;
    });

    // [저장 로직]
    adminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentData = fullData[currentTelecom];
        
        const collectData = (type) => {
            const rows = document.querySelectorAll(`#${type}-list-container .dynamic-row`);
            return Array.from(rows).map(row => ({
                id: row.dataset.id,
                name: row.querySelector('.name-input').value,
                price: Number(row.querySelector('.price-input').value.replace(/,/g, ''))
            })).filter(item => item.name.trim() !== '');
        };

        currentData.internet = collectData('internet');
        currentData.tv = collectData('tv');
        currentData.settop = collectData('settop');
        currentData.additionalTv = collectData('additionalTv');

        const gp = currentData.giftPolicy || {};
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? Number(el.value.replace(/,/g, '')) * 10000 : 0;
        };
        
        gp.base_100 = getVal('gift-base_100');
        gp.base_500 = getVal('gift-base_500');
        gp.base_1000 = getVal('gift-base_1000');
        gp.tv_bundle_add_100 = getVal('gift-tv_bundle_add_100');
        gp.tv_bundle_add_500 = getVal('gift-tv_bundle_add_500');
        gp.tv_bundle_add_1000 = getVal('gift-tv_bundle_add_1000');
        gp.premium_tv_add = getVal('gift-premium_tv_add');
        gp.add_tv_basic = getVal('gift-add_tv_basic');
        gp.usim_add = getVal('gift-usim_add');
        
        currentData.giftPolicy = gp;

        const success = await saveData(fullData);
        
        if (success) {
            showToast('전체 설정이 저장되었습니다.', true);
            isFormDirty = false;
            // 저장 후 모든 '확인' 상태 초기화 (깔끔하게)
            document.querySelectorAll('.dynamic-row').forEach(row => {
                row.classList.remove('modified', 'confirmed');
                row.querySelector('.btn-confirm-item').classList.remove('active');
            });
            loadActivityLog();
        } else {
            showToast('저장 실패', false);
        }
    });

    // ... (상담사 관리 로직은 기존과 동일) ...
    async function renderManagerList() {
        managerListBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">로딩 중...</td></tr>';
        const managers = await getManagers();
        managerListBody.innerHTML = '';

        if (managers.length === 0) {
            managerListBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">등록된 상담사가 없습니다.</td></tr>';
            return;
        }

        managers.forEach((m) => {
            const mData = encodeURIComponent(JSON.stringify(m));
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${m.img}" class="profile-thumb" onerror="this.src='assets/images/manager_placeholder.png'"></td>
                <td><strong>${m.name}</strong></td>
                <td>${m.team} <br> <span style="color:#888; font-size:11px;">${m.role}</span></td>
                <td>${m.phone}</td>
                <td>
                    <button class="btn-edit" onclick="editManager('${mData}')">수정</button>
                    <button class="btn-delete" data-id="${m.id}">삭제</button>
                </td>
            `;
            managerListBody.appendChild(tr);
        });
    }

    window.editManager = function(encodedData) {
        const m = JSON.parse(decodeURIComponent(encodedData));
        
        document.getElementById('m-id').value = m.id;
        document.getElementById('m-name').value = m.name;
        document.getElementById('m-phone').value = m.phone;
        document.getElementById('m-team').value = m.team;
        document.getElementById('m-role').value = m.role;
        document.getElementById('m-kakao').value = m.kakao || '';
        document.getElementById('m-img').value = m.img;

        managerFormTitle.textContent = "👩‍💼 상담사 정보 수정";
        btnSaveManager.textContent = "상담사 수정하기";
        btnSaveManager.style.backgroundColor = "#ffc107"; 
        btnSaveManager.style.color = "#333";
        btnCancelEdit.style.display = "inline-block";
        
        managerForm.scrollIntoView({ behavior: 'smooth' });
    };

    btnCancelEdit.addEventListener('click', () => {
        resetManagerForm();
    });

    function resetManagerForm() {
        document.getElementById('manager-form').reset();
        document.getElementById('m-id').value = '';
        managerFormTitle.textContent = "👩‍💼 상담사 등록";
        btnSaveManager.textContent = "상담사 저장하기";
        btnSaveManager.style.backgroundColor = "#28a745"; 
        btnSaveManager.style.color = "white";
        btnCancelEdit.style.display = "none";
    }

    managerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('m-id').value;
        const managerData = {
            name: document.getElementById('m-name').value,
            phone: document.getElementById('m-phone').value,
            team: document.getElementById('m-team').value,
            role: document.getElementById('m-role').value,
            kakao: document.getElementById('m-kakao').value.trim(), 
            img: document.getElementById('m-img').value || 'assets/images/manager_placeholder.png'
        };

        let success = false;
        if (id) {
            success = await updateManager(id, managerData);
            if (success) showToast('상담사 정보가 수정되었습니다.', true);
        } else {
            success = await addManager(managerData);
            if (success) showToast('상담사가 등록되었습니다.', true);
        }

        if (success) {
            resetManagerForm();
            renderManagerList();
        } else {
            showToast('처리 실패', false);
        }
    });

    managerListBody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-delete')) {
            if(confirm('정말 삭제하시겠습니까?')) {
                const id = e.target.dataset.id;
                const success = await deleteManager(id);
                if (success) {
                    showToast('삭제되었습니다.', true);
                    renderManagerList();
                } else {
                    showToast('삭제 실패', false);
                }
            }
        }
    });

    const phoneInput = document.getElementById('m-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            e.target.value = autoHyphenPhone(e.target.value);
        });
    }

    function autoHyphenPhone(str) {
        str = str.replace(/[^0-9]/g, '');
        var tmp = '';
        if( str.length < 4){
            return str;
        }else if(str.length < 7){
            tmp += str.substr(0, 3);
            tmp += '-';
            tmp += str.substr(3);
            return tmp;
        }else if(str.length < 11){
            tmp += str.substr(0, 3);
            tmp += '-';
            tmp += str.substr(3, 3);
            tmp += '-';
            tmp += str.substr(6);
            return tmp;
        }else{
            tmp += str.substr(0, 3);
            tmp += '-';
            tmp += str.substr(3, 4);
            tmp += '-';
            tmp += str.substr(7);
            return tmp;
        }
        return str;
    }

    function showToast(message, isSuccess) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${isSuccess ? 'success' : 'error'}`;
        setTimeout(() => { toast.className = 'toast'; }, 3000);
    }
});