let heroSwiper = null;

// ============================================================
// [1] 전역 헬퍼 함수 (비교함 데이터 관리)
// ============================================================
function getCompareList() {
    return JSON.parse(sessionStorage.getItem('compareList') || '[]');
}

function saveCompareList(list) {
    sessionStorage.setItem('compareList', JSON.stringify(list));
    updateCompareCount();
}

function updateCompareCount() {
    const badge = document.getElementById('compare-count-badge');
    if (badge) {
        badge.textContent = getCompareList().length;
    }
}

function clearCompareList() {
    try {
        sessionStorage.removeItem('compareList');
    } catch (e) {
        console.error('clearCompareList 오류', e);
    }
    updateCompareCount();
}

window.addToCompare = function (item) {
    let list = getCompareList();
    if (!list.some(i => i.id === item.id)) {
        if (list.length >= 4) {
            alert('비교함에는 최대 4개까지 담을 수 있습니다.');
            return;
        }
        list.push(item);
        saveCompareList(list);
    } else {
        alert('이미 비교함에 추가된 항목입니다.');
    }
}

window.generateSignupUrl = function (resultId) {
    const allResults = JSON.parse(sessionStorage.getItem('lastAiResults') || '[]');
    const result = allResults.find(r => r.id === resultId);
    if (!result) return 'signup.html';

    const userSelections = JSON.parse(sessionStorage.getItem('lastAiSelections') || '{}');
    const usimCount = (userSelections.mobilePlans || []).filter(p => p.hasUsim).length;

    const params = {
        telecom: result.carrier,
        internet: result.details.internet?.name,
        tv: result.details.tv?.name,
        combinedProduct: result.bestPlanName,
        usim: usimCount > 0 ? `${usimCount}개` : null,
        totalPrice: `${Math.round(result.netBill)}`,
        supportFund: `${Math.round(result.cashBenefit)}`
    };
    const cleanedParams = {};
    for (const key in params) {
        if (params[key] !== null && params[key] !== undefined) cleanedParams[key] = params[key];
    }
    return 'signup.html?' + new URLSearchParams(cleanedParams).toString();
}


