import { getFullData } from './data-service.js';

class AIChatbot {
    constructor() {
        this.telecomData = null;
        this.chatBox = null;

        // State Management
        this.state = 'IDLE';
        // States: IDLE, SELECT_SPEED, SELECT_TV, SELECT_ADDITIONAL_TV, SELECT_MOBILE_COMBINATION, SELECT_MOBILE_COUNT, SELECT_USIM

        this.context = {
            carrier: null,
            speed: null,
            tvProduct: null, // Object {name, price}
            additionalTvCount: 0,
            mobileCount: 0,
            usimCount: 0
        };

        this.init();
    }

    async init() {
        try {
            this.telecomData = await getFullData();
            this.createChatbotUI();
            this.bindEvents();
            console.log("AI Chatbot Initialized with Detailed Flow & Dynamic Gift Policy");
        } catch (error) {
            console.error("Failed to initialize chatbot:", error);
        }
    }

    createChatbotUI() {
        const chatbotHTML = `
            <div class="chatbot-toggler">
                <span class="material-icons"><i class="fas fa-robot"></i></span>
                <span class="material-icons"><i class="fas fa-times"></i></span>
            </div>
            <div class="chatbot-window">
                <div class="chat-header">
                    <div class="chat-header-info">
                        <div class="chat-header-icon"><i class="fas fa-robot"></i></div>
                        <div>
                            <h2>성지넷 AI 상담사</h2>
                            <p>무엇이든 물어보세요!</p>
                        </div>
                    </div>
                    <button class="chat-close-btn"><i class="fas fa-chevron-down"></i></button>
                </div>
                <div class="chat-box">
                    <div class="chat-msg bot">
                        <div class="msg-icon"><i class="fas fa-robot"></i></div>
                        <div class="msg-content">
                            안녕하세요! 성지넷 AI 상담사입니다. 🤖<br>
                            통신사별 상세 견적(TV상품, 결합, 유심 등)을 도와드릴 수 있어요.<br><br>
                            궁금한 통신사를 선택해주세요!
                            <div class="bot-actions">
                                <button class="bot-action-btn" data-action="select_carrier_sk">SK</button>
                                <button class="bot-action-btn" data-action="select_carrier_kt">KT</button>
                                <button class="bot-action-btn" data-action="select_carrier_lg">LG</button>
                                <button class="bot-action-btn" data-action="select_carrier_skb">Btv알뜰</button>
                                <button class="bot-action-btn" data-action="select_carrier_lg_hello">LG헬로</button>
                                <button class="bot-action-btn" data-action="select_carrier_skylife">스카이라이프</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="chat-input-area">
                    <textarea placeholder="메시지를 입력하세요..." required></textarea>
                    <button class="chat-send-btn"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', chatbotHTML);
        this.chatBox = document.querySelector('.chat-box');
    }

    bindEvents() {
        const toggler = document.querySelector('.chatbot-toggler');
        const closeBtn = document.querySelector('.chat-close-btn');
        const sendBtn = document.querySelector('.chat-send-btn');
        const textarea = document.querySelector('.chat-input-area textarea');

        const toggleChat = () => {
            document.body.classList.toggle('show-chat');
            document.querySelector('.chatbot-toggler').classList.toggle('show-chat');
        };

        toggler.addEventListener('click', toggleChat);
        closeBtn.addEventListener('click', () => {
            document.body.classList.remove('show-chat');
            document.querySelector('.chatbot-toggler').classList.remove('show-chat');
        });

        const sendMessage = (text = null, payload = null) => {
            const message = text || textarea.value.trim();
            if (!message) return;

            if (!text) {
                textarea.value = '';
                textarea.style.height = '45px';
            }

            this.appendMessage('user', message);

            setTimeout(() => {
                const response = this.processInput(message, payload);
                this.appendMessage('bot', response.text, response.actions);
            }, 600);
        };

        sendBtn.addEventListener('click', () => sendMessage());
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        this.chatBox.addEventListener('click', (e) => {
            if (e.target.classList.contains('bot-action-btn')) {
                const action = e.target.dataset.action;
                const label = e.target.innerText;
                const payload = e.target.dataset.payload;

                if (['consult', 'secret', 'recommend', 'reset'].includes(action)) {
                    this.handleGlobalAction(action);
                } else {
                    sendMessage(label, action);
                }
            }
        });
    }

    appendMessage(sender, text, actions = null) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${sender}`;

        let contentHTML = text;
        if (actions) {
            contentHTML += `<div class="bot-actions">`;
            actions.forEach(act => {
                contentHTML += `<button class="bot-action-btn" data-action="${act.code}" ${act.payload ? `data-payload="${act.payload}"` : ''}>${act.label}</button>`;
            });
            contentHTML += `</div>`;
        }

        const iconHTML = sender === 'bot' ? `<div class="msg-icon"><i class="fas fa-robot"></i></div>` : '';

        msgDiv.innerHTML = `
            ${iconHTML}
            <div class="msg-content">${contentHTML}</div>
        `;

        this.chatBox.appendChild(msgDiv);
        this.chatBox.scrollTop = this.chatBox.scrollHeight;
    }

