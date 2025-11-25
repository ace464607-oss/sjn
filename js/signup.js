box.addEventListener('click', () => {
    choiceBoxes.forEach(b => b.classList.remove('active'));
    box.classList.add('active');
});
    });

if (window.history.state?.page !== 'signup') {
    history.pushState({ page: 'signup' }, '', location.href);
}

window.addEventListener('popstate', (event) => {
    if (event.state?.page !== 'signup') {
        try {
            const ctx = JSON.parse(sessionStorage.getItem('returnContext') || 'null');
            if (ctx?.type === 'ai') {
                window.location.href = 'index.html#ai';
            } else if (ctx?.type === 'main') {
                window.location.href = 'index.html#calculator-section';
            } else {
                window.location.href = 'index.html';
            }
        } catch {
            window.location.href = 'index.html';
        }
    }
});

const urlForTest = new URLSearchParams(window.location.search);
const isTestMode = urlForTest.get('test') === 'true';
if (isTestMode) {
    console.warn("⚠️ 테스트 모드가 활성화되었습니다. 유효성 검사를 건너뜁니다.");
}

const urlParams = new URLSearchParams(window.location.search);
const productInfo = {
    // 기본 파라미터(기존 방식)
    telecom: urlParams.get('telecom'),
    // compare-modal 등에서 사용하는 대체 키도 함께 지원
    internet: urlParams.get('internet') || urlParams.get('internetProduct'),
    tv: urlParams.get('tv') || urlParams.get('tvProduct'),
    settop: urlParams.get('settop'),
    additionalTv: urlParams.get('additionalTv'),
    combinedProduct: urlParams.get('combinedProduct') || urlParams.get('planName'),
    // usim / mobileSummary 등 다양한 키 허용
    usim: urlParams.get('usim') || urlParams.get('mobileSummary'),
    totalPrice: urlParams.get('totalPrice'),
    supportFund: urlParams.get('supportFund')
};

const formatNumber = (numStr) => {
    const number = parseFloat(numStr);
    if (isNaN(number)) return numStr;
    return number.toLocaleString('ko-KR');
};

const summaryContainer = document.getElementById('product-summary-container');
if (summaryContainer) {
    summaryContainer.innerHTML = '';
    function addSummaryRow(title, value) {
        if (value && value !== 'null' && value !== 'undefined') {
            const row = document.createElement('div');
            row.className = 'row';
            row.innerHTML = `<span class="title">${title}</span><span class="value">${value}</span>`;
            summaryContainer.appendChild(row);
        }
    }
    addSummaryRow('통신사', productInfo.telecom);
    addSummaryRow('인터넷', productInfo.internet);
    addSummaryRow('TV', productInfo.tv);
    addSummaryRow('셋탑박스', productInfo.settop);
    addSummaryRow('TV 추가', productInfo.additionalTv);
    addSummaryRow('결합상품', productInfo.combinedProduct);
    addSummaryRow('휴대폰(유심)', productInfo.usim);

    const summaryPriceEl = document.getElementById('summary-price');
    const summaryGiftEl = document.getElementById('summary-gift');

    if (summaryPriceEl && productInfo.totalPrice) {
        summaryPriceEl.textContent = `${formatNumber(productInfo.totalPrice)}원`;
    }
    if (summaryGiftEl && productInfo.supportFund) {
        summaryGiftEl.textContent = `사은품 ${formatNumber(productInfo.supportFund)}원`;
    }

    document.getElementById('selected-product-telecom').value = productInfo.telecom || '';
    document.getElementById('selected-product-internet').value = productInfo.internet || '';
    document.getElementById('selected-product-tv').value = productInfo.tv || '';
    document.getElementById('selected-product-settop').value = productInfo.settop || '';
    document.getElementById('selected-product-additionalTv').value = productInfo.additionalTv || '';
    document.getElementById('selected-product-combined').value = productInfo.combinedProduct || '';
    document.getElementById('selected-product-usim').value = productInfo.usim || '';
    document.getElementById('selected-product-totalPrice').value = productInfo.totalPrice || '';
    document.getElementById('selected-product-supportFund').value = productInfo.supportFund || '';
}

const signupForm = document.getElementById('signup-form');
if (!signupForm) return;