// ============================================================
// [2] Main Initialize Function
// ============================================================
export function initializeUI(telecomData) {

    // [Issue 1 해결] 동적 생성된 모달 닫기 버튼에 대한 전역 이벤트 위임
    document.body.addEventListener('click', (e) => {
        if (e.target.id === 'modal-close-btn-footer' || e.target.classList.contains('btn-close')) {
            const modal = e.target.closest('.modal-overlay');
            if (modal) {
                window.globalModal.close(modal.id);
            }
        }
    });

    function setupModalHistoryHandler() {
        const modalIds = [
            'detail-modal', 'secret-benefit-modal', 'custom-alert',
            'affiliate-card-modal', 'quick-signup-modal',
            'quick-signup-info-modal', 'event-detail-modal',
            'compare-modal'
        ];
        let currentlyOpenModalId = null;

        const openModalWithHistory = (modalId) => {
            const modal = document.getElementById(modalId);
            if (!modal || modal.classList.contains('visible')) return;

            document.body.classList.add('modal-open');
            modal.classList.add('visible');
            modal.setAttribute('aria-hidden', 'false');

            currentlyOpenModalId = modalId;
            history.pushState({ modalId: modalId }, '', `#${modalId}`);
        };

        const closeModal = (modalId, fromPopState = false) => {
            const modal = document.getElementById(modalId);
            if (!modal || !modal.classList.contains('visible')) return;

            document.body.classList.remove('modal-open');
            modal.classList.remove('visible');
            modal.setAttribute('aria-hidden', 'true');

            if (currentlyOpenModalId === modalId) {
                currentlyOpenModalId = null;
            }

            if (!fromPopState && location.hash === `#${modalId}`) {
                history.replaceState(null, '', location.pathname + location.search);
            }

            // [Issue 4 해결] 비교함에서 상담신청 후 돌아왔을 때 비교함 다시 열기
            if (modalId === 'quick-signup-modal' || modalId === 'secret-benefit-modal') {
                if (sessionStorage.getItem('returnToCompare') === 'true') {
                    sessionStorage.removeItem('returnToCompare');
                    setTimeout(() => {
                        openModalWithHistory('compare-modal');
                    }, 100);
                }
            }
        };

        window.addEventListener('popstate', (event) => {
            if (currentlyOpenModalId && (!event.state || event.state.modalId !== currentlyOpenModalId)) {
                closeModal(currentlyOpenModalId, true);
            }
        });

        modalIds.forEach(id => {
            const modal = document.getElementById(id);
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal || e.target.closest('.modal-close-btn')) {
                        closeModal(id);
                    }
                });
            }
        });

        window.globalModal = { open: openModalWithHistory, close: closeModal };
    }

    // ▼▼▼ [수정] 더미 게시판 데이터 및 렌더링 로직 제거 ▼▼▼
    // 기존에 존재하던 더미 데이터와 renderBoard 함수는 js/board.js의 실제 로직과 충돌하므로 제거합니다.
    // ▼▼▼ [수정] 끝 ▼▼▼

    function setupPageViewToggle() {
        const mainContentWrapper = document.getElementById('main-content-wrapper');
        const aiViewWrapper = document.getElementById('ai-view-wrapper');
        const boardViewWrapper = document.getElementById('board-view-wrapper');

        const aiNavButton = document.getElementById('ai-calculator-nav-link-text');
        const aiHeaderButton = document.getElementById('ai-calculator-header-link');
        const aiBodyButton = document.getElementById('ai-calculator-body-link');
        const logoButton = document.getElementById('logo-link');
        const quickAiFinderBtn = document.getElementById('quick-ai-finder-btn');
        const fabAiFinderBtn = document.getElementById('fab-ai-finder');
        const heroAiPlannerBtn = document.getElementById('hero-ai-planner-btn');

        // 게시판 링크 선택 (href 속성 활용)
        const tipsLinks = document.querySelectorAll('a[href="tips.html"]');
        const reviewsLinks = document.querySelectorAll('a[href="reviews.html"]');

        const switchView = (viewName, pushState = true) => {
            window.scrollTo(0, 0);
            if (mainContentWrapper) mainContentWrapper.style.display = 'none';
            if (aiViewWrapper) aiViewWrapper.style.display = 'none';
            if (boardViewWrapper) boardViewWrapper.style.display = 'none';
            document.body.classList.remove('ai-view-active');

            if (viewName === 'main') {
                if (mainContentWrapper) mainContentWrapper.style.display = 'block';
                if (window.heroSwiper && typeof window.heroSwiper.update === 'function') {
                    setTimeout(() => {
                        try {
                            window.heroSwiper.update();
                            if (window.heroSwiper.slideTo) window.heroSwiper.slideTo(0);
                            if (window.heroSwiper.autoplay && typeof window.heroSwiper.autoplay.start === 'function') {
                                window.heroSwiper.autoplay.start();
                            }
                        } catch (e) { console.error('Hero Swiper 재초기화 중 오류', e); }
                    }, 0);
                }
                if (pushState) {
                    history.pushState({ view: 'main' }, '', location.pathname + location.search);
                }
            } else if (viewName === 'ai') {
                if (aiViewWrapper) aiViewWrapper.style.display = 'block';
                document.body.classList.add('ai-view-active');
                if (pushState) {
                    history.pushState({ view: 'ai' }, '', '#ai');
                }
            } else if (viewName === 'board') {
                if (boardViewWrapper) boardViewWrapper.style.display = 'block';
                if (pushState) {
                    history.pushState({ view: 'board' }, '', '#board');
                }
            }
        };

        // [추가] 뒤로가기(popstate) 처리
        window.addEventListener('popstate', (event) => {
            // 모달 히스토리인 경우 무시 (모달 핸들러가 처리)
            if (event.state && event.state.modalId) return;

            // 뷰 상태 복원
            if (event.state && event.state.view) {
                switchView(event.state.view, false);
            } else {
                // state가 없으면 해시 기반으로 판단 (초기 진입 등)
                if (location.hash === '#ai') {
                    switchView('ai', false);
                } else if (location.hash === '#board') {
                    switchView('board', false);
                } else {
                    switchView('main', false);
                }
            }
        });

        // AI View Triggers
        const aiTriggers = [aiNavButton, aiHeaderButton, aiBodyButton, heroAiPlannerBtn, quickAiFinderBtn, fabAiFinderBtn];
        aiTriggers.forEach(btn => {
            if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); switchView('ai'); });
        });

        // Main View Triggers
        if (logoButton) logoButton.addEventListener('click', (e) => { e.preventDefault(); switchView('main'); });

        // Board View Triggers
        tipsLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                switchView('board');
                // ▼▼▼ [수정] 실제 board.js의 탭 전환 함수 호출 ▼▼▼
                if (window.changeBoardType) window.changeBoardType('tips');
            });
        });
        reviewsLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                switchView('board');
                // ▼▼▼ [수정] 실제 board.js의 탭 전환 함수 호출 ▼▼▼
                if (window.changeBoardType) window.changeBoardType('reviews');
            });
        });

        // Board Internal Tabs - js/board.js에서 직접 처리하므로 여기서는 제거
        // document.querySelectorAll('.board-tab').forEach(btn => {
        //     btn.addEventListener('click', () => {
        //         renderBoard(btn.dataset.board);
        //     });
        // });

        document.querySelectorAll('a[data-carrier]').forEach(link => {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                switchView('main');
                const carrierKey = this.dataset.carrier;
                const telecomButton = document.querySelector(`#telecom-options-simple .option-btn[data-key="${carrierKey}"]`);
                if (telecomButton) telecomButton.click();
                document.querySelector('#calculator-section')?.scrollIntoView({ behavior: 'smooth' });
            });
        });

        // [추가] AI 화면 내 뒤로가기 버튼 처리
        const aiBackBtn = document.getElementById('ai-back-btn');
        if (aiBackBtn) {
            aiBackBtn.addEventListener('click', (e) => {
                e.preventDefault();
                switchView('main');
            });
        }

        try {
            const rawContext = sessionStorage.getItem('returnContext');
            const ctx = rawContext ? JSON.parse(rawContext) : null;

            if (location.hash === '#ai' || ctx?.type === 'ai') {
                switchView('ai', false); // 초기 로딩 시에는 pushState 하지 않음
                if (ctx?.selections) {
                    const { internetSpeed, tvPlan, additionalTvCount, mobilePlans } = ctx.selections;
                    document.querySelector(`#internet-selector button[data-value="${internetSpeed}"]`)?.click();
                    document.querySelector(`#tv-selector button[data-value="${tvPlan}"]`)?.click();
                    document.querySelector(`#additional-tv-selector button[data-value="${additionalTvCount}"]`)?.click();

                    if (mobilePlans && mobilePlans.length > 0) {
                        document.querySelector('#mobile-combination-selector button[data-value="yes"]')?.click();
                        const addBtn = document.getElementById('add-mobile-btn');
                        document.querySelectorAll('#mobile-list .mobile-entry:not(:first-child)').forEach(el => el.remove());
                        mobilePlans.forEach((plan, index) => { if (index > 0) addBtn.click(); });

                        setTimeout(() => {
                            document.querySelectorAll('#mobile-list .mobile-entry').forEach((entry, index) => {
                                const plan = mobilePlans[index];
                                if (plan && window.MOBILE_TIER_PRICES) {
                                    const tierValue = Object.keys(window.MOBILE_TIER_PRICES).find(key => window.MOBILE_TIER_PRICES[key].price === plan.price) || "80000";
                                    entry.querySelector('.mobile-plan-tier').value = tierValue;
                                    entry.querySelector('.youth-checkbox').checked = plan.isYouth;
                                    entry.querySelector('.usim-checkbox').checked = plan.hasUsim;
                                }
                            });
                        }, 100);
                    } else {
                        document.querySelector('#mobile-combination-selector button[data-value="no"]')?.click();
                    }

                    if (ctx.results && ctx.results.html) {
                        sessionStorage.setItem('lastAiResults', JSON.stringify(ctx.results.data));
                        sessionStorage.setItem('lastAiSelections', JSON.stringify(ctx.selections));
                        const payload = new CustomEvent('restoreAiResults', { detail: ctx.results });
                        const fire = () => document.dispatchEvent(payload);
                        if (window.aiModuleReady) fire();
                        else window.addEventListener('ai-module-ready', fire, { once: true });
                    }
                }
            } else if (location.hash === '#calculator-section' || ctx?.type === 'main') {
                switchView('main', false); // 초기 로딩 시에는 pushState 하지 않음
                if (ctx?.state) {
                    const payload = new CustomEvent('restoreMainCalculator', { detail: ctx.state });
                    const fire = () => document.dispatchEvent(payload);
                    if (window.mainModuleReady) fire();
                    else window.addEventListener('main-module-ready', fire, { once: true });
                }
                document.querySelector('#calculator-section')?.scrollIntoView({ behavior: 'auto' });
            }
            sessionStorage.removeItem('returnContext');
        } catch (e) {
            console.warn('상태 복원 중 오류 발생:', e);
            sessionStorage.removeItem('returnContext');
        }
    }

    function setupSecretBenefitModal() {
        const secretBenefitBtns = document.querySelectorAll('#secret-benefit-link-nav, #quick-secret-benefit-btn, #fab-secret-benefit, #secret-benefit-link-body');
        const modalId = 'secret-benefit-modal';
        const modalOverlay = document.getElementById(modalId);
        if (!modalOverlay || secretBenefitBtns.length === 0) return;

        const form = document.getElementById('benefit-apply-form');
        const nameInput = document.getElementById('benefit-name');
        const phoneInput = document.getElementById('benefit-phone');
        const consentAll = document.getElementById('benefit-consent-all');
        const consentItems = Array.from(form.querySelectorAll('.consent-item'));
        const consentToggles = form.querySelectorAll('.consent-toggle-arrow');
        const productBtns = modalOverlay.querySelectorAll('.product-btn');
        const loadingOverlay = document.getElementById('loading-overlay');

        secretBenefitBtns.forEach(btn => btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.globalModal.open(modalId);
        }));

        productBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('selected');
            });
        });

        const nameRegex = /^(?:[a-zA-Z]{4,}|[가-힣]{2,})$/;
        const phoneRegex = /^010-\d{4}-\d{4}$/;

        const validateField = (input, regex, message) => {
            const validationMessage = input.nextElementSibling;
            if (!input.value || !regex.test(input.value)) {
                input.classList.add('invalid');
                validationMessage.textContent = message;
                validationMessage.style.display = 'block';
                return false;
            } else {
                input.classList.remove('invalid');
                validationMessage.style.display = 'none';
                return true;
            }
        };

        nameInput.addEventListener('input', () => validateField(nameInput, nameRegex, '이름은 한글 2자 이상, 또는 영문 4자 이상 입력해주세요.'));
        phoneInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/[^0-9]/g, '');
            if (value.length > 11) value = value.slice(0, 11);
            e.target.value = value.replace(/^(\d{3})(\d{4})(\d{4})$/, `$1-$2-$3`);
            validateField(phoneInput, phoneRegex, '휴대폰번호 형식이 올바르지 않습니다.');
        });

        consentAll.addEventListener('change', () => {
            consentItems.forEach(item => item.checked = consentAll.checked);
        });

        consentItems.forEach(item => {
            item.addEventListener('change', () => {
                const allChecked = consentItems.every(i => i.checked);
                consentAll.checked = allChecked;
            });
        });

        consentToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                const detail = toggle.closest('li').querySelector('.consent-detail');
                const isOpen = detail.classList.toggle('open');
                toggle.classList.toggle('open', isOpen);
                if (isOpen) {
                    detail.style.maxHeight = detail.scrollHeight + 'px';
                } else {
                    detail.style.maxHeight = '0';
                }
            });
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const isNameValid = validateField(nameInput, nameRegex, '이름은 한글 2자 이상, 또는 영문 4자 이상 입력해주세요.');
            const isPhoneValid = validateField(phoneInput, phoneRegex, '휴대폰번호 형식이 올바르지 않습니다.');
            const isConsentValid = [...form.querySelectorAll('.consent-required')].every(c => c.checked);

            if (!isConsentValid) {
                alert('필수 약관에 모두 동의해주세요.');
                return;
            }

            if (isNameValid && isPhoneValid && isConsentValid) {
                const submitBtn = form.querySelector('.btn-submit');
                const originalBtnText = submitBtn ? submitBtn.innerHTML : '처리 중...';
                const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwofjx4zLTtMX5Fi3lzw4oNYqDcLn7_gygyDblAJ5Pxfg7c-A6P39MPNP6l7Xm2lHhfjQ/exec";

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '처리 중...';
                }
                if (loadingOverlay) loadingOverlay.classList.add('visible');

                const selectedProducts = [...productBtns].filter(btn => btn.classList.contains('selected')).map(btn => btn.querySelector('span').textContent);
                const applicationData = {
                    products: selectedProducts,
                    name: nameInput.value,
                    phone: phoneInput.value,
                    consents: {
                        all: consentAll.checked,
                        required: [...form.querySelectorAll('.consent-required')].map(c => c.checked),
                        marketing: form.querySelector('.consent-item:not(.consent-required)')?.checked || false
                    }
                };

                fetch(SCRIPT_URL, {
                    method: 'POST',
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify(applicationData),
                    redirect: "follow",
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.result === 'success') {
                            window.globalModal.close(modalId);
                            setTimeout(() => {
                                window.globalModal.open('custom-alert');
                            }, 80);
                            form.reset();
                            productBtns.forEach(btn => btn.classList.remove('selected'));
                            productBtns[0]?.classList.add('selected');
                        } else {
                            throw new Error(data.message || '알 수 없는 서버 오류');
                        }
                    })
                    .catch(error => {
                        console.error('Fetch Error:', error);
                        alert('신청 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.');
                    })
                    .finally(() => {
                        if (loadingOverlay) loadingOverlay.classList.remove('visible');
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = originalBtnText;
                        }
                    });
            }
        });

        const customAlert = document.getElementById('custom-alert');
        if (customAlert) {
            customAlert.addEventListener('click', (e) => {
                if (e.target.id === 'alert-close-btn') {
                    window.globalModal.close('custom-alert');
                } else if (e.target.id === 'alert-signup-btn') {
                    window.globalModal.close('custom-alert');
                    document.getElementById('calculator-section')?.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
    }

    function setupQuickMenu() {
        const stickyHeader = document.querySelector('.sticky-header-container');
        const summaryBar = document.querySelector('.summary-sticky-bar');
        const pageBackdrop = document.querySelector('.page-backdrop');
        let backdrop = document.querySelector('.quick-menu-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'quick-menu-backdrop';
            document.body.appendChild(backdrop);
        }

        const headerBtn = document.getElementById('quick-menu-header-btn');
        const container = document.querySelector('.quick-menu-container.right-sidebar');
        const closeBtn = container?.querySelector('.quick-menu-close-btn');
        const fabContainer = document.querySelector('.mobile-fab-container');
        const fabToggleBtn = document.getElementById('fab-toggle-btn');
        const fabMenu = document.querySelector('.fab-menu');

        const openPcMenu = () => {
            if (!container || !stickyHeader) return;
            const headerHeight = stickyHeader.offsetHeight;
            const summaryBarHeight = summaryBar && (window.getComputedStyle(summaryBar).display !== 'none') ? summaryBar.offsetHeight : 0;

            container.style.top = `${headerHeight}px`;
            container.style.height = `calc(100vh - ${headerHeight}px - ${summaryBarHeight}px)`;
            backdrop.style.top = `${headerHeight}px`;

            container.classList.add('open');
            document.body.classList.add('quick-menu-open');
            backdrop.classList.add('visible');
        };

        const closePcMenu = () => {
            if (!container) return;
            container.classList.remove('open');
            document.body.classList.remove('quick-menu-open');
            backdrop.classList.remove('visible');
        };

        const closeAllMenus = () => {
            closePcMenu();
            if (fabContainer) fabContainer.classList.remove('open');
            if (pageBackdrop) pageBackdrop.classList.remove('visible');
        };

        headerBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            container.classList.contains('open') ? closePcMenu() : openPcMenu();
        });

        closeBtn?.addEventListener('click', closeAllMenus);
        container?.querySelectorAll('.quick-panel-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!btn.target || btn.target !== '_blank') {
                    if (!btn.getAttribute('href') || btn.getAttribute('href') === '#') {
                        e.preventDefault();
                        closeAllMenus();
                    }
                }
            });
        });

        fabToggleBtn?.addEventListener('click', () => {
            const isOpen = fabContainer.classList.toggle('open');
            pageBackdrop?.classList.toggle('visible', isOpen);
        });

        fabMenu?.addEventListener('click', (e) => {
            if (e.target.closest('.fab-action-btn')) {
                closeAllMenus();
            }
        });

        backdrop.addEventListener('click', closeAllMenus);
        pageBackdrop?.addEventListener('click', closeAllMenus);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeAllMenus();
        });
    }

    function setupAffiliateCardLink() {
        const affiliateCardBtns = document.querySelectorAll('#affiliate-card-link, #affiliate-card-link-body');
        const modalId = 'affiliate-card-modal';
        const modal = document.getElementById(modalId);
        if (affiliateCardBtns.length === 0 || !modal) return;

        const tabsContainer = modal.querySelector('.card-modal-tabs');
        const tabBtns = modal.querySelectorAll('.card-tab-btn');
        const tabContents = modal.querySelectorAll('.card-tab-content');

        affiliateCardBtns.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                window.globalModal.open(modalId);
            });
        });

        tabsContainer.addEventListener('click', (e) => {
            const targetBtn = e.target.closest('.card-tab-btn');
            if (!targetBtn) return;
            const tabId = targetBtn.dataset.tab;
            tabBtns.forEach(btn => btn.classList.remove('active'));
            targetBtn.classList.add('active');
            tabContents.forEach(content => content.classList.toggle('active', content.id === tabId));
        });
    }

    function setupQuickSignupModal() {
        if (!telecomData) return;
        const mainModalId = 'quick-signup-modal';
        const infoModalId = 'quick-signup-info-modal';
        const triggerBtns = document.querySelectorAll('#quick-self-signup-btn, #fab-self-signup, #hero-quick-signup-btn');
        const loadingOverlay = document.getElementById('loading-overlay');
        if (triggerBtns.length === 0) return;

        const QUICK_SIGNUP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwFxt5YjlMdWEJW3VWC_7eTyP0Xm_GN2lBOfecVCoU8MTmJwr1ecBvutMSglR_jjBUc/exec";

        const submitBtn = document.getElementById('qs-submit-btn');
        const infoForm = document.getElementById('quick-signup-info-form');

        const containers = {
            telecom: document.getElementById('qs-telecom-options'),
            internet: document.getElementById('qs-internet-options'),
            tv: document.getElementById('qs-tv-options'),
            additionalTv: document.getElementById('qs-additional-tv-select'),
            usim: document.getElementById('qs-usim-toggle')
        };
        let quickSignupState = {};

        triggerBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.globalModal.open(mainModalId);
                initializeMainModal();
            });
        });

        const createButton = (type, item, container) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = item.name.split('(')[0].trim();
            btn.dataset.name = item.name;
            btn.dataset.key = item.key || item.id;

            btn.onclick = () => {
                container.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                quickSignupState[type] = item;
                if (type === 'telecom') renderSubOptions(item.key);
                if (type === 'tv') container.querySelector('.no-tv-btn')?.classList.remove('selected');
            };
            container.appendChild(btn);
            return btn;
        };

        const renderSubOptions = (telecomKey) => {
            quickSignupState.telecom = { key: telecomKey, name: telecomData[telecomKey].name || telecomKey };
            ['internet', 'tv'].forEach(type => {
                containers[type].innerHTML = '';
                const options = telecomData[telecomKey]?.[type] || [];
                if (type === 'tv') {
                    const noTvBtn = document.createElement('button');
                    noTvBtn.className = 'option-btn no-tv-btn';
                    noTvBtn.textContent = '미신청';
                    noTvBtn.onclick = () => {
                        quickSignupState.tv = null;
                        containers.tv.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
                        noTvBtn.classList.add('selected');
                    };
                    containers.tv.appendChild(noTvBtn);
                }
                options.forEach(item => createButton(type, item, containers[type]));
            });

            containers.additionalTv.innerHTML = '<option value="">선택 안함</option>';
            (telecomData[telecomKey]?.additionalTv || []).forEach(item => {
                containers.additionalTv.add(new Option(item.name, item.name));
            });
            quickSignupState.internet = null;
            quickSignupState.tv = null;
            quickSignupState.additionalTv = null;
        };

        const initializeMainModal = () => {
            quickSignupState = { usim: false };
            if (containers.usim) containers.usim.checked = false;
            containers.telecom.innerHTML = '';

            const initialTelecomOrder = ['LG', 'KT', 'SK', 'SKB', 'Skylife', 'HelloVision'];
            initialTelecomOrder.forEach(key => {
                if (telecomData[key]) {
                    createButton('telecom', { key: key, name: telecomData[key].name || key }, containers.telecom);
                }
            });

            if (window.qsPrefillData) {
                const targetCarrierName = window.qsPrefillData.carrier;
                const telecomBtn = Array.from(containers.telecom.children).find(btn =>
                    btn.dataset.name === targetCarrierName || btn.textContent.trim() === targetCarrierName
                );

                if (telecomBtn) {
                    telecomBtn.click();
                    if (window.qsPrefillData.internet) {
                        const netBtn = Array.from(containers.internet.children).find(btn =>
                            btn.dataset.name === window.qsPrefillData.internet
                        );
                        if (netBtn) netBtn.click();
                    }
                    if (window.qsPrefillData.tv) {
                        const tvBtn = Array.from(containers.tv.children).find(btn =>
                            btn.dataset.name === window.qsPrefillData.tv
                        );
                        if (tvBtn) tvBtn.click();
                    }
                }
                window.qsPrefillData = null;
            } else {
                const lgBtn = containers.telecom.querySelector('button[data-key="LG"]');
                if (lgBtn) {
                    lgBtn.click();
                    const internet500Btn = containers.internet.querySelector('button[data-name*="500"]');
                    if (internet500Btn) internet500Btn.click();
                    const tvBasicBtn = containers.tv.querySelector('button[data-name*="베이직"]');
                    if (tvBasicBtn) tvBasicBtn.click();
                }
            }
        };

        containers.additionalTv.onchange = e => {
            const name = e.target.value;
            quickSignupState.additionalTv = name ? { name } : null;
        };
        containers.usim.onchange = e => { quickSignupState.usim = e.target.checked; };

        submitBtn.onclick = () => {
            if (!quickSignupState.telecom || !quickSignupState.internet) {
                alert('통신사와 인터넷 상품은 필수로 선택해야 합니다.');
                return;
            }

            submitBtn.blur();

            window.globalModal.close(mainModalId, true);
            window.globalModal.open(infoModalId);

            setTimeout(() => {
                document.getElementById('qs-info-name')?.focus();
            }, 50);
        };

        const nameRegex = /^(?:[a-zA-Z]{4,}|[가-힣]{2,})$/;
        const phoneRegex = /^010-\d{4}-\d{4}$/;

        const validateField = (input, regex, message) => {
            const validationMessage = input.nextElementSibling;
            if (!input.value || !regex.test(input.value)) {
                input.classList.add('invalid');
                validationMessage.textContent = message;
                validationMessage.style.display = 'block';
                return false;
            } else {
                input.classList.remove('invalid');
                validationMessage.style.display = 'none';
                return true;
            }
        };

        const qsPhoneInput = document.getElementById('qs-info-phone');
        if (qsPhoneInput) {
            qsPhoneInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/[^0-9]/g, '');
                if (value.length > 11) value = value.slice(0, 11);
                e.target.value = value.replace(/^(\d{3})(\d{4})(\d{4})$/, `$1-$2-$3`);
            });
        }

        infoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('qs-info-name');
            const phoneInput = document.getElementById('qs-info-phone');
            const consentInput = document.getElementById('qs-consent-1');
            const submitBtn = infoForm.querySelector('.btn-submit');
            const originalBtnText = submitBtn ? submitBtn.innerHTML : '처리 중...';

            const isNameValid = validateField(nameInput, nameRegex, '이름 형식이 올바르지 않습니다.');
            const isPhoneValid = validateField(phoneInput, phoneRegex, '연락처 형식이 올바르지 않습니다.');

            if (!consentInput.checked) {
                alert('개인정보 수집 및 활용에 동의해주세요.');
                return;
            }

            if (!isNameValid || !isPhoneValid) return;

            if (loadingOverlay) loadingOverlay.classList.add('visible');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '처리 중...';
            }

            const applicationData = {
                name: nameInput.value,
                phone: phoneInput.value,
                telecom: quickSignupState.telecom?.name,
                internet: quickSignupState.internet?.name,
                tv: quickSignupState.tv?.name,
                additionalTv: quickSignupState.additionalTv?.name,
                usim: quickSignupState.usim ? '신청' : '미신청'
            };

            fetch(QUICK_SIGNUP_SCRIPT_URL, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(applicationData),
                redirect: "follow",
            })
                .then(response => response.json())
                .then(data => {
                    if (data.result === 'success') {
                        window.globalModal.close(infoModalId);
                        setTimeout(() => {
                            const alertTitle = document.querySelector('#custom-alert .alert-title');
                            if (alertTitle) alertTitle.textContent = '간편상담 신청이 완료되었습니다.';
                            window.globalModal.open('custom-alert');
                        }, 80);
                        infoForm.reset();
                    } else {
                        throw new Error(data.message || '알 수 없는 서버 오류');
                    }
                })
                .catch(error => {
                    console.error('Fetch Error:', error);
                    alert('신청 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.');
                })
                .finally(() => {
                    if (loadingOverlay) loadingOverlay.classList.remove('visible');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalBtnText;
                    }
                });
        });
    }

    function setupGlobalModalKeyListener() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const visibleModal = document.querySelector('.modal-overlay.visible');
                if (visibleModal) {
                    window.globalModal.close(visibleModal.id);
                }
            }
        });
    }

    function setupRealtimeStatus() {
        const statusList = document.querySelector('.status-list');
        if (!statusList) return;

        const names = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임"];
        const regions = ["서울 강남구", "부산 해운대구", "대구 수성구", "인천 연수구", "광주 서구", "대전 유성구", "울산 남구", "세종시", "경기 성남시", "강원 원주시"];
        const products = ["LG 500M+TV", "SK 1G+TV", "KT 500M", "LG 1G", "SK 500M+TV", "KT 1G+TV"];

        let items = [];
        for (let i = 0; i < 10; i++) {
            const name = names[Math.floor(Math.random() * names.length)] + "* " + names[Math.floor(Math.random() * names.length)];
            const region = regions[Math.floor(Math.random() * regions.length)];
            const product = products[Math.floor(Math.random() * products.length)];
            items.push(`<li>[${name}] ${region} - ${product} 신청완료</li>`);
        }

        statusList.innerHTML = items.join('');
        statusList.innerHTML += items.join('');
    }

    function setupFaqAccordion() {
        const faqItems = document.querySelectorAll('.faq-item');
        faqItems.forEach(item => {
            const question = item.querySelector('.faq-question');
            const answer = item.querySelector('.faq-answer');

            question.addEventListener('click', () => {
                const isOpen = question.classList.contains('active');

                faqItems.forEach(otherItem => {
                    otherItem.querySelector('.faq-question').classList.remove('active');
                    otherItem.querySelector('.faq-answer').style.maxHeight = null;
                });

                if (!isOpen) {
                    question.classList.add('active');
                    answer.style.maxHeight = answer.scrollHeight + 'px';
                }
            });
        });
    }

    function setupDetailFeeToggle() {
        const toggleLink = document.getElementById('toggle-detail-fee');
        const summaryToggleLink = document.getElementById('summary-toggle-details');
        const detailSummary = document.getElementById('detail-fee-summary');

        if (!toggleLink || !detailSummary || !summaryToggleLink) return;

        const toggleDetails = (e) => {
            e.preventDefault();
            const isHidden = detailSummary.style.display === 'none' || detailSummary.style.display === '';
            if (isHidden) {
                detailSummary.style.display = 'block';
                toggleLink.innerHTML = '상세요금 <i class="fas fa-chevron-up"></i>';
                summaryToggleLink.innerHTML = '상세요금 <i class="fas fa-chevron-up"></i>';
            } else {
                detailSummary.style.display = 'none';
                toggleLink.innerHTML = '상세요금 <i class="fas fa-chevron-right"></i>';
                summaryToggleLink.innerHTML = '상세요금 <i class="fas fa-chevron-right"></i>';
            }
        };

        toggleLink.addEventListener('click', toggleDetails);
        summaryToggleLink.addEventListener('click', toggleDetails);
    }

    function setupEventDetailModal() {
        const eventData = {
            event1: {
                title: "친구야 같이 바꾸자! 지인 추천 이벤트",
                image: "https://placehold.co/640x300/007BFF/FFFFFF?text=Friend+Referral+Event",
                content: `
                    <h3>참여 방법</h3>
                    <p>성지넷을 통해 인터넷/TV를 가입하고, 주변 지인에게 추천해주세요! 추천받은 지인이 성지넷을 통해 가입을 완료하면 추천인과 신규가입자 모두에게 특별한 혜택을 드립니다.</p>
                    <ul>
                        <li>1. 먼저 성지넷을 통해 인터넷 가입을 완료합니다.</li>
                        <li>2. 친구에게 성지넷을 소개하고, 친구가 상담 시 추천인(본인)의 성함과 연락처를 알려줍니다.</li>
                        <li>3. 친구의 인터넷 설치가 완료되면 두 분 모두에게 혜택이 지급됩니다!</li>
                    </ul>
                    <h3>이벤트 혜택</h3>
                    <p>추천인과 신규가입자 모두에게 <strong>백화점 상품권 3만원 권</strong>을 추가로 증정합니다.</p>
                    <div class="event-notes">
                        <strong>※ 유의사항</strong><br>
                        - 추천인과 신규가입자 모두 개통이 완료되어야 혜택이 지급됩니다.<br>
                        - 이벤트 혜택은 개통 완료 후 7일 이내에 모바일 상품권으로 발송됩니다.<br>
                        - 본 이벤트는 회사 사정에 따라 예고 없이 변경되거나 종료될 수 있습니다.
                    </div>
                `
            },
            event2: {
                title: "생생 후기 이벤트",
                image: "https://placehold.co/640x250/28A745/FFFFFF?text=Review+Event",
                content: `
                    <h3>참여 방법</h3>
                    <p>성지넷에서 인터넷/TV 가입 후, 이용 후기를 지정된 커뮤니티나 개인 블로그에 작성해주세요. 모든 참여자분들께 감사의 선물을 드립니다.</p>
                    <ul>
                        <li>1. 성지넷에서 인터넷/TV 설치를 완료합니다.</li>
                        <li>2. 인터넷 관련 커뮤니티, 지역 맘카페, 개인 블로그 등에 사진 2장 이상 포함된 후기를 작성합니다.</li>
                        <li>3. 작성한 후기 URL을 성지넷 카카오톡 채널로 보내주시면 확인 후 혜택을 드립니다.</li>
                    </ul>
                    <h3>이벤트 혜택</h3>
                    <p>참여하신 모든 분들께 <strong>스타벅스 아메리카노 기프티콘</strong>을 100% 증정합니다.</p>
                    <div class="event-notes">
                        <strong>※ 유의사항</strong><br>
                        - 전체 공개 게시물만 참여로 인정됩니다.<br>
                        - 후기 작성 시 '성지넷' 키워드가 반드시 포함되어야 합니다.<br>
                        - 기프티콘은 URL 접수 후 3일 이내에 발송됩니다.
                    </div>
                `
            }
        };

        const triggerBtns = document.querySelectorAll('.btn-event-details');
        const modalId = 'event-detail-modal';
        const modal = document.getElementById(modalId);
        if (!modal || triggerBtns.length === 0) return;

        const modalTitle = document.getElementById('modal-event-title');
        const modalImage = document.getElementById('modal-event-image');
        const modalContent = document.getElementById('modal-event-content');

        triggerBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const eventKey = btn.dataset.event;
                const data = eventData[eventKey];

                if (data) {
                    modalTitle.textContent = data.title;
                    modalImage.src = data.image;
                    modalImage.alt = data.title;
                    modalContent.innerHTML = data.content;
                    window.globalModal.open(modalId);
                }
            });
        });
    }

    function setupAiScanner() { }

    function setupDynamicContent() {
        const eventTitle = document.getElementById('event-section-title');
        if (eventTitle) {
            const currentMonth = new Date().getMonth() + 1;
            eventTitle.textContent = `🎁 ${currentMonth}월 진행중인 이벤트`;
        }
    }

    function setupCarrierMenuToggle() {
        const carrierMenuToggle = document.querySelector('.carrier-menu-toggle');
        const carrierDropdown = document.querySelector('.carrier-dropdown-menu');

        if (carrierMenuToggle && carrierDropdown) {
            carrierMenuToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.currentTarget.parentElement.classList.toggle('open');
            });

            document.addEventListener('click', (e) => {
                const menuItem = e.target.closest('.carrier-menu-item');
                if (!menuItem) {
                    document.querySelector('.carrier-menu-item.open')?.classList.remove('open');
                }
            });
        }
    }

    function setupRollingHeroAndScroll() {
        if (window.heroSwiper && typeof window.heroSwiper.destroy === 'function') {
            window.heroSwiper.destroy(true, true);
        }

        const swiper = new Swiper('.hero-swiper', {
            autoplay: { delay: 5000, disableOnInteraction: false },
            loop: true,
            effect: 'fade',
            fadeEffect: { crossFade: true },
            pagination: { el: '.swiper-pagination', clickable: true },
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
        });

        window.heroSwiper = swiper;

        const targetSection = document.getElementById('calculator-section');
        document.querySelectorAll('.hero-scroll-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (!targetSection) return;
                const main = document.getElementById('main-content-wrapper');
                const ai = document.getElementById('ai-view-wrapper');
                if (main && ai) {
                    main.style.display = 'block';
                    ai.style.display = 'none';
                    document.body.classList.remove('ai-view-active');
                }
                targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        document.querySelectorAll('.hero-secret-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                for (const id of ['quick-secret-benefit-btn', 'secret-benefit-link-body', 'secret-benefit-link-nav', 'fab-secret-benefit']) {
                    const el = document.getElementById(id);
                    if (el) { el.click(); return; }
                }
                alert('비밀혜택 신청 기능을 찾을 수 없습니다.');
            });
        });

        const header = document.querySelector('header');
        if (header && window.innerWidth <= 768) {
            let last = 0;
            const thr = 5;
            window.addEventListener('scroll', () => {
                const y = window.pageYOffset || document.documentElement.scrollTop;
                if (Math.abs(y - last) > thr) {
                    if (y > last && y > 50) header.classList.add('hidden');
                    else header.classList.remove('hidden');
                    last = y <= 0 ? 0 : y;
                }
            }, false);
        }
    }

    function setupCompareOpeners() {
        const selectors = ['#compare-btn', '#quick-compare-btn', '#open-compare', '.open-compare'];
        const targets = document.querySelectorAll(selectors.join(','));
        if (targets.length === 0) return;
        targets.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof window.globalModal?.open === 'function') {
                    window.globalModal.open('compare-modal');
                } else {
                    const modal = document.getElementById('compare-modal');
                    if (modal) modal.classList.add('visible');
                }
            });
        });
    }

    function setupBottomBarAutoHide() {
        const bar = document.querySelector('.summary-sticky-bar');
        if (!bar) return;
        if (window.innerWidth > 768) return;

        let lastY = window.pageYOffset || document.documentElement.scrollTop || 0;
        let ticking = false;

        const onScroll = () => {
            const y = window.pageYOffset || document.documentElement.scrollTop || 0;
            const dy = y - lastY;

            if (Math.abs(dy) > 4) {
                if (dy > 0 && y > 40) {
                    bar.classList.add('hidden');
                } else {
                    bar.classList.remove('hidden');
                }
                lastY = y <= 0 ? 0 : y;
            }
            ticking = false;
        };

        const requestTick = () => {
            if (!ticking) {
                window.requestAnimationFrame(onScroll);
                ticking = true;
            }
        };

        window.addEventListener('scroll', requestTick, { passive: true });
    }

    function setupAiPortalAndHint() {
        // [수정] AI 파동 게이트 애니메이션 삭제 요청으로 인해 게이트 생성 및 트리거 로직 제거

        let bubble = document.getElementById('ai-hint-bubble');
        if (!bubble) {
            bubble = document.createElement('div');
            bubble.id = 'ai-hint-bubble';
            bubble.className = 'ai-hint-bubble';
            // [수정] 텍스트 변경: 파동 게이트 -> 스마트플래너
            bubble.innerHTML = '🤖 AI 스마트플래너로 진입하시겠습니까? <span class="hint-cta">입장하기</span>';
            document.body.appendChild(bubble);
        }
        const showBubble = () => bubble.classList.add('show');
        const hideBubble = () => bubble.classList.remove('show');

        setTimeout(showBubble, 2200);

        bubble.addEventListener('click', () => {
            hideBubble();
            const anyTrigger = document.getElementById('hero-ai-planner-btn') || document.getElementById('ai-calculator-body-link');
            if (anyTrigger) anyTrigger.click();
        });

        let lastY = window.pageYOffset || 0;
        window.addEventListener('scroll', () => {
            const y = window.pageYOffset || 0;
            if (y - lastY > 15 && y > 200) hideBubble();
            lastY = y;
        }, { passive: true });
    }

    // ============================================================
    // [3] SMS Template Helper & Updated Compare Feature
    // ============================================================

    function buildSmsMessageFromItem(item) {
        if (!item) return "";

        var details = item.details || {};
        var telecom = "";
        if (details.telecom) {
            telecom = details.telecom.name || details.telecom.officialName || "";
        }
        if (!telecom && item.carrier) {
            telecom = item.carrier;
        }

        var internetObj = details.internetProduct || details.internet || {};
        var tvObj = details.tvProduct || details.tv || {};
        var addTvObj = details.additionalTv || null;

        var internetName = internetObj.name || "";
        var tvName = tvObj.name || "";
        var addTvName = addTvObj && addTvObj.name ? addTvObj.name : "";

        var mobileSummary = details.mobileSummary || "";
        var planName = item.bestPlanName || details.bestPlanName || "";

        var netBill = item.netBill || 0;
        var cashBenefit = item.cashBenefit || 0;
        var totalBenefit = item.totalBenefit || 0;
        var mobileDiscount = item.totalMobileDiscount || 0;

        var productParts = [];
        if (internetName) productParts.push(internetName);
        if (tvName) productParts.push(tvName);
        if (addTvObj && addTvName) productParts.push(addTvName);
        var productLine = productParts.join(" + ");

        var lines = [];

        lines.push("[성지넷 맞춤 견적]");
        lines.push("");

        if (telecom) lines.push("▷ 통신사: " + telecom);
        if (planName) lines.push("▷ 상품: " + planName);
        if (productLine) lines.push("▷ 구성: " + productLine);
        if (mobileSummary) lines.push("▷ 휴대폰: " + mobileSummary);

        if (netBill) {
            var netStr = String(Math.round(netBill)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "원";
            if (mobileDiscount > 0) {
                lines.push("▷ 월요금: " + netStr + " (휴대폰할인 포함)");
            } else {
                lines.push("▷ 월요금: " + netStr);
            }
        }

        if (cashBenefit) {
            var cashStr = String(Math.round(cashBenefit)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "원";
            lines.push("▷ 현금 사은품: " + cashStr);
        }

        if (mobileDiscount > 0) {
            var mobStr = String(Math.round(mobileDiscount)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "원";
            lines.push("▷ 휴대폰 할인: 월 -" + mobStr);
        }

        if (totalBenefit) {
            var benStr = String(Math.round(totalBenefit)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "원";
            lines.push("▷ 총 혜택(3년): " + benStr);
        }

        lines.push("");
        lines.push("※ 위 금액은 설치 지역/약정/결합방식에 따라 일부 변동될 수 있습니다.");
        lines.push("궁금한 점 있으시면 이 문자에 그대로 답장 주세요 :)");

        return lines.join("\n");
    }

    function setupCompareFeature() {
        var viewBtn = document.getElementById('view-compare-btn');
        var modalBody = document.getElementById('compare-modal-body');
        if (!viewBtn || !modalBody) return;

        var originalListCache = [];
        var currentSort = 'bill';
        var filterMobileOnly = false;
        var filterHidePrepay = false;
        var selectedIds = new Set();

        function isPrepayPlan(item) {
            var name = item.bestPlanName || '';
            return name.indexOf('선납') !== -1 || name.indexOf('일시납') !== -1;
        }

        function getWorkingList() {
            var list = originalListCache.slice();

            if (filterMobileOnly) {
                list = list.filter(function (item) {
                    return (item.totalMobileDiscount || 0) > 0;
                });
            }
            if (filterHidePrepay) {
                list = list.filter(function (item) {
                    return !isPrepayPlan(item);
                });
            }

            if (currentSort === 'bill') {
                list.sort(function (a, b) {
                    return (a.netBill || 0) - (b.netBill || 0);
                });
            } else if (currentSort === 'benefit') {
                list.sort(function (a, b) {
                    return (b.totalBenefit || 0) - (a.totalBenefit || 0);
                });
            } else if (currentSort === 'original') {
                list.sort(function (a, b) {
                    return (a._aiIndex || 0) - (b._aiIndex || 0);
                });
            }
            return list;
        }

        function buildSignupUrlFromItem(item) {
            try {
                if (item && item.id && window.generateSignupUrl && typeof window.generateSignupUrl === 'function') {
                    try {
                        var url = window.generateSignupUrl(item.id);
                        if (url && typeof url === 'string' && url !== 'signup.html') {
                            return url;
                        }
                    } catch (e) {
                        console.warn('generateSignupUrl 실패, fallback 사용', e);
                    }
                }

                var details = item.details || {};
                var telecomName = '';
                if (details.telecom) {
                    telecomName = details.telecom.name || details.telecom.officialName || '';
                }
                if (!telecomName && item.carrier) {
                    telecomName = item.carrier;
                }

                var internetProduct = details.internetProduct || details.internet || {};
                var tvProduct = details.tvProduct || details.tv || {};
                var additionalTv = details.additionalTv || null;
                var mobilePlans = details.mobilePlans || item.mobilePlans || [];
                var bestPlanName = item.bestPlanName || details.bestPlanName || '';

                var usimCount = 0;
                if (Object.prototype.toString.call(mobilePlans) === '[object Array]') {
                    mobilePlans.forEach(function (p) {
                        if (p && p.hasUsim) usimCount++;
                    });
                } else if (typeof item.usimCount === 'number') {
                    usimCount = item.usimCount;
                }

                var params = new URLSearchParams();
                if (telecomName) params.set('telecom', telecomName);
                if (internetProduct.name) params.set('internet', internetProduct.name);
                if (tvProduct.name) params.set('tv', tvProduct.name);
                if (bestPlanName) params.set('combinedProduct', bestPlanName);
                if (usimCount > 0) params.set('usim', String(usimCount) + '개');
                if (item.netBill != null) params.set('totalPrice', String(Math.round(item.netBill)));
                if (item.cashBenefit != null) params.set('supportFund', String(Math.round(item.cashBenefit)));
                if (additionalTv && additionalTv.name) params.set('additionalTv', additionalTv.name);
                if (details.mobileSummary) params.set('mobileSummary', details.mobileSummary);

                params.set('source', 'compare');

                return 'signup.html?' + params.toString();
            } catch (e) {
                console.error('buildSignupUrlFromItem 오류', e);
                return 'signup.html';
            }
        }

        function render() {
            var list = getWorkingList();
            if (!list || list.length === 0) {
                modalBody.innerHTML = '<p class="empty-message">비교할 항목이 없습니다. 먼저 견적을 비교함에 추가해주세요.</p>';
                return;
            }

            var netBills = list.map(function (item) { return item.netBill || 0; });
            var benefits = list.map(function (item) { return item.totalBenefit || 0; });
            var minNetBill = Math.min.apply(null, netBills);
            var maxBenefit = Math.max.apply(null, benefits);

            var totalSlots = 4;
            var selectedCount = selectedIds.size;
            var filledDots = new Array(Math.min(selectedCount, totalSlots) + 1).join('●');
            var emptyDots = new Array(Math.max(totalSlots - selectedCount, 0) + 1).join('○');

            var html = '<div class="compare-modal-content">';

            html += '<div class="compare-summary-header">';
            html += '<div class="summary-main">';
            html += '<h3>비교함 (총 ' + originalListCache.length + '개)</h3>';
            html += '<p class="summary-desc">AI가 추천한 요금제를 월 요금과 총 혜택 기준으로 한눈에 비교하고, 문자 템플릿으로 바로 복사해보세요.</p>';
            html += '<div class="summary-progress">선택: ' + selectedCount + ' / ' + totalSlots + ' <span class="progress-dots">' + filledDots + emptyDots + '</span></div>';
            html += '</div>';

            html += '<div class="summary-controls">';
            html += '<label class="summary-control-item">정렬 ';
            html += '<select id="compare-sort-select">';
            html += '<option value="bill"' + (currentSort === 'bill' ? ' selected' : '') + '>최저요금순</option>';
            html += '<option value="benefit"' + (currentSort === 'benefit' ? ' selected' : '') + '>최대혜택순</option>';
            html += '<option value="original"' + (currentSort === 'original' ? ' selected' : '') + '>AI추천순</option>';
            html += '</select></label>';
            html += '<label class="summary-control-item"><input type="checkbox" id="compare-filter-mobile"' + (filterMobileOnly ? ' checked' : '') + '> 모바일 결합 포함만</label>';
            html += '<label class="summary-control-item"><input type="checkbox" id="compare-filter-prepay"' + (filterHidePrepay ? ' checked' : '') + '> 선납/일시납 숨기기</label>';
            html += '</div></div>';

            html += '<div class="compare-card-row">';
            list.forEach(function (item) {
                var net = Math.round(item.netBill || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ", ");
                var benefit = Math.round(item.totalBenefit || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ", ");
                var tags = [];

                if (item.netBill === minNetBill) tags.push('최저요금');
                if (item.totalBenefit === maxBenefit) tags.push('최대혜택');
                if ((item.totalMobileDiscount || 0) > 0) tags.push('모바일결합');
                if (isPrepayPlan(item)) tags.push('선납');

                html += '<div class="compare-mini-card">';
                html += '<div class="cmp-mini-title">' + (item.carrier || '') + '</div>';
                html += '<div class="cmp-mini-sub">' + (item.bestPlanName || '') + '</div>';
                html += '<div class="cmp-mini-numbers">';
                html += '<div class="cmp-mini-metric"><span class="label">월 요금</span><span class="value">' + net + '원</span></div>';
                html += '<div class="cmp-mini-metric"><span class="label">총 혜택</span><span class="value">' + benefit + '원</span></div>';
                html += '</div>';
                if (tags.length > 0) {
                    html += '<div class="cmp-mini-tags">';
                    tags.forEach(function (t) {
                        html += '<span class="chip chip-sm">' + t + '</span>';
                    });
                    html += '</div>';
                }
                html += '</div>';
            });
            html += '</div>';

            html += '<div class="compare-table-container" style="overflow-x:auto;"><table class="modal-table compare-table">';
            html += '<thead><tr><th style="white-space: nowrap;">항목</th>';

            list.forEach(function (item) {
                // [Issue 3 해결] 슬라이드형 체크박스 적용
                html += '<th class="selectable-header" data-id="' + item.id + '">' +
                    '<div class="cmp-plan-title">' + (item.carrier || '') + '</div>' +
                    '<div class="cmp-plan-sub">' + (item.bestPlanName || '') + '</div>' +
                    '<div class="cmp-plan-select">' +
                    '<label class="toggle-switch-wrapper">' +
                    '<input type="checkbox" class="compare-select-checkbox" data-id="' + item.id + '"' + (selectedIds.has(item.id) ? ' checked' : '') + '>' +
                    '<span class="toggle-slider"></span>' +
                    '</label>' +
                    '<span class="cmp-select-label">선택</span>' +
                    '</div>' +
                    '</th>';
            });
            html += '</tr></thead><tbody>';

            var rows = [
                '월 요금',
                '현금 사은품',
                '휴대폰 할인',
                '총 혜택 (3년)'
            ];

            rows.forEach(function (rowName, rowIndex) {
                html += '<tr><td style="white-space: nowrap;">' + rowName + '</td>';

                list.forEach(function (item) {
                    var net = item.netBill || 0;
                    var cash = item.cashBenefit || 0;
                    var mobile = item.totalMobileDiscount || 0;
                    var benefit = item.totalBenefit || 0;

                    var value = '';
                    var cellClass = '';

                    if (rowIndex === 0) {
                        value = String(Math.round(net)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + '원';
                        if (net === minNetBill) {
                            cellClass = 'highlight-lowest';
                        } else {
                            var diff = net - minNetBill;
                            if (diff > 0) {
                                value += '<div class="cmp-subtext">+' + diff.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + '원</div>';
                            }
                        }
                    } else if (rowIndex === 1) {
                        value = String(Math.round(cash)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + '원';
                    } else if (rowIndex === 2) {
                        if (mobile > 0) {
                            value = '월 -' + String(Math.round(mobile)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + '원';
                        } else {
                            value = '-';
                        }
                    } else if (rowIndex === 3) {
                        value = String(Math.round(benefit)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + '원';
                        if (benefit === maxBenefit && benefit > 0) {
                            cellClass = 'highlight-benefit';
                        } else if (benefit > 0) {
                            var diff2 = maxBenefit - benefit;
                            if (diff2 > 0) {
                                value += '<div class="cmp-subtext">-' + diff2.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + '원</div>';
                            }
                        }
                    }

                    html += '<td class="' + cellClass + '">' + value + '</td>';
                });

                html += '</tr>';
            });

            html += '<tr><td style="white-space: nowrap;">액션</td>';
            list.forEach(function (item) {
                var signupUrl = buildSignupUrlFromItem(item);
                html += '<td class="cmp-actions">' +
                    '<a href="' + signupUrl + '" class="btn btn-primary btn-xs compare-signup-link" data-result-id="' + item.id + '">셀프 가입</a>' +
                    '<button type="button" class="btn btn-outline btn-xs copy-sms-btn" data-id="' + item.id + '">문자 템플릿 복사</button>' +
                    '<button type="button" class="btn btn-tertiary btn-xs remove-compare-item" data-id="' + item.id + '">제거</button>' +
                    '</td>';
            });
            html += '</tr>';

            html += '</tbody></table></div>';

            html += '<div class="compare-footer-notice">';
            html += '<p>※ 총 혜택(3년)은 현금 사은품과 인터넷/모바일 할인 예상 금액을 36개월 기준으로 단순 합산한 값입니다.</p>';
            html += '</div>';

            html += '<div class="compare-sms-preview">';
            html += '  <div class="preview-header">';
            html += '    <span class="preview-title">문자 메시지 미리보기</span>';
            html += '    <button type="button" class="btn btn-outline btn-xs" id="compare-sms-copy-current">현재 내용 복사</button>';
            html += '  </div>';

            html += '  <div class="sms-phone-mockup">';
            html += '    <div class="sms-status-bar">12:30</div>';
            html += '    <div class="sms-sender-info">성지넷</div>';
            html += '    <div class="sms-screen-body">';
            html += '      <div class="sms-date-divider">오늘</div>';
            html += '      <div class="sms-bubble-container">';
            html += '        <textarea id="compare-sms-preview-text" readonly placeholder="왼쪽 상품의 [문자 템플릿 복사] 버튼을 누르면 이곳에 미리보기가 표시됩니다."></textarea>';
            html += '      </div>';
            html += '      <div class="sms-time">오후 12:30</div>';
            html += '    </div>';
            html += '    <div class="sms-input-area">';
            html += '       <i class="fas fa-plus-circle sms-fake-plus"></i>';
            html += '       <div class="sms-fake-input">문자 메시지</div>';
            html += '       <i class="fas fa-microphone sms-fake-mic"></i>';
            html += '    </div>';
            html += '  </div>';

            html += '  <p class="preview-hint">* 상담사는 위 내용을 복사하여 SMS/카카오톡 등으로 고객에게 전송할 수 있습니다.</p>';
            html += '</div>';

            html += '<div class="compare-global-actions">';
            html += '<div class="selected-info">선택한 상품: <strong>' + selectedCount + '</strong>개</div>';
            html += '<div class="btn-group">';
            html += '<button type="button" class="btn btn-action-lg btn-gradient" id="compare-global-signup">선택한 상품 셀프 가입</button>';
            html += '<button type="button" class="btn btn-action-lg btn-outline-dark" id="compare-global-consult">상담 요청 남기기</button>';
            html += '<button type="button" class="btn btn-action-lg btn-simple" id="compare-global-clear">비교함 비우기</button>';
            html += '</div></div>';

            html += '</div>';

            modalBody.innerHTML = html;

            var sortSelect = modalBody.querySelector('#compare-sort-select');
            var mobileFilterChk = modalBody.querySelector('#compare-filter-mobile');
            var prepayFilterChk = modalBody.querySelector('#compare-filter-prepay');
            var globalSignupBtn = modalBody.querySelector('#compare-global-signup');
            var globalConsultBtn = modalBody.querySelector('#compare-global-consult');
            var globalClearBtn = modalBody.querySelector('#compare-global-clear');
            var smsPreviewArea = modalBody.querySelector('#compare-sms-preview-text');
            var smsCopyCurrentBtn = modalBody.querySelector('#compare-sms-copy-current');
            var compareSignupLinks = modalBody.querySelectorAll('.compare-signup-link');

            if (sortSelect) {
                sortSelect.addEventListener('change', function (e) {
                    currentSort = e.target.value || 'bill';
                    render();
                });
            }
            if (mobileFilterChk) {
                mobileFilterChk.addEventListener('change', function (e) {
                    filterMobileOnly = !!e.target.checked;
                    render();
                });
            }
            if (prepayFilterChk) {
                prepayFilterChk.addEventListener('change', function (e) {
                    filterHidePrepay = !!e.target.checked;
                    render();
                });
            }

            if (compareSignupLinks && compareSignupLinks.length > 0) {
                compareSignupLinks.forEach(link => {
                    link.addEventListener('click', () => {
                        try {
                            const isAiActive = document.body.classList.contains('ai-view-active') ||
                                (document.getElementById('ai-view-wrapper') && document.getElementById('ai-view-wrapper').style.display !== 'none');
                            sessionStorage.setItem('lastViewMode', isAiActive ? 'ai' : 'main');
                            sessionStorage.setItem('openCompareOnReturn', '1');
                        } catch (e) {
                            console.warn('비교함 복귀 플래그 저장 실패', e);
                        }
                    });
                });
            }

            var headerCells = modalBody.querySelectorAll('.selectable-header');
            headerCells.forEach(function (cell) {
                cell.addEventListener('click', function (e) {
                    if (e.target.type === 'checkbox' || e.target.closest('.toggle-switch-wrapper')) return;

                    var checkbox = cell.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        checkbox.checked = !checkbox.checked;
                        var event = new Event('change');
                        checkbox.dispatchEvent(event);
                    }
                });
            });

            var selectCheckboxes = modalBody.querySelectorAll('.compare-select-checkbox');
            selectCheckboxes.forEach(function (cb) {
                cb.addEventListener('change', function (e) {
                    var id = e.target.getAttribute('data-id');
                    if (!id) return;
                    if (e.target.checked) {
                        selectedIds.add(id);
                    } else {
                        selectedIds.delete(id);
                    }

                    var selectedInfo = modalBody.querySelector('.compare-global-actions .selected-info');
                    var progressEl = modalBody.querySelector('.summary-progress');
                    var newCount = selectedIds.size;
                    var filled = new Array(Math.min(newCount, totalSlots) + 1).join('●');
                    var empty = new Array(Math.max(totalSlots - newCount, 0) + 1).join('○');
                    if (selectedInfo) {
                        selectedInfo.innerHTML = '선택한 상품: <strong>' + newCount + '</strong>개';
                    }
                    if (progressEl) {
                        progressEl.innerHTML = '선택: ' + newCount + ' / ' + totalSlots + ' <span class="progress-dots">' + filled + empty + '</span>';
                    }
                });
            });

            if (globalSignupBtn) {
                globalSignupBtn.addEventListener('click', function () {
                    if (selectedIds.size === 0) {
                        alert('먼저 가입을 원하는 상품을 선택해 주세요.');
                        return;
                    }
                    var firstId = Array.from(selectedIds)[0];
                    var target = originalListCache.find(function (item) { return item.id === firstId; });
                    if (!target) return;
                    var url = buildSignupUrlFromItem(target);

                    try {
                        const isAiActive = document.body.classList.contains('ai-view-active') ||
                            (document.getElementById('ai-view-wrapper') && document.getElementById('ai-view-wrapper').style.display !== 'none');
                        sessionStorage.setItem('lastViewMode', isAiActive ? 'ai' : 'main');
                        sessionStorage.setItem('openCompareOnReturn', '1');
                    } catch (e) {
                        console.warn('비교함 복귀 플래그 저장 실패', e);
                    }
                    window.location.href = url;
                });
            }

            if (globalConsultBtn) {
                globalConsultBtn.addEventListener('click', function () {
                    if (selectedIds.size > 0) {
                        const firstId = Array.from(selectedIds)[0];
                        const targetItem = originalListCache.find(i => i.id === firstId);
                        if (targetItem) {
                            window.qsPrefillData = {
                                carrier: targetItem.carrier,
                                internet: targetItem.details.internet?.name,
                                tv: targetItem.details.tv?.name
                            };
                        }
                    } else if (originalListCache.length > 0) {
                        const targetItem = originalListCache[0];
                        window.qsPrefillData = {
                            carrier: targetItem.carrier,
                            internet: targetItem.details.internet?.name,
                            tv: targetItem.details.tv?.name
                        };
                    }

                    // [Issue 4 해결] 비교함으로 돌아오기 위한 플래그 설정
                    sessionStorage.setItem('returnToCompare', 'true');

                    if (window.globalModal && typeof window.globalModal.close === 'function') {
                        window.globalModal.close('compare-modal');
                    } else {
                        var compareModal = document.getElementById('compare-modal');
                        if (compareModal) compareModal.classList.remove('visible');
                    }

                    setTimeout(function () {
                        if (window.globalModal && typeof window.globalModal.open === 'function') {
                            var qsModal = document.getElementById('quick-signup-modal');
                            if (qsModal) {
                                window.globalModal.open('quick-signup-modal');
                                const hiddenTrigger = document.getElementById('quick-self-signup-btn');
                                if (hiddenTrigger) hiddenTrigger.click();
                            } else {
                                var secretModal = document.getElementById('secret-benefit-modal');
                                if (secretModal) {
                                    window.globalModal.open('secret-benefit-modal');
                                }
                            }
                        } else {
                            alert('상담 요청 기능을 불러올 수 없습니다. 우측/하단의 빠른 상담 기능을 이용해 주세요.');
                        }
                    }, 300);
                });
            }

            if (globalClearBtn) {
                globalClearBtn.addEventListener('click', function () {
                    if (!confirm('비교함을 모두 비우시겠습니까?')) return;
                    if (typeof clearCompareList === 'function') {
                        clearCompareList();
                    } else {
                        try {
                            sessionStorage.removeItem('compareList');
                        } catch (e) {
                            console.error('compareList 초기화 실패', e);
                        }
                    }
                    selectedIds.clear();
                    updateCompareCount();
                    modalBody.innerHTML = '<p class="empty-message">비교함이 비워졌습니다.</p>';
                    if (window.globalModal && typeof window.globalModal.close === 'function') {
                        window.globalModal.close('compare-modal');
                    } else {
                        var modal = document.getElementById('compare-modal');
                        if (modal) {
                            modal.classList.remove('visible');
                            document.body.classList.remove('modal-open');
                        }
                    }
                });
            }

            var smsButtons = modalBody.querySelectorAll('.copy-sms-btn');
            smsButtons.forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    var itemId = e.currentTarget.getAttribute('data-id');
                    var targetItem = originalListCache.find(function (it) { return it.id === itemId; });
                    if (!targetItem) return;

                    var msg = buildSmsMessageFromItem(targetItem);
                    if (smsPreviewArea) {
                        smsPreviewArea.value = msg;
                    }

                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(msg).then(function () {
                            alert('문자 템플릿이 클립보드에 복사되었습니다.');
                        }).catch(function () {
                            alert('복사에 실패했습니다. 미리보기 내용을 직접 드래그하여 복사해 주세요.');
                        });
                    } else {
                        alert('복사 기능을 지원하지 않는 브라우저입니다. 미리보기 내용을 직접 드래그하여 복사해 주세요.');
                    }
                });
            });

            if (smsCopyCurrentBtn && smsPreviewArea) {
                smsCopyCurrentBtn.addEventListener('click', function () {
                    var text = smsPreviewArea.value || '';
                    if (!text) {
                        alert('먼저 왼쪽 상품에서 [문자 템플릿 복사] 버튼을 눌러 미리보기를 생성해 주세요.');
                        return;
                    }
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(text).then(function () {
                            alert('현재 미리보기 내용이 클립보드에 복사되었습니다.');
                        }).catch(function () {
                            alert('복사에 실패했습니다. 미리보기 내용을 직접 드래그하여 복사해 주세요.');
                        });
                    } else {
                        alert('복사 기능을 지원하지 않는 브라우저입니다. 미리보기 내용을 직접 드래그하여 복사해 주세요.');
                    }
                });
            }

            updateCompareCount();
        }

        viewBtn.addEventListener('click', function () {
            var list = getCompareList();
            if (!list || list.length === 0) {
                alert('비교할 항목이 없습니다. 먼저 견적을 비교함에 추가해주세요.');
                return;
            }

            originalListCache = list.map(function (item, idx) {
                var newItem = Object.assign({}, item);
                newItem._aiIndex = idx;
                return newItem;
            });

            currentSort = 'bill';
            filterMobileOnly = false;
            filterHidePrepay = false;
            selectedIds = new Set(list.map(function (item) { return item.id; }));

            render();

            if (window.globalModal && typeof window.globalModal.open === 'function') {
                window.globalModal.open('compare-modal');
            } else {
                var modal = document.getElementById('compare-modal');
                if (modal) {
                    modal.classList.add('visible');
                    document.body.classList.add('modal-open');
                }
            }
        });

        updateCompareCount();
    }

    // ============================================================
    // [4] Execution & Event Binding
    // ============================================================
    setupModalHistoryHandler();
    setupPageViewToggle();
    setupQuickMenu();
    setupSecretBenefitModal();
    setupAffiliateCardLink();
    setupQuickSignupModal();
    setupGlobalModalKeyListener();
    setupRealtimeStatus();
    setupFaqAccordion();
    setupDetailFeeToggle();
    setupEventDetailModal();
    setupAiScanner();
    setupDynamicContent();
    setupCarrierMenuToggle();
    setupCompareOpeners();
    setupCompareFeature();
    setupAiPortalAndHint();
    setupRollingHeroAndScroll();
    setupBottomBarAutoHide();

    setTimeout(() => {
        try {
            const lastViewMode = sessionStorage.getItem('lastViewMode');
            if (lastViewMode === 'ai') {
                const aiNavBtn = document.getElementById('ai-calculator-nav-link-text') ||
                    document.getElementById('ai-calculator-header-link');
                if (aiNavBtn) aiNavBtn.click();
            }
            sessionStorage.removeItem('lastViewMode');

            const openCompareOnReturn = sessionStorage.getItem('openCompareOnReturn');
            if (openCompareOnReturn === '1') {
                sessionStorage.removeItem('openCompareOnReturn');

                const list = getCompareList();
                if (list && list.length > 0) {
                    const viewBtn = document.getElementById('view-compare-btn');
                    if (viewBtn) {
                        viewBtn.click();
                    } else if (window.globalModal && typeof window.globalModal.open === 'function') {
                        window.globalModal.open('compare-modal');
                    }
                }
            }
        } catch (e) {
            console.warn('비교함 복귀 중 오류', e);
        }
    }, 100);
}

document.addEventListener('DOMContentLoaded', () => {
    const targetSection = document.getElementById('calculator-section');

    document.querySelectorAll('.hero-scroll-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            if (!targetSection) return;
            const main = document.getElementById('main-content-wrapper');
            const ai = document.getElementById('ai-view-wrapper');
            if (main && ai) {
                main.style.display = 'block';
                ai.style.display = 'none';
                document.body.classList.remove('ai-view-active');
            }
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // 이벤트 비디오 두 번 재생 제어
    const eventVideos = document.querySelectorAll('.event-card video.event-image');
    eventVideos.forEach(video => {
        let playCount = 0;
        video.addEventListener('ended', () => {
            playCount++;
            if (playCount < 2) {
                video.play();
            }
        });
    });
});