    handleGlobalAction(action) {
        if (action === 'consult') {
            if (window.openConsultationModal) window.openConsultationModal('AI챗봇');
        } else if (action === 'secret') {
            const btn = document.getElementById('hero-secret-benefit-btn');
            if (btn) btn.click();
        } else if (action === 'recommend') {
            const btn = document.getElementById('hero-ai-planner-btn');
            if (btn) btn.click();
        } else if (action === 'reset') {
            this.state = 'IDLE';
            this.context = { carrier: null, speed: null, tvProduct: null, additionalTvCount: 0, mobileCount: 0, usimCount: 0 };
            this.appendMessage('bot', "초기화되었습니다. 다시 통신사를 선택해주세요.", [
                { label: "SK", code: "select_carrier_sk" },
                { label: "KT", code: "select_carrier_kt" },
                { label: "LG", code: "select_carrier_lg" },
                { label: "Btv알뜰", code: "select_carrier_skb" },
                { label: "LG헬로", code: "select_carrier_lg_hello" },
                { label: "스카이라이프", code: "select_carrier_skylife" }
            ]);
        }
    }

    processInput(input, actionCode = null) {
        const text = input.toLowerCase();

        // [New] Greeting Logic
        if (this.state === 'IDLE' && text.match(/안녕|반가워|하이|hello|hi/)) {
            return {
                text: "안녕하세요! 반가워요. 👋<br>통신사 요금이나 혜택이 궁금하시면 언제든 물어봐주세요!",
                actions: [
                    { label: "SK", code: "select_carrier_sk" },
                    { label: "KT", code: "select_carrier_kt" },
                    { label: "LG", code: "select_carrier_lg" },
                    { label: "Btv알뜰", code: "select_carrier_skb" },
                    { label: "LG헬로", code: "select_carrier_lg_hello" },
                    { label: "스카이라이프", code: "select_carrier_skylife" }
                ]
            };
        }

        // Global Reset
        if (text.match(/처음|취소|다시|리셋/)) {
            this.state = 'IDLE';
            this.context = { carrier: null, speed: null, tvProduct: null, additionalTvCount: 0, mobileCount: 0, usimCount: 0 };
            return {
                text: "처음으로 돌아왔어요. 통신사를 선택해주세요.",
                actions: [
                    { label: "SK", code: "select_carrier_sk" },
                    { label: "KT", code: "select_carrier_kt" },
                    { label: "LG", code: "select_carrier_lg" },
                    { label: "Btv알뜰", code: "select_carrier_skb" },
                    { label: "LG헬로", code: "select_carrier_lg_hello" },
                    { label: "스카이라이프", code: "select_carrier_skylife" }
                ]
            };
        }

        // [New] Comparison Logic: Max Gift / Lowest Rate
        if (this.state === 'IDLE' && (text.match(/사은품|현금|혜택|최대/) || text.match(/요금|최저|싼|저렴/))) {
            const isMaxGift = text.match(/사은품|현금|혜택|최대/);
            const comparisonResults = [];

            // Iterate all carriers
            const carriers = ['SK', 'KT', 'LG', 'SKB', 'HelloVision', 'Skylife'];

            carriers.forEach(carrierName => {
                const data = this.telecomData[carrierName];
                if (!data) return;

                // Standard comparison basis: 500M + Basic TV (or 100M for lowest rate)
                const targetSpeed = isMaxGift ? '500M' : '100M';
                const speedKey = isMaxGift ? '500' : '100'; // Key for giftPolicy

                const internet = data.internet.find(i => i.name.includes(targetSpeed));
                const tv = data.tv[0]; // Basic TV

                if (internet && tv) {
                    const price = internet.price + tv.price;

                    // [Dynamic Gift Calculation]
                    const giftPolicy = data.giftPolicy || {};
                    let cash = (giftPolicy[`base_${speedKey}`] || 0) + (giftPolicy[`tv_bundle_add_${speedKey}`] || 0);

                    // Fallback if data is missing (prevent 0)
                    if (cash === 0) {
                        cash = targetSpeed === '100M' ? 400000 : 470000;
                        if (carrierName === 'HelloVision' || carrierName === 'Skylife') cash -= 20000;
                    }

                    comparisonResults.push({
                        carrier: carrierName,
                        product: `${internet.name} + ${tv.name}`,
                        price: price,
                        cash: cash,
                        sortScore: isMaxGift ? cash : -price // Higher cash or Lower price
                    });
                }
            });

            // Sort and take top 3
            comparisonResults.sort((a, b) => b.sortScore - a.sortScore);
            const top3 = comparisonResults.slice(0, 3);

            let responseText = isMaxGift
                ? "🎁 <strong>사은품 혜택이 가장 좋은 3곳</strong>을 추천해드려요! (500M+TV 기준)"
                : "💸 <strong>요금이 가장 저렴한 3곳</strong>을 추천해드려요! (100M+TV 기준)";

            responseText += "<br><br>";

            const actions = [];

            top3.forEach((item, index) => {
                const rank = index + 1;
                const icon = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : '🥉');
                responseText += `
                    ${icon} <strong>${item.carrier}</strong><br>
                    월 ${item.price.toLocaleString()}원 / 현금 ${item.cash.toLocaleString()}원<br>
                    <span style="font-size:0.85em; color:#aaa;">${item.product}</span><br><br>
                `;

                // Map carrier name to action code
                let code = 'select_carrier_sk';
                if (item.carrier === 'KT') code = 'select_carrier_kt';
                if (item.carrier === 'LG') code = 'select_carrier_lg';
                if (item.carrier === 'SKB') code = 'select_carrier_skb';
                if (item.carrier === 'HelloVision') code = 'select_carrier_lg_hello';
                if (item.carrier === 'Skylife') code = 'select_carrier_skylife';

                actions.push({ label: `${item.carrier} 자세히 보기`, code: code });
            });

            return { text: responseText, actions: actions };
        }

