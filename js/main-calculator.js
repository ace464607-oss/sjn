export function initMainCalculator(telecomData) {

    if (!telecomData) {
        const mainContainer = document.getElementById('calculator-section');
        if(mainContainer) mainContainer.innerHTML = '<p style="text-align:center; color:red; font-weight:bold; padding: 50px 0;">[오류] 요금 정보를 불러오는 데 실패했습니다. 페이지를 새로고침하거나 관리자에게 문의하세요.</p>';
        return;
    }

    // [핵심 수정] 결합상품 데이터가 없는 경우 기본값 강제 주입 (Fallback)
    for (const key in telecomData) {
        if (!telecomData[key].combinedProducts || telecomData[key].combinedProducts.length === 0) {
            if (key === 'SK') {
                telecomData[key].combinedProducts = [{ name: '요즘가족결합', type: 'main' }];
            } else if (key === 'SKB') {
                // SKB는 결합(main)과 선납(addon)을 같이 넣음
                telecomData[key].combinedProducts = [
                    { name: '요즘가족결합', type: 'main' },
                    { name: 'B알뜰 선납 (단독특가)', type: 'addon' } 
                ];
            } else if (key === 'KT') {
                telecomData[key].combinedProducts = [
                    { name: '총액결합할인' }, 
                    { name: '프리미엄가족결합' }, 
                    { name: '프리미엄싱글결합' }
                ];
            } else if (key === 'LG') {
                telecomData[key].combinedProducts = [
                    { name: '참쉬운가족결합' }, 
                    { name: '투게더결합' }
                ];
            } else if (key === 'Skylife') {
                telecomData[key].combinedProducts = [{ name: '홈결합30%' }];
            } else {
                telecomData[key].combinedProducts = [{ name: '모바일결합' }];
            }
        }
    }

    const els = {
        telecomCont: document.getElementById('telecom-options-simple'),
        internetCont: document.getElementById('internet-options-simple'),
        tvCont: document.getElementById('tv-options-simple'),
        settopCont: document.getElementById('settop-options-simple'),
        additionalTvCont: document.getElementById('additional-tv-options-simple'),
        combinedCont: document.getElementById('combined-options-simple'),
        mobileCombinationSelector: document.getElementById('main-mobile-combination-selector'),
        mobileDetailsWrapper: document.getElementById('main-mobile-details-wrapper'),
        mobileList: document.getElementById('main-mobile-list'),
        addMobileBtn: document.getElementById('main-add-mobile-btn'),
        detailFeeSummary: document.getElementById('detail-fee-summary'),
        detailSummaryContent: document.getElementById('detail-summary-content'),
        toggleDetailFeeLink: document.getElementById('toggle-detail-fee'),
        results: {
            baseFee: document.getElementById('base-fee'),
            combinedFee: document.getElementById('combined-fee'),
            totalPrice: document.getElementById('total-price'),
            totalSupport: document.getElementById('total-support-fund'),
            combinedFeeLabel: document.getElementById('combined-fee-label')
        },
        summaryResults: {
            baseFee: document.getElementById('summary-base-fee'),
            combinedFee: document.getElementById('summary-combined-fee'),
            totalPrice: document.getElementById('summary-total-price'),
            totalSupport: document.getElementById('summary-total-support'),
            combinedFeeLabel: document.getElementById('summary-combined-fee-label')
        },
        signupButtons: {
            quote: document.getElementById('self-signup-btn-quote'),
            summary: document.getElementById('summary-self-signup-btn')
        },
        wizard: {
            prevBtn: document.getElementById('calc-prev-btn'),
            nextBtn: document.getElementById('calc-next-btn'),
            stepIndicators: document.querySelectorAll('.calc-wizard-progress .step-indicator'),
            stepContents: document.querySelectorAll('.calc-step-content'),
            guideBubble: document.getElementById('calc-guide-bubble'),
            progressBar: document.getElementById('calc-progress-bar'),
        }
    };

    let state = { 
        telecom: null, internet: null, tv: null, settop: null, additionalTv: null, 
        combinedProduct: null, skbPrepaid: false, 
        mobilePlans: [],
        isMobileCombined: true, // 디폴트 결합 상태 true
        isCombinedProductAuto: true,
        _autoBundleReason: 'init',
        currentStep: 1,
        totalSteps: 5
    };
    const fmt = (n) => (n || 0).toLocaleString('ko-KR');

    const MOBILE_TIER_PRICES = {
        "20000": { name: '3만원 미만 요금제', price: 20000 }, "30000": { name: '3만원대 요금제', price: 35000 },
        "40000": { name: '4만원대 요금제', price: 45000 }, "50000": { name: '5만원대 요금제', price: 55000 },
        "60000": { name: '6만원대 요금제', price: 65000 }, "70000": { name: '7만원대 요금제', price: 75000 },
        "80000": { name: '8만원 이상 요금제', price: 80000 } 
    };

    const guideMessages = {
        1: "안녕하세요! 원하시는 통신사를 선택해주세요.",
        2: "사용하실 인터넷 속도는 어떻게 되시나요?",
        3: "TV와 셋탑박스를 선택해주세요. (TV 미신청도 가능!)",
        4: "TV를 추가로 더 설치하시나요?",
        5: "마지막! 휴대폰 결합 또는 선납 할인을 선택해주세요!",
        6: "완료! 최적의 견적을 확인해보세요. 정말 고생 많으셨어요!"
    };

    // ==========================================
    // [할인 정책 상수 정의]
    // ==========================================
    const LG_TOGETHER_MIN_PRICE = 80000; 
    const LG_TOGETHER_PER_LINE = { 2: 10000, 3: 14000, 4: 20000, 5: 20000 }; 
    const LG_TOGETHER_YOUTH_DISCOUNT = 10000;

    const LG_CHAM_MATRIX = { 1: [0, 0, 0], 2: [2200, 3300, 4400], 3: [3300, 5500, 6600], 4: [4400, 6600, 8800], 5: [4400, 6600, 8800] };
    const LG_CHAM_TIERS = [69000, 88000];

    const KT_PREMIUM_MIN_PRICE = 77000;
    const KT_TOTAL_TIERS = { 
        tiers: [22000, 64900, 108900, 141900, 174900, Infinity], 
        '100M': { internet: [1650, 3300, 5500, 5500, 5500, 5500], mobile: [0, 0, 3300, 14300, 18700, 23100] }, 
        '500M+': { internet: [2200, 5500, 5500, 5500, 5500, 5500], mobile: [0, 0, 5500, 16610, 22110, 27610] } 
    };
    const KT_YOUTH_DISCOUNT = 5500;

    const SK_FAMILY_MOBILE = { 1: 0, 2: 9900, 3: 19800, 4: 30800, 5: 41800 };


    function updateWizardUI() {
        els.wizard.stepIndicators.forEach(indicator => {
            indicator.classList.toggle('active', parseInt(indicator.dataset.step) <= state.currentStep);
        });
        els.wizard.stepContents.forEach(content => {
            content.classList.toggle('active', content.id === `step-${state.currentStep}`);
        });
        if (els.wizard.prevBtn) {
            els.wizard.prevBtn.style.display = state.currentStep === 1 ? 'none' : 'inline-block';
        }
        if (els.wizard.nextBtn) {
            els.wizard.nextBtn.textContent = state.currentStep === state.totalSteps ? '견적 완료!' : '다음 단계';
            els.wizard.nextBtn.style.animation = state.currentStep === state.totalSteps ? 'none' : 'pulse-next 2s infinite';
        }
        const progressPercentage = state.currentStep > 1 ? ((state.currentStep - 1) / (state.totalSteps - 1)) * 100 : 0;
        els.wizard.progressBar.style.width = `${progressPercentage}%`;
        els.wizard.guideBubble.textContent = guideMessages[state.currentStep];
    }
    
    function showAutoBundleNotification(message) {
        const notificationEl = document.getElementById('auto-bundle-notification');
        if (!notificationEl) return;
        
        notificationEl.classList.remove('visible');
        void notificationEl.offsetWidth; 
        
        notificationEl.textContent = message;
        notificationEl.classList.add('visible');
        
        setTimeout(() => {
            notificationEl.classList.remove('visible');
        }, 6000);
    }

    function enableAutoBundleAndRecalc(reason = 'unknown') {
        state.isCombinedProductAuto = true;
        state._autoBundleReason = reason;
        recalcBestBundleAndUpdate();
    }

    function recalcBestBundleAndUpdate() {
        if (state.isCombinedProductAuto) {
            const bestId = findBestCombinedProductId();
            const list = getCombinedListNormalized();
            const best = list.find(p => p.id === bestId);
            
            if (best && (!state.combinedProduct || state.combinedProduct.id !== best.id)) {
                state.combinedProduct = best;
                if (state._autoBundleReason !== 'init') {
                    showAutoBundleNotification(`✨ 고객님께 가장 유리한 '${best.name}'으로 자동 추천되었어요!`);
                }
            } else if (!bestId && state.isMobileCombined === false) {
                state.combinedProduct = null;
            }
            
            if (els.combinedCont) {
                els.combinedCont.querySelectorAll('.option-btn').forEach(btn => {
                    // 선납(addon) 버튼은 자동 선택에서 제외
                    if (btn.dataset.type !== 'addon') {
                        btn.classList.toggle('selected', btn.dataset.id === state.combinedProduct?.id);
                    }
                });
            }
        }
        updateCalculations();
    }

    function findBestCombinedProductId() {
        const list = getCombinedListNormalized().filter(p => p.type !== 'addon'); // 선납 제외하고 검색
        if (!state.isMobileCombined || list.length === 0) {
            return null;
        }
        let best = { id: null, discount: -1 };
        for (const product of list) {
            const d = calculateTotalDiscountForProduct(product);
            if (d > best.discount) {
                best = { id: product.id, discount: d };
            }
        }
        // 할인이 0이어도 리스트의 첫 번째 항목을 기본값으로 반환
        return best.discount <= 0 ? (list[0]?.id || null) : best.id;
    }

    function computeDiscountBreakdown(product) {
        if (!state.telecom || !state.internet || !product) {
            return { internetDiscount: 0, mobileDiscount: 0 };
        }
        const carrier = state.telecom;
        const internetId = state.internet.id || '';
        const speedKey = internetId.includes('100') ? '100M' : '500M+';
        
        const mobilePlans = state.mobilePlans || [];
        const mobileCount = mobilePlans.length;
        const mobilePriceSum = mobilePlans.reduce((s, p) => s + (p.price || 0), 0);
        
        const ktHighPlanCount = mobilePlans.filter(p => p.price >= KT_PREMIUM_MIN_PRICE).length;
        const lgHighPlanCount = mobilePlans.filter(p => p.price >= LG_TOGETHER_MIN_PRICE).length;
        const youthCount = mobilePlans.filter(p => p.isYouth).length;

        const key = `${product.id || ''}|${product.name || ''}`;
        const isSK_Family   = /요즘가족/.test(key) || /패밀리/.test(key);
        const isKT_Total    = /총액결합/.test(key);
        const isKT_Premium  = /프리미엄가족/.test(key);
        const isKT_Premium_Single = /프리미엄싱글/.test(key);
        const isLG_Cham     = /참쉬운/.test(key);
        const isLG_Together = /투게더/.test(key);
        const isHello_Mob   = /모바일결합/.test(key);
        
        let internetDiscount = 0;
        let mobileDiscount   = 0;

        if (carrier === 'SK') {
            if (isSK_Family) {
                internetDiscount = 0; 
                mobileDiscount = SK_FAMILY_MOBILE[Math.min(mobileCount, 5)] || 0;
                // [수정] SK 인터넷 할인 13,200원으로 현실화
                if (mobileCount >= 2 && !internetId.includes('100')) {
                     internetDiscount = 13200; 
                }
            }
        } else if (carrier === 'SKB') {
            // [신규] SKB 요즘가족결합 속도별 차등 할인 적용
            if (isSK_Family && mobileCount >= 1) {
                if (internetId.includes('100') && !internetId.includes('1000')) internetDiscount = 2200;
                else if (internetId.includes('500')) internetDiscount = 5500;
                else if (internetId.includes('1000') || internetId.includes('1G')) internetDiscount = 7700;
                
                mobileDiscount = SK_FAMILY_MOBILE[Math.min(mobileCount, 5)] || 0;
            }
        } else if (carrier === 'KT' || carrier === 'Skylife') {
            if (isKT_Total) {
                let tierIndex = KT_TOTAL_TIERS.tiers.findIndex(t => mobilePriceSum < t);
                if (tierIndex === -1) tierIndex = KT_TOTAL_TIERS.tiers.length - 1;
                
                internetDiscount = KT_TOTAL_TIERS[speedKey].internet[tierIndex] || 0;
                mobileDiscount = KT_TOTAL_TIERS[speedKey].mobile[tierIndex] || 0;
                
                if (youthCount > 0) mobileDiscount += (youthCount * KT_YOUTH_DISCOUNT);

            } else if (isKT_Premium) {
                if (mobileCount >= 2 && ktHighPlanCount >= 2) {
                    internetDiscount = 5500;
                    const sortedPlans = [...mobilePlans].sort((a, b) => b.price - a.price);
                    
                    let tierIndex = KT_TOTAL_TIERS.tiers.findIndex(t => mobilePriceSum < t);
                    if (tierIndex === -1) tierIndex = KT_TOTAL_TIERS.tiers.length - 1;
                    mobileDiscount += KT_TOTAL_TIERS[speedKey].mobile[tierIndex] || 0;

                    for (let i = 1; i < sortedPlans.length; i++) {
                        if (sortedPlans[i].price >= KT_PREMIUM_MIN_PRICE) {
                            mobileDiscount += Math.round(sortedPlans[i].price * 0.25 / 10) * 10;
                        }
                    }
                    
                    if (youthCount > 0) mobileDiscount += (youthCount * KT_YOUTH_DISCOUNT);
                }
            } else if (isKT_Premium_Single) {
                if (mobileCount === 1 && ktHighPlanCount >= 1) {
                    internetDiscount = 5500;
                    mobileDiscount = Math.round(mobilePlans[0].price * 0.25 / 10) * 10;
                }
            } else if (product.name === '홈결합30%') {
                internetDiscount = (state.internet?.price || 0) * 0.3;
            }
        } else if (carrier === 'LG' || carrier === 'HelloVision') {
            if (isLG_Cham) {
                internetDiscount = speedKey === '100M' ? 5500 : 9900;
                const discountRow = LG_CHAM_MATRIX[Math.min(mobileCount, 5)];
                if (discountRow) {
                    mobilePlans.forEach(plan => {
                        let priceIndex = (plan.price >= LG_CHAM_TIERS[1]) ? 2 : (plan.price >= LG_CHAM_TIERS[0] ? 1 : 0);
                        mobileDiscount += discountRow[priceIndex];
                    });
                }
            } else if (isLG_Together) {
                if (lgHighPlanCount >= 2) {
                    internetDiscount = speedKey === '100M' ? 5500 : 11000;
                    const perLineDiscount = LG_TOGETHER_PER_LINE[Math.min(lgHighPlanCount, 5)] || 0;
                    mobileDiscount = perLineDiscount * lgHighPlanCount;
                    if (youthCount > 0) mobileDiscount += (youthCount * LG_TOGETHER_YOUTH_DISCOUNT);
                }
            } else if (isHello_Mob) {
                const discounts = telecomData.HelloVision?.mobileDiscounts || {};
                internetDiscount = (state.tv ? (discounts.internet_tv?.[internetId] || 0) : (discounts.internet_only?.[internetId] || 0));
            }
        }
        return { internetDiscount, mobileDiscount };
    }

    function calculateTotalDiscountForProduct(product) {
        const { internetDiscount, mobileDiscount } = computeDiscountBreakdown(product);
        return internetDiscount + mobileDiscount;
    }

    function getCombinedListNormalized() {
        let raw = (telecomData[state.telecom]?.combinedProducts || []);
        if (state.telecom === 'SKB') {
            raw = raw.filter(p => p.name !== '미결합');
        }
        return raw.map((p, i) => ({ ...p, id: p.id || p.name || `cp_${i}` }));
    }

    function setupMobileOptionsUI() {
        if (!els.mobileCombinationSelector || !els.mobileDetailsWrapper || !els.mobileList || !els.addMobileBtn) return;
        
        const updateMobileState = () => {
            state.isMobileCombined = els.mobileCombinationSelector.querySelector('.selected')?.dataset.value === 'yes';
            if (state.isMobileCombined) {
                state.mobilePlans = Array.from(els.mobileList.querySelectorAll('.mobile-entry')).map(entry => {
                    const select = entry.querySelector('.mobile-plan-tier');
                    const youthCheckbox = entry.querySelector('.youth-checkbox');
                    const usimCheckbox = entry.querySelector('.usim-checkbox');
                    const planData = MOBILE_TIER_PRICES[select.value];
                    return { ...planData, isYouth: youthCheckbox.checked, hasUsim: usimCheckbox.checked };
                });
            } else {
                state.mobilePlans = [];
            }
        };

        const onMobileConfigChange = () => {
            updateMobileState();
            enableAutoBundleAndRecalc('user-action');
        };

        els.mobileCombinationSelector.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            els.mobileCombinationSelector.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            els.mobileDetailsWrapper.style.display = btn.dataset.value === 'yes' ? 'block' : 'none';
            onMobileConfigChange();
        });

        els.mobileList.addEventListener('change', onMobileConfigChange);
        els.mobileList.addEventListener('input', onMobileConfigChange);
        
        els.addMobileBtn.addEventListener('click', () => {
            const mobileEntryCount = els.mobileList.children.length;
            if (mobileEntryCount >= 5) {
                alert('가족은 최대 4명까지 추가할 수 있습니다.');
                return;
            }
            const newEntry = document.createElement('div');
            newEntry.className = 'mobile-entry';
            newEntry.innerHTML = `
                <label>가족${mobileEntryCount}</label>
                <select class="mobile-plan-tier">
                    <option value="20000">3만원 미만</option><option value="30000">3만원대</option>
                    <option value="40000">4만원대</option><option value="50000">5만원대</option>
                    <option value="60000">6만원대</option><option value="70000">7만원대</option>
                    <option value="80000">8만원 이상</option>
                </select>
                <div class="mobile-entry-options">
                    <label class="toggle-switch-label">청소년<div class="toggle-switch"><input type="checkbox" class="youth-checkbox"><span class="slider"></span></div></label>
                    <label class="toggle-switch-label">유심<div class="toggle-switch"><input type="checkbox" class="usim-checkbox"><span class="slider"></span></div></label>
                </div>
                <button class="remove-mobile-btn" type="button" title="삭제">&times;</button>
            `;
            els.mobileList.appendChild(newEntry);
            onMobileConfigChange();
        });

        els.mobileList.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-mobile-btn')) {
                e.target.parentElement.remove();
                onMobileConfigChange();
            }
        });

        const mo = new MutationObserver(() => {
            els.mobileList.querySelectorAll('.mobile-entry').forEach((entry, index) => {
                entry.querySelector('label').textContent = index === 0 ? '본인' : `가족${index}`;
            });
        });
        mo.observe(els.mobileList, { childList: true });
        
        updateMobileState();
    }

    function updateCalculations() {
        if (!state.telecom) return;
        if (state.isCombinedProductAuto) {
            const bestProductId = findBestCombinedProductId();
            if (bestProductId) {
                const allCombinedProducts = getCombinedListNormalized();
                const bestProduct = allCombinedProducts.find(p => p.id === bestProductId);
                if (bestProduct && (!state.combinedProduct || state.combinedProduct.id !== bestProduct.id)) {
                    state.combinedProduct = bestProduct;
                }
            } else {
                state.combinedProduct = null;
            }
            if (els.combinedCont) {
                els.combinedCont.querySelectorAll('.option-btn').forEach(btn => {
                    btn.classList.toggle('selected', btn.dataset.id === state.combinedProduct?.id);
                });
            }
        }
        let intPrice = state.internet?.price || 0;
        let tvPrice = state.tv?.price || 0;
        const settopPrice = state.settop?.price || 0;
        const additionalTvPrice = state.additionalTv?.price || 0;
        let internetDiscount = 0;
        let prepaidDiscount = 0;
        let supportFund = 0;
        const cardDiscount = 15000;
        let routerFee = 0;
        let totalMobileDiscount = 0;
        const giftPolicy = telecomData[state.telecom]?.giftPolicy || {};
        if (state.internet) {
            const speed = state.internet.id.includes('1000') ? '1000' : (state.internet.id.includes('500') ? '500' : '100');
            supportFund = state.tv ? (giftPolicy[`base_${speed}`] || 0) + (giftPolicy[`tv_bundle_add_${speed}`] || 0) : giftPolicy[`base_${speed}`] || 0;
        }
        const isPremiumTV = state.tv && (state.tv.name.includes('스탠다드') || state.tv.name.includes('ALL') || state.tv.name.includes('프리미엄') || state.tv.name.includes('에센스') || state.tv.name.includes('모든G'));
        if (isPremiumTV) supportFund += giftPolicy.premium_tv_add || 0;
        if (state.additionalTv) {
            const isPremiumAddTV = state.additionalTv.name.includes('프리미엄') || state.additionalTv.name.includes('ALL');
            supportFund += (isPremiumAddTV ? giftPolicy.add_tv_premium : giftPolicy.add_tv_basic) || 0;
        }
        const mobileCount = state.mobilePlans.length;
        const usimCount = state.mobilePlans.filter(p => p.hasUsim).length;
        if (usimCount > 0) supportFund += (giftPolicy.usim_add || 0) * usimCount;
        if (mobileCount > 1) supportFund += giftPolicy.family_add || 0;
        if (state.telecom === 'SKB' && state.internet) {
            const speedId = state.internet.id;
            if (speedId.includes('100') || speedId.includes('200')) routerFee = 2200;
            else if (speedId.includes('500') || speedId.includes('1000')) routerFee = 1100;
            if (state.skbPrepaid) {
                prepaidDiscount = 5500;
                supportFund = 100000;
            }
        }
        const { internetDiscount: idc, mobileDiscount: mdc } = computeDiscountBreakdown(state.combinedProduct);
        internetDiscount = idc;
        totalMobileDiscount = mdc;
        const baseFee = (intPrice + tvPrice + settopPrice + additionalTvPrice + routerFee);
        const subtotalTvFee = baseFee - internetDiscount - prepaidDiscount;
        const finalPrice = state.internet ? (subtotalTvFee - cardDiscount) : subtotalTvFee;
        const combinedFeeLabelText = (internetDiscount > 0 || prepaidDiscount > 0 || totalMobileDiscount > 0) ? '휴대폰 결합 요금' : '할인 적용 후 요금';
        if(els.results.combinedFeeLabel) els.results.combinedFeeLabel.textContent = combinedFeeLabelText;
        if(els.summaryResults.combinedFeeLabel) els.summaryResults.combinedFeeLabel.textContent = combinedFeeLabelText;
        const priceElements = [
            els.results.baseFee, els.results.combinedFee, els.results.totalPrice, els.results.totalSupport,
            els.summaryResults.baseFee, els.summaryResults.combinedFee, els.summaryResults.totalPrice, els.summaryResults.totalSupport
        ];
        els.results.baseFee.textContent = `${fmt(baseFee)}원`;
        els.results.combinedFee.textContent = `${fmt(subtotalTvFee)}원`;
        els.results.totalPrice.textContent = `${fmt(finalPrice)}원`;
        els.results.totalSupport.textContent = `${fmt(supportFund)}원`;
        if (els.summaryResults.baseFee) {
            els.summaryResults.baseFee.textContent = `${fmt(baseFee)}원`;
            els.summaryResults.combinedFee.textContent = `${fmt(subtotalTvFee)}원`;
            els.summaryResults.totalPrice.textContent = `${fmt(finalPrice)}원`;
            els.summaryResults.totalSupport.textContent = `${fmt(supportFund)}원`;
        }
        priceElements.forEach(el => {
            if (el) {
                el.classList.remove('flash-update');
                void el.offsetWidth; 
                el.classList.add('flash-update');
            }
        });
        const telecomNameFull = telecomData[state.telecom]?.name || state.telecom;
        const combinedProductName = state.combinedProduct ? state.combinedProduct.name : '-';
        
        // [수정] 상세 요금 HTML 생성 로직 (선납 분리 및 휴대폰 할인 위치 이동)
        let detailHTML = '';
        detailHTML += `<div class="detail-row"><span class="detail-label">통신사:</span> <span class="detail-value">${telecomNameFull}</span></div>`;
        detailHTML += `<div class="detail-row"><span class="detail-label">인터넷:</span> <span class="detail-value">${state.internet ? `${state.internet.name} (${fmt(intPrice)}원)` : '-'}</span></div>`;
        detailHTML += `<div class="detail-row"><span class="detail-label">TV:</span> <span class="detail-value">${state.tv ? `${state.tv.name} (${fmt(tvPrice)}원)` : '-'}</span></div>`;
        if (state.settop) detailHTML += `<div class="detail-row"><span class="detail-label">셋탑박스:</span> <span class="detail-value">${state.settop.name} (${fmt(settopPrice)}원)</span></div>`;
        if (state.additionalTv) detailHTML += `<div class="detail-row"><span class="detail-label">TV 추가:</span> <span class="detail-value">${state.additionalTv.name} (${fmt(additionalTvPrice)}원)</span></div>`;
        
        // 인터넷 할인 표시
        if (internetDiscount > 0) {
            const discountName = combinedProductName.replace(/결합|할인/g, '');
            detailHTML += `<div class="detail-row"><span class="detail-label">인터넷 할인(${discountName}):</span> <span class="detail-value discount">-${fmt(internetDiscount)}원</span></div>`;
        }
        // 선납 할인 별도 표시
        if (prepaidDiscount > 0) {
            detailHTML += `<div class="detail-row"><span class="detail-label" style="color:#007bff;">선납 할인:</span> <span class="detail-value discount" style="color:#007bff;">-${fmt(prepaidDiscount)}원</span></div>`;
        }
        
        detailHTML += `<div class="detail-row final"><span class="detail-label">월 납부 총액:</span> <span class="detail-value">${fmt(subtotalTvFee)}원</span></div>`;
        
        // 혜택 섹션 (휴대폰 할인 포함)
        detailHTML += `<h4 style="font-size: 14px; font-weight: 700; margin: 15px 0 8px 0; padding-top: 10px; border-top: 1px dashed #ccc;">혜택 상세</h4>`;
        detailHTML += `<div class="detail-row"><span class="detail-label">현금 사은품:</span> <span class="detail-value" style="color:#28a745; font-weight:bold;">${fmt(supportFund)}원</span></div>`;
        
        if (totalMobileDiscount > 0) {
            const discountName = combinedProductName.replace(/결합|할인/g, '');
            detailHTML += `<div class="detail-row"><span class="detail-label">휴대폰 할인(${discountName}):</span> <span class="detail-value" style="color:#28a745;">월 ${fmt(totalMobileDiscount)}원</span></div>`;
        }

        els.detailSummaryContent.innerHTML = detailHTML;
        const params = {
            telecom: telecomNameFull,
            internet: state.internet?.name,
            tv: state.tv?.name,
            settop: state.settop?.name,
            additionalTv: state.additionalTv?.name,
            combinedProduct: combinedProductName,
            mobilePlanDetails: JSON.stringify(state.mobilePlans),
            usim: state.mobilePlans.filter(p => p.hasUsim).length > 0 ? `${state.mobilePlans.filter(p => p.hasUsim).length}개` : null,
            totalPrice: subtotalTvFee,
            supportFund: supportFund
        };
        const cleanedParams = {};
        for (const key in params) {
            if (params[key] !== null && params[key] !== undefined) {
                cleanedParams[key] = params[key];
            }
        }
        const signupUrl = 'signup.html?' + new URLSearchParams(cleanedParams).toString();
        if (els.signupButtons.quote) els.signupButtons.quote.href = signupUrl;
        if (els.signupButtons.summary) els.signupButtons.summary.href = signupUrl;
        [els.signupButtons.quote, els.signupButtons.summary].forEach(btn => {
            if (!btn) return;
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const fullState = {
                    telecomKey: state.telecom,
                    internetId: state.internet?.id,
                    tvId: state.tv?.id,
                    settopId: state.settop?.id,
                    additionalTvId: state.additionalTv?.id,
                    combinedProductId: state.combinedProduct?.id,
                    skbPrepaid: state.skbPrepaid,
                    mobilePlans: state.mobilePlans,
                    isCombinedProductAuto: state.isCombinedProductAuto
                };
                sessionStorage.setItem('returnContext', JSON.stringify({ type: 'main', state: fullState }));
                window.location.href = newBtn.href;
            });
        });
        els.signupButtons.quote = document.getElementById('self-signup-btn-quote');
        els.signupButtons.summary = document.getElementById('summary-self-signup-btn');
    }

    function createOptionButton(type, item, telecomKey) {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.dataset.name = item.name;
        btn.dataset.key = telecomKey;
        btn.dataset.id = item.id || item.name;
        btn.dataset.type = item.type || '';
        btn.innerHTML = `<span class="item-name">${item.name}</span>` + (item.price > 0 ? `<span class="item-price">월 ${fmt(item.price)}원</span>` : '');
        
        const handleOptionClick = () => {
            if (type === 'telecom') { 
                handleTelecomClick(telecomKey); 
                return; 
            }
            if (type === 'combinedProduct') {
                state.isCombinedProductAuto = false;
            } else {
                state.isCombinedProductAuto = true;
            }
            const container = btn.parentNode;
            if (type === 'combinedProduct' && telecomKey === 'SKB') {
                if (item.type === 'addon') { 
                    state.skbPrepaid = !state.skbPrepaid;
                    btn.classList.toggle('selected');
                } else { 
                    if(state.combinedProduct?.id !== item.id) {
                        state.combinedProduct = item;
                        container.querySelectorAll('.option-btn[data-type="main"]').forEach(b => b.classList.toggle('selected', b.dataset.id === item.id));
                    }
                }
            } else { 
                const wasSelected = btn.classList.contains('selected');
                container.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
                if (wasSelected && (type === 'additionalTv' || type === 'tv' || type === 'internet')) {
                    state[type] = null;
                } else {
                    btn.classList.add('selected');
                    state[type] = item;
                }
            }
            
            if (type !== 'combinedProduct') {
                enableAutoBundleAndRecalc('user-action');
            } else {
                updateCalculations();
            }
        };
        btn.onclick = handleOptionClick;
        return btn;
    }
    
    function renderProducts(telecomKey) {
        const data = telecomData[telecomKey];
        const containers = [els.internetCont, els.tvCont, els.settopCont, els.additionalTvCont, els.combinedCont];
        containers.forEach(c => c.innerHTML = '');
        
        (data.internet || []).forEach(item => els.internetCont.appendChild(createOptionButton('internet', item, telecomKey)));
        
        const noTvBtn = document.createElement('button');
        noTvBtn.className = 'option-btn';
        noTvBtn.innerHTML = '<span class="item-name">TV 미신청</span>';
        noTvBtn.onclick = () => {
            els.tvCont.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            noTvBtn.classList.add('selected');
            state.tv = null;
            enableAutoBundleAndRecalc('user-action');
        };
        els.tvCont.appendChild(noTvBtn);
        (data.tv || []).forEach(item => els.tvCont.appendChild(createOptionButton('tv', item, telecomKey)));
        
        const defaultSettop = { name: 'UHD 셋탑', price: 4400, id: 'default_settop' };
        const settops = data.settop && data.settop.length > 0 ? data.settop : [defaultSettop];
        settops.forEach(item => els.settopCont.appendChild(createOptionButton('settop', item, telecomKey)));

        const defaultAddTv = [
            { name: '선택 안함', price: 0, id: 'no_add_tv' },
            { name: '1대 추가', price: 10000, id: 'add_tv_1' }
        ];
        const addTvs = data.additionalTv && data.additionalTv.length > 0 ? data.additionalTv : defaultAddTv;
        addTvs.forEach(item => els.additionalTvCont.appendChild(createOptionButton('additionalTv', item, telecomKey)));

        const list = getCombinedListNormalized();
        list.forEach(item => {
            els.combinedCont.appendChild(createOptionButton('combinedProduct', item, telecomKey));
        });
        
        // [수정] 결합상품 버튼 컨테이너 표시 설정
        if (list.length > 0) {
            els.combinedCont.style.display = 'grid';
            els.combinedCont.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
            els.combinedCont.style.gap = '10px';
            els.combinedCont.style.marginTop = '20px';
        } else {
            els.combinedCont.style.display = 'none';
        }
    }

    function handleTelecomClick(telecomKey) {
        state.telecom = telecomKey;
        state.isCombinedProductAuto = true;
        state._autoBundleReason = 'init';
        
        document.querySelectorAll('#telecom-options-simple .option-btn').forEach(btn => btn.classList.toggle('selected', btn.dataset.key === telecomKey));
        renderProducts(telecomKey);
        const data = telecomData[telecomKey];
        
        state.internet = data.internet?.find(item => item.id && item.id.includes('500')) || data.internet?.[0] || null;
        // [수정] 기본 TV를 2번째 항목(Pop 180 등)으로 설정
        // SKB만 Index 1, 나머지는 Index 0 (최저가)
        if (telecomKey === 'SKB') {
            state.tv = data.tv?.[1] || data.tv?.[0] || null;
        } else {
            state.tv = data.tv?.[0] || null;
        }
        
        state.settop = data.settop?.[0] || { name: 'UHD 셋탑', price: 4400, id: 'default_settop' };
        state.additionalTv = null;
        state.skbPrepaid = false;
        
        state.isMobileCombined = true;
        
        els.mobileList.innerHTML = '';
        const newEntry = document.createElement('div');
        newEntry.className = 'mobile-entry';
        newEntry.innerHTML = `
            <label>본인</label>
            <select class="mobile-plan-tier">
                <option value="20000">3만원 미만</option><option value="30000">3만원대</option>
                <option value="40000">4만원대</option><option value="50000">5만원대</option>
                <option value="60000">6만원대</option><option value="70000">7만원대</option>
                <option value="80000" selected>8만원 이상</option>
            </select>
            <div class="mobile-entry-options">
                <label class="toggle-switch-label">청소년<div class="toggle-switch"><input type="checkbox" class="youth-checkbox"><span class="slider"></span></div></label>
                <label class="toggle-switch-label">유심<div class="toggle-switch"><input type="checkbox" class="usim-checkbox"><span class="slider"></span></div></label>
            </div>
        `;
        els.mobileList.appendChild(newEntry);
        
        const combineYesBtn = els.mobileCombinationSelector.querySelector('button[data-value="yes"]');
        const combineNoBtn = els.mobileCombinationSelector.querySelector('button[data-value="no"]');
        if (combineYesBtn && combineNoBtn) {
            combineNoBtn.classList.remove('selected');
            combineYesBtn.classList.add('selected');
        }
        els.mobileDetailsWrapper.style.display = 'block';
        
        state.mobilePlans = [{ name: '8만원 이상 요금제', price: 80000, isYouth: false, hasUsim: false }];

        state.combinedProduct = null; 
        
        if (state.internet) document.querySelector(`#internet-options-simple .option-btn[data-id="${state.internet.id}"]`)?.classList.add('selected');
        if (state.tv) document.querySelector(`#tv-options-simple .option-btn[data-id="${state.tv.id}"]`)?.classList.add('selected');
        if (state.settop) document.querySelector(`#settop-options-simple .option-btn[data-id="${state.settop.id}"]`)?.classList.add('selected');
        
        const noAddTvBtn = els.additionalTvCont.querySelector('.option-btn');
        if(noAddTvBtn) noAddTvBtn.classList.add('selected');

        els.detailFeeSummary.style.display = 'none';
        if (els.toggleDetailFeeLink) els.toggleDetailFeeLink.innerHTML = '상세요금 <i class="fas fa-chevron-right"></i>';
        
        state.currentStep = 1;
        updateWizardUI();
        
        enableAutoBundleAndRecalc('init');
    }
    
    (function initCalculator() {
        
        function injectDynamicStyles() {
            const style = document.createElement('style');
            style.textContent = `
                .auto-bundle-notification {
                    background-color: var(--primary-light-bg); color: var(--primary-dark);
                    font-size: 14px; font-weight: 500; padding: 12px 15px;
                    border-radius: 8px; margin: 0 30px 20px; text-align: center;
                    opacity: 0; max-height: 0; transform: translateY(-10px);
                    transition: all 0.4s ease; overflow: hidden;
                }
                .auto-bundle-notification.visible {
                    opacity: 1; max-height: 50px; transform: translateY(0); margin-bottom: 20px;
                }
                .flash-update { animation: flash-update 0.7s ease-out; }
                @keyframes flash-update {
                    0% { transform: translateY(5px); opacity: 0.5; }
                    50% { transform: translateY(-2px); opacity: 1; }
                    100% { transform: translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        function createNotificationElement() {
            const quotePanelBody = document.querySelector('.quote-body');
            if (quotePanelBody && !document.getElementById('auto-bundle-notification')) {
                const notificationEl = document.createElement('div');
                notificationEl.id = 'auto-bundle-notification';
                notificationEl.className = 'auto-bundle-notification';
                quotePanelBody.prepend(notificationEl);
            }
        }

        injectDynamicStyles();
        createNotificationElement();
        
        const initialTelecomOrder = ['SK', 'LG', 'KT', 'SKB', 'Skylife', 'HelloVision'];
        if (els.wizard.nextBtn) {
            els.wizard.nextBtn.addEventListener('click', () => {
                if (state.currentStep < state.totalSteps) {
                    state.currentStep++;
                    updateWizardUI();
                } else {
                    els.wizard.guideBubble.textContent = guideMessages[6];
                    const quotePanel = document.querySelector('.quote-panel');
                    if (quotePanel) {
                        quotePanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            });
        }
        if (els.wizard.prevBtn) {
            els.wizard.prevBtn.addEventListener('click', () => {
                if (state.currentStep > 1) {
                    state.currentStep--;
                    updateWizardUI();
                }
            });
        }
        initialTelecomOrder.forEach(key => {
            if (telecomData[key]) {
                const btn = document.createElement('button');
                btn.className = 'option-btn'; btn.dataset.key = key;
                btn.innerHTML = `<span class="item-name">${telecomData[key].name || key}</span>`;
                btn.onclick = () => handleTelecomClick(key);
                els.telecomCont.appendChild(btn);
            }
        });
        setupMobileOptionsUI();
        if (initialTelecomOrder.length > 0 && telecomData[initialTelecomOrder[0]]) {
            handleTelecomClick(initialTelecomOrder[0]);
        }
    })();
    
    function restoreMainCalculatorState(stateToRestore) {
        const telecomKey = stateToRestore.telecomKey;
        if (!telecomKey || !telecomData[telecomKey]) return;
        document.querySelectorAll('#telecom-options-simple .option-btn').forEach(btn => btn.classList.toggle('selected', btn.dataset.key === telecomKey));
        renderProducts(telecomKey);
        const data = telecomData[telecomKey];
        state.telecom = telecomKey;
        state.internet = data.internet.find(i => i.id === stateToRestore.internetId) || null;
        state.tv = data.tv.find(i => i.id === stateToRestore.tvId) || null;
        state.settop = data.settop?.find(i => i.id === stateToRestore.settopId) || null;
        state.additionalTv = data.additionalTv?.find(i => i.id === stateToRestore.additionalTvId) || null;
        state.skbPrepaid = stateToRestore.skbPrepaid;
        state.mobilePlans = stateToRestore.mobilePlans || [];
        state.isCombinedProductAuto = stateToRestore.isCombinedProductAuto;
        if (!state.isCombinedProductAuto) {
            state.combinedProduct = getCombinedListNormalized().find(i => i.id === stateToRestore.combinedProductId) || null;
        }
        if (state.internet) document.querySelector(`#internet-options-simple .option-btn[data-id="${state.internet.id}"]`)?.classList.add('selected');
        if (state.tv) document.querySelector(`#tv-options-simple .option-btn[data-id="${state.tv.id}"]`)?.classList.add('selected');
        if (state.settop) document.querySelector(`#settop-options-simple .option-btn[data-id="${state.settop.id}"]`)?.classList.add('selected');
        if (state.additionalTv) document.querySelector(`#additional-tv-options-simple .option-btn[data-id="${state.additionalTv.id}"]`)?.classList.add('selected');
        if (els.mobileList && state.mobilePlans.length > 0) {
            els.mobileList.innerHTML = '';
            state.mobilePlans.forEach((plan, index) => {
                const tierValue = Object.keys(MOBILE_TIER_PRICES).find(key => MOBILE_TIER_PRICES[key].price === plan.price) || "80000";
                const newEntry = document.createElement('div');
                newEntry.className = 'mobile-entry';
                newEntry.innerHTML = `
                    <label>${index === 0 ? '본인' : `가족${index}`}</label>
                    <select class="mobile-plan-tier">
                        <option value="20000">3만원 미만</option><option value="30000">3만원대</option>
                        <option value="40000">4만원대</option><option value="50000">5만원대</option>
                        <option value="60000">6만원대</option><option value="70000">7만원대</option>
                        <option value="80000">8만원 이상</option>
                    </select>
                    <div class="mobile-entry-options">
                        <label class="toggle-switch-label">청소년<div class="toggle-switch"><input type="checkbox" class="youth-checkbox"><span class="slider"></span></div></label>
                        <label class="toggle-switch-label">유심<div class="toggle-switch"><input type="checkbox" class="usim-checkbox"><span class="slider"></span></div></label>
                    </div>
                    ${index > 0 ? '<button class="remove-mobile-btn" type="button" title="삭제">&times;</button>' : ''}
                `;
                newEntry.querySelector('.mobile-plan-tier').value = tierValue;
                newEntry.querySelector('.youth-checkbox').checked = plan.isYouth;
                newEntry.querySelector('.usim-checkbox').checked = plan.hasUsim;
                els.mobileList.appendChild(newEntry);
            });
            els.mobileCombinationSelector.querySelector('button[data-value="yes"]').click();
        } else {
             els.mobileCombinationSelector.querySelector('button[data-value="no"]').click();
        }
        state.currentStep = state.totalSteps;
        updateWizardUI();
        updateCalculations();
    }

    document.addEventListener('restoreMainCalculator', (e) => {
        restoreMainCalculatorState(e.detail);
    });

    window.mainModuleReady = true;
    window.dispatchEvent(new Event('main-module-ready'));
}