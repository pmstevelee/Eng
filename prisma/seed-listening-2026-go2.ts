/**
 * 2026학년도 제1회 고2 영어듣기능력평가 - 문제뱅크 시드 데이터
 * 출처: 전국 13개 시·도교육청 공동 주관 (2026.4.8 시행)
 * 저작권자: 13개 시·도교육청(서울, 인천, 세종, 경기 제외) 및 한국교육과정평가원
 *
 * 실행: npx tsx prisma/seed-listening-2026-go2.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { PrismaClient, QuestionDomain, QuestionSource } from '../src/generated/prisma'

const prisma = new PrismaClient()

const SOURCE_LABEL = '출처: 2026학년도 제1회 전국 13개 시·도교육청 공동 주관 영어듣기능력평가(고2) — 2026.4.8.(수) 시행'

interface ListeningQuestion {
  subCategory: string
  difficulty: number
  cefrLevel: string
  contentJson: Record<string, unknown>
}

const LISTENING_QUESTIONS: ListeningQuestion[] = [
  // ── 1번: 적절한 응답 ──
  {
    subCategory: '적절한 응답',
    difficulty: 3,
    cefrLevel: 'A1 상',
    contentJson: {
      type: 'listening_response',
      questionNumber: 1,
      grade: 'go2',
      instruction: '대화를 듣고, 남자의 마지막 말에 대한 여자의 응답으로 가장 적절한 것을 고르시오.',
      script: [
        "M: Honey. I'm trying to bake muffins, but I just realized we're out of eggs.",
        'W: Oh, no! I used the last few eggs for dinner. Do you want me to go to the store?',
        "M: Yes, please. I'll start mixing the other ingredients.",
        'W: _______________',
      ],
      options: [
        "① I'm sorry. I ran out of muffins.",
        "② Never mind. I'm going to skip dinner.",
        "③ Okay. I'll go and buy some eggs right now.",
        "④ Don't worry. I'll find another bakery for you.",
        '⑤ Exactly. People want different things for dessert.',
      ],
      correctAnswer: 3,
      explanation:
        '머핀을 구우려는데 달걀이 없다며 가게에 가달라는 요청에 "알겠어, 지금 달걀 사러 갈게"가 가장 적절합니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 2번: 적절한 응답 ──
  {
    subCategory: '적절한 응답',
    difficulty: 3,
    cefrLevel: 'A1 상',
    contentJson: {
      type: 'listening_response',
      questionNumber: 2,
      grade: 'go2',
      instruction: '대화를 듣고, 여자의 마지막 말에 대한 남자의 응답으로 가장 적절한 것을 고르시오.',
      script: [
        'W: Jack, are you able to come to our group meeting tomorrow at 3 p.m. to finish the school art project?',
        "M: I'm sorry. I have a soccer match that ends around 4 p.m. But I'm free after that.",
        "W: Then, how about 6 p.m.? Everyone else said they're free in the evening.",
        'M: _______________',
      ],
      options: [
        "① That works for me. I'll be there on time.",
        '② No worries. I already canceled the meeting.',
        "③ Great. Let's watch the soccer match together.",
        '④ Sounds fun! We should go to the art festival.',
        "⑤ I can't believe it! We won the group debate competition.",
      ],
      correctAnswer: 1,
      explanation:
        '저녁 6시에 모임을 하자는 제안에 "괜찮아, 제시간에 갈게"가 가장 적절합니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 3번: 주제 파악 ──
  {
    subCategory: '주제 파악',
    difficulty: 5,
    cefrLevel: 'A2 상',
    contentJson: {
      type: 'listening_topic',
      questionNumber: 3,
      grade: 'go2',
      instruction: '다음을 듣고, 남자가 하는 말의 주제로 가장 적절한 것을 고르시오.',
      script: [
        "M: Hi, everyone! You're tuned in to The Green Tech Minute. These days, AI is everywhere, helping us work faster and solve complex problems. However, it doesn't come without a cost. Today, I'd like to highlight that using AI systems significantly burdens the environment. For example, a massive amount of electricity is needed to run AI. In addition, AI data centers require millions of liters of water to cool down their servers. This high consumption of resources is a major environmental cost of using AI. So the next time you use AI, please remember it puts a heavy burden on the environment.",
      ],
      options: [
        '① 지나친 도심 개발의 문제점',
        '② 전기 사용을 줄이는 효과적인 방법',
        '③ 전문 분야에서의 인공지능 활용 전략',
        '④ 인공지능 사용으로 인한 환경적 부담',
        '⑤ 가뭄 시 물 부족을 해결하기 위한 방안',
      ],
      correctAnswer: 4,
      explanation:
        'AI 시스템 운영에 막대한 전력과 냉각수가 필요하다며 AI 사용이 환경에 큰 부담을 준다는 내용입니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 4번: 목적 파악 ──
  {
    subCategory: '목적 파악',
    difficulty: 5,
    cefrLevel: 'A2 상',
    contentJson: {
      type: 'listening_purpose',
      questionNumber: 4,
      grade: 'go2',
      instruction: '다음을 듣고, 여자가 하는 말의 목적으로 가장 적절한 것을 고르시오.',
      script: [
        "W: Good morning, everyone. I'm your tour guide, Beth Thompson. We're about to enter one of the world's most famous historical sites. Before we go inside, I'd like to inform you of some important rules for your visit. First, you're welcome to take photos, but please ensure your flash is turned off to preserve the ancient remains. Second, food and drinks are strictly prohibited inside the site. Finally, for your safety, please do not run as there are many dark areas inside. By following these simple guidelines, everyone can have an enjoyable experience. Now, please follow me inside.",
      ],
      options: [
        '① 오디오 가이드 사용을 독려하려고',
        '② 박물관 관람 시간 준수를 당부하려고',
        '③ 유적지 내부 관람 규칙을 안내하려고',
        '④ 유명 관광지 여행 상품을 홍보하려고',
        '⑤ 역사 전시관 내부 공사 일정을 공지하려고',
      ],
      correctAnswer: 3,
      explanation:
        '유적지 입장 전 플래시 금지, 음식 반입 금지, 뛰지 않기 등 관람 규칙을 안내하는 것이 목적입니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 5번: 주장 파악 ──
  {
    subCategory: '주장 파악',
    difficulty: 5,
    cefrLevel: 'A2 상',
    contentJson: {
      type: 'listening_opinion',
      questionNumber: 5,
      grade: 'go2',
      instruction: '대화를 듣고, 남자의 주장으로 가장 적절한 것을 고르시오.',
      script: [
        "W: Professor Higgins, I'm having trouble understanding my students because they use shortened expressions, such as TMI for too much information.",
        'M: I know what you mean. The younger generations use those expressions quite often.',
        "W: I'm confused when they use those expressions.",
        "M: That's why we should learn shortened expressions younger generations use for better communication.",
        'W: I thought they were just using improper language.',
        'M: You can think so. But the younger generations show their own identity by using shortened expressions.',
        'W: I see. Knowing their language helps to understand their culture.',
        'M: Right. That\'s why you should know their shortened expressions to communicate with your students better.',
        "W: Okay. I'll make an effort to learn their expressions.",
      ],
      options: [
        '① 갈등 해결을 위해 순화된 표현을 사용해야 한다.',
        '② 효과적인 외국어 학습을 위해 문화를 공부해야 한다.',
        '③ 원만한 교우 관계를 위해 친구의 말을 경청해야 한다.',
        '④ 최신 유행을 따라가려면 소셜 미디어를 시작해야 한다.',
        '⑤ 더 나은 소통을 위해 젊은 세대의 줄임말을 배워야 한다.',
      ],
      correctAnswer: 5,
      explanation:
        '남자는 학생들과 더 잘 소통하기 위해 젊은 세대가 사용하는 줄임말을 배워야 한다고 주장하고 있습니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 6번: 의견 파악 ──
  {
    subCategory: '의견 파악',
    difficulty: 5,
    cefrLevel: 'A2 상',
    contentJson: {
      type: 'listening_opinion',
      questionNumber: 6,
      grade: 'go2',
      instruction: '대화를 듣고, 여자의 의견으로 가장 적절한 것을 고르시오.',
      script: [
        "M: Dr. Miles, I'm worried about my son. He's scared of our new dog.",
        "W: That's quite common. How did you try to make him more comfortable around the dog?",
        "M: I tried to get him to touch it so he can see it's harmless. But my son just ran away.",
        'W: In that case, you can reduce his fear of dogs in gradual stages.',
        'M: What do you mean by gradual stages?',
        'W: Let him see the dog from a distance first. Then, try to have him approach it closer each day.',
        'M: So the key is letting him get used to it slowly.',
        'W: Right. Gradually exposing him to your dog can help him overcome his fear.',
        "M: Thank you. I'll keep that in mind.",
      ],
      options: [
        '① 반려동물을 입양하는 데 신중을 기해야 한다.',
        '② 개를 키우면 가족 간의 대화가 더 활발해진다.',
        '③ 아이가 스스로 계획을 세워 실천하도록 돕는 것이 필요하다.',
        '④ 부모와 아이가 함께 할 수 있는 활동은 유대감을 강화시킨다.',
        '⑤ 단계적인 노출을 통해 아이가 개에 대한 두려움을 극복할 수 있다.',
      ],
      correctAnswer: 5,
      explanation:
        '여자는 아이를 개에게 점진적으로(단계적으로) 노출시키면 두려움을 극복하는 데 도움이 된다고 말하고 있습니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 7번: 관계 파악 ──
  {
    subCategory: '관계 파악',
    difficulty: 5,
    cefrLevel: 'A2 상',
    contentJson: {
      type: 'listening_relationship',
      questionNumber: 7,
      grade: 'go2',
      instruction: '대화를 듣고, 두 사람의 관계를 가장 잘 나타낸 것을 고르시오.',
      script: [
        'M: Hi, Ms. Brown. Welcome to my practice room.',
        "W: Pleasure to be here. I watched your performance video.",
        "M: What did you think? I've been practicing that routine for my next dance show.",
        'W: Your movements were very powerful. So I want to create an outfit that matches your energy.',
        'M: Sounds perfect. I need the clothes to be shiny but also very flexible.',
        'W: I agree. I brought my initial designs.',
        'M: These look wonderful! The bright colors will really stand out on the stage.',
        "W: I'm glad you like them. Now, let's get your measurements.",
        "M: Sure. Please make sure the outfit isn't too tight when I dance.",
        "W: Don't worry. I'll make a costume that helps you move smoothly.",
      ],
      options: [
        '① 화가 ― 미술 비평가',
        '② 요리사 ― 심사 위원',
        '③ 무용가 ― 의상 디자이너',
        '④ 패션모델 ― 무대 감독',
        '⑤ 피겨 스케이팅 선수 ― 코치',
      ],
      correctAnswer: 3,
      explanation:
        '남자는 다음 댄스 공연을 위해 연습 중인 무용가이고, 여자는 공연 의상을 제작하는 의상 디자이너입니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 8번: 근거 파악 (보기 매칭) ──
  {
    subCategory: '근거 파악',
    difficulty: 5,
    cefrLevel: 'A2 상',
    contentJson: {
      type: 'listening_evidence',
      questionNumber: 8,
      grade: 'go2',
      instruction: '대화를 듣고, social media에 관한 남자의 의견을 뒷받침하는 근거를 <보기>에서 찾아 바르게 짝지은 것을 고르시오.',
      referenceBox: {
        label: '<보기>',
        items: [
          '(A) 자존감 저하',
          '(B) 집중력 약화',
          '(C) 개인 정보 오용',
          '(D) 수면 장애',
        ],
      },
      script: [
        "W: Mike, have you decided what topic you're going to talk about in your presentation?",
        'M: Yes. I want to talk about the negative effects of social media.',
        "W: Really? Most people say social media helps people stay connected.",
        "M: That's true, but I believe there are some serious problems people tend to ignore.",
        'W: Like what?',
        "M: Constantly comparing themselves to others online can lower people's self-esteem.",
        'W: Yeah. Sometimes I get jealous when I look at posts of my friends doing cool things.',
        'M: Besides, personal information on social media can easily be misused.',
        'W: Right. Your information on social media can be used by someone with bad intentions.',
        "M: That's why I think people should be more aware of these risks.",
      ],
      options: [
        '① (A), (B)',
        '② (A), (C)',
        '③ (B), (C)',
        '④ (B), (D)',
        '⑤ (C), (D)',
      ],
      correctAnswer: 2,
      explanation:
        '남자가 언급한 두 가지 근거: 타인과 비교로 인한 자존감 저하(A)와 개인 정보 오용(C)입니다. 집중력 약화(B)와 수면 장애(D)는 언급되지 않았습니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 9번: 부탁한 일 ──
  {
    subCategory: '부탁한 일',
    difficulty: 4,
    cefrLevel: 'A2 하',
    contentJson: {
      type: 'listening_request',
      questionNumber: 9,
      grade: 'go2',
      instruction: '대화를 듣고, 여자가 남자에게 부탁한 일로 가장 적절한 것을 고르시오.',
      script: [
        "W: Honey, my parents will be here in an hour.",
        'M: I know. I just finished cleaning the bathroom.',
        'W: Good. You said you were going to take out the recycling bins, right?',
        'M: Yes, I did that after lunch. How\'s dinner coming along?',
        "W: I'm still working on the soup, but the roast beef is almost done.",
        'M: Sounds delicious. Is there anything I can help you with?',
        'W: Actually, I ordered a strawberry cake from our favorite bakery, but I cannot pick it up now.',
        'M: Oh, you have to watch the soup, right?',
        'W: Yeah. So could you pick up the cake for me?',
        "M: No problem. I'll be back in 20 minutes.",
        "W: Thanks. That'd be a huge help.",
      ],
      options: [
        '① 케이크 찾아오기',
        '② 수프 끓이기',
        '③ 부모님 마중 나가기',
        '④ 화장실 청소하기',
        '⑤ 재활용 쓰레기 버리기',
      ],
      correctAnswer: 1,
      explanation:
        '여자는 수프를 지켜봐야 해서 베이커리에 가져다 놓은 딸기 케이크를 남자에게 찾아와 달라고 부탁했습니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 10번: 이유 파악 ──
  {
    subCategory: '이유 파악',
    difficulty: 4,
    cefrLevel: 'A2 하',
    contentJson: {
      type: 'listening_reason',
      questionNumber: 10,
      grade: 'go2',
      instruction: '대화를 듣고, 남자가 드론 수업에 갈 수 없는 이유를 고르시오.',
      script: [
        '[Cellphone rings.]',
        "W: Hey, Marcus. Are you on your way to drone class?",
        "M: Hi, Amy. I called to tell you I can't make it tonight.",
        'W: Really? Did you forget to charge the battery for your drone again?',
        "M: No, I didn't make that mistake this time. My equipment is ready.",
        "W: Then, are you still too tired from your family trip over the weekend?",
        'M: No, I actually feel quite energized and was looking forward to the class.',
        "W: Then why can't you come? Are you working late tonight?",
        "M: No. My neighbor went to the hospital for an emergency, so I'm looking after her puppy.",
        'W: I see. Then see you at the next class.',
        "M: Sure. Enjoy today's class.",
      ],
      options: [
        '① 배터리를 충전하지 않아서',
        '② 정기 검진을 받으러 가야 해서',
        '③ 가족 여행으로 인해 피곤해서',
        '④ 이웃집 강아지를 돌봐주고 있어서',
        '⑤ 저녁 늦게까지 일을 해야 해서',
      ],
      correctAnswer: 4,
      explanation:
        '이웃이 응급으로 병원에 가서 남자가 이웃집 강아지를 돌봐주고 있기 때문에 드론 수업에 갈 수 없습니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 11번: 금액 계산 ──
  {
    subCategory: '금액 계산',
    difficulty: 4,
    cefrLevel: 'A2 하',
    contentJson: {
      type: 'listening_calculation',
      questionNumber: 11,
      grade: 'go2',
      instruction: '대화를 듣고, 여자가 지불할 금액을 고르시오.',
      script: [
        'M: Welcome! How can I help you today?',
        "W: Hi, I'm looking for a glass tank for my son. He wants to raise pet spiders.",
        'M: We have two sizes. The small one is 40 dollars, and the large one is 60 dollars.',
        "W: I'll take the small one. Also, do you sell jumping spiders?",
        "M: Yes. They're five dollars each. How many would you like?",
        "W: I'll take four spiders, please.",
        'M: Okay. Would you also like to buy a climbing platform for the spiders? It costs 10 dollars.',
        "W: No, thanks. It won't be necessary.",
        'M: Then, one small glass tank and four jumping spiders, right?',
        "W: That's correct. Here's my credit card.",
      ],
      options: [
        '① $50',
        '② $60',
        '③ $70',
        '④ $80',
        '⑤ $90',
      ],
      correctAnswer: 2,
      explanation:
        '소형 유리 탱크 $40 + 점프 거미 4마리 × $5 = $40 + $20 = $60\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 12번: 언급되지 않은 것 ──
  {
    subCategory: '세부 내용 파악',
    difficulty: 4,
    cefrLevel: 'A2 하',
    contentJson: {
      type: 'listening_detail',
      questionNumber: 12,
      grade: 'go2',
      instruction: '대화를 듣고, 푸드 트럭 축제에 관해 언급되지 않은 것을 고르시오.',
      script: [
        'W: Steve, check out this flyer! Our community center is organizing a food truck festival.',
        "M: Oh, I've heard about that! I think it's being held at Riverside Park this time.",
        "W: Right. It's the perfect spot for an outdoor event.",
        'M: I agree. Do you know exactly when it is held?',
        "W: It's scheduled for Saturday April 25th, from 11 a.m. to 5 p.m.",
        'M: Sounds great. How many food trucks will be there?',
        'W: It says 75 trucks are participating.',
        'M: Wow! Will there be anything else to enjoy besides the food?',
        "W: Yes. There'll be special performances by well-known local musicians.",
        "M: That's awesome. I definitely want to go and try all the different kinds of foods.",
      ],
      options: [
        '① 개최 장소',
        '② 개최 일시',
        '③ 참가 트럭 수',
        '④ 특별 공연',
        '⑤ 기념품',
      ],
      correctAnswer: 5,
      explanation:
        '개최 장소(Riverside Park), 일시(4월 25일 토 오전 11시~오후 5시), 트럭 수(75대), 특별 공연(지역 유명 음악가)은 언급되었지만, 기념품은 언급되지 않았습니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 13번: 내용 일치/불일치 ──
  {
    subCategory: '내용 일치',
    difficulty: 4,
    cefrLevel: 'A2 하',
    contentJson: {
      type: 'listening_match',
      questionNumber: 13,
      grade: 'go2',
      instruction: "Jenny's Pottery Class에 관한 다음 내용을 듣고, 일치하지 않는 것을 고르시오.",
      script: [
        "W: Good morning! Welcome to Jenny's Pottery Class. In this session, you'll make your own mug using special white clay. This material is very soft and easy to paint on. We provide aprons for all participants. So, you don't need to worry about your clothes getting dirty. Please note that it takes two weeks for the mugs to be completed because they must be baked in a hot oven several times. Once they're ready, you must pick up your mug in person because we don't offer a delivery service. Instead, we'll provide a box for you. Plus, you can make one more mug for an additional five dollars. Now let's get started.",
      ],
      options: [
        '① 특별한 하얀 점토를 사용할 것이다.',
        '② 모든 참가자에게 앞치마를 제공한다.',
        '③ 머그잔이 완성되는 데 2주일이 걸린다.',
        '④ 머그잔은 집으로 배송된다.',
        '⑤ 5달러를 추가하면 머그잔을 하나 더 만들 수 있다.',
      ],
      correctAnswer: 4,
      explanation:
        '대본에 "you must pick up your mug in person because we don\'t offer a delivery service"라고 했으므로 배송 서비스가 없습니다. ④가 일치하지 않습니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 14번: 표 보고 선택 (스마트워치) ──
  {
    subCategory: '표 정보 활용',
    difficulty: 5,
    cefrLevel: 'A2 상',
    contentJson: {
      type: 'listening_table',
      questionNumber: 14,
      grade: 'go2',
      instruction: '다음 표를 보면서 대화를 듣고, 여자가 구매할 스마트 워치를 고르시오.',
      tableData: {
        headers: ['Model', 'Case Material', 'Price', 'Color', 'Heart Monitor'],
        rows: [
          ['A', 'Plastic', '$100', 'Rose Gold', '×'],
          ['B', 'Aluminum', '$150', 'Black', '×'],
          ['C', 'Stainless Steel', '$180', 'Gray', '×'],
          ['D', 'Titanium', '$190', 'Silver', '○'],
          ['E', 'Ceramic', '$220', 'Ivory', '○'],
        ],
      },
      script: [
        "M: Honey, what are you looking at on your phone?",
        "W: I'm trying to choose a smartwatch, but I can't decide among these five.",
        "M: Let me take a look. Do you want a specific case material for your smartwatch?",
        "W: Well, stainless steel is quite heavy to wear on a daily basis. So I don't want that one.",
        "M: Right. Then, what's your budget?",
        'W: No more than 200 dollars.',
        "M: Okay. Then let's exclude this one. Now, what about the color?",
        'W: Rose gold is not for me.',
        "M: I see. Now you have two choices left. Which one do you like better?",
        "W: I don't think I need the heart monitor function. I'll buy the one without it.",
      ],
      options: [
        '① A (Plastic, $100, Rose Gold, ×)',
        '② B (Aluminum, $150, Black, ×)',
        '③ C (Stainless Steel, $180, Gray, ×)',
        '④ D (Titanium, $190, Silver, ○)',
        '⑤ E (Ceramic, $220, Ivory, ○)',
      ],
      correctAnswer: 2,
      explanation:
        'Stainless Steel(C) 제외, $200 초과(E) 제외, Rose Gold(A) 제외 → B($150, Black)와 D($190, Silver) 중 심박 모니터 불필요 → 심박 모니터 없는 B를 선택합니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 15번: 함축적 의미 파악 ──
  {
    subCategory: '함축적 의미 파악',
    difficulty: 5,
    cefrLevel: 'A2 상',
    contentJson: {
      type: 'listening_implication',
      questionNumber: 15,
      grade: 'go2',
      instruction: '대화를 듣고, 남자의 "Time won\'t be on your side."가 의미하는 바로 가장 적절한 것을 고르시오.',
      targetExpression: "Time won't be on your side.",
      script: [
        "M: Sweetie, you look upset. What's going on?",
        "W: Sally and I had an argument about two weeks ago, and we haven't talked since.",
        "M: It must have been pretty serious. Have you tried reaching out to her?",
        "W: No. I'm scared that if I bring it up, we'll start fighting again. I thought things would just get better over time.",
        "M: Actually, that's not usually how it works. The longer you wait, the harder it becomes to fix things.",
        'W: Really? I thought giving it some time would help.',
        "M: When there's a problem, you should try to fix it right away. If not, the problem often grows.",
        "W: I see. I should try to work it out with Sally right away.",
        "M: Exactly. Time won't be on your side.",
      ],
      options: [
        '① 관계의 문제는 즉시 해결해야 한다.',
        '② 속도보다 과정을 중요시해야 한다.',
        '③ 시간 약속을 잘 지켜야 한다.',
        '④ 가족과 많은 시간을 보내야 한다.',
        '⑤ 과거의 인연에 얽매이지 말아야 한다.',
      ],
      correctAnswer: 1,
      explanation:
        '기다릴수록 문제가 더 커진다며 즉시 해결하라고 조언하는 맥락에서 "시간이 네 편이 아닐 거야"는 "관계 문제는 즉시 해결해야 한다"는 의미입니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 16번: 적절한 응답 (긴 대화) ──
  {
    subCategory: '적절한 응답',
    difficulty: 6,
    cefrLevel: 'B1 하',
    contentJson: {
      type: 'listening_response',
      questionNumber: 16,
      grade: 'go2',
      instruction: '대화를 듣고, 여자의 마지막 말에 대한 남자의 응답으로 가장 적절한 것을 고르시오.',
      script: [
        'W: Honey, what are all these wooden boards and screws doing all over the living room?',
        "M: I'm trying to assemble the bookshelf I ordered online, but it's much harder than I expected.",
        "W: It looks complicated. How long have you been working on it?",
        "M: It's been more than an hour. It's so frustrating.",
        'W: Hmm, did you read the instruction manual before you started?',
        "M: No, I thought it would be a simple task. But it turns out the pieces don't really seem to fit correctly.",
        "W: That's why you should read the manual to assemble something properly.",
        "M: I guess you're right. I just thought that I could save time by skipping it.",
        'W: Quite the contrary. Skipping the instructions usually ends up costing you more time.',
        'M: _______________',
      ],
      options: [
        "① Alright. I'd better read the manual then.",
        "② I'm so glad that we've finished assembling it.",
        "③ Wonderful! It's a perfect fit for my bookshelf.",
        '④ Reading a book every day boosts your memory.',
        '⑤ Please don\'t put heavy things on the shelf anymore.',
      ],
      correctAnswer: 1,
      explanation:
        '설명서를 건너뛰면 오히려 시간이 더 걸린다는 말에 "알겠어, 설명서를 읽는 게 낫겠네"가 가장 적절합니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 17번: 적절한 응답 (긴 대화) ──
  {
    subCategory: '적절한 응답',
    difficulty: 6,
    cefrLevel: 'B1 하',
    contentJson: {
      type: 'listening_response',
      questionNumber: 17,
      grade: 'go2',
      instruction: '대화를 듣고, 남자의 마지막 말에 대한 여자의 응답으로 가장 적절한 것을 고르시오.',
      script: [
        'M: Hi, Emma. Are you going to the office potluck party this Friday?',
        "W: Yes, I'm looking forward to it. I love seeing the different foods everyone brings.",
        "M: Do we have to cook a dish ourselves? I'm a terrible cook.",
        "W: Not necessarily. A potluck is just a gathering where each guest brings a dish, and we all share the food together.",
        "M: But I'm worried people will be disappointed if I don't bring something I cooked.",
        "W: No way. The goal is to share a meal together, not to judge each other's cooking.",
        'M: So, can I just bring something I bought?',
        "W: Absolutely! Some people actually prefer a delicious store-bought dish.",
        "M: That's a huge relief. There's a great bakery near my house that sells amazing pies.",
        'W: _______________',
      ],
      options: [
        '① Yes. We sell all kinds of baking tools and ingredients.',
        '② Sure. You can definitely win the cooking competition.',
        '③ Certainly. You may share my recipe with the guests.',
        "④ Sounds perfect. I'm sure everyone will enjoy the pie.",
        "⑤ No way. I don't like sharing my food with others.",
      ],
      correctAnswer: 4,
      explanation:
        '집 근처 베이커리의 파이를 가져가겠다는 말에 "완벽해, 모두 파이를 좋아할 거야"가 가장 적절합니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 18번: 상황에 적절한 말 ──
  {
    subCategory: '상황에 적절한 말',
    difficulty: 6,
    cefrLevel: 'B1 하',
    contentJson: {
      type: 'listening_situation',
      questionNumber: 18,
      grade: 'go2',
      instruction: "다음 상황 설명을 듣고, Jake가 Katie에게 할 말로 가장 적절한 것을 고르시오.",
      script: [
        "M: Jake and Katie are classmates, and Jake was chosen to be the leader of their class for the school's upcoming sports day. One of the events they're preparing for is the group jump rope competition. Katie keeps making mistakes during practice, which makes her feel very nervous. Jake knows that Katie is good at sports. He thinks she's making mistakes because she's too focused on winning. So, Jake wants to advise Katie to stop worrying about losing and enjoy herself during practice time. In this situation, what would Jake most likely say to Katie?",
      ],
      options: [
        '① You have to push back the date of the jump rope competition.',
        '② Don\'t feel pressured to win and just have fun during practice.',
        "③ Let's order our class T-shirts for the sports day.",
        '④ I think the school needs to buy new jump ropes.',
        '⑤ You should become our next class president.',
      ],
      correctAnswer: 2,
      explanation:
        'Jake는 Katie에게 승리에 집착하지 말고 연습 중에 즐기라고 조언하고 싶으므로 ②가 적절합니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 19번: 주제 파악 (긴 담화) ──
  {
    subCategory: '주제 파악',
    difficulty: 6,
    cefrLevel: 'B1 하',
    contentJson: {
      type: 'listening_topic',
      questionNumber: 19,
      grade: 'go2',
      instruction: '여자가 하는 말의 주제로 가장 적절한 것을 고르시오.',
      script: [
        "W: Hello, class. In the animal kingdom, mothers and fathers take on different roles depending on the species. Today, we'll explore how mother animals lead their groups and ensure their survival. First, elephants live in groups led by an old, wise mother who makes all the major decisions. She uses her memory to lead the family to food and water. Second, when it comes to lions, the mothers provide food for the entire group. These females work together to hunt and are responsible for teaching the young ones how to survive. Third, killer whales have mothers that act as lifelong teachers for their children. The mother whale leads the group and shows her babies the best ways to find food and communicate. Finally, hyenas live in groups where the mother's role is to maintain order. The highest-ranking female leads the hunts and ensures that the group stays together and strong. Now, let's watch a short video.",
      ],
      options: [
        "① types of animals' defense mechanisms",
        '② why some animals cannot be domesticated',
        '③ effects of climate change on wild animal life',
        '④ ways that animals communicate with each other',
        '⑤ how mother animals lead and support their groups',
      ],
      correctAnswer: 5,
      explanation:
        '코끼리, 사자, 범고래, 하이에나의 어미가 무리를 이끌고 생존을 보장하는 방식에 대해 설명하고 있습니다.\n\n' +
        SOURCE_LABEL,
    },
  },
  // ── 20번: 언급되지 않은 것 (19번과 동일 담화) ──
  {
    subCategory: '세부 내용 파악',
    difficulty: 6,
    cefrLevel: 'B1 하',
    contentJson: {
      type: 'listening_detail',
      questionNumber: 20,
      grade: 'go2',
      instruction: '언급된 동물이 아닌 것을 고르시오.',
      script: [
        "W: Hello, class. In the animal kingdom, mothers and fathers take on different roles depending on the species. Today, we'll explore how mother animals lead their groups and ensure their survival. First, elephants live in groups led by an old, wise mother who makes all the major decisions. She uses her memory to lead the family to food and water. Second, when it comes to lions, the mothers provide food for the entire group. These females work together to hunt and are responsible for teaching the young ones how to survive. Third, killer whales have mothers that act as lifelong teachers for their children. The mother whale leads the group and shows her babies the best ways to find food and communicate. Finally, hyenas live in groups where the mother's role is to maintain order. The highest-ranking female leads the hunts and ensures that the group stays together and strong. Now, let's watch a short video.",
      ],
      linkedQuestion: 19,
      options: [
        '① elephants',
        '② lions',
        '③ killer whales',
        '④ beavers',
        '⑤ hyenas',
      ],
      correctAnswer: 4,
      explanation:
        '코끼리(elephants), 사자(lions), 범고래(killer whales), 하이에나(hyenas)는 언급되었지만, 비버(beavers)는 언급되지 않았습니다.\n\n' +
        SOURCE_LABEL,
    },
  },
]

async function main() {
  console.log('🎧 2026 고2 영어듣기능력평가 문제뱅크 시딩 시작...')
  console.log(`총 ${LISTENING_QUESTIONS.length}개 문제`)

  let created = 0
  let skipped = 0

  for (const q of LISTENING_QUESTIONS) {
    const questionNumber = (q.contentJson as Record<string, unknown>).questionNumber as number
    const grade = (q.contentJson as Record<string, unknown>).grade as string

    const existing = await prisma.question.findFirst({
      where: {
        academyId: null,
        domain: QuestionDomain.LISTENING,
        subCategory: q.subCategory,
        contentJson: {
          path: ['questionNumber'],
          equals: questionNumber,
        },
        AND: {
          contentJson: {
            path: ['grade'],
            equals: grade,
          },
        },
      },
    })

    if (existing) {
      console.log(`  ⏭️  ${questionNumber}번 문제 이미 존재 — 건너뜀`)
      skipped++
      continue
    }

    await prisma.question.create({
      data: {
        academyId: null,
        domain: QuestionDomain.LISTENING,
        subCategory: q.subCategory,
        difficulty: q.difficulty,
        cefrLevel: q.cefrLevel,
        contentJson: q.contentJson as never,
        source: QuestionSource.SYSTEM,
        isVerified: true,
        isActive: true,
        statsJson: { timesUsed: 0, avgScore: null },
      },
    })
    console.log(`  ✅ ${questionNumber}번 문제 생성 완료 (${q.subCategory}, 난이도 ${q.difficulty})`)
    created++
  }

  console.log(`\n🎧 고2 듣기 문제 시딩 완료: ${created}개 생성, ${skipped}개 건너뜀`)
}

main()
  .catch((e) => {
    console.error('❌ 시딩 실패:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