        // 1. IDLE -> Carrier Selection
        if (this.state === 'IDLE') {
            const carriers = {
                'sk': 'SK', 'kt': 'KT', 'lg': 'LG',
                '헬로': 'HelloVision', 'hello': 'HelloVision',
                '스카이': 'Skylife', 'sky': 'Skylife',
                'skb': 'SKB', 'btv': 'SKB', '알뜰': 'SKB'
            };

            let foundCarrier = null;
            if (actionCode && actionCode.startsWith('select_carrier_')) {
                if (actionCode.includes('skb')) foundCarrier = 'SKB';
                else if (actionCode.includes('lg_hello')) foundCarrier = 'HelloVision';
                else if (actionCode.includes('skylife')) foundCarrier = 'Skylife';
                else if (actionCode.includes('sk')) foundCarrier = 'SK';
                else if (actionCode.includes('kt')) foundCarrier = 'KT';
                else if (actionCode.includes('lg')) foundCarrier = 'LG';
            } else {
                for (const [k, v] of Object.entries(carriers)) {
                    if (text.includes(k)) foundCarrier = v;
                }
            }

            if (foundCarrier) {
                this.context.carrier = foundCarrier;
                this.state = 'SELECT_SPEED';
                return {
                    text: `<strong>${foundCarrier}</strong>를 선택하셨습니다.<br>인터넷 속도를 선택해주세요.`,
                    actions: [
                        { label: "100M (광랜)", code: "speed_100" },
                        { label: "500M (기가라이트)", code: "speed_500" },
                        { label: "1G (기가)", code: "speed_1g" }
                    ]
                };
            }
            return {
                text: "통신사를 선택해주세요.",
                actions: [
                    { label: "SK", code: "select_carrier_sk" },
                    { label: "KT", code: "select_carrier_kt" },
                    { label: "LG", code: "select_carrier_lg" }
                ]
            };
        }

