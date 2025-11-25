import { getFullData, addCustomerLead, createShortQuote } from './data-service.js';

export function initAiCalculator(telecomDataFromDB) {

    // [유효성 검사] 데이터가 없으면 에러 표시
    if (!telecomDataFromDB) {
        const aiContainer = document.querySelector('.ai-calculator-body');
        if(aiContainer) aiContainer.innerHTML = '<p style="text-align:center; color:red; font-weight:bold; padding: 50px 0;">[오류] AI 플래너 정보를 불러오는 데 실패했습니다. 페이지를 새로고침하거나 관리자에게 문의하세요.</p>';
        return;
    }

    const aiCalcBody = document.querySelector('.ai-calculator-body');
    if (!aiCalcBody) return;

    let allResultsData = [];

    // [설정] 모바일 요금제 기준표 (가격 계산용)
    window.MOBILE_TIER_PRICES = {
        "20000": { name: '3만원 미만 요금제', price: 20000 }, 
        "30000": { name: '3만원대 요금제', price: 35000 }, 
        "40000": { name: '4만원대 요금제', price: 45000 }, 
        "50000": { name: '5만원대 요금제', price: 55000 }, 
        "60000": { name: '6만원대 요금제', price: 65000 }, 
        "70000": { name: '7만원대 요금제', price: 75000 }, 
        "80000": { name: '8만원 이상 요금제', price: 80000 } 
    };
    
    // [데이터 가공] DB 데이터를 내부 로직에 맞게 변환
    const telecomData = {};
    for (const key in telecomDataFromDB) {
        const original = telecomDataFromDB[key];
        telecomData[key] = {
            name: original.name,
            color: original.color,
            internet: (original.internet || []).map(p => ({ id: p.id, name: p.name.split(' ')[0], price: p.price })),
            tv: (original.tv || []).map(p => ({ 
                id: p.id, 
                name: p.name.split('(')[0].trim(), 
                price: p.price 
            })),
            additionalTv: Array.isArray(original.additionalTv) ? original.additionalTv : [],
            combinedProducts: original.combinedProducts || [],
            giftPolicy: original.giftPolicy,
            discounts: original.discounts,
            mobileDiscounts: original.mobileDiscounts
        };
    }
    
    // ==========================================
    // [할인 정책 상수 정의]
    // ==========================================
    
    // [LG U+] 투게더 결합 기준 및 할인액
    const LG_TOGETHER_MIN_PRICE = 80000; // 8만원 이상
    const LG_TOGETHER_PER_LINE = { 2: 10000, 3: 14000, 4: 20000, 5: 20000 }; 
    const LG_TOGETHER_YOUTH_DISCOUNT = 10000; // 청소년 추가 할인

    // [LG U+] 참쉬운 가족결합 (데이터 구간별 할인)
    const LG_CHAM_MATRIX = { 
        1: [0, 0, 0], 
        2: [2200, 3300, 4400], 
        3: [3300, 5500, 6600], 
        4: [4400, 6600, 8800], 
        5: [4400, 6600, 8800] 
    };
    const LG_CHAM_TIERS = [69000, 88000]; 

    // [KT] 프리미엄 결합 기준
    const KT_PREMIUM_MIN_PRICE = 77000; // 7.7만원 이상

    // [KT] 총액 결합 할인 (구간별)
    const KT_TOTAL_TIERS = { 
        tiers: [22000, 64900, 108900, 141900, 174900, Infinity], 
        '100M': { internet: [1650, 3300, 5500, 5500, 5500, 5500], mobile: [0, 0, 3300, 14300, 18700, 23100] }, 
        '500M+': { internet: [2200, 5500, 5500, 5500, 5500, 5500], mobile: [0, 0, 5500, 16610, 22110, 27610] } 
    };
    const KT_YOUTH_DISCOUNT = 5500; 

    // [SK] 요즘가족결합 (회선 수별 모바일 할인)
    const SK_FAMILY_MOBILE = { 1: 0, 2: 9900, 3: 19800, 4: 30800, 5: 41800 };


    // ==========================================
    // [UI 요소 선택]
    // ==========================================
    const els = { 
        internetSelector: aiCalcBody.querySelector('#internet-selector'), 
        tvSelector: aiCalcBody.querySelector('#tv-selector'), 
        additionalTvSelector: aiCalcBody.querySelector('#additional-tv-selector'), 
        mobileCombinationSelector: aiCalcBody.querySelector('#mobile-combination-selector'), 
        mobileDetailsWrapper: aiCalcBody.querySelector('#mobile-details-wrapper'), 
        mobileList: aiCalcBody.querySelector('#mobile-list'), 
        addMobileBtn: aiCalcBody.querySelector('#add-mobile-btn'), 
        calculateBtn: aiCalcBody.querySelector('#calculate-btn'), 
        loader: aiCalcBody.querySelector('#loader'), 
        resultsContainer: aiCalcBody.querySelector('.results-container'), 
        recommendationCards: aiCalcBody.querySelector('#ai-recommendation-cards')
    };

    // 옵션 선택 핸들러
    function handleOptionSelection(selector) { 
        selector.addEventListener('click', (e) => { 
            if (e.target.tagName === 'BUTTON') { 
                Array.from(selector.children).forEach(btn => btn.classList.remove('selected')); 
                e.target.classList.add('selected'); 
            } 
        }); 
    }
    handleOptionSelection(els.internetSelector); 
    handleOptionSelection(els.tvSelector); 
    handleOptionSelection(els.additionalTvSelector);

    // 모바일 결합 여부 토글
    els.mobileCombinationSelector.addEventListener('click', (e) => { 
        if (e.target.tagName === 'BUTTON') { 
            Array.from(els.mobileCombinationSelector.children).forEach(btn => btn.classList.remove('selected')); 
            e.target.classList.add('selected'); 
            const isCombined = e.target.dataset.value === 'yes'; 
            els.mobileDetailsWrapper.style.display = isCombined ? 'block' : 'none'; 
        } 
    });

    // 가족 추가 로직
    let mobileEntryCount = 1;
    els.addMobileBtn.addEventListener('click', () => {
        if (mobileEntryCount >= 5) { alert('가족은 최대 4명까지 추가할 수 있습니다.'); return; }
        mobileEntryCount++;
        const newEntry = document.createElement('div');
        newEntry.className = 'mobile-entry';
        newEntry.innerHTML = `
            <label>가족${mobileEntryCount - 1}</label>
            <select class="mobile-plan-tier">
                <option value="20000">3만원 미만</option><option value="30000">3만원대</option><option value="40000">4만원대</option><option value="50000" selected>5만원대</option><option value="60000">6만원대</option><option value="70000">7만원대</option><option value="80000">8만원 이상</option>
            </select>
            <div class="mobile-entry-options">
                <label class="toggle-switch-label">
                    청소년
                    <div class="toggle-switch">
                        <input type="checkbox" class="youth-checkbox">
                        <span class="slider"></span>
                    </div>
                </label>
                <label class="toggle-switch-label">
                    유심
                    <div class="toggle-switch">
                        <input type="checkbox" class="usim-checkbox">
                        <span class="slider"></span>
                    </div>
                </label>
            </div>
            <button class="remove-mobile-btn" type="button" title="삭제">&times;</button>
        `;
        els.mobileList.appendChild(newEntry);
    });

    // 가족 삭제 로직
    els.mobileList.addEventListener('click', (e) => { 
        if (e.target.classList.contains('remove-mobile-btn')) { 
            e.target.parentElement.remove(); 
            mobileEntryCount--; 
            els.mobileList.querySelectorAll('.mobile-entry').forEach((entry, index) => { 
                entry.querySelector('label').textContent = index === 0 ? '본인' : `가족${index}`; 
            }); 
        } 
    });

    // 계산 시작 버튼
    els.calculateBtn.addEventListener('click', runOptimization);

    function runOptimization() {
        els.calculateBtn.classList.add('calculating');
        els.calculateBtn.disabled = true;

        const userSelections = getUserSelections();
        els.resultsContainer.style.display = 'none';
        els.loader.style.display = 'block';
        
        setTimeout(() => {
            const carriers = ['SK', 'LG', 'KT', 'SKB', 'Skylife', 'HelloVision'];
            // 각 통신사별 최적 상품 계산
            allResultsData = carriers.map(carrier => calculateBestOptionForCarrier(carrier, userSelections))
                                     .flat()
                                     .filter(result => result && result.totalBenefit > 0);
            
            displayResults(allResultsData);
            
            els.loader.style.display = 'none';
            els.resultsContainer.style.display = 'block';
            
            // 스크롤 이동
            const header = document.querySelector('.sticky-header-container');
            const firstResultCategory = aiCalcBody.querySelector('.result-category');

            if (header && firstResultCategory) {
                const headerHeight = header.offsetHeight;
                const elementPosition = firstResultCategory.getBoundingClientRect().top + window.pageYOffset;
                const offsetPosition = elementPosition - headerHeight - 20;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }

            els.calculateBtn.classList.remove('calculating');
            els.calculateBtn.disabled = false;
        }, 1500);
    }

    function getUserSelections() {
        const isMobileCombined = els.mobileCombinationSelector.querySelector('.selected').dataset.value === 'yes';
        return {
            internetSpeed: els.internetSelector.querySelector('.selected').dataset.value,
            tvPlan: els.tvSelector.querySelector('.selected').dataset.value,
            additionalTvCount: parseInt(els.additionalTvSelector.querySelector('.selected').dataset.value, 10),
            mobilePlans: isMobileCombined ? Array.from(els.mobileList.querySelectorAll('.mobile-entry')).map(entry => {
                const select = entry.querySelector('.mobile-plan-tier');
                const youthCheckbox = entry.querySelector('.youth-checkbox');
                const usimCheckbox = entry.querySelector('.usim-checkbox');
                const planData = window.MOBILE_TIER_PRICES[select.value];
                return { ...planData, isYouth: youthCheckbox.checked, hasUsim: usimCheckbox.checked };
            }) : []
        };
    }
    
    // ==========================================================================
    // [핵심 로직] 통신사별 최적 결합 상품 계산
    // ==========================================================================
    function calculateBestOptionForCarrier(carrierName, selections) {
        const carrierData = telecomData[carrierName];
        if (!carrierData) return [];
        
        // [수정] 결합 상품 목록 강제 생성 (Fallback Logic)
        let combinedProducts = [];
        if (selections.mobilePlans.length > 0) {
            if (carrierData.combinedProducts && carrierData.combinedProducts.length > 0) {
                combinedProducts = carrierData.combinedProducts;
            } else {
                // DB 데이터 부재 시 기본값 강제 주입
                if (carrierName === 'SK' || carrierName === 'SKB') combinedProducts = [{ name: '요즘가족결합' }];
                else if (carrierName === 'KT') combinedProducts = [{ name: '총액결합할인' }, { name: '프리미엄가족결합' }, { name: '프리미엄싱글결합' }];
                else if (carrierName === 'LG') combinedProducts = [{ name: '참쉬운가족결합' }, { name: '투게더결합' }];
                else combinedProducts = [{ name: '모바일결합' }];
            }
        } else {
            const defaultName = selections.tvPlan !== 'none' ? '홈 결합 (3년 약정)' : '3년 약정 할인';
            combinedProducts = [{ name: defaultName }];
        }
        
        let results = [];
        
        // 인터넷 상품 찾기
        const internetProduct = carrierData.internet.find(p => p.id.includes(selections.internetSpeed));
        if (!internetProduct) return [];

        // TV 상품 찾기
        let tvProduct = null, tvPrice = 0, additionalTvPrice = 0, additionalTvProductForDetail = null;
        
        if (selections.tvPlan !== 'none') {
            // [수정] 기본 TV 선택 시 2번째 상품(Pop 180 등)을 우선 선택하도록 변경
            if (selections.tvPlan === 'basic') {
                // SKB만 Index 1, 나머지는 Index 0 (최저가)
                if (carrierName === 'SKB') {
                    tvProduct = carrierData.tv[1] || carrierData.tv[0]; 
                } else {
                    tvProduct = carrierData.tv[0]; 
                }
            } else if (selections.tvPlan === 'premium') {
                tvProduct = carrierData.tv[2] || carrierData.tv[1] || carrierData.tv[0];
            }

            if (tvProduct) {
                tvPrice = tvProduct.price;
                if (selections.additionalTvCount > 0) {
                    let pricePerUnit = 0;
                    if (Array.isArray(carrierData.additionalTv) && carrierData.additionalTv.length > 0) {
                        const idx = selections.additionalTvCount; 
                        if (carrierData.additionalTv[idx]) pricePerUnit = carrierData.additionalTv[idx].price; 
                        else pricePerUnit = carrierData.additionalTv[1] ? carrierData.additionalTv[1].price : 9900;
                    }
                    additionalTvPrice = pricePerUnit * selections.additionalTvCount;
                    if (additionalTvPrice > 0) {
                        additionalTvProductForDetail = { name: `추가 TV ${selections.additionalTvCount}대`, price: additionalTvPrice };
                    }
                }
            }
        }
        
        if (!tvProduct) tvProduct = { id: 'none', name: '미포함', price: 0 };
        const internetPrice = internetProduct.price;

        for (const combinedProduct of combinedProducts) {
            let internetDiscount = 0, totalMobileDiscount = 0;
            let recommendationContext = {};
            
            const mobileCount = selections.mobilePlans.length;
            const mobilePriceSum = selections.mobilePlans.reduce((sum, p) => sum + p.price, 0);
            
            const ktHighPlanCount = selections.mobilePlans.filter(p => p.price >= KT_PREMIUM_MIN_PRICE).length;
            const lgHighPlanCount = selections.mobilePlans.filter(p => p.price >= LG_TOGETHER_MIN_PRICE).length;
            const youthCount = selections.mobilePlans.filter(p => p.isYouth).length;

            if (mobileCount > 0) {
                if (carrierName === 'LG') {
                    if (lgHighPlanCount >= 2) {
                        if (!combinedProduct.name.includes('투게더')) continue; 
                        internetDiscount = selections.internetSpeed === '100' ? 5500 : 11000;
                        const perLineDiscount = LG_TOGETHER_PER_LINE[Math.min(lgHighPlanCount, 5)] || 0;
                        totalMobileDiscount = perLineDiscount * lgHighPlanCount;
                        if (youthCount > 0) totalMobileDiscount += (youthCount * LG_TOGETHER_YOUTH_DISCOUNT);
                        recommendationContext = { primaryBenefit: 'mobile', value: totalMobileDiscount };
                    } else {
                        if (combinedProduct.name.includes('투게더')) continue; 
                        internetDiscount = selections.internetSpeed === '100' ? 5500 : 9900;
                        const discountRow = LG_CHAM_MATRIX[Math.min(mobileCount, 5)];
                        if (discountRow) {
                            selections.mobilePlans.forEach(plan => {
                                let priceIndex = (plan.price >= LG_CHAM_TIERS[1]) ? 2 : (plan.price >= LG_CHAM_TIERS[0] ? 1 : 0);
                                totalMobileDiscount += discountRow[priceIndex];
                            });
                        }
                    }
                } 
                else if (carrierName === 'KT') {
                    if (mobileCount === 1 && ktHighPlanCount >= 1) {
                        if (!combinedProduct.name.includes('프리미엄싱글')) continue;
                        internetDiscount = 5500; 
                        totalMobileDiscount = Math.round(selections.mobilePlans[0].price * 0.25 / 10) * 10;
                        recommendationContext = { primaryBenefit: 'mobile', value: totalMobileDiscount };
                    }
                    else if (mobileCount >= 2 && ktHighPlanCount >= 2) {
                        if (!combinedProduct.name.includes('프리미엄가족')) continue;
                        internetDiscount = 5500; 
                        const sortedPlans = [...selections.mobilePlans].sort((a, b) => b.price - a.price);
                        const speedKey = selections.internetSpeed === '100' ? '100M' : '500M+';
                        let tierIndex = KT_TOTAL_TIERS.tiers.findIndex(tier => mobilePriceSum < tier);
                        if (tierIndex === -1) tierIndex = KT_TOTAL_TIERS.tiers.length - 1;
                        totalMobileDiscount += KT_TOTAL_TIERS[speedKey].mobile[tierIndex] || 0;
                        for (let i = 1; i < sortedPlans.length; i++) {
                            if (sortedPlans[i].price >= KT_PREMIUM_MIN_PRICE) {
                                totalMobileDiscount += Math.round(sortedPlans[i].price * 0.25 / 10) * 10;
                            }
                        }
                        if (youthCount > 0) totalMobileDiscount += (youthCount * KT_YOUTH_DISCOUNT);
                        recommendationContext = { primaryBenefit: 'mobile', value: totalMobileDiscount };
                    }
                    else {
                        if (combinedProduct.name.includes('프리미엄')) continue; 
                        const speedKey = selections.internetSpeed === '100' ? '100M' : '500M+';
                        let tierIndex = KT_TOTAL_TIERS.tiers.findIndex(tier => mobilePriceSum < tier);
                        if (tierIndex === -1) tierIndex = KT_TOTAL_TIERS.tiers.length - 1;
                        internetDiscount = KT_TOTAL_TIERS[speedKey].internet[tierIndex] || 0;
                        totalMobileDiscount = KT_TOTAL_TIERS[speedKey].mobile[tierIndex] || 0;
                        if (youthCount > 0) totalMobileDiscount += (youthCount * KT_YOUTH_DISCOUNT);
                    }
                }
                else if (carrierName === 'SK' || carrierName === 'SKB') {
                    if (combinedProduct.name.includes('요즘가족') || combinedProduct.name.includes('패밀리')) {
                        internetDiscount = 0; 
                        totalMobileDiscount = SK_FAMILY_MOBILE[Math.min(mobileCount, 5)] || 0;
                        
                        // [수정] SKB(B알뜰) 요즘가족결합 인터넷 할인 로직 변경 (속도별 차등)
                        if (carrierName === 'SKB') {
                            if (mobileCount >= 1) {
                                if (selections.internetSpeed === '100') internetDiscount = 2200;
                                else if (selections.internetSpeed === '500') internetDiscount = 5500;
                                else if (selections.internetSpeed === '1000') internetDiscount = 7700;
                            }
                        } 
                        // [수정] SKT 본사 로직 (1대 이상이면 속도별 할인 적용)
                        else {
                            if (mobileCount >= 1) {
                                if (selections.internetSpeed === '100') internetDiscount = 3300;
                                else if (selections.internetSpeed === '500') internetDiscount = 6600;
                                else if (selections.internetSpeed === '1000') internetDiscount = 8800;
                            }
                        }
                    }
                }
                else if (carrierName === 'Skylife') {
                     if (combinedProduct.name.includes('홈결합')) {
                         internetDiscount = Math.round(internetPrice * 0.3 / 10) * 10;
                     }
                }
            }
            
            if (totalMobileDiscount > internetDiscount && totalMobileDiscount > 3000) {
                recommendationContext = { primaryBenefit: 'mobile', value: totalMobileDiscount };
            } else if (internetDiscount > 0) {
                recommendationContext = { primaryBenefit: 'internet', value: internetDiscount };
            }

            const netBill = (internetPrice || 0) + (tvPrice || 0) + (additionalTvPrice || 0) - (internetDiscount || 0);
            
            const giftPolicy = carrierData.giftPolicy || {};
            const speed = selections.internetSpeed;

            let cashBenefit = 0;
            if (selections.tvPlan !== 'none') {
                cashBenefit = (giftPolicy[`base_${speed}`] || 0) + (giftPolicy[`tv_bundle_add_${speed}`] || 0);
            } else {
                cashBenefit = giftPolicy[`base_${speed}`] || 0;
            }

            if (selections.tvPlan === 'premium') cashBenefit += giftPolicy.premium_tv_add || 0;
            if (selections.additionalTvCount > 0) {
                const addTvAmount = selections.tvPlan === 'premium' ? giftPolicy.add_tv_premium : giftPolicy.add_tv_basic;
                cashBenefit += (addTvAmount || 0) * selections.additionalTvCount;
            }
            if (selections.mobilePlans.filter(p => p.hasUsim).length > 0) cashBenefit += (giftPolicy.usim_add || 0) * selections.mobilePlans.filter(p => p.hasUsim).length;
            
            const totalBenefit = cashBenefit + ((internetDiscount + totalMobileDiscount) * 36);

            results.push({
                id: `${carrierName}_${combinedProduct.name}`.replace(/\s/g, ''),
                carrier: carrierData.name, 
                netBill, cashBenefit, totalBenefit, totalMobileDiscount, bestPlanName: combinedProduct.name,
                details: { telecom: { name: carrierData.name, color: telecomDataFromDB[carrierName].color }, internet: internetProduct, tv: tvProduct, additionalTv: additionalTvProductForDetail, internetDiscount },
                recommendationContext
            });
        }
        
        if (carrierName === 'SKB') {
            const prepaidDiscount = 5500;
            const prepaidCashBenefit = 100000; // 선납 사은품 10만원 고정
            
            // [수정] SKB 선납 + 결합 중복 적용 로직
            let bestMobileDiscount = 0;
            let internetDiscountForPrepaid = 0;
            const mobileCount = selections.mobilePlans.length;
            
            if (mobileCount > 0) {
                bestMobileDiscount = SK_FAMILY_MOBILE[Math.min(mobileCount, 5)] || 0;
                // SKB 요즘가족결합 로직 적용 (1인 이상 시 속도별 할인)
                if (mobileCount >= 1) {
                    if (selections.internetSpeed === '100') internetDiscountForPrepaid = 2200;
                    else if (selections.internetSpeed === '500') internetDiscountForPrepaid = 5500;
                    else if (selections.internetSpeed === '1000') internetDiscountForPrepaid = 7700;
                }
            }

            const finalPricePrepaid = (internetPrice + tvPrice + additionalTvPrice) - prepaidDiscount - internetDiscountForPrepaid;
            const totalBenefitPrepaid = prepaidCashBenefit + ((prepaidDiscount + bestMobileDiscount + internetDiscountForPrepaid) * 36);
            
            let prepaidName = 'B알뜰 선납';
            if (bestMobileDiscount > 0) prepaidName += ` + 요즘가족(${mobileCount}인)`;

            results.push({
                id: `${carrierName}_선납`,
                carrier: carrierData.name,
                netBill: finalPricePrepaid, 
                cashBenefit: prepaidCashBenefit, 
                totalBenefit: totalBenefitPrepaid, 
                totalMobileDiscount: bestMobileDiscount, 
                bestPlanName: prepaidName,
                details: { 
                    telecom: { name: carrierData.name, color: telecomDataFromDB[carrierName].color }, 
                    internet: internetProduct, tv: tvProduct, additionalTv: additionalTvProductForDetail, 
                    internetDiscount: internetDiscountForPrepaid + prepaidDiscount // 총 할인액 (선납+결합)
                },
                recommendationContext: { primaryBenefit: 'prepaid', value: prepaidDiscount }
            });
        }
        
        return results;
    }
    
    function generateRecommendationReason(result) {
        if (!result || !result.rankTitle) return '';
        
        const { netBill, cashBenefit, totalMobileDiscount, bestPlanName, details, recommendationContext, rankTitle } = result;
        const fmt = (n) => Math.round(n).toLocaleString();

        if (rankTitle === '최대혜택 1위' || rankTitle === '최저요금 1위') {
            if (recommendationContext?.primaryBenefit === 'mobile' && totalMobileDiscount > 0) {
                return `고객님 가족의 휴대폰 요금제 구성은 <strong>'${bestPlanName}'</strong> 적용 시 <strong>월 ${fmt(totalMobileDiscount)}원</strong>의 추가 통신비 절감 효과가 있어 1위로 추천되었습니다.`;
            }
            if (recommendationContext?.primaryBenefit === 'internet' && details.internetDiscount > 0) {
                return `선택하신 인터넷 상품은 <strong>'${bestPlanName}'</strong> 적용 시 <strong>월 ${fmt(details.internetDiscount)}원</strong>의 가장 큰 요금 할인을 받을 수 있어 추천되었습니다.`;
            }
        }

        let reasonParts = [];
        let concludingText = '으로 합리적인 선택입니다.';

        switch(rankTitle) {
            case '최대혜택 1위':
            case '최대혜택 2위':
                reasonParts.push(`현금 사은품 ${fmt(cashBenefit)}원`);
                if (totalMobileDiscount > 0) {
                    reasonParts.push(`휴대폰 월 ${fmt(totalMobileDiscount)}원 할인`);
                }
                concludingText = rankTitle === '최대혜택 1위' ? ' 기준으로 가장 큰 혜택을 제공합니다.' : ' 기준으로 혜택이 우수합니다.';
                break;
            case '최저요금 1위':
                 reasonParts.push(`월 요금 ${fmt(netBill)}원`);
                if (totalMobileDiscount > 0) {
                    reasonParts.push(`휴대폰 월 ${fmt(totalMobileDiscount)}원 할인`);
                }
                concludingText = ' 기준으로 가장 저렴합니다.';
                break;
            default:
                reasonParts.push(`월 ${fmt(netBill)}원`);
                reasonParts.push(`현금 ${fmt(cashBenefit)}원`);
                concludingText = '을 종합적으로 고려 시 추천됩니다.';
                break;
        }
        return `${reasonParts.join(', ')}${concludingText}`;
    }

    function displayResults(results) {
        if (!results || results.length === 0) {
            els.recommendationCards.innerHTML = "<p>조건에 맞는 추천 요금제가 없습니다.</p>";
            return;
        }

        const sortedByBenefit = [...results].sort((a, b) => b.totalBenefit - a.totalBenefit);
        const sortedByBill = [...results].sort((a, b) => a.netBill - b.netBill);

        const finalCards = new Array(3).fill(null);
        const usedIds = new Set();

        const topBenefit1 = sortedByBenefit[0];
        if (topBenefit1) {
            topBenefit1.rankTitle = "최대혜택 1위";
            topBenefit1.tag = "추천";
            finalCards[0] = topBenefit1;
            usedIds.add(topBenefit1.id);
        }

        const sortedByBillForLowest = sortedByBill.filter(plan => !plan.bestPlanName.includes('선납'));
        const topBillCandidate = sortedByBillForLowest[0] || sortedByBill[0];

        const topBill1 = topBillCandidate;
        if (topBill1) {
            topBill1.rankTitle = "최저요금 1위";
            topBill1.tag = "인기";
            if (!usedIds.has(topBill1.id)) {
                finalCards[1] = topBill1;
                usedIds.add(topBill1.id);
            }
        }

        for (const plan of sortedByBenefit) {
            if (!finalCards.includes(null)) break;
            if (usedIds.has(plan.id)) continue;

            const emptyIndex = finalCards.indexOf(null);
            if (emptyIndex !== -1) {
                plan.rankTitle = (emptyIndex === 1) ? "최대혜택 2위" : "추가 추천";
                plan.tag = "프리미엄";
                finalCards[emptyIndex] = plan;
                usedIds.add(plan.id);
            }
        }

        const validCards = finalCards.filter(Boolean);

        els.recommendationCards.innerHTML = validCards.map(plan => {
            return createPlanCardHTML(plan, plan.rankTitle, plan.tag);
        }).join('');
    }

    function createPlanCardHTML(result, rankTitle, tagText) {
        const { id, carrier, netBill, cashBenefit, totalMobileDiscount, details, totalBenefit } = result;
        const internetSpeed = details.internet.name.match(/\d+M|1G/)?.[0] || details.internet.name;
        const tvPlanName = details.tv?.name || '미포함';
        const cardDisplayPrice = netBill;
        
        result.rankTitle = rankTitle;
        const recommendationReason = generateRecommendationReason(result);

        const shareData = JSON.stringify({
            carrier: carrier,
            product: `${internetSpeed} + ${tvPlanName}`,
            originalPrice: netBill + 15000, 
            price: netBill,
            gift: cashBenefit,
            saving: totalBenefit,
            secret: 30000
        });

        return `
            <div class="plan-card">
                <div class="rank-badge">${rankTitle}</div>
                <div class="plan-card-header" style="background-color: ${details.telecom.color};">
                    <h3>${carrier}</h3>
                    <span class="tag">${carrier}</span>
                </div>
                <div class="plan-card-body">
                    <div class="price-section">
                        <span class="price">${Math.round(cardDisplayPrice).toLocaleString()}원</span>
                        <span class="unit">/월 (VAT포함)</span>
                    </div>
                    <dl class="details-section">
                        <dt>인터넷</dt>
                        <dd>${internetSpeed}</dd>
                        <dt>TV</dt>
                        <dd>${tvPlanName}</dd>
                    </dl>
                    ${recommendationReason ? `
                    <div class="recommendation-reason">
                        <i class="fas fa-check-circle"></i>
                        <span>${recommendationReason}</span>
                    </div>
                    ` : ''}
                    <div class="benefit-section">
                        <span class="label">현금 사은품</span>
                        <span class="amount">${Math.round(cashBenefit).toLocaleString()}원</span>
                    </div>
                    ${totalMobileDiscount > 0 ? `
                    <div class="benefit-section mobile-discount">
                        <span class="label">휴대폰 할인</span>
                        <span class="amount">월 -${Math.round(totalMobileDiscount).toLocaleString()}원</span>
                    </div>
                    ` : ''}
                </div>
                <div class="plan-card-footer">
                    <div class="button-group">
                        <button class="btn detail-view-btn" data-result-id="${id}"><i class="fas fa-search"></i> 자세히</button>
                        <button class="btn btn-share-quote" data-share='${shareData}' style="background:#28a745; color:white; border:none;">
                            <i class="fas fa-link"></i> 공유
                        </button>
                        <button class="btn compare-add-btn" data-result-id="${id}"><i class="fas fa-plus"></i> 비교</button>
                        <a href="${generateSignupUrl(id)}" class="btn btn-primary signup-link" data-tag="${tagText}" data-result-id="${id}"><i class="fas fa-rocket"></i> 셀프 가입</a>
                    </div>
                </div>
            </div>
        `;
    }

    // [수정] 상세 견적 모달 레이아웃 개선 (선납 분리, 휴대폰 할인 위치 이동)
    function openDetailsModal(result) {
        const modalId = 'detail-modal';
        const modal = document.getElementById(modalId);
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body-content');
        if (!modal || !modalTitle || !modalBody) return;
        
        const { carrier, netBill, cashBenefit, totalMobileDiscount, bestPlanName, details } = result;
        const fmt = (n) => (n || 0).toLocaleString();

        const baseFee = (details.internet?.price || 0) + (details.tv?.price || 0) + (details.additionalTv?.price || 0);
        
        // 선납 확인
        const isPrepaid = bestPlanName.includes('선납');
        const prepaidDiscount = isPrepaid ? 5500 : 0;
        const internetDiscountReal = details.internetDiscount - prepaidDiscount;

        const totalDiscount36 = (details.internetDiscount + totalMobileDiscount) * 36;
        const finalTotalBenefit = cashBenefit + totalDiscount36;
        
        const recommendationReason = generateRecommendationReason(result);
        
        modalTitle.textContent = `${carrier} 상세 견적`;
        
        let discountRows = '';
        if (internetDiscountReal > 0) {
            discountRows += `<tr class="discount-row"><td>인터넷 할인</td><td>-${fmt(internetDiscountReal)}원</td></tr>`;
        }
        if (isPrepaid) {
            discountRows += `<tr class="discount-row" style="color:#007bff;"><td>선납 할인</td><td>-${fmt(prepaidDiscount)}원</td></tr>`;
        }

        modalBody.innerHTML = `
            <div class="modal-section">
                <h4><i class="fas fa-check-circle"></i> 선택하신 상품</h4>
                <table class="modal-table">
                    <tr><td>인터넷</td><td>${details.internet.name}</td></tr>
                    ${details.tv && details.tv.id !== 'none' ? `<tr><td>TV</td><td>${details.tv.name}</td></tr>` : ''}
                    <tr><td>결합</td><td><b>${bestPlanName}</b></td></tr>
                </table>
            </div>
            ${recommendationReason ? `
            <div class="modal-section recommendation-highlight">
                <h4><i class="fas fa-lightbulb"></i> AI 추천 이유</h4>
                <p>${recommendationReason}</p>
            </div>
            ` : ''}
            <div class="modal-section">
                <h4><i class="fas fa-coins"></i> 월 요금 상세</h4>
                <table class="modal-table">
                    <tr><td>기본요금</td><td>${fmt(baseFee)}원</td></tr>
                    ${discountRows}
                    <tr class="total-row"><td>월 납부금</td><td>${fmt(netBill)}원</td></tr>
                </table>
            </div>
            <div class="modal-section">
                <h4><i class="fas fa-gift"></i> 혜택 상세</h4>
                <table class="modal-table">
                    <tr><td>현금 사은품</td><td>${fmt(cashBenefit)}원</td></tr>
                    ${totalMobileDiscount > 0 ? `<tr><td>휴대폰 할인 (월)</td><td>${fmt(totalMobileDiscount)}원</td></tr>` : ''}
                    <tr class="total-row" style="color:#28a745;"><td>3년 총 혜택</td><td>${fmt(finalTotalBenefit)}원</td></tr>
                </table>
            </div>
            <div class="modal-footer">
                <button class="btn btn-close" id="modal-close-btn-footer">닫기</button>
            </div>
        `;
        
        window.globalModal.open(modalId);
    }

    els.recommendationCards.addEventListener('click', async (e) => {
        const detailButton = e.target.closest('.detail-view-btn');
        const signupLink = e.target.closest('a.signup-link');
        const compareButton = e.target.closest('.compare-add-btn');
        const shareButton = e.target.closest('.btn-share-quote');

        if (shareButton) {
            const data = JSON.parse(shareButton.dataset.share);
            const savedInfo = localStorage.getItem('activeManagerInfo');
            let managerId = null;
            
            if (savedInfo) {
                const m = JSON.parse(savedInfo);
                managerId = m.id;
            } else {
                alert("상담사 로그인이 필요합니다. (하단 ©성지넷 5회 클릭)");
                return;
            }

            const modal = document.getElementById('share-input-modal');
            const nameInput = document.getElementById('share-cust-name');
            const phoneInput = document.getElementById('share-cust-phone');
            const confirmBtn = document.getElementById('btn-confirm-share');

            nameInput.value = '고객';
            phoneInput.value = '';
            window.globalModal.open('share-input-modal');

            const autoHyphen = (str) => {
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
            };

            const handlePhoneInput = (e) => {
                e.target.value = autoHyphen(e.target.value);
            };
            phoneInput.addEventListener('input', handlePhoneInput);

            // [수정] 엔터키 입력 시 전송 기능 추가 및 이벤트 중복 방지
            const handleShareSubmit = async () => {
                const customerName = nameInput.value.trim() || "고객";
                const customerPhone = phoneInput.value.trim();

                window.globalModal.close('share-input-modal');
                phoneInput.removeEventListener('input', handlePhoneInput);
                // 이벤트 리스너 정리
                nameInput.onkeyup = null;
                phoneInput.onkeyup = null;

                const mInfo = JSON.parse(savedInfo);
                const leadData = {
                    name: customerName,
                    phone: customerPhone,
                    product: data.product,
                    quoteData: {
                        ...data,
                        managerKakao: mInfo.kakao 
                    }
                };
                
                const originalBtnText = shareButton.innerHTML;
                shareButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장 중...';
                shareButton.disabled = true;

                try {
                    const newLeadId = await addCustomerLead(managerId, leadData);
                    
                    if (newLeadId) {
                        const params = new URLSearchParams();
                        params.set('name', customerName);
                        params.set('carrier', data.carrier);
                        params.set('product', data.product);
                        params.set('price', data.price);
                        params.set('gift', data.gift);
                        params.set('saving', data.saving);
                        params.set('secret', data.secret);
                        
                        params.set('manager', mInfo.name);
                        params.set('phone', mInfo.phone);
                        params.set('managerImg', mInfo.img);
                        params.set('team', mInfo.team);
                        params.set('role', mInfo.role);
                        if(mInfo.kakao) params.set('kakao', mInfo.kakao);

                        const baseUrl = window.location.origin + "/quote.html";
                        const finalUrl = `${baseUrl}?${params.toString()}`;

                        navigator.clipboard.writeText(finalUrl).then(() => {
                            if (confirm(`✅ [${customerName}]님을 위한 견적서 링크가 복사되었습니다!\nCRM에도 자동 저장되었습니다.\n\n고객에게 보내기 전에 화면을 확인하시겠습니까?`)) {
                                window.open(finalUrl, '_blank');
                            }
                        }).catch(err => {
                            console.error('복사 실패:', err);
                            prompt("자동 복사에 실패했습니다. 아래 링크를 직접 복사하세요:", finalUrl);
                        });
                    } else {
                        alert("CRM 저장에 실패했습니다. (Firebase 오류)");
                    }
                } catch (error) {
                    console.error("CRM Save Error:", error);
                    alert("오류가 발생했습니다: " + error.message);
                } finally {
                    shareButton.innerHTML = originalBtnText;
                    shareButton.disabled = false;
                }
            };

            confirmBtn.onclick = handleShareSubmit;

            const handleEnterKey = (e) => {
                if (e.key === 'Enter') handleShareSubmit();
            };

            nameInput.onkeyup = handleEnterKey;
            phoneInput.onkeyup = handleEnterKey;

            return;
        }

        if (detailButton) {
            const resultId = detailButton.dataset.resultId;
            const resultData = allResultsData.find(r => r.id === resultId);
            if (resultData) {
                const cardElement = detailButton.closest('.plan-card');
                const rankBadge = cardElement.querySelector('.rank-badge');
                if (rankBadge) {
                    resultData.rankTitle = rankBadge.textContent;
                }
                openDetailsModal(resultData);
            }
        } else if (compareButton) {
            const resultId = compareButton.dataset.resultId;
            const resultData = allResultsData.find(r => r.id === resultId);
            if (resultData) {
                window.addToCompare(resultData);
                compareButton.innerHTML = `<i class="fas fa-check"></i> 추가됨!`;
                compareButton.disabled = true;
                setTimeout(() => {
                    compareButton.innerHTML = `<i class="fas fa-balance-scale"></i> 비교함`;
                    compareButton.disabled = false;
                }, 2000);
            }
        } else if (signupLink) {
            e.preventDefault();
            sessionStorage.setItem('returnContext', JSON.stringify({
                type: 'ai',
                selections: getUserSelections(),
                results: {
                    html: els.recommendationCards.innerHTML,
                    data: allResultsData
                }
            }));
            window.location.href = signupLink.href;
        }
    });

    function generateSignupUrl(resultId) {
        const result = allResultsData.find(r => r.id === resultId);
        if (!result) return 'signup.html';

        const userSelections = getUserSelections();
        const usimCount = userSelections.mobilePlans.filter(p => p.hasUsim).length;

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

    document.addEventListener('restoreAiResults', (e) => {
        const dataToRestore = e.detail;
        if (dataToRestore && dataToRestore.html) {
            els.recommendationCards.innerHTML = dataToRestore.html;
            allResultsData = dataToRestore.data;
            els.loader.style.display = 'none';
            els.resultsContainer.style.display = 'block';

            const header = document.querySelector('.sticky-header-container');
            const firstResult = document.querySelector('.ai-calculator-body .result-category');
            if (header && firstResult) {
                const top = firstResult.getBoundingClientRect().top + window.pageYOffset;
                window.scrollTo({ top: top - header.offsetHeight - 20, behavior: 'auto' });
            }
        }
    });
    
    window.aiModuleReady = true;
    window.dispatchEvent(new Event('ai-module-ready'));
}