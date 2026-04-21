/**
 * 2026학년도 제1회 고3 영어듣기능력평가 - 문제뱅크 시드 데이터
 * 출처: 전국 13개 시·도교육청 공동 주관 (2026.4.9 시행)
 *
 * 실행: npx tsx prisma/seed-listening-2026-go3.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { PrismaClient, QuestionDomain, QuestionSource } from '../src/generated/prisma'

const prisma = new PrismaClient()

interface ListeningQuestion {
  subCategory: string
  difficulty: number
  cefrLevel: string
  contentJson: Record<string, unknown>
}

const LISTENING_QUESTIONS: ListeningQuestion[] = [
  // ── 1번: 적절한 응답 (대화 완성) ──
  {
    subCategory: '적절한 응답',
    difficulty: 4,
    cefrLevel: 'A2 하',
    contentJson: {
      type: 'listening_response',
      questionNumber: 1,
      instruction: '대화를 듣고, 남자의 마지막 말에 대한 여자의 응답으로 가장 적절한 것을 고르시오.',
      script: [
        'M: Sweetie, did you enjoy dinner?',
        'W: Yes, Dad. It was so good. I\'m sure Mom would have enjoyed it, too.',
        'M: Thanks! Then, I\'ll cook the same dish on Saturday. Your mom is coming back from her business trip that day.',
        'W: _______________',
      ],
      options: [
        '① I bought a beautiful plate for you.',
        '② You must be tired from the business trip.',
        '③ I\'m glad she joined us at the dinner table.',
        '④ Good idea. That\'d be a nice surprise for her.',
        '⑤ Awesome! We\'re having fish for dinner tonight.',
      ],
      correctAnswer: 4,
      explanation: '엄마가 출장에서 돌아오는 날 같은 요리를 해주겠다는 아빠의 말에 "좋은 생각이야, 엄마한테 멋진 깜짝선물이 될 거야"가 가장 적절합니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 2번: 적절한 응답 ──
  {
    subCategory: '적절한 응답',
    difficulty: 4,
    cefrLevel: 'A2 하',
    contentJson: {
      type: 'listening_response',
      questionNumber: 2,
      instruction: '대화를 듣고, 여자의 마지막 말에 대한 남자의 응답으로 가장 적절한 것을 고르시오.',
      script: [
        'W: Noah, are you heading to the library now?',
        'M: Yes, I want to check out some new books.',
        'W: Then can you do me a favor? I\'m late for tennis practice, so can you return a book for me?',
        'M: _______________',
      ],
      options: [
        '① Of course. Just give me the book.',
        '② I\'m sorry. I\'m not a big tennis fan.',
        '③ Okay. I can join the practice today.',
        '④ Good. I\'m glad my due date is extended.',
        '⑤ Yeah. Our public libraries need more support.',
      ],
      correctAnswer: 1,
      explanation: '도서관에 가는 길에 책을 반납해달라는 부탁에 "물론이지, 책만 줘"가 가장 적절합니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 3번: 적절한 응답 ──
  {
    subCategory: '적절한 응답',
    difficulty: 4,
    cefrLevel: 'A2 하',
    contentJson: {
      type: 'listening_response',
      questionNumber: 3,
      instruction: '대화를 듣고, 남자의 마지막 말에 대한 여자의 응답으로 가장 적절한 것을 고르시오.',
      script: [
        'M: Kelly. The famous psychologist Steven Lee is giving a talk at the university library next Friday.',
        'W: That sounds interesting. I really want to go. Do I need to sign up in advance?',
        'M: Yes. You can sign up online. I\'ll send you the link.',
        'W: _______________',
      ],
      options: [
        '① Oh, no. I forgot to bring my ticket.',
        '② Thanks. I\'ll register for it right away.',
        '③ I really look forward to reading your book.',
        '④ Too bad. You should\'ve submitted it earlier.',
        '⑤ The medicine you recommended was so good.',
      ],
      correctAnswer: 2,
      explanation: '온라인으로 등록할 수 있고 링크를 보내주겠다는 말에 "고마워, 바로 등록할게"가 가장 적절합니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 4번: 주제 파악 ──
  {
    subCategory: '주제 파악',
    difficulty: 6,
    cefrLevel: 'B1 하',
    contentJson: {
      type: 'listening_topic',
      questionNumber: 4,
      instruction: '다음을 듣고, 여자가 하는 말의 주제로 가장 적절한 것을 고르시오.',
      script: [
        'W: Welcome to my channel, Art Inside. Many people wonder why some individuals become so successful in the world of art. While some think it\'s just talent and a bit of luck, there are actually other specific reasons. Today, I\'d like to talk about some common traits shared by successful artists. First, they observe the world closely, recognizing small details that others don\'t notice. Also, they\'re open to trying new ideas and different styles, and don\'t get discouraged even if they\'re not initially accepted. These shared qualities of successful artists are what help them create great work. I hope this inspires your own creative journey!',
      ],
      options: [
        '① 예술 작품 거래 활성화를 위한 방안',
        '② 예술가 사후에 작품이 재평가 받는 이유',
        '③ 창의력 신장을 위한 예술 교육의 필요성',
        '④ 손상된 예술 작품 복원 기술의 발달 과정',
        '⑤ 성공적인 예술가들이 공통적으로 가진 특징',
      ],
      correctAnswer: 5,
      explanation: '성공한 예술가들의 공통적 특징(세밀한 관찰력, 새로운 시도에 대한 개방성 등)에 대해 이야기하고 있습니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 5번: 목적 파악 ──
  {
    subCategory: '목적 파악',
    difficulty: 6,
    cefrLevel: 'B1 하',
    contentJson: {
      type: 'listening_purpose',
      questionNumber: 5,
      instruction: '다음을 듣고, 남자가 하는 말의 목적으로 가장 적절한 것을 고르시오.',
      script: [
        'M: Good afternoon, students. This is your vice principal, Mr. Kim. I\'d like to call your attention to our school\'s new policy regarding taking photos and videos on campus. This policy was recently approved and will take effect immediately. Under the new guidelines, if you want to record others or share such content on social media, you must obtain their permission. These are designed to protect your privacy and prevent conflicts. For the full details of the policy, you can visit the school website. Thank you for your cooperation.',
      ],
      options: [
        '① 교내 사진전 참가를 독려하려고',
        '② 학교 홈페이지 이전을 홍보하려고',
        '③ 학교의 새로운 촬영 규정을 공지하려고',
        '④ 학교 폭력 예방 교육 일정을 안내하려고',
        '⑤ 개인 정보 보호 규정 마련을 촉구하려고',
      ],
      correctAnswer: 3,
      explanation: '교내 촬영 및 SNS 공유 시 허가를 받아야 한다는 새로운 규정을 공지하는 것이 목적입니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 6번: 주장 파악 ──
  {
    subCategory: '주장 파악',
    difficulty: 6,
    cefrLevel: 'B1 하',
    contentJson: {
      type: 'listening_opinion',
      questionNumber: 6,
      instruction: '대화를 듣고, 여자의 주장으로 가장 적절한 것을 고르시오.',
      script: [
        'M: Honey, I\'m concerned about our daughter.',
        'W: Are you worried because she gets distracted easily while studying at home?',
        'M: Right. I wish she could focus better.',
        'W: Well, then we should make her write a diary to improve her concentration.',
        'M: Can you explain in more detail?',
        'W: When she keeps a diary, she has to write down her thoughts and feelings.',
        'M: So, how does that help?',
        'W: It allows her to clear her mind, which leads to better focus. That\'s why writing a diary can help her concentrate.',
        'M: That could be the solution for our daughter. Let\'s give it a try.',
      ],
      options: [
        '① 집중력 향상을 위해 아이에게 일기를 쓰게 해야 한다.',
        '② 갈등 해결을 위해 감정을 솔직하게 표현해야 한다.',
        '③ 아이가 문제 행동을 보일 때 빨리 해결해야 한다.',
        '④ 타인의 감정을 배려하도록 아이를 지도해야 한다.',
        '⑤ 성적 향상을 위해 집에서 공부하게 해야 한다.',
      ],
      correctAnswer: 1,
      explanation: '여자는 아이의 집중력을 키우기 위해 일기 쓰기를 시켜야 한다고 주장하고 있습니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 7번: 의견 파악 ──
  {
    subCategory: '의견 파악',
    difficulty: 6,
    cefrLevel: 'B1 하',
    contentJson: {
      type: 'listening_opinion',
      questionNumber: 7,
      instruction: '대화를 듣고, 남자의 의견으로 가장 적절한 것을 고르시오.',
      script: [
        'M: Hi, Sarah. You look a bit tired today. Is everything okay?',
        'W: Hi, Mike. I couldn\'t sleep well because of the pain in my neck.',
        'M: That\'s too bad. Have you tried anything to fix the pain?',
        'W: I\'ve tried stretching, but my neck still hurts when I sleep.',
        'M: Well, I\'ve found that sleeping with a rolled-up towel under your neck helps to relieve neck pain.',
        'W: A towel? How does that help with the pain?',
        'M: It supports your neck and makes it feel more comfortable.',
        'W: I see. I never thought about using a towel for sleep.',
        'M: It really works. You\'ll feel less pain while sleeping with a rolled-up towel under your neck.',
        'W: Okay. I\'ll try that tonight.',
      ],
      options: [
        '① 꾸준한 스트레칭은 거북목 예방에 효과적이다.',
        '② 골반 교정을 위해 전문적인 물리 치료가 필요하다.',
        '③ 숙면을 취하기 위해서는 적절한 습도 유지가 중요하다.',
        '④ 위생 관리를 위해 정기적으로 수건을 교체하는 것이 좋다.',
        '⑤ 수건을 말아 목에 받치고 자면 목 통증 완화에 도움이 된다.',
      ],
      correctAnswer: 5,
      explanation: '남자는 수건을 말아 목 아래에 받치고 자면 목 통증이 완화된다고 말하고 있습니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 8번: 관계 파악 ──
  {
    subCategory: '관계 파악',
    difficulty: 6,
    cefrLevel: 'B1 하',
    contentJson: {
      type: 'listening_relationship',
      questionNumber: 8,
      instruction: '대화를 듣고, 두 사람의 관계를 가장 잘 나타낸 것을 고르시오.',
      script: [
        'W: Thank you for doing this interview. It\'s a great honor.',
        'M: I\'m happy to be here.',
        'W: Our magazine readers are curious how it feels to be a world champion.',
        'M: It\'s been my dream ever since I started playing chess at the age of five.',
        'W: Great. Can you tell me how you trained for the chess world championship?',
        'M: I spent many hours every day practicing against an AI program. That allowed me to come up with whole new strategies.',
        'W: That\'s interesting! I\'ll make sure to write those details in my article.',
        'M: Thank you. I hope many chess fans who read your magazine find my experience helpful.',
        'W: I\'m sure they will. I\'ll send you the magazine as soon as it\'s published.',
        'M: Great. I look forward to reading your article.',
      ],
      options: [
        '① 광고주 ― 출판사 편집장',
        '② 잡지 기자 ― 체스 선수',
        '③ 웹 개발자 ― 면접관',
        '④ 방송 작가 ― 영화배우',
        '⑤ 육상 코치 ― 심판',
      ],
      correctAnswer: 2,
      explanation: '여자는 잡지 기사를 쓰기 위해 인터뷰를 하고 있고, 남자는 체스 세계 챔피언입니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 9번: 그림 상황 ──
  {
    subCategory: '그림 상황',
    difficulty: 5,
    cefrLevel: 'A2 상',
    contentJson: {
      type: 'listening_picture',
      questionNumber: 9,
      instruction: '다음 그림의 상황에 가장 적절한 대화를 고르시오.',
      script: [
        'Number One — W: I didn\'t know you could play the guitar. M: I played the guitar for my high school band.',
        'Number Two — W: I really like your new hair style. M: Thanks. I changed my hairdresser.',
        'Number Three — W: Honey, something smells good. M: I made lemon cookies. Have a bite.',
        'Number Four — W: Wait, you\'re holding the painting upside down. M: Oh, I am. Let me hang it the right way.',
        'Number Five — W: Are you finished setting up the tent? M: Almost. Please hand me the hammer.',
      ],
      options: [
        '① 기타 연주 대화',
        '② 새 헤어스타일 대화',
        '③ 쿠키 만들기 대화',
        '④ 그림 거꾸로 들기 대화',
        '⑤ 텐트 설치 대화',
      ],
      correctAnswer: 4,
      explanation: '그림에서 남자가 그림을 거꾸로 들고 있는 상황으로, 여자가 그림이 거꾸로라고 알려주는 4번이 적절합니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 10번: 부탁한 일 ──
  {
    subCategory: '부탁한 일',
    difficulty: 5,
    cefrLevel: 'A2 상',
    contentJson: {
      type: 'listening_request',
      questionNumber: 10,
      instruction: '대화를 듣고, 여자가 남자에게 부탁한 일로 가장 적절한 것을 고르시오.',
      script: [
        'M: Hi, Ms. Wilkins. How\'s the preparation going for tomorrow\'s school volleyball match?',
        'W: Hi, Mr. Kane. I just finished setting up the net for the game.',
        'M: Is there anything I can help you with?',
        'W: Yes. There are still a few more things that need to be done.',
        'M: Should I start cleaning the gym floor?',
        'W: Actually, some student volunteers are coming to do that later this afternoon.',
        'M: I see. How about checking the air pressure in the volleyballs?',
        'W: I\'ll take care of that tomorrow morning. There\'s one thing you can do.',
        'M: Sure. What do you need me to do?',
        'W: Can you hang the banners on the walls in the gym?',
        'M: No problem. I\'ll get started right away.',
      ],
      options: [
        '① 현수막 걸기',
        '② 자원봉사자 선발하기',
        '③ 배구 네트 설치하기',
        '④ 체육관 바닥 청소하기',
        '⑤ 배구공 공기압 점검하기',
      ],
      correctAnswer: 1,
      explanation: '여자는 남자에게 체육관 벽에 현수막을 걸어달라고 부탁했습니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 11번: 이유 파악 ──
  {
    subCategory: '이유 파악',
    difficulty: 5,
    cefrLevel: 'A2 상',
    contentJson: {
      type: 'listening_reason',
      questionNumber: 11,
      instruction: '대화를 듣고, 남자가 회사를 그만두는 이유를 고르시오.',
      script: [
        'W: Matthew, I heard you\'re leaving your company at the end of this month. Is that true?',
        'M: Yes, it is. I\'ve decided to quit my job.',
        'W: Did you get a job offer from another company?',
        'M: No. Actually, I don\'t have a new job lined up right now.',
        'W: Did you have some problems with your boss or coworkers?',
        'M: Not at all. Everyone in the office has been wonderful to me.',
        'W: Then why are you quitting? Is the salary too low?',
        'M: No, the pay is fine. After working nonstop for years, I need some time to rest and recharge.',
        'W: I see. I\'m glad you decided to take some time for yourself.',
      ],
      options: [
        '① 이직 제안을 받아서',
        '② 급여가 너무 적어서',
        '③ 직장 동료와 문제가 있어서',
        '④ 재충전의 시간을 갖기 위해서',
        '⑤ 새로운 사업을 시작하기 위해서',
      ],
      correctAnswer: 4,
      explanation: '남자는 몇 년간 쉬지 않고 일해서 재충전의 시간이 필요하다고 말했습니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 12번: 금액 계산 ──
  {
    subCategory: '금액 계산',
    difficulty: 5,
    cefrLevel: 'A2 상',
    contentJson: {
      type: 'listening_calculation',
      questionNumber: 12,
      instruction: '대화를 듣고, 여자가 지불할 금액을 고르시오.',
      script: [
        'M: Good morning! Welcome to Happy Paws. How can I help you?',
        'W: Hi. I\'m looking for some healthy snacks for my dog.',
        'M: Well, we have these chicken-flavored snacks, which are 20 dollars a bag. But if you buy two bags, they\'re 30 dollars.',
        'W: Great. I\'ll take two bags. Do you also have dental chews?',
        'M: Yes, they\'re five dollars each. How many would you like?',
        'W: I\'ll take four.',
        'M: Okay. So that\'s two bags of snacks and four dental chews, right?',
        'W: Yes. Do I get a discount with this membership card?',
        'M: Sure. You get 10 percent off the total price with that.',
        'W: Perfect. Here\'s my credit card.',
      ],
      options: [
        '① $40',
        '② $45',
        '③ $50',
        '④ $54',
        '⑤ $60',
      ],
      correctAnswer: 2,
      explanation: '간식 2봉지 $30 + 덴탈 츄 4개 $20 = $50, 회원카드 10% 할인 → $50 × 0.9 = $45',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 13번: 언급되지 않은 것 ──
  {
    subCategory: '세부 내용 파악',
    difficulty: 6,
    cefrLevel: 'B1 하',
    contentJson: {
      type: 'listening_detail',
      questionNumber: 13,
      instruction: '대화를 듣고, Underwater Drone Experience에 관해 언급되지 않은 것을 고르시오.',
      script: [
        'W: Jake, have you tried the Underwater Drone Experience at the marine center?',
        'M: Not yet, but I\'ve heard it\'s great. You explore underwater environments with a drone, right?',
        'W: Exactly. You get to control a real drone and look at sea life up close.',
        'M: Sounds amazing! How long does it last?',
        'W: It\'s 45 minutes, including a brief training session.',
        'M: I see. I checked their poster earlier, and it said participants must be at least 18 years old.',
        'W: That\'s right. How much does the experience cost?',
        'M: It\'s 35 dollars.',
        'W: That\'s reasonable. How do we make a reservation?',
        'M: We can book it through their official app.',
        'W: Great. Let\'s check the availability for this weekend.',
      ],
      options: [
        '① 소요 시간',
        '② 참가 가능 연령',
        '③ 비용',
        '④ 예약 방법',
        '⑤ 최대 이용 인원',
      ],
      correctAnswer: 5,
      explanation: '소요 시간(45분), 참가 연령(18세 이상), 비용($35), 예약 방법(공식 앱)은 언급되었지만, 최대 이용 인원은 언급되지 않았습니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 14번: 내용 일치/불일치 ──
  {
    subCategory: '내용 일치',
    difficulty: 6,
    cefrLevel: 'B1 하',
    contentJson: {
      type: 'listening_match',
      questionNumber: 14,
      instruction: 'Green Teens Eco-Adventure에 관한 다음 내용을 듣고, 일치하지 않는 것을 고르시오.',
      script: [
        'M: Are you a young person who cares about nature? Then Green Teens Eco-Adventure is the perfect program for you. This program is for teenagers aged 13 to 18. It\'s sponsored by the city\'s parks and recreations office, and will run for a two-week period starting from July 27th. Participants will take part in various forest exploration activities including bird watching and identifying different types of plant species. Participants will have an opportunity to have discussions with local environmental experts, who can share their real experiences and expertise. There\'s no participation fee for this program, so come and explore nature.',
      ],
      options: [
        '① 13세에서 18세까지를 위한 프로그램이다.',
        '② 2주간 운영된다.',
        '③ 조류 관찰 활동이 포함되어 있다.',
        '④ 지역 환경 전문가와의 토론 기회가 있다.',
        '⑤ 참가비가 있다.',
      ],
      correctAnswer: 5,
      explanation: '대본에 "There\'s no participation fee"라고 했으므로 참가비가 없습니다. ⑤가 일치하지 않습니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 15번: 표 보고 선택 ──
  {
    subCategory: '표 정보 활용',
    difficulty: 5,
    cefrLevel: 'A2 상',
    contentJson: {
      type: 'listening_table',
      questionNumber: 15,
      instruction: '다음 표를 보면서 대화를 듣고, 두 사람이 주문할 식탁 매트 세트를 고르시오.',
      tableData: {
        headers: ['Model', 'Material', 'Shape', 'Color', 'Price'],
        rows: [
          ['A', 'Bamboo', 'Round', 'Brown', '$12'],
          ['B', 'Plastic', 'Square', 'Green', '$18'],
          ['C', 'Linen', 'Rectangular', 'White', '$21'],
          ['D', 'Leather', 'Heart', 'Black', '$25'],
          ['E', 'Silicon', 'Cloud', 'Blue', '$27'],
        ],
      },
      script: [
        'W: Look at these table mats, honey. Our old ones are so worn out.',
        'M: You\'re right. I was just searching for a new set on the internet. Do you want to take a look?',
        'W: Sure. Let\'s see. I want to avoid the leather ones since they\'re too difficult to clean.',
        'M: That makes sense. Which shape do you prefer?',
        'W: I don\'t think the cloud-shaped ones go with our table.',
        'M: Okay. Among the three left, I don\'t like the white one.',
        'W: I feel the same. White gets dirty too easily.',
        'M: Then, we only have two options left. Which one do you like better?',
        'W: Well, both seem fine. Why don\'t we just buy the cheaper one?',
        'M: Sounds good. Then, let\'s order this set.',
      ],
      options: [
        '① A (Bamboo, Round, Brown, $12)',
        '② B (Plastic, Square, Green, $18)',
        '③ C (Linen, Rectangular, White, $21)',
        '④ D (Leather, Heart, Black, $25)',
        '⑤ E (Silicon, Cloud, Blue, $27)',
      ],
      correctAnswer: 1,
      explanation: 'Leather 제외(D), Cloud 모양 제외(E), White 제외(C) → A($12)와 B($18) 중 더 저렴한 A를 선택합니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 16번: 적절한 응답 (긴 대화) ──
  {
    subCategory: '적절한 응답',
    difficulty: 7,
    cefrLevel: 'B1 상',
    contentJson: {
      type: 'listening_response',
      questionNumber: 16,
      instruction: '대화를 듣고, 남자의 마지막 말에 대한 여자의 응답으로 가장 적절한 것을 고르시오.',
      script: [
        'W: Excuse me, are you the one who posted the advertisement for the used camera?',
        'M: That\'s me. You must be the one who messaged me this morning.',
        'W: Yes. I just have a couple of questions. First, how long have you used it?',
        'M: I bought it about two months ago. Everything\'s functioning properly.',
        'W: I see. May I ask why you\'re selling this camera?',
        'M: Last week, I received a more professional model as a gift.',
        'W: Can I check the condition before I buy it?',
        'M: Sure. As you can see, there are no scratches on it.',
        'W: Okay. Then, I\'ll take it. The price you listed was 600 dollars, right?',
        'M: Since you came all the way here to pick it up, I\'ll give it to you at 550 dollars.',
        'W: _______________',
      ],
      options: [
        '① Yes. Let me leave a message for the seller.',
        '② Sorry. The TV advertisement was inaccurate.',
        '③ I appreciate it. That\'s a good deal for this camera.',
        '④ Sure. You\'ll get a discount if you pay in cash.',
        '⑤ Great. I prefer giving a gift to receiving one.',
      ],
      correctAnswer: 3,
      explanation: '600달러에서 550달러로 할인해주겠다는 제안에 "감사합니다, 좋은 거래네요"가 가장 적절합니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 17번: 적절한 응답 (긴 대화) ──
  {
    subCategory: '적절한 응답',
    difficulty: 7,
    cefrLevel: 'B1 상',
    contentJson: {
      type: 'listening_response',
      questionNumber: 17,
      instruction: '대화를 듣고, 여자의 마지막 말에 대한 남자의 응답으로 가장 적절한 것을 고르시오.',
      script: [
        'M: Hi, Lisa. Did you finish your science project proposal yet?',
        'W: Yes. I just need to hand it in to the professor in class tomorrow.',
        'M: In class? But the professor said all proposals must be submitted through the school website.',
        'W: Really? I thought we were supposed to hand in a printed copy.',
        'M: No, he was very specific. Uploading it on the online portal is the only way.',
        'W: Oh, no. I must have missed that part of the instructions.',
        'M: He even mentioned it again in the previous class.',
        'W: I was absent for that class. When is the deadline?',
        'M: Tonight at midnight. You only have a few hours left.',
        'W: That\'s a relief. I have the file ready on my laptop right now.',
        'M: _______________',
      ],
      options: [
        '① Avoid downloading a file from an unknown website.',
        '② I\'m relieved I got a good grade on the science project.',
        '③ Then you should hurry and upload it before it\'s too late.',
        '④ I like reading a printed copy rather than an electronic one.',
        '⑤ You can drop by the professor\'s office to register for the class.',
      ],
      correctAnswer: 3,
      explanation: '파일이 노트북에 준비되어 있다는 말에 "그럼 늦기 전에 빨리 업로드해"가 가장 적절합니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 18번: 상황 설명 후 적절한 말 ──
  {
    subCategory: '상황에 적절한 말',
    difficulty: 7,
    cefrLevel: 'B1 상',
    contentJson: {
      type: 'listening_situation',
      questionNumber: 18,
      instruction: '다음 상황 설명을 듣고, Scott이 Hana에게 할 말로 가장 적절한 것을 고르시오.',
      script: [
        'M: Hana and Scott are volunteers at an animal shelter. For the last three weeks, they\'ve spent most of their time cleaning cages and washing bowls. Hana complains to Scott that she\'s dissatisfied with her volunteer experience because these repetitive tasks seem meaningless and time-consuming. She even considers quitting because she feels her time is being wasted. However, Scott understands that a clean environment is essential for preventing disease and keeping the animals healthy. He believes Hana\'s work is very important. So, Scott wants to tell Hana that her cleaning efforts are essential for the animals\' health. In this situation, what would Scott most likely say to Hana?',
      ],
      options: [
        '① Let\'s find another animal shelter to volunteer at.',
        '② I can recommend you a good hospital for the animals.',
        '③ We\'re not allowed to bring our dogs to the shopping mall.',
        '④ Make sure to bring a waste bag when you walk your dog.',
        '⑤ Your cleaning work is crucial in keeping the animals healthy.',
      ],
      correctAnswer: 5,
      explanation: 'Scott은 Hana에게 청소 작업이 동물의 건강을 유지하는 데 필수적이라고 말하고 싶으므로 ⑤가 적절합니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 19번: 주제 파악 (긴 담화) ──
  {
    subCategory: '주제 파악',
    difficulty: 7,
    cefrLevel: 'B1 상',
    contentJson: {
      type: 'listening_topic',
      questionNumber: 19,
      instruction: '여자가 하는 말의 주제로 가장 적절한 것을 고르시오.',
      script: [
        'W: Hello! I\'m Dr. White from the Space Science Center. Did you know that many commonly-used items began as space inventions? Today, we\'ll discuss how technology made for space later turned into everyday products. First, sunglasses were used to block out harmful UV lights while astronauts explored space. Today they help to protect our eyes from the sun\'s damaging UV lights. Second, vacuum cleaners without cords were developed so that astronauts could clear away dirt when they drill for samples on the moon. Now, we can conveniently use these at home. Third, laptops were initially used on a space shuttle mission in 1983 to process data. They were very expensive at that time, but today they\'ve become affordable and most people can\'t live without them. Finally, although smoke detectors were invented earlier, they were enhanced for space exploration to pick up poisonous gases. Now, they\'re in almost every room to sense smoke and prevent fire from spreading. Now, let\'s watch a related video.',
      ],
      options: [
        '① how everyday products are polluting space',
        '② effective ways to keep space equipment clean',
        '③ negative impacts of new technology on workers',
        '④ everyday items that derived from space technology',
        '⑤ technical limits of space science in the past century',
      ],
      correctAnswer: 4,
      explanation: '우주 기술에서 유래한 일상용품(선글라스, 무선 청소기, 노트북, 연기 감지기)에 대해 이야기하고 있습니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
  // ── 20번: 언급되지 않은 것 ──
  {
    subCategory: '세부 내용 파악',
    difficulty: 7,
    cefrLevel: 'B1 상',
    contentJson: {
      type: 'listening_detail',
      questionNumber: 20,
      instruction: '언급된 물건이 아닌 것을 고르시오.',
      script: [
        '(19번과 동일한 담화 참조)',
      ],
      linkedQuestion: 19,
      options: [
        '① sunglasses',
        '② vacuum cleaners',
        '③ laptops',
        '④ water purifiers',
        '⑤ smoke detectors',
      ],
      correctAnswer: 4,
      explanation: '선글라스, 무선 청소기, 노트북, 연기 감지기는 언급되었지만, 정수기(water purifiers)는 언급되지 않았습니다.',
      source: '2026학년도 제1회 전국 13개 시·도교육청 고3 영어듣기능력평가',
    },
  },
]

async function main() {
  console.log('🎧 2026 고3 영어듣기능력평가 문제뱅크 시딩 시작...')
  console.log(`총 ${LISTENING_QUESTIONS.length}개 문제`)

  let created = 0
  let skipped = 0

  for (const q of LISTENING_QUESTIONS) {
    const questionNumber = (q.contentJson as Record<string, unknown>).questionNumber as number

    // 중복 체크: 같은 출처 + 문항번호로 이미 존재하는지 확인
    const existing = await prisma.question.findFirst({
      where: {
        academyId: null,
        domain: QuestionDomain.LISTENING,
        subCategory: q.subCategory,
        contentJson: {
          path: ['questionNumber'],
          equals: questionNumber,
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
        academyId: null, // 공용 문제
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

  console.log(`\n🎧 듣기 문제 시딩 완료: ${created}개 생성, ${skipped}개 건너뜀`)
}

main()
  .catch((e) => {
    console.error('❌ 시딩 실패:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