        // 2. SELECT_SPEED -> Internet Speed
        if (this.state === 'SELECT_SPEED') {
            let speed = null;
            if (text.includes('100')) speed = '100M';
            else if (text.includes('500')) speed = '500M';
            else if (text.includes('1g') || text.includes('1기가')) speed = '1G';

            if (speed) {
                this.context.speed = speed;
                this.state = 'SELECT_TV';

                const carrierData = this.telecomData[this.context.carrier];
                const tvOptions = carrierData?.tv?.map((tv, index) => ({
                    label: tv.name,
                    code: `tv_select_${index}`,
                    payload: index
                })) || [];

                tvOptions.unshift({ label: "TV 미신청", code: "tv_none" });

                return {
                    text: `<strong>${speed}</strong> 속도군요.<br>TV 상품을 선택해주세요.`,
                    actions: tvOptions
                };
            }
            return { text: "속도를 다시 선택해주세요.", actions: [{ label: "100M", code: "speed_100" }, { label: "500M", code: "speed_500" }, { label: "1G", code: "speed_1g" }] };
        }

        // 3. SELECT_TV -> TV Product
        if (this.state === 'SELECT_TV') {
            if (text.includes('미신청') || actionCode === 'tv_none') {
                this.context.tvProduct = { name: '미신청', price: 0 };
                this.state = 'SELECT_MOBILE_COMBINATION';
                return {
                    text: "TV는 신청하지 않으시군요.<br>휴대폰 결합을 하시나요?",
                    actions: [
                        { label: "네, 결합할래요", code: "mobile_yes" },
                        { label: "아니요", code: "mobile_no" }
                    ]
                };
            } else {
                const carrierData = this.telecomData[this.context.carrier];
                let selectedTv = null;

                if (actionCode && actionCode.startsWith('tv_select_')) {
                    const index = parseInt(actionCode.split('_')[2]);
                    selectedTv = carrierData.tv[index];
                } else {
                    selectedTv = carrierData.tv.find(t => text.includes(t.name.split(' ')[0])) || carrierData.tv[0];
                }

                if (selectedTv) {
                    this.context.tvProduct = selectedTv;
                    this.state = 'SELECT_ADDITIONAL_TV';
                    return {
                        text: `<strong>${selectedTv.name}</strong>을(를) 선택하셨습니다.<br>TV를 추가로 더 설치하시나요?`,
                        actions: [
                            { label: "추가 안함", code: "add_tv_0" },
                            { label: "1대 추가", code: "add_tv_1" },
                            { label: "2대 추가", code: "add_tv_2" }
                        ]
                    };
                }
            }
        }

