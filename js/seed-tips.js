
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getDatabase, ref, push } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js';
import { firebaseConfig } from './config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);

const samplePosts = [
  {
    category: "인터넷",
    title: "인터넷 가입 현금 사은품, 47만원 받는 법 (최신 정책)",
    summary: "경품고시제 한도 내에서 현금 사은품을 최대로 받는 방법과 주의사항을 정리했습니다.",
    thumbnailUrl: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=800&q=80",
    nickname: "성지넷",
    contentHtml: `
      <h2>인터넷 가입 사은품, 아는 만큼 받습니다.</h2>
      <p>많은 분들이 인터넷 가입 시 '현금 많이 주는 곳'을 찾으시는데요. 법적으로 정해진 한도(경품고시제)가 있다는 사실, 알고 계셨나요?</p>
      <h3>1. 경품고시제란?</h3>
      <p>방송통신위원회에서 정한 가이드라인으로, 인터넷 단통법이라고도 불립니다. 현재 최대 47만원까지 지급이 가능하며, 이를 초과하여 지급한다고 광고하는 곳은 불법 업체일 가능성이 높으니 주의하셔야 합니다.</p>
      <h3>2. 최대 혜택 받는 꿀팁</h3>
      <ul>
        <li><strong>신규 가입이 유리:</strong> 재약정보다는 통신사를 이동하는 신규 가입이 혜택이 훨씬 큽니다.</li>
        <li><strong>결합 상품 활용:</strong> 인터넷 단독보다는 TV와 함께 가입할 때 사은품이 30~40만원대로 껑충 뜁니다.</li>
        <li><strong>온라인 대리점 이용:</strong> 오프라인 매장보다 임대료 등 고정비가 적어 고객 혜택으로 돌려주는 비중이 높습니다.</li>
      </ul>
      <p>성지넷에서는 법적 한도 내 최대 금액인 47만원을 설치 당일 지급해 드리고 있습니다. AI 요금설계로 나에게 딱 맞는 요금제도 확인해보세요!</p>
    `
  },
  {
    category: "인터넷",
    title: "100M vs 500M vs 1G, 우리 집에 맞는 속도는?",
    summary: "무조건 빠른 게 좋을까요? 사용 패턴에 딱 맞는 가성비 요금제를 추천해 드립니다.",
    thumbnailUrl: "https://images.unsplash.com/photo-1544197150-b99a580bbcbf?auto=format&fit=crop&w=800&q=80",
    nickname: "성지넷",
    contentHtml: `
      <h2>인터넷 속도, 낭비하지 마세요!</h2>
      <p>상담을 하다 보면 무조건 1G 속도를 원하시는 분들이 계신데요. 실제 사용 환경에 맞지 않으면 요금만 낭비하게 됩니다.</p>
      <h3>속도별 추천 대상</h3>
      <ol>
        <li><strong>100M (광랜):</strong> 유튜브 시청, 웹서핑, 간단한 문서 작업 위주. 1~2인 가구에 적합합니다. 가성비 최고!</li>
        <li><strong>500M (기가라이트):</strong> 3인 이상 가구, 넷플릭스 고화질 시청, 온라인 게임을 즐기시는 분. 가장 많이 선택하는 국민 요금제입니다.</li>
        <li><strong>1G (기가인터넷):</strong> 주식 트레이딩, 대용량 파일 업로드/다운로드가 잦은 크리에이터, 헤비 게이머.</li>
      </ol>
      <p>자신의 사용 패턴을 잘 모르시겠다면, 성지넷 AI 플래너가 30초 만에 분석해 드립니다.</p>
    `
  },
  {
    category: "휴대폰",
    title: "통신사 결합 할인, 이것만 알면 월 3만원 절약!",
    summary: "SK, KT, LG 통신사별 결합 할인 혜택을 알기 쉽게 비교 정리했습니다.",
    thumbnailUrl: "https://images.unsplash.com/photo-1512428559087-560fa0db7982?auto=format&fit=crop&w=800&q=80",
    nickname: "성지넷",
    contentHtml: `
      <h2>통신비 다이어트의 핵심, '결합'</h2>
      <p>인터넷과 휴대폰을 같은 통신사로 묶으면 요금 할인이 어마어마합니다. 가족들의 통신사를 확인해 보세요!</p>
      <h3>통신사별 특징</h3>
      <ul>
        <li><strong>SK (요즘가족결합):</strong> 가족 구성원 수에 따라 인터넷과 휴대폰 요금을 각각 할인해 줍니다. 장기 고객 혜택도 좋은 편입니다.</li>
        <li><strong>KT (총액결합할인):</strong> 가족들의 휴대폰 요금 총합에 따라 할인 구간이 달라집니다. 고가 요금제를 쓰는 가족이 있다면 유리합니다.</li>
        <li><strong>LG (참쉬운가족결합):</strong> 알뜰폰 결합이 가장 자유롭습니다. 인터넷끼리 결합해도 할인이 적용되는 것이 장점입니다.</li>
      </ul>
      <p>복잡한 결합 할인 계산, 머리 아프시죠? 성지넷 상담사에게 물어보시면 최적의 결합 구성을 찾아드립니다.</p>
    `
  },
  {
    category: "카드",
    title: "제휴카드로 통신비 0원 만들기 도전",
    summary: "전월 실적 30만원으로 매달 15,000원 이상 할인받는 제휴카드 활용법.",
    thumbnailUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?auto=format&fit=crop&w=800&q=80",
    nickname: "성지넷",
    contentHtml: `
      <h2>숨만 쉬어도 나가는 고정지출, 카드로 막자</h2>
      <p>통신비 제휴카드는 잘만 쓰면 요금 부담을 확 줄여줍니다. 보통 전월 실적 30만원을 채우면 1.5만~2만원을 할인해 주죠.</p>
      <h3>제휴카드 사용 꿀팁</h3>
      <ol>
        <li><strong>고정비 이체:</strong> 아파트 관리비, 도시가스, 보험료 등 매달 나가는 돈을 제휴카드로 자동이체 걸어두세요. 실적 채우기가 훨씬 수월해집니다.</li>
        <li><strong>상품권 실적 인정 확인:</strong> 일부 카드는 상품권 구매도 실적으로 인정해 줍니다. (상테크 가능!)</li>
        <li><strong>프로모션 확인:</strong> 카드사별로 추가 할인 프로모션을 진행할 때 가입하면 혜택이 더 커집니다.</li>
      </ol>
      <p>성지넷 홈페이지의 '제휴카드' 메뉴에서 통신사별 추천 카드를 확인해 보세요.</p>
    `
  },
  {
    category: "인터넷",
    title: "재약정 vs 신규가입, 호갱 탈출 가이드",
    summary: "약정이 끝났다면 무조건 읽어보세요. 통신사가 알려주지 않는 진실.",
    thumbnailUrl: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=800&q=80",
    nickname: "성지넷",
    contentHtml: `
      <h2>약정 만료? 축하드립니다! 돈 벌 기회입니다.</h2>
      <p>3년 약정이 끝났는데 아무 조치도 안 하고 계신가요? 매달 몇 만원씩 손해 보고 계신 겁니다.</p>
      <h3>선택지는 두 가지입니다.</h3>
      <ul>
        <li><strong>재약정 (통신사 유지):</strong> 고객센터에 전화해서 "해지하겠다"고 하면 상품권이나 요금 할인을 제안합니다. (보통 10~20만원 수준)</li>
        <li><strong>신규가입 (통신사 이동):</strong> 타 통신사로 이동하면 현금 사은품 최대 47만원을 받을 수 있습니다.</li>
      </ul>
      <p><strong>결론:</strong> 결합 할인 때문에 묶여있는 게 아니라면, 3년마다 통신사를 옮기며 사은품을 챙기는 것이 이득입니다. 성지넷에서 비교 견적 받아보세요!</p>
    `
  }
];