const formSections = document.querySelectorAll('.form-section');
const progressSteps = document.querySelectorAll('.progress-bar .step');
const prevBtn = document.querySelector('.btn-prev');
const nextBtn = document.querySelector('.btn-next');
const priceSummary = document.querySelector('.price-summary');
const navButtons = document.querySelector('.nav-buttons');
const confirmModal = document.getElementById('confirm-modal');
const paymentMethodSelect = document.getElementById('paymentMethod');
const payerInfoSection = document.getElementById('payer-info-section');
const cardInfoSection = document.getElementById('card-info-section');
const loadingOverlay = document.createElement('div'); // [추가] 로딩 오버레이 요소 생성
loadingOverlay.id = 'loading-overlay';
loadingOverlay.innerHTML = '<div class="spinner"></div><p>요청을 처리 중입니다...</p>';
document.body.appendChild(loadingOverlay);

let currentStep = 1;
let isPayerInfoConfirmed = false;

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxvKH6JTly1_VpfqXixLX9NA_T1tTM4z0FS-CWJHai0nW4Pn0Fv_p-JsG648IeKqAANUg/exec";

const accountLengthRules = {
    'KB국민은행': [12, 14], '신한은행': [11, 12, 14], '우리은행': [13], '하나은행': [11, 12, 14], 'IBK기업은행': [10, 11, 12, 14],
    'NH농협은행': [13], 'KDB산업은행': [12], 'SC제일은행': [11], '씨티은행': [10, 12], '수협은행': [12], '카카오뱅크': [13],
    '케이뱅크': [12], '토스뱅크': [12], '경남은행': [12], '광주은행': [11, 13], '대구은행': [11, 12, 13], '부산은행': [11, 12, 13],
    '전북은행': [11, 12, 14], '제주은행': [10, 12], '새마을금고': [13, 14], '신용협동조합': [13], '저축은행': [13], '우체국': [14]
};

function populateExpiryDateSelectors() {
    const monthSelect = document.getElementById('payerCardExpiryMonth');
    const yearSelect = document.getElementById('payerCardExpiryYear');
    if (!monthSelect || !yearSelect) return;
    const currentYear = new Date().getFullYear();

    for (let i = 1; i <= 12; i++) {
        const month = i.toString().padStart(2, '0');
        monthSelect.innerHTML += `<option value="${month}">${month}</option>`;
    }
    for (let i = 0; i < 15; i++) {
        const year = currentYear + i;
        yearSelect.innerHTML += `<option value="${year.toString().slice(-2)}">${year}</option>`;
    }
}

function updateFormUI() {
    formSections.forEach((section, index) => section.classList.toggle('active', index + 1 === currentStep));
    progressSteps.forEach((step, index) => step.classList.toggle('active', index < currentStep));
    prevBtn.style.display = currentStep === 1 ? 'none' : 'block';
    nextBtn.textContent = currentStep === formSections.length ? '제출하기' : '다음';
    if (priceSummary) priceSummary.style.display = currentStep === 1 ? 'block' : 'none';
    if (navButtons) navButtons.style.width = currentStep === 1 ? 'auto' : '100%';
}

function showValidationAlert(element, message) {
    const formGroup = element.closest('.form-group');
    if (!formGroup) { alert(message); return; }

    let messageEl = formGroup.querySelector('.validation-message');
    if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.className = 'validation-message';
        formGroup.appendChild(messageEl);
    }

    element.classList.add('invalid');
    messageEl.textContent = message;
    messageEl.style.display = 'block';
    element.focus();
}

function hideValidationAlert(element) {
    const formGroup = element.closest('.form-group');
    if (!formGroup) return;

    const messageEl = formGroup.querySelector('.validation-message');
    if (messageEl) messageEl.style.display = 'none';
    element.classList.remove('invalid');
}

document.querySelectorAll('.form-section [required]').forEach(input => {
    input.addEventListener('input', () => hideValidationAlert(input));
    input.addEventListener('change', () => hideValidationAlert(input));
});