        // 4. SELECT_ADDITIONAL_TV
        if (this.state === 'SELECT_ADDITIONAL_TV') {
            let count = 0;
            if (text.includes('1대')) count = 1;
            else if (text.includes('2대')) count = 2;
            else if (text.includes('3대')) count = 3;

            this.context.additionalTvCount = count;
            this.state = 'SELECT_MOBILE_COMBINATION';

            return {
                text: `${count > 0 ? count + '대 추가하셨네요.' : '추가하지 않으셨네요.'}<br>휴대폰 결합을 하시나요?`,
                actions: [
                    { label: "네, 결합할래요", code: "mobile_yes" },
                    { label: "아니요", code: "mobile_no" }
                ]
            };
        }

        // 5. SELECT_MOBILE_COMBINATION
        if (this.state === 'SELECT_MOBILE_COMBINATION') {
            if (text.includes('네') || text.includes('결합') || actionCode === 'mobile_yes') {
                this.state = 'SELECT_MOBILE_COUNT';
                return {
                    text: `
                        결합 할인은 구성원 수, 요금제, 청소년 여부 등에 따라 다양합니다.<br>
                        정확한 계산은 <strong>[AI 요금설계]</strong>를 이용해보세요.<br><br>
                        우선 대략적인 인원수로 계산해드릴게요.<br>
                        몇 분의 휴대폰을 결합하시나요?
                    `,
                    actions: [
                        { label: "1명", code: "mobile_cnt_1" },
                        { label: "2명", code: "mobile_cnt_2" },
                        { label: "3명", code: "mobile_cnt_3" },
                        { label: "4명 이상", code: "mobile_cnt_4" }
                    ]
                };
            } else {
                this.context.mobileCount = 0;

                // [수정] 유심은 SK, KT, LG만 서비스함
                if (['SK', 'KT', 'LG'].includes(this.context.carrier)) {
                    this.state = 'SELECT_USIM';
                    return {
                        text: "결합은 안 하시는군요.<br>알뜰폰 유심 가입이 필요하신가요?",
                        actions: [
                            { label: "네, 필요해요", code: "usim_yes" },
                            { label: "아니요", code: "usim_no" }
                        ]
                    };
                } else {
                    this.context.usimCount = 0;
                    return this.calculateFinalEstimate();
                }
            }
        }

        // 6. SELECT_MOBILE_COUNT
        if (this.state === 'SELECT_MOBILE_COUNT') {
            let count = 1;
            if (text.includes('2')) count = 2;
            else if (text.includes('3')) count = 3;
            else if (text.includes('4')) count = 4;
            else if (text.includes('5')) count = 5;

            this.context.mobileCount = count;

            // [수정] 유심은 SK, KT, LG만 서비스함
            if (['SK', 'KT', 'LG'].includes(this.context.carrier)) {
                this.state = 'SELECT_USIM';
                return {
                    text: `${count}명 결합하시는군요.<br>혹시 유심 가입도 필요하신가요? (개당 추가 혜택)`,
                    actions: [
                        { label: "네 (1개)", code: "usim_1" },
                        { label: "네 (2개)", code: "usim_2" },
                        { label: "네 (3개)", code: "usim_3" },
                        { label: "아니요", code: "usim_no" }
                    ]
                };
            } else {
                this.context.usimCount = 0;
                return this.calculateFinalEstimate();
            }
        }

        // 7. SELECT_USIM -> Final Result
        if (this.state === 'SELECT_USIM') {
            let usimCount = 0;
            if (text.includes('1개') || actionCode === 'usim_1') usimCount = 1;
            else if (text.includes('2개') || actionCode === 'usim_2') usimCount = 2;
            else if (text.includes('3개') || actionCode === 'usim_3') usimCount = 3;
            else if (text.includes('네') || actionCode === 'usim_yes') usimCount = 1;

            this.context.usimCount = usimCount;

            return this.calculateFinalEstimate();
        }

        return { text: "죄송해요, 이해하지 못했어요. '처음'이라고 입력하면 다시 시작할 수 있어요.", actions: null };
    }

    calculateFinalEstimate() {
        const { carrier, speed, tvProduct, additionalTvCount, mobileCount, usimCount } = this.context;
        const data = this.telecomData[carrier];

        if (!data) return { text: "데이터 오류가 발생했습니다.", actions: null };

        const internetItem = data.internet.find(i => i.name.includes(speed));
        if (!internetItem) return { text: "인터넷 상품 정보를 찾을 수 없습니다.", actions: null };

        // 1. Base Price
        let internetPrice = internetItem.price;
        let tvPrice = tvProduct.price;
        let additionalTvPrice = 0;

        if (additionalTvCount > 0 && data.additionalTv) {
            const addTvUnit = data.additionalTv[1] ? data.additionalTv[1].price : 9900;
            additionalTvPrice = addTvUnit * additionalTvCount;
        }

        // 2. Discounts
        let internetDiscount = 0;
        let mobileDiscount = 0;

        if (mobileCount > 0) {
            if (carrier === 'SK') {
                internetDiscount = mobileCount >= 1 ? 3300 : 0;
                mobileDiscount = mobileCount * 4000;
            } else if (carrier === 'KT') {
                internetDiscount = 5500;
                mobileDiscount = mobileCount * 5000;
            } else if (carrier === 'LG') {
                internetDiscount = 5500;
                mobileDiscount = mobileCount * 6000;
            }
        }

        const totalPrice = internetPrice + tvPrice + additionalTvPrice - internetDiscount;

        // 3. Cash Benefit (Dynamic Calculation)
        const giftPolicy = data.giftPolicy || {};

        // Convert speed string to key (100M -> 100, 500M -> 500, 1G -> 1000)
        let speedKey = '100';
        if (speed.includes('500')) speedKey = '500';
        if (speed.includes('1G') || speed.includes('1기가')) speedKey = '1000';

        let cashBenefit = 0;

        if (tvProduct.name === '미신청') {
            // Internet Only
            cashBenefit = giftPolicy[`base_${speedKey}`] || 0;
        } else {
            // Internet + TV
            cashBenefit = (giftPolicy[`base_${speedKey}`] || 0) + (giftPolicy[`tv_bundle_add_${speedKey}`] || 0);
        }

        // Fallback if 0 (Safety net)
        if (cashBenefit === 0) {
            cashBenefit = speedKey === '100' ? 400000 : 470000;
            if (tvProduct.name === '미신청') cashBenefit = 100000;
        }

        // Add-ons
        if (additionalTvCount > 0) {
            const addTvAmount = giftPolicy.add_tv_basic || 20000;
            cashBenefit += (addTvAmount * additionalTvCount);
        }
        if (usimCount > 0) {
            const usimAmount = giftPolicy.usim_add || 10000;
            cashBenefit += (usimAmount * usimCount);
        }

        this.state = 'IDLE';

        return {
            text: `
                📋 <strong>최종 견적 (${carrier})</strong><br>
                --------------------------------<br>
                📡 인터넷: ${internetItem.name}<br>
                📺 TV: ${tvProduct.name} ${additionalTvCount > 0 ? `(+${additionalTvCount}대)` : ''}<br>
                📱 결합: ${mobileCount}명 ${usimCount > 0 ? `/ 💳 유심: ${usimCount}개` : ''}<br>
                --------------------------------<br>
                월 예상 요금: <span style="color:#00d4ff; font-size:1.2em;">${totalPrice.toLocaleString()}원</span><br>
                (휴대폰 할인 별도: 약 -${mobileDiscount.toLocaleString()}원)<br>
                <br>
                🎁 <strong>최대 현금 혜택: <span style="color:#ff007a; font-size:1.2em;">${cashBenefit.toLocaleString()}원</span></strong><br>
                <br>
                추가비밀지원금 알아보시겠어요?
            `,
            actions: [
                { label: "간편신청", code: "consult" },
                { label: "처음으로", code: "reset" }
            ]
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AIChatbot();
});