const sampleReviews = [
  {
    category: "인터넷",
    title: "SK 500M + TV 설치 후기 (사은품 당일 입금 대박!)",
    contentHtml: "상담도 너무 친절하시고, 무엇보다 설치 당일에 바로 사은품이 입금되어서 놀랐습니다. 기존에 쓰던 곳보다 요금도 저렴해졌어요. 지인들에게도 추천하고 다닙니다!",
    nickname: "김*수",
    rating: 5,
    views: 120
  },
  {
    category: "TV",
    title: "LG 넷플릭스 요금제 갈아탔는데 화질 굿",
    contentHtml: "집에서 넷플릭스를 자주 봐서 LG로 바꿨는데 리모컨 반응 속도도 빠르고 화질도 너무 좋네요. 지원금도 꽉 채워 받아서 기분 좋습니다. 번창하세요~",
    nickname: "이*영",
    rating: 5,
    views: 85
  },
  {
    category: "휴대폰",
    title: "가족 결합으로 월 2만원 아꼈습니다",
    contentHtml: "AI 플래너로 조회해보니 결합 할인을 놓치고 있었더라고요. 상담사님이 꼼꼼하게 챙겨주셔서 가족 결합 묶고 요금 확 줄였습니다. 진작 알았으면 좋았을 텐데 ㅠㅠ",
    nickname: "박*호",
    rating: 5,
    views: 210
  },
  {
    category: "기타",
    title: "알뜰폰 유심 가입도 빠르네요",
    contentHtml: "서브폰이 필요해서 알뜰폰 유심 신청했는데 배송도 빠르고 개통도 금방 됐습니다. 약정 부담 없어서 너무 편해요. 상담 감사합니다.",
    nickname: "최*민",
    rating: 4,
    views: 56
  },
  {
    category: "인터넷",
    title: "KT 재약정보다 신규가입이 낫네요",
    contentHtml: "KT 오래 썼는데 혜택이 별로라 이번에 성지넷 통해서 LG로 갈아탔습니다. 현금 지원 빵빵하게 받고 TV도 새걸로 바꾸니 속이 다 시원하네요.",
    nickname: "정*우",
    rating: 5,
    views: 143
  }
];

const statusEl = document.getElementById('seed-status');
const buttonEl = document.getElementById('seed-button');

buttonEl.addEventListener('click', async () => {
  if (!confirm('샘플 글(꿀팁 5개 + 후기 5개)을 생성할까요?')) {
    return;
  }

  buttonEl.disabled = true;
  statusEl.textContent = '생성 중입니다...';

  try {
    const baseTime = Date.now();

    // 1. 꿀팁 생성
    const tipPromises = samplePosts.map((post, index) => {
      const createdAt = baseTime + index;
      const data = {
        ...post,
        views: Math.floor(Math.random() * 500),
        commentsCount: 0,
        createdAt
      };
      return push(ref(db, '/boards/tips'), data);
    });

    // 2. 후기 생성
    const reviewPromises = sampleReviews.map((review, index) => {
      const createdAt = baseTime + index;
      const data = {
        ...review,
        createdAt
      };
      return push(ref(db, '/boards/reviews'), data);
    });

    await Promise.all([...tipPromises, ...reviewPromises]);
    statusEl.textContent = '샘플 데이터가 성공적으로 생성되었습니다. 꿀팁/후기 게시판을 확인해보세요!';
  } catch (err) {
    console.error(err);
    statusEl.textContent = '오류가 발생했습니다: ' + err.message;
  } finally {
    buttonEl.disabled = false;
  }
});