function validateCurrentStep() {
    if (isTestMode) return true;

    const currentSection = formSections[currentStep - 1];
    for (const input of currentSection.querySelectorAll('[required]')) {
        if (input.offsetParent === null) continue;

        hideValidationAlert(input);

        if (input.tagName === 'SELECT' && input.value === '') { let labelText = document.querySelector(`label[for="${input.id}"]`)?.innerText.replace('*', '') || '선택항목'; showValidationAlert(input, `"${labelText}"을(를) 선택해주세요.`); return false; }
        if (input.type === 'radio' && !Array.from(currentSection.querySelectorAll(`input[name="${input.name}"]`)).some(radio => radio.checked)) { const groupLabel = input.closest('.form-group').querySelector('.label').innerText.replace('*', ''); showValidationAlert(input, `"${groupLabel}" 항목을 선택해주세요.`); return false; }
        else if (input.classList.contains('terms-checkbox-item') && !input.checked) { showValidationAlert(input, '필수 약관에 모두 동의해주셔야 합니다.'); return false; }
        else if (!input.value.trim() && !['SELECT', 'RADIO', 'CHECKBOX'].includes(input.tagName)) {
            if (input.id === 'address-basic') { showValidationAlert(input, '"주소찾기"를 진행해주세요.'); return false; }
            let labelText = document.querySelector(`label[for="${input.id}"]`)?.innerText.replace('*', '') || input.placeholder || '필수 입력';
            showValidationAlert(input, `"${labelText}" 항목은 필수입니다.`); return false;
        }
        const nameRegex = /^(?:[a-zA-Z]{4,}|[가-힣]{2,})$/;
        if ((input.id === 'name' || input.id === 'bizName' || input.id === 'corporateName') && !nameRegex.test(input.value)) { showValidationAlert(input, '이름/상호/법인명은 한글 2자 이상 또는 영문 4자 이상이어야 합니다.'); return false; }
        if (input.id === 'bizRegNumber' && !/^\d{10}$/.test(input.value)) { showValidationAlert(input, '사업자등록번호는 10자리 숫자로 입력해주세요.'); return false; }
        if (input.id === 'birth' && !/^\d{8}$/.test(input.value)) { showValidationAlert(input, '생년월일을 8자리 숫자로 정확히 입력해주세요.'); return false; }
        if (input.id === 'phone' && !/^010\d{8}$/.test(input.value.replace(/-/g, ''))) { showValidationAlert(input, '휴대폰 번호 형식이 올바르지 않습니다.'); return false; }
        if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) { showValidationAlert(input, '이메일 형식이 올바르지 않습니다.'); return false; }

        if (input.name === 'accountNumber' || input.name === 'payerAccountNumber') {
            const bankSelect = input.name === 'accountNumber' ? document.getElementById('bank') : document.getElementById('payerBank');
            const bankName = bankSelect.value;
            const accountNumber = input.value.replace(/\D/g, '');
            const rules = accountLengthRules[bankName];
            if (bankName && rules && !rules.includes(accountNumber.length)) {
                showValidationAlert(input, `${bankName} 계좌번호 자릿수(${rules.join(' 또는 ')}자리)가 올바르지 않습니다.`);
                return false;
            }
        }
        if (input.id === 'payerCardNumber' && !/^\d{15,16}$/.test(input.value.replace(/-/g, ''))) { showValidationAlert(input, '카드번호는 15~16자리 숫자로 입력해주세요.'); return false; }
        if (input.id === 'payerCardExpiryMonth' || input.id === 'payerCardExpiryYear') {
            const monthSelect = document.getElementById('payerCardExpiryMonth');
            const yearSelect = document.getElementById('payerCardExpiryYear');
            if (monthSelect.value && yearSelect.value) {
                const today = new Date();
                const currentMonth = today.getMonth() + 1;
                const currentYear = today.getFullYear() % 100;
                const selectedMonth = parseInt(monthSelect.value, 10);
                const selectedYear = parseInt(yearSelect.value, 10);

                if (selectedYear < currentYear || (selectedYear === currentYear && selectedMonth < currentMonth)) {
                    showValidationAlert(monthSelect, '만료된 카드입니다. 유효기간을 다시 확인해주세요.');
                    return false;
                }
            }
        }
    }
    return true;
}

function goToNextStep() {
    if (!validateCurrentStep()) return;
    if (currentStep < formSections.length) {
        if (currentStep === 4 && !isPayerInfoConfirmed) {
            if (paymentMethodSelect.value) { confirmModal.style.display = 'flex'; return; }
        }
        currentStep++; isPayerInfoConfirmed = false; updateFormUI();
    } else { signupForm.dispatchEvent(new Event('submit', { cancelable: true })); }
}

if (paymentMethodSelect) paymentMethodSelect.addEventListener('change', function () { payerInfoSection.style.display = 'none'; cardInfoSection.style.display = 'none'; isPayerInfoConfirmed = false; });
if (prevBtn) prevBtn.addEventListener('click', () => { if (currentStep > 1) { currentStep--; isPayerInfoConfirmed = false; updateFormUI(); } });
if (nextBtn) nextBtn.addEventListener('click', goToNextStep);

function showPayerSection(isSamePerson) {
    isPayerInfoConfirmed = true; const selectedMethod = paymentMethodSelect.value;
    const sections = {
        '계좌이체': { section: payerInfoSection, nameFieldId: 'payerName', bankFieldId: 'payerBank', accountFieldId: 'payerAccountNumber' },
        '카드납부': { section: cardInfoSection, nameFieldId: 'cardHolderName', monthField: 'payerCardExpiryMonth', yearField: 'payerCardExpiryYear' }
    };
    Object.values(sections).forEach(s => { if (s.section) { s.section.style.display = 'none'; s.section.querySelectorAll('input, select').forEach(el => el.required = false); } });

    const target = sections[selectedMethod];
    if (target && target.section) {
        target.section.style.display = 'block';
        target.section.querySelectorAll('input, select').forEach(el => el.required = true);

        const applicantName = document.getElementById('name').value;
        if (isSamePerson) {
            document.getElementById(target.nameFieldId).value = applicantName;
            if (selectedMethod === '계좌이체') {
                document.getElementById(target.bankFieldId).value = document.getElementById('bank').value;
                document.getElementById(target.accountFieldId).value = document.getElementById('giftAccountNumber').value;
            }
        } else {
            document.getElementById(target.nameFieldId).value = '';
            document.getElementById(target.nameFieldId).focus();
            if (selectedMethod === '계좌이체') {
                document.getElementById(target.bankFieldId).value = '';
                document.getElementById(target.accountFieldId).value = '';
            } else if (selectedMethod === '카드납부') {
                document.getElementById(target.monthField).value = '';
                document.getElementById(target.yearField).value = '';
            }
        }
    }
    confirmModal.style.display = 'none';
}

const modalYesBtn = document.getElementById('modal-yes');
const modalNoBtn = document.getElementById('modal-no');
if (modalYesBtn) modalYesBtn.addEventListener('click', () => showPayerSection(true));
if (modalNoBtn) modalNoBtn.addEventListener('click', () => showPayerSection(false));

const payerCardNumberInput = document.getElementById('payerCardNumber');
if (payerCardNumberInput) payerCardNumberInput.addEventListener('input', function (e) { let v = e.target.value.replace(/\D/g, ''); e.target.value = v.replace(/(\d{4})(?=\d)/g, '$1-'); });

const customerTypeRadios = document.querySelectorAll('input[name="customerType"]');
const corporateNameSection = document.getElementById('corporate-name-section'); const bizNameSection = document.getElementById('biz-name-section');
const bizRegNumberSection = document.getElementById('biz-reg-number-section'); const birthSection = document.getElementById('birth-section');
const personNameSection = document.getElementById('person-name-section');
const corporateNameInput = document.getElementById('corporateName'); const bizNameInput = document.getElementById('bizName');
const bizRegNumberInput = document.getElementById('bizRegNumber'); const birthInput = document.getElementById('birth');
const personNameInput = document.getElementById('name'); const nameLabel = document.getElementById('name-label');

function handleCustomerTypeChange(type) {
    if (!corporateNameSection) return;
    corporateNameSection.style.display = 'none'; corporateNameInput.required = false;
    bizNameSection.style.display = 'none'; bizNameInput.required = false;
    bizRegNumberSection.style.display = 'none'; bizRegNumberInput.required = false;
    birthSection.style.display = 'block'; birthInput.required = true;
    personNameSection.style.display = 'block'; personNameInput.required = true;
    nameLabel.innerHTML = '가입자명<span class="required">*</span>';

    if (type === '개인사업자') {
        bizNameSection.style.display = 'block';
        bizNameInput.required = true;
    } else if (type === '법인사업자') {
        corporateNameSection.style.display = 'block'; corporateNameInput.required = true;
        bizRegNumberSection.style.display = 'block'; bizRegNumberInput.required = true;
        nameLabel.innerHTML = '대표자명<span class="required">*</span>';
        birthSection.style.display = 'none';
        birthInput.required = false;
    }
}
customerTypeRadios.forEach(radio => radio.addEventListener('change', (e) => handleCustomerTypeChange(e.target.value)));

const termsAllCheckbox = document.getElementById('agree-all');
const termsCheckboxes = Array.from(document.querySelectorAll('.terms-checkbox-item'));

if (termsAllCheckbox) {
    termsAllCheckbox.addEventListener('change', () => {
        termsCheckboxes.forEach(checkbox => {
            checkbox.checked = termsAllCheckbox.checked;
        });
    });
}

termsCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        if (termsAllCheckbox) termsAllCheckbox.checked = termsCheckboxes.every(cb => cb.checked);
    });
});

const termsToggles = document.querySelectorAll('.terms-toggle-arrow');
const termsDetailModal = document.getElementById('terms-detail-modal');
const termsModalTitle = document.getElementById('terms-modal-title');
const termsModalBody = document.getElementById('terms-modal-body');
const termsModalCloseBtn = document.getElementById('terms-modal-close');

const termsContent = {
    term1: { title: '(필수) 개인정보 수집 및 이용 동의', content: '<strong>제1조 (목적)</strong><br>본 약관은 성지넷 서비스 이용을 위해 필요한 개인정보의 수집 및 이용에 관한 사항을 규정함을 목적으로 합니다.<br><br><strong>제2조 (수집 항목)</strong><br>수집하는 개인정보 항목은 다음과 같습니다: 이름, 연락처, 주소 등 서비스 제공에 필요한 최소한의 정보.<br><br><strong>제3조 (보유 기간)</strong><br>수집된 정보는 서비스 제공 기간 동안 보유하며, 법령에 따른 보관 기간 이후에는 지체 없이 파기합니다.' },
    term2: { title: '(필수) 개인정보 제3자 제공 동의', content: '<strong>제1조 (제공받는 자)</strong><br>서비스 가입 및 설치를 위해 각 통신사(SK, KT, LG U+ 등)에 개인정보가 제공됩니다.<br><br><strong>제2조 (제공 목적)</strong><br>인터넷, TV 등 신청하신 상품의 원활한 개통 및 설치 진행을 위함입니다.<br><br><strong>제3조 (제공 항목)</strong><br>성명, 연락처, 설치 주소 등 개통에 필요한 정보.' },
    term3: { title: '(선택) 마케팅 정보 수신 동의', content: '<strong>제1조 (수신 목적)</strong><br>신규 상품 출시, 특별 할인 이벤트, 제휴 혜택 등 고객님께 유용한 마케팅 정보를 SMS, 이메일, 앱 푸시 등을 통해 제공하기 위함입니다.<br><br><strong>제2조 (철회 방법)</strong><br>마케팅 정보 수신을 원치 않으실 경우, 언제든지 고객센터(1644-6780)를 통해 동의를 철회할 수 있습니다.' }
};

termsToggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const termKey = toggle.dataset.term;
        const termData = termsContent[termKey];
        if (termData && termsDetailModal) {
            termsModalTitle.textContent = termData.title;
            termsModalBody.innerHTML = termData.content;
            termsDetailModal.style.display = 'flex';
        }
    });
});

function closeTermsModal() {
    if (termsDetailModal) termsDetailModal.style.display = 'none';
}
if (termsDetailModal) termsDetailModal.addEventListener('click', (e) => { if (e.target === termsDetailModal) closeTermsModal(); });
if (termsModalCloseBtn) termsModalCloseBtn.addEventListener('click', closeTermsModal);

if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validateCurrentStep()) return;

        // [수정] 로딩 시작
        loadingOverlay.classList.add('visible');
        nextBtn.disabled = true;
        nextBtn.textContent = '제출 중...';

        const formData = new FormData(signupForm);
        const data = Object.fromEntries(formData.entries());

        if (data.payerCardExpiryMonth && data.payerCardExpiryYear) {
            data.payerCardExpiry = `${data.payerCardExpiryMonth}/${data.payerCardExpiryYear}`;
            delete data.payerCardExpiryMonth;
            delete data.payerCardExpiryYear;
        }

        if (!SCRIPT_URL || !SCRIPT_URL.includes("AKfyc")) {
            alert("신청 시스템이 준비되지 않았습니다. 관리자에게 문의해주세요.");
            // [수정] 로딩 종료
            loadingOverlay.classList.remove('visible');
            nextBtn.disabled = false;
            updateFormUI();
            return;
        }

        fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(data),
            redirect: "follow",
        })
            .then(response => response.json())
            .then(data => {
                if (data.result === 'success') {
                    alert('가입 신청이 성공적으로 접수되었습니다. 곧 안내 연락드리겠습니다.');
                    sessionStorage.removeItem('returnContext');
                    window.location.href = 'index.html';
                } else {
                    throw new Error(data.message || '알 수 없는 서버 오류가 발생했습니다.');
                }
            })
            .catch(error => {
                console.error('Fetch Error!', error);
                alert('신청 중 오류가 발생했습니다. 네트워크 연결을 확인하거나 관리자에게 문의해주세요.');
            })
            .finally(() => {
                // [수정] 로딩 종료
                loadingOverlay.classList.remove('visible');
                nextBtn.disabled = false;
                updateFormUI();
            });
    });
}

if (document.getElementById('signup-form')) {
    populateExpiryDateSelectors();
    updateFormUI();
    handleCustomerTypeChange('개인');
}
});