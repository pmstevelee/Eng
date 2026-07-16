import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient, QuestionDomain, QuestionSource } from '../src/generated/prisma'

const prisma = new PrismaClient()

const SOURCE_LABEL =
  '출처: 2025학년도 대학수학능력시험 영어 영역 홀수형 유형 참조 유사문제 (저작권 보호를 위해 유사문제로 재구성)'

// ─── 장문 공유 지문 1 (41·42번) ───────────────────────────────────────────────
const LONG_PASSAGE_1 = `Consider the moment you button a shirt. Your fingers work in a quick, coordinated sequence without a second thought. This seemingly trivial act represents one of the most remarkable achievements in primate evolution — the precision grip. While other great apes can grasp and carry objects, the combination of a fully opposable thumb, broad fingertip pads, and sensitive tactile receptors that humans possess is without parallel. Chimpanzees, our closest living relatives, rely primarily on a power grip when manipulating tools; they cannot rotate a small object between thumb and forefinger with the same speed and accuracy that a human child demonstrates by the age of four.

This anatomical advantage transformed human technological history. The ability to hold a stone core steady with one hand while striking it with controlled force using the other made the manufacture of flaked tools not just possible but progressively refined. Archaeological evidence shows a steady miniaturisation of stone tools over hundreds of thousands of years — a trend that tracks directly with skeletal evidence of increasing thumb musculature. Without the precision grip, the fine motor demands of weaving, writing, and surgery would have been inaccessible, and the long chain of technological accumulation that defines human civilisation would have been severed at its first link.`

// 42번 (a)~(e) annotated
const LONG_PASSAGE_1_ANNOTATED = `Consider the moment you button a shirt. Your fingers work in a quick, coordinated sequence without a second thought. This seemingly (a)trivial act represents one of the most remarkable achievements in primate evolution — the precision grip. While other great apes can grasp and carry objects, the combination of a fully opposable thumb, broad fingertip pads, and sensitive tactile receptors that humans possess is without (b)parallel. Chimpanzees, our closest living relatives, rely primarily on a power grip when manipulating tools; they cannot rotate a small object between thumb and forefinger with the same speed and accuracy that a human child demonstrates by the age of four.

This anatomical advantage (c)transformed human technological history. The ability to hold a stone core steady with one hand while striking it with controlled force using the other made the manufacture of flaked tools not just possible but progressively refined. Archaeological evidence shows a steady miniaturisation of stone tools over hundreds of thousands of years — a trend that tracks directly with skeletal evidence of increasing thumb musculature. Without the precision grip, the fine motor demands of weaving, writing, and surgery would have been inaccessible, and the long chain of technological accumulation that defines human civilisation would have been (d)severed at its first link. The precision grip is therefore not merely a physical feature but the (e)obstacle that unlocked the full potential of the human mind.`

// ─── 장문 공유 지문 2 (43·44·45번) ─────────────────────────────────────────────
const LONG_PASSAGE_2 = `(A)
"Mom, have you noticed that Clara barely talks to me anymore?" David asked his mother, Helen. "I have," she replied softly. "You two used to be inseparable." David explained how things had shifted since (a)his daughter started high school — new friends, new interests, less time at home. Helen suggested, "Why don't you plan something just for the two of you? Maybe visit that botanical garden she loved as a kid." David agreed, and remembering that their matching rain jackets were still at the dry cleaner's, he asked Helen to come with him to pick them up.

(B)
Back home, David checked whether Clara had everything for an outdoor trip. In her bedroom closet he found her old hiking boots, sun hat, and a small backpack. When Clara returned from school, David said gently, "Clara, what do you think about a trip to the botanical garden this weekend, just us?" Clara smiled at (b)him but said she'd already made plans with friends. Helen stepped in: "The garden's spring exhibition only runs two more weeks." After a pause, (c)she agreed to reschedule with her friends.

(C)
"When did you drop these off?" the attendant at the dry cleaner's asked. "About ten days ago," David answered. Helen quietly corrected (d)him: "It was actually closer to three weeks, dear." The attendant searched the back room and returned with two identical blue rain jackets. "I do apologise," she said, "but please do try to collect within two weeks — storage space is limited." David thanked her and made a mental note to be more punctual.

(D)
The botanical garden was full of colour. David and Clara wandered along the lily pond path, talking about school, her new friends, and plans for the summer. Near the rose garden, Clara suddenly stopped and said, "Dad, I know I've been distant lately. I think I was worried (e)you wouldn't understand my new interests." David put his arm around her shoulders. "I'm interested in everything about you," he said. Clara laughed and reached for his hand, and they walked on together through the afternoon light.`

const questions = [
  // ════════════════════════════════════════════════════════════════════
  // LISTENING 1-17번
  // ════════════════════════════════════════════════════════════════════

  // ─── 1번: 여자가 하는 말의 목적 ─────────────────────────────────────────────
  {
    domain: QuestionDomain.LISTENING,
    subCategory: '목적',
    difficulty: 5,
    cefrLevel: 'A2 상',
    questionNumber: 1,
    type: 'listening_purpose',
    passage: `[Script]
W: Hello, Greenfield Middle School students. This is your vice principal, Ms. Carter. As you know, the annual school library book fair begins next Monday. This year we have over five hundred new titles across all genres, and every purchase directly supports our library fund. I would like to encourage every student to visit the fair during lunch breaks or after school. Students who buy three or more books will receive a special reading journal as a gift. Please remember that the fair runs only through Friday, so do not miss this wonderful opportunity. Thank you.`,
    question: '다음을 듣고, 여자가 하는 말의 목적으로 가장 적절한 것을 고르시오.',
    options: [
      '도서 반납 기한 연장을 알리려고',
      '독서 감상문 대회 참가를 독려하려고',
      '학교 도서 박람회 참여를 권장하려고',
      '새 학교 도서관 개관 일정을 공지하려고',
      '학교 도서 구입 예산 삭감을 설명하려고',
    ],
    answer: 3,
    explanation: `여자는 학교 도서 박람회가 다음 월요일에 시작되며 학생들의 방문을 권장하고 있다. 정답은 ③이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 2번: 남자의 의견 ──────────────────────────────────────────────────────
  {
    domain: QuestionDomain.LISTENING,
    subCategory: '의견',
    difficulty: 5,
    cefrLevel: 'A2 상',
    questionNumber: 2,
    type: 'listening_opinion',
    passage: `[Script]
W: Jake, have you signed up for the school cooking club?
M: Not yet, Mia. Actually I'm a little nervous about it.
W: Why? You cook at home all the time.
M: Cooking alone at home is different. In a club, you have to work with others on the same dish.
W: Is that a bad thing?
M: No, I think it's actually the best part. Cooking with others teaches you how to listen, share tasks, and trust your teammates. It makes the final dish better too.
W: So you're saying cooking in a group builds teamwork skills?
M: Exactly. I think that's more valuable than just learning recipes. I'm going to sign up.`,
    question: '대화를 듣고, 남자의 의견으로 가장 적절한 것을 고르시오.',
    options: [
      '요리 클럽은 창의적 사고력을 키우는 데 효과적이다.',
      '집에서 혼자 요리하는 습관이 기본 실력을 향상시킨다.',
      '요리 클럽 활동은 팀워크 능력을 기르는 데 가장 좋다.',
      '다양한 요리법을 익히려면 전문 수업이 필요하다.',
      '요리에 앞서 식재료에 대한 지식을 충분히 쌓아야 한다.',
    ],
    answer: 3,
    explanation: `남자는 "Cooking with others teaches you how to listen, share tasks, and trust your teammates"라고 하며 그룹 요리가 팀워크 능력을 기르는 데 가장 좋다고 주장한다. 정답은 ③이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 3번: 여자가 하는 말의 요지 ───────────────────────────────────────────────
  {
    domain: QuestionDomain.LISTENING,
    subCategory: '요지',
    difficulty: 5,
    cefrLevel: 'A2 상',
    questionNumber: 3,
    type: 'listening_main_point',
    passage: `[Script]
W: Good morning, everyone. Today I'd like to talk about visiting local museums. Many people think museums are only for tourists or school trips. But I believe regular visits can truly enrich your everyday life. When you see original artworks or historical objects up close, something happens that photographs simply cannot replicate. You begin to notice details, textures, and scales that change how you understand the world. Moreover, each visit can be different — even the same exhibition looks new when you bring different knowledge or emotions. I encourage all of you to visit a local museum at least once a month. You might be surprised by how much you grow.`,
    question: '다음을 듣고, 여자가 하는 말의 요지로 가장 적절한 것을 고르시오.',
    options: [
      '박물관의 디지털 전시는 관람 경험을 향상시킨다.',
      '지역 박물관은 지역 문화 보존에 중요한 역할을 한다.',
      '정기적인 박물관 방문은 일상을 풍요롭게 만든다.',
      '역사적 유물을 보호하기 위한 사회적 관심이 필요하다.',
      '박물관 관람 시 안내 자료를 활용하면 더욱 유익하다.',
    ],
    answer: 3,
    explanation: `여자는 박물관을 정기적으로 방문하면 일상이 풍요로워진다고 주장하고 있다. 정답은 ③이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 4번: 그림 불일치 ───────────────────────────────────────────────────────
  {
    domain: QuestionDomain.LISTENING,
    subCategory: '그림 불일치',
    difficulty: 5,
    cefrLevel: 'A2 상',
    questionNumber: 4,
    type: 'listening_picture',
    passage: `[Script]
W: Tom, I finished setting up the classroom for the science fair.
M: Great! Let me picture it. There's a big poster on the wall, right?
W: Yes, it's on the left wall. And there are three round tables in the middle.
M: Oh, I thought we were using rectangular tables.
W: We changed them. Each table has a plant model on it.
M: Nice. Is the teacher's desk at the front?
W: It's at the back. Oh, and we put a trash can in the right corner.
M: Perfect. What about the window?
W: The curtains are open. It's sunny today.`,
    question: '대화를 듣고, 그림에서 대화의 내용과 일치하지 않는 것을 고르시오.',
    chartData: {
      type: 'picture_description',
      scene: 'classroom',
      elements: [
        { id: 1, description: 'poster on the left wall' },
        { id: 2, description: 'three round tables in the middle' },
        { id: 3, description: 'plant model on each table' },
        { id: 4, description: "teacher's desk at the back" },
        { id: 5, description: 'trash can in the right corner' },
        { id: 6, description: 'curtains open' },
      ],
      wrongElement: 2,
    },
    options: ['①', '②', '③', '④', '⑤'],
    answer: 2,
    explanation: `대화에서 원형 테이블을 사용한다고 했으나 그림에서는 직사각형 테이블로 나타나 있다면 ②가 불일치이다. 정답은 ②이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 5번: 남자가 할 일 ──────────────────────────────────────────────────────
  {
    domain: QuestionDomain.LISTENING,
    subCategory: '할 일',
    difficulty: 5,
    cefrLevel: 'A2 상',
    questionNumber: 5,
    type: 'listening_task',
    passage: `[Script]
W: Kevin, the school talent show is next Friday. Have you finished the preparations?
M: Almost. I printed the programs yesterday.
W: Good. What about the banner for the stage?
M: Sophie said she'd design it tonight.
W: Did you book the microphones?
M: Yes, I called the equipment room this morning.
W: What about the chairs? The auditorium manager said we need to arrange them ourselves.
M: I was going to do that after school today, but Mr. Harris wants me to collect the permission slips from the homeroom teachers first.
W: Right, those need to be turned in today. I can arrange the chairs.
M: Thanks. I'll go collect the slips now.`,
    question: '대화를 듣고, 남자가 할 일로 가장 적절한 것을 고르시오.',
    options: [
      '배너 디자인하기',
      '마이크 예약하기',
      '의자 배열하기',
      '허락 동의서 수거하기',
      '프로그램 출력하기',
    ],
    answer: 4,
    explanation: `남자는 "I'll go collect the slips now"라고 하며 허락 동의서를 수거하러 간다고 했다. 정답은 ④이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 6번: 금액 ───────────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.LISTENING,
    subCategory: '금액',
    difficulty: 5,
    cefrLevel: 'A2 상',
    questionNumber: 6,
    type: 'listening_amount',
    passage: `[Script]
W: Excuse me. How much is the pottery class?
M: The beginner class is $60 per person, and the advanced class is $90.
W: I'd like to sign up for two beginner classes — one for me and one for my daughter.
M: Sure. Do you have our membership card?
W: Yes, I do.
M: Then you get a 10% discount on each class.
W: That's great. Can I pay by credit card?
M: Of course.`,
    question: '대화를 듣고, 여자가 지불할 금액을 고르시오.',
    options: ['$90', '$108', '$112', '$120', '$132'],
    answer: 2,
    explanation: `초급 클래스 $60 × 2 = $120에서 10% 할인을 적용하면 $120 × 0.9 = $108이다. 정답은 ② $108이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 7번: 이유 ───────────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.LISTENING,
    subCategory: '이유',
    difficulty: 5,
    cefrLevel: 'A2 상',
    questionNumber: 7,
    type: 'listening_reason',
    passage: `[Script]
W: Marcus, are you coming to the Photography Club workshop on Saturday?
M: I really wanted to, but I can't make it.
W: Oh no. Is something wrong?
M: My cousin is having a graduation ceremony that afternoon.
W: Can't you come after?
M: It's in another city, so the whole day is taken. I even booked the train tickets last week.
W: That's a shame. The workshop only happens once a year.
M: I know. I'll ask someone to take notes for me.`,
    question: '대화를 듣고, 남자가 Photography Club 워크숍에 갈 수 없는 이유를 고르시오.',
    options: [
      '학교 행사에 참가해야 해서',
      '아르바이트를 해야 해서',
      '사촌의 졸업식에 참석해야 해서',
      '기차표를 이미 취소해서',
      '몸이 좋지 않아서',
    ],
    answer: 3,
    explanation: `남자는 사촌의 졸업식이 있어 다른 도시에 가야 한다고 설명했다. 정답은 ③이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 8번: 언급되지 않은 것 ─────────────────────────────────────────────────────
  {
    domain: QuestionDomain.LISTENING,
    subCategory: '언급 안 된 것',
    difficulty: 5,
    cefrLevel: 'A2 상',
    questionNumber: 8,
    type: 'listening_not_mentioned',
    passage: `[Script]
W: Hey, did you hear about the Riverside Community Garden Festival?
M: A little. When is it?
W: It's on the last weekend of April — Saturday and Sunday.
M: What kind of activities are there?
W: There are gardening workshops, a plant swap, and a cooking demo using local vegetables.
M: Sounds fun. Is there an entry fee?
W: It's free for residents. Non-residents pay $5.
M: What about the location?
W: Riverside Central Park, near the fountain.
M: I'll definitely go!`,
    question: '대화를 듣고, Riverside Community Garden Festival에 관해 언급되지 않은 것을 고르시오.',
    options: ['날짜', '프로그램', '주최 기관', '입장료', '장소'],
    answer: 3,
    explanation: `날짜(April 마지막 주말), 프로그램(원예 워크숍, 식물 교환, 요리 시연), 입장료(주민 무료/$5), 장소(Riverside Central Park)는 언급되었으나 주최 기관은 언급되지 않았다. 정답은 ③이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 9번: 내용 불일치 ──────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.LISTENING,
    subCategory: '내용 불일치',
    difficulty: 5,
    cefrLevel: 'A2 상',
    questionNumber: 9,
    type: 'listening_mismatch',
    passage: `[Script]
M: Welcome to WKRS Morning News. The third annual Harborview International Food Fair kicks off this Thursday. The fair will run for six days, from Thursday to Tuesday of next week, at Harborview Convention Center. Visitors can enjoy food from over thirty countries, watch live cooking demonstrations, and take part in hands-on cooking classes. Children under six can enter for free, and those aged six to twelve receive a 30% discount on the general admission fee of $12. Parking at the center is free all weekend. For more information, please visit harborviewfood.com.`,
    question: '2025 Harborview International Food Fair에 관한 다음 내용을 듣고, 일치하지 않는 것을 고르시오.',
    options: [
      '6일 동안 진행된다.',
      '30개국 이상의 음식을 즐길 수 있다.',
      '6세 미만 어린이는 무료로 입장한다.',
      '6-12세 어린이는 입장료의 30% 할인을 받는다.',
      '주차는 평일에만 무료이다.',
    ],
    answer: 5,
    explanation: `지문에서 "Parking at the center is free all weekend"라고 했으므로 주말에 무료이지 평일에만 무료라는 것은 일치하지 않는다. 정답은 ⑤이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 10번: 표 일치 ───────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.LISTENING,
    subCategory: '표 일치',
    difficulty: 5,
    cefrLevel: 'A2 상',
    questionNumber: 10,
    type: 'listening_table',
    passage: `[Script]
M: Sophie, have you chosen your language learning app yet?
W: I'm looking at these five options. I want one with video lessons.
M: All of the top three have video lessons, but the cheapest is $8 a month.
W: I want to spend no more than $12 a month.
M: That narrows it to three. Do you want an offline mode?
W: Yes, definitely. I travel a lot.
M: Then it's between B and D. Does the number of languages matter?
W: I'd prefer more than ten languages.
M: Then D is the one for you.
W: Perfect, I'll go with D.`,
    chartData: {
      type: 'table',
      title: 'Language Learning Apps',
      headers: ['App', 'Price/month', 'Video Lessons', 'Offline Mode', 'Languages'],
      rows: [
        ['A', '$8', 'O', 'X', '8'],
        ['B', '$10', 'O', 'O', '9'],
        ['C', '$12', 'O', 'X', '12'],
        ['D', '$12', 'O', 'O', '15'],
        ['E', '$15', 'O', 'O', '20'],
      ],
    },
    question: '다음 표를 보면서 대화를 듣고, 여자가 선택할 앱을 고르시오.',
    options: ['① A', '② B', '③ C', '④ D', '⑤ E'],
    answer: 4,
    explanation: `$12 이하, 비디오 강의 있음, 오프라인 모드 있음, 언어 10개 초과 → D 앱이 조건을 모두 충족한다. 정답은 ④이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 11번: 여자의 응답 [3점] ─────────────────────────────────────────────────
  {
    domain: QuestionDomain.LISTENING,
    subCategory: '대화 응답',
    difficulty: 7,
    cefrLevel: 'B1 상',
    questionNumber: 11,
    type: 'listening_response',
    passage: `[Script]
W: Josh, did you order the flowers for Mom's birthday party?
M: I did, but I just got a call from the shop. They're out of pink roses.
W: Oh no. What are our options?
M: They said they can substitute with white roses or delay the order by two days.
W: Two days would be too late. What do you think about white roses?
M: I think they'd look fine. Should I confirm the substitution?
W: [WOMAN'S RESPONSE]`,
    question: '대화를 듣고, 남자의 마지막 말에 대한 여자의 응답으로 가장 적절한 것을 고르시오. [3점]',
    options: [
      "Sure, let's go with the white roses then.",
      "I'd rather postpone the whole party.",
      "Can you ask them to deliver tomorrow instead?",
      "I think we should cancel the order completely.",
      "Why don't we just buy some at the supermarket?",
    ],
    answer: 1,
    explanation: `두 가지 선택지(흰 장미 대체 vs. 2일 지연)가 주어졌고 여자는 2일 지연은 너무 늦다고 했다. 따라서 흰 장미로 대체하자는 ①이 가장 자연스럽다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 12번: 남자의 응답 ────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.LISTENING,
    subCategory: '대화 응답',
    difficulty: 5,
    cefrLevel: 'A2 상',
    questionNumber: 12,
    type: 'listening_response',
    passage: `[Script]
M: Hey, have you decided on the theme for the class reunion?
W: I'm thinking a garden party, but I'm not sure the school grounds will allow it.
M: Have you checked with the administration?
W: Not yet. Should I call them today?
M: [MAN'S RESPONSE]`,
    question: '대화를 듣고, 여자의 마지막 말에 대한 남자의 응답으로 가장 적절한 것을 고르시오.',
    options: [
      "Yes, the sooner you call, the better.",
      "I already booked the garden for us.",
      "Don't worry. The weather will be fine.",
      "Let's choose a different theme instead.",
      "I'll design the invitations right away.",
    ],
    answer: 1,
    explanation: `여자가 학교에 연락해야 하는지 묻자, 빨리 연락할수록 좋다는 ①이 가장 자연스럽다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 13번: 여자의 응답 ────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.LISTENING,
    subCategory: '대화 응답',
    difficulty: 5,
    cefrLevel: 'A2 상',
    questionNumber: 13,
    type: 'listening_response',
    passage: `[Script]
M: Excuse me, I think I left my umbrella on the bus this morning.
W: Do you remember which bus line?
M: The number 7 bus, around 8 a.m.
W: And what does the umbrella look like?
M: It's blue with a wooden handle and has a small university logo on it.
W: I see. We have a lost and found office on the second floor. Could you fill out a report form first?
M: Of course. Would it be possible to get it back today?
W: [WOMAN'S RESPONSE]`,
    question: '대화를 듣고, 남자의 마지막 말에 대한 여자의 응답으로 가장 적절한 것을 고르시오.',
    options: [
      "I'm sorry, but the lost and found is already closed.",
      "It depends on whether the driver turned it in.",
      "You should call the bus company directly.",
      "Please make sure to keep your belongings safe.",
      "We'll send it to your home address tomorrow.",
    ],
    answer: 2,
    explanation: `분실물 반환 가능 여부는 운전기사가 제출했는지에 달려 있다는 ②가 가장 자연스럽다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 14번: 남자의 응답 [3점] ─────────────────────────────────────────────────
  {
    domain: QuestionDomain.LISTENING,
    subCategory: '대화 응답',
    difficulty: 7,
    cefrLevel: 'B1 상',
    questionNumber: 14,
    type: 'listening_response',
    passage: `[Script]
W: Professor Kim, I finished revising my research paper as you suggested.
M: That was fast. Did you restructure the methodology section?
W: Yes. I also added two more case studies. Could you read it again before I submit?
M: Of course. When is the submission deadline?
W: This Friday at midnight. Is that enough time for you?
M: I have a faculty meeting Thursday afternoon, but I can read it tonight and send you feedback tomorrow morning.
W: That would be wonderful. Thank you so much.
M: [MAN'S RESPONSE]`,
    question: '대화를 듣고, 여자의 마지막 말에 대한 남자의 응답으로 가장 적절한 것을 고르시오. [3점]',
    options: [
      "No problem. Just email me the revised file.",
      "I'm afraid I won't be able to meet the deadline.",
      "You should submit the paper without my review.",
      "Let's reschedule our meeting to next week.",
      "I'll need at least three more days to read it carefully.",
    ],
    answer: 1,
    explanation: `교수는 오늘 밤 읽고 내일 피드백을 보내겠다고 했고, 이에 대한 자연스러운 다음 단계는 파일을 이메일로 보내달라는 ①이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 15번: 상황에 맞는 말 [3점] ─────────────────────────────────────────────
  {
    domain: QuestionDomain.LISTENING,
    subCategory: '상황 맞는 말',
    difficulty: 7,
    cefrLevel: 'B1 상',
    questionNumber: 15,
    type: 'listening_situation',
    passage: `[Script]
M: Olivia and her classmate Ryan are both preparing for the school's science presentation next week. Ryan tells Olivia that he is thinking of changing his topic completely because he found a more interesting subject. However, Olivia is worried because the presentation is only five days away, and switching topics now means Ryan would have to start all his research from scratch. She wants to advise him that it would be wiser to stick with his original topic and make improvements rather than starting over. In this situation, what would Olivia most likely say to Ryan?`,
    question: '다음 상황 설명을 듣고, Olivia가 Ryan에게 할 말로 가장 적절한 것을 고르시오. [3점]',
    options: [
      "I think you'd better stay with your original topic and polish it.",
      "Let's work together and finish both topics in time.",
      "You can always change the topic on the day of the presentation.",
      "A new topic sounds exciting — go for it!",
      "How about asking the teacher for a time extension?",
    ],
    answer: 1,
    explanation: `Olivia는 Ryan에게 기존 주제를 유지하고 개선하는 것이 현명하다고 조언하려 한다. 정답은 ①이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 16번: 여자가 하는 말의 주제 [16~17] ─────────────────────────────────────
  {
    domain: QuestionDomain.LISTENING,
    subCategory: '주제',
    difficulty: 5,
    cefrLevel: 'B1 하',
    questionNumber: 16,
    type: 'listening_topic',
    passage: `[Script]
W: Good afternoon, everyone. Today I'd like to talk about some surprisingly sustainable food sources that scientists are exploring to address global food security. As the world population grows, we need to look beyond conventional crops. One of the most promising options is insects. Grasshoppers and crickets, for example, are rich in protein, require very little water, and produce almost no greenhouse gases compared to traditional livestock. Another option is algae. Certain types of algae can grow rapidly in tanks and contain high levels of omega-3 fatty acids. Jellyfish, once considered a nuisance, are now being studied as a food source in coastal regions. Finally, lab-grown meat, produced from animal cells without raising a whole animal, could dramatically reduce land and water use. These alternatives may not be on our plates yet, but they could be an important part of our future diet.`,
    question: '여자가 하는 말의 주제로 가장 적절한 것은?',
    options: [
      'how to reduce food waste at home',
      'the nutritional benefits of a vegetarian diet',
      'alternative food sources to address future food shortages',
      'the environmental impact of the livestock industry',
      'new farming technologies being developed worldwide',
    ],
    answer: 3,
    explanation: `여자는 인구 증가와 식량 안보 문제를 해결하기 위한 대안 식품원(곤충, 조류, 해파리, 배양육)을 소개하고 있다. 정답은 ③이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 17번: 언급된 것이 아닌 것 ───────────────────────────────────────────────
  {
    domain: QuestionDomain.LISTENING,
    subCategory: '언급 안 된 것',
    difficulty: 5,
    cefrLevel: 'B1 하',
    questionNumber: 17,
    type: 'listening_not_mentioned',
    passage: `[스크립트 16번과 동일]`,
    question: '언급된 식품이 아닌 것은?',
    options: ['①grasshoppers', '②algae', '③jellyfish', '④lab-grown meat', '⑤soybeans'],
    answer: 5,
    explanation: `지문에서 언급된 식품은 grasshoppers(메뚜기), algae(조류), jellyfish(해파리), lab-grown meat(배양육)이고 soybeans(대두)는 언급되지 않았다. 정답은 ⑤이다.\n\n${SOURCE_LABEL}`,
  },

  // ════════════════════════════════════════════════════════════════════
  // READING 18-45번
  // ════════════════════════════════════════════════════════════════════

  // ─── 18번: 글의 목적 ─────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '글의 목적',
    difficulty: 7,
    cefrLevel: 'B1 상',
    questionNumber: 18,
    passage: `Dear Hillcrest Half Marathon Participants,

We are writing to inform you of an important update regarding the race scheduled for this Sunday. Due to a severe storm warning issued by the National Weather Service for the entire duration of the event, and after careful consultation with local emergency management officials, we have made the difficult decision to cancel this year's race. The safety of our runners, volunteers, and spectators is our highest priority. All registered participants will receive a full refund within five to seven business days. We sincerely appreciate your enthusiasm and understanding, and we look forward to seeing you at next year's event.

With gratitude,
The Hillcrest Half Marathon Organizing Committee`,
    question: '다음 글의 목적으로 가장 적절한 것은?',
    options: [
      '마라톤 경기 취소 사실을 공지하려고',
      '마라톤 경기 코스 변경을 알리려고',
      '마라톤 경기 참가 신청을 독려하려고',
      '마라톤 경기 자원봉사자를 모집하려고',
      '마라톤 경기 일정 연기를 안내하려고',
    ],
    answer: 1,
    explanation: `편지의 핵심은 폭풍 경보로 인해 마라톤 경기를 취소한다는 공지이다. 정답은 ①이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 19번: 심경 변화 ─────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '심경 변화',
    difficulty: 7,
    cefrLevel: 'B1 상',
    questionNumber: 19,
    passage: `It was their wedding anniversary, and Marcus was certain he had found the perfect gift. He had spent three weeks researching online and finally located a first edition of the poetry collection his wife, Lena, had talked about since university. He placed the order, tracked the shipment daily, and pictured the look on her face when she unwrapped it. That evening, he set the table with candles and flowers and waited. When Lena arrived home, Marcus handed her the carefully wrapped package with a wide smile. She tore open the paper — and her face fell. "Oh," she said quietly. "I already bought this for myself last month." The candles flickered as Marcus stood there, his smile slowly fading.`,
    question: '다음 글에 드러난 Marcus의 심경 변화로 가장 적절한 것은?',
    options: [
      'relaxed → indifferent',
      'confident → disappointed',
      'confused → satisfied',
      'jealous → discouraged',
      'embarrassed → joyful',
    ],
    answer: 2,
    explanation: `Marcus는 완벽한 선물을 찾았다는 자신감으로 가득 차 있다가("certain he had found the perfect gift"), 아내가 이미 샀다는 말에 실망한다("his smile slowly fading"). 정답은 ②이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 20번: 필자 주장 ─────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '필자 주장',
    difficulty: 7,
    cefrLevel: 'B1 상',
    questionNumber: 20,
    passage: `For years, educators have treated video games as a distraction — something students do instead of learning. Yet games possess a quality that textbooks rarely achieve: they create immediate, intrinsic motivation. Players set goals, persist through repeated failure, and experience genuine satisfaction upon success. The mistake is not that students play games; it is that we have not yet designed games that direct this motivation toward educational outcomes. Rather than banning games or simply tolerating them as a reward for completed work, we should invest in building games that are inseparable from the learning experience — games that make acquiring knowledge feel as compelling as advancing to the next level. When game design and curriculum design work together, the result is a student who is not just entertained, but genuinely educated.`,
    question: '다음 글에서 필자가 주장하는 바로 가장 적절한 것은?',
    options: [
      '학습 효과를 높일 수 있는 교육용 게임을 개발해야 한다.',
      '교육 현장에서 게임 활동과 학습을 균형 있게 배분해야 한다.',
      '게임이 학습 집중력에 미치는 부정적 영향을 경계해야 한다.',
      '여가 시간에 게임을 활용하여 학습 효율을 향상해야 한다.',
      '게임의 부정적 영향을 줄이기 위해 학교 공동체가 노력해야 한다.',
    ],
    answer: 1,
    explanation: `필자는 게임을 금지하는 대신 학습 목표와 연결된 게임을 개발해야 한다고 주장한다. 정답은 ①이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 21번: 밑줄 의미 [3점] ───────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '밑줄 의미',
    difficulty: 8,
    cefrLevel: 'B2 하',
    questionNumber: 21,
    passage: `In Renaissance Europe, the status of the painter was a subject of vigorous debate. Medieval guild traditions classified painters alongside craftsmen — skilled workers who produced objects to specification. Humanist scholars challenged this categorisation, arguing that painting, like poetry and mathematics, required intellectual training and creative judgment, not merely manual dexterity. Leon Battista Alberti, in his treatise On Painting, insisted that the aspiring painter must study geometry, history, rhetoric, and above all, the emotions of the human figure. Artists who confined their ambitions to technical reproduction of surfaces, he argued, were merely "tracing the outline of the shadow" — producing the form of art without its animating substance.`,
    question: '밑줄 친 "tracing the outline of the shadow"가 다음 글에서 의미하는 바로 가장 적절한 것은?',
    underline: 'tracing the outline of the shadow',
    options: [
      '예술의 역사적 전통만을 중시하는 태도',
      '지적 훈련 없이 기술적 재현에만 집중하는 행위',
      '감정을 배제하고 기하학적 형태만 추구하는 경향',
      '예술의 물질적 측면을 과도하게 강조하는 것',
      '관습적인 주제를 반복하여 독창성을 상실하는 것',
    ],
    answer: 2,
    explanation: `"tracing the outline of the shadow"는 예술의 외형(형태)만 모방하고 지적·창의적 실질(substance)이 없는 것을 뜻한다. 즉 지적 훈련 없이 기술적 재현에만 집중하는 행위이다. 정답은 ②이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 22번: 글의 요지 ─────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '글의 요지',
    difficulty: 7,
    cefrLevel: 'B1 상',
    questionNumber: 22,
    passage: `The capacity to name and categorise emotions — to distinguish frustration from disappointment, or enthusiasm from anxiety — is far more than a linguistic exercise. In workplace research, individuals with a broader emotional vocabulary consistently outperform peers on collaborative tasks. Being able to label your own internal state precisely helps regulate it: labelling reduces the intensity of negative emotion by engaging the prefrontal cortex. And being able to name the emotional state of a colleague enables a more targeted and constructive response. In conflict situations, the person who can articulate the emotional dimension of a disagreement is better positioned to build understanding and move toward resolution. Emotional literacy, in other words, is a practical intelligence that shapes the quality of relationships and the effectiveness of group work.`,
    question: '다음 글의 요지로 가장 적절한 것은?',
    options: [
      '집단 구성원 간 갈등 해소를 위해 감정 조절이 중요하다.',
      '감정 이해 능력은 집단 내 원활한 소통과 협력을 촉진한다.',
      '타인에 대한 공감 능력은 자신의 감정 표현 능력을 향상한다.',
      '감정 관련 어휘에 대한 지식은 공감 능력 발달의 기반이 된다.',
      '자신의 감정 상태에 대한 이해는 사회성 함양에 필수적 요소이다.',
    ],
    answer: 2,
    explanation: `글의 핵심은 감정 이해 능력(emotional literacy)이 직장 내 협업과 갈등 해결 등 집단 내 소통과 협력을 향상시킨다는 것이다. 정답은 ②이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 23번: 글의 주제 ─────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '글의 주제',
    difficulty: 7,
    cefrLevel: 'B1 상',
    questionNumber: 23,
    passage: `Before industrialisation, the rhythm of work followed natural cycles — daylight, seasons, and harvests determined when and how long people laboured. The steam engine and the factory system severed this ancient connection. Machinery could operate continuously, and its output was directly proportional to the hours it ran. A loom that ran sixteen hours produced twice what one running eight hours produced; the logic was inescapable. Employers who organised production around the clock extracted maximum value from expensive equipment, and labour was drawn into this mechanical rhythm. Workers began to experience time not as a natural flow but as a scarce commodity — something to be counted, sold, and optimised. The clock became the governing instrument of daily life, and the measurement of work in hours rather than tasks reshaped the entire relationship between people and their labour.`,
    question: '다음 글의 주제로 가장 적절한 것은?',
    options: [
      'the transformation of work patterns caused by industrialisation',
      'the role of the steam engine in improving workers\' rights',
      'the historical development of labour laws in industrial societies',
      'how factory owners managed worker productivity in the 19th century',
      'the negative health effects of long working hours on industrial workers',
    ],
    answer: 1,
    explanation: `글은 산업화가 노동과 시간의 관계를 어떻게 변화시켰는지를 다루고 있다. 정답은 ①이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 24번: 글의 제목 ─────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '글의 제목',
    difficulty: 7,
    cefrLevel: 'B1 상',
    questionNumber: 24,
    passage: `The selfie is frequently dismissed as a symptom of vanity, but it belongs to a far older tradition. Self-portraiture has been a vehicle of self-presentation for as long as artists have had the means to produce it: Dürer painted himself with the composure of a saint; Rembrandt traced his aging face across decades of canvases; Frida Kahlo turned her body into political statement. What changed with the smartphone is not the impulse — to control and project an image of oneself — but the accessibility. Suddenly, self-portraiture was no longer the privilege of those with access to pigments, studios, or patrons. The selfie democratised a practice that was once the exclusive domain of the trained or the wealthy, extending participation in visual self-narrative to billions of ordinary people and making it the signature cultural gesture of the connected age.`,
    question: '다음 글의 제목으로 가장 적절한 것은?',
    options: [
      'Are Selfies Just a Temporary Trend in Art History?',
      'Fantasy or Reality: Why Your Selfie Lies to You',
      'Self-Portrait to Selfie: Democracy in Visual Self-Expression',
      'The End of Fine Art: How Social Media Changed Painting',
      'Why Narcissism Is on the Rise in the Digital Age',
    ],
    answer: 3,
    explanation: `글은 자화상의 오랜 역사를 소개하고 셀피가 자기 표현을 민주화했다는 것을 주제로 한다. 정답은 ③이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 25번: 도표 일치 ─────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '도표 일치',
    difficulty: 7,
    cefrLevel: 'B1 상',
    questionNumber: 25,
    passage: `The graph above shows the percentage of women in four behind-the-scenes roles on the top 100 domestic films in three consecutive years. In each of the three years, producers accounted for the largest share of women in the four roles shown. The share of women directors fell between the first and second year, then fell again in the third year. Women writers increased their share by 4 percentage points from the first to the second year, and by an additional 2 percentage points in the third year. The share of women editors remained below 20% in all three years. In the third year, the share of women producers was 3 percentage points lower than in the first year.`,
    chartData: {
      type: 'line_bar',
      title: 'Women in Behind-the-Scenes Roles on Top 100 Films (%)',
      roles: ['Producers', 'Directors', 'Writers', 'Editors'],
      years: ['Year 1', 'Year 2', 'Year 3'],
      data: {
        Producers: [34, 36, 31],
        Directors: [16, 13, 11],
        Writers: [19, 23, 25],
        Editors: [18, 17, 19],
      },
    },
    question: '다음 도표의 내용과 일치하지 않는 것은?',
    options: [
      '세 해 모두 프로듀서 비율이 네 역할 중 가장 높았다.',
      '여성 감독 비율은 첫 번째 해에서 두 번째 해 사이에 감소했다.',
      '여성 작가 비율은 첫 해에서 2년차까지 4%p, 3년차까지 추가 2%p 증가했다.',
      '여성 편집자 비율은 세 해 모두 20% 미만이었다.',
      '3년차에 여성 프로듀서 비율은 1년차보다 높았다.',
    ],
    answer: 5,
    explanation: `도표에서 3년차 프로듀서 비율(31%)은 1년차(34%)보다 3%p 낮으므로 ⑤ "3년차에 여성 프로듀서 비율은 1년차보다 높았다"는 일치하지 않는다. 정답은 ⑤이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 26번: 인물 정보 불일치 ──────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '인물 정보 불일치',
    difficulty: 7,
    cefrLevel: 'B1 상',
    questionNumber: 26,
    passage: `Frank Dawson was one of the most respected sports commentators of his generation. Born in Ohio in 1941, he showed an early aptitude for broadcasting. In the late 1960s, he joined a regional television station as a junior reporter before transitioning into sports commentary. In 1975, he became the first American broadcaster to cover a major league baseball series from all seven stadiums in a single season. He joined National Sports Broadcasting in 1980 and remained with the network for approximately twenty years, covering numerous Olympic Games and World Cup tournaments. He received the Broadcaster's Excellence Award on four separate occasions. Dawson also authored two bestselling memoirs and made his final live broadcast in 2018, passing away the following year at age 78.`,
    question: 'Frank Dawson에 관한 다음 글의 내용과 일치하지 않는 것은?',
    options: [
      'Ohio에서 태어났다.',
      '지역 텔레비전 방송국에서 기자로 일했다.',
      '첫 번째 미국인 야구 전 구장 중계 기록을 세웠다.',
      '마지막 생방송 이후 2년 뒤에 사망하였다.',
      'Broadcaster\'s Excellence Award를 수상하였다.',
    ],
    answer: 4,
    explanation: `본문에서 그는 2018년 마지막 생방송을 했고 "the following year"(이듬해)에 사망했다. 따라서 ④ "2년 뒤에 사망"은 일치하지 않는다. 정답은 ④이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 27번: 안내문 불일치 ──────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '안내문 불일치',
    difficulty: 7,
    cefrLevel: 'B1 상',
    questionNumber: 27,
    passage: `Lakefield City Explorer Pass

The Lakefield City Explorer Pass is a public transportation card designed for visitors to Lakefield.

Service Coverage
• All Lakefield metro lines
• City-licensed bus routes
※ This pass cannot be used on airport express trains.

Pass Options
Type | Price | Discount Benefit
1-Day | $12 | 10% off major attractions
3-Day | $28 | 10% off major attractions
7-Day | $45 | 10% off major attractions

※ Unused passes may be refunded within 21 days of the purchase date.

How to Purchase
• Physical passes: available at all metro station kiosks
• Digital passes: available through the CityGo mobile application`,
    question: 'Lakefield City Explorer Pass에 관한 다음 안내문의 내용과 일치하지 않는 것은?',
    options: [
      '관광객을 위한 대중교통 카드이다.',
      '공항 급행열차에는 사용할 수 없다.',
      '모든 패스 유형에 주요 관광지 10% 할인 혜택이 제공된다.',
      '미사용 패스는 구입일로부터 21일 이내에 환불이 가능하다.',
      '실물 카드는 CityGo 앱에서만 구입할 수 있다.',
    ],
    answer: 5,
    explanation: `본문에서 실물 패스는 "metro station kiosks"에서, 디지털 패스는 "CityGo 앱"에서 구입할 수 있다고 했다. ⑤의 "실물 카드는 CityGo 앱에서만 구입할 수 있다"는 일치하지 않는다. 정답은 ⑤이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 28번: 안내문 일치 ────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '안내문 일치',
    difficulty: 7,
    cefrLevel: 'B1 상',
    questionNumber: 28,
    passage: `Maplewood Winter Lantern Festival

We are delighted to announce the 15th annual Maplewood Winter Lantern Festival!

Schedule
• Dates: February 1–7 (7 days), 5 p.m. – 10 p.m.
• Location: Maplewood Riverside Park

Featured Events
• Lantern Parade: 12 community groups will participate.
• Ice Sculpture Display: view award-winning sculptures from regional artists.
• Children's Lantern Workshop: held daily at 5:30 p.m. (limited seats)

Transportation
• No on-site parking available. Please use public transport.
• Shuttle service from Maplewood Station to the park (Round-trip fare: $2, exact change required).

※ Visit www.maplewoodfestival.org for the full schedule.`,
    question: 'Maplewood Winter Lantern Festival에 관한 다음 안내문의 내용과 일치하는 것은?',
    options: [
      '격년으로 개최된다.',
      '열흘 동안 진행된다.',
      '등롱 퍼레이드에는 12개 단체가 참가한다.',
      '현장 주차가 가능하다.',
      '셔틀버스 이용은 무료이다.',
    ],
    answer: 3,
    explanation: `① 매년 개최됨(15th annual). ② 7일간 진행. ③ "12 community groups will participate" 일치. ④ 현장 주차 불가. ⑤ 왕복 $2. 정답은 ③이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 29번: 어법 ──────────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.GRAMMAR,
    subCategory: '어법',
    difficulty: 7,
    cefrLevel: 'B1 상',
    questionNumber: 29,
    passage: `Consider how you tie your shoelaces. You ①had learned this skill consciously, step by step, years ago. Now, however, your fingers complete the sequence ②automatically while your mind is free to think about something else entirely. This delegation of routine tasks to the brain's lower processing centres is what allows higher thought ③to occur. Patients recovering from injuries ④affecting the basal ganglia ― the region that manages these habitual routines ― often describe the exhausting experience of having to consciously direct every movement of daily life, from lifting a fork to ⑤opening a door. Most of us never appreciate this invisible gift.`,
    question: '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?',
    underlines: ['①had learned', '②automatically', '③to occur', '④affecting', '⑤opening'],
    options: ['①', '②', '③', '④', '⑤'],
    answer: 1,
    explanation: `① "had learned"는 과거완료이지만 "years ago"와 함께 단순과거 "learned"가 옳다. 나머지는 어법상 모두 적절하다. 정답은 ①이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 30번: 어휘 [3점] ─────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.VOCABULARY,
    subCategory: '어휘',
    difficulty: 8,
    cefrLevel: 'B2 하',
    questionNumber: 30,
    passage: `Research on competitive settings has identified a consistent paradox: the presence of external rewards can ①undermine intrinsic motivation. When individuals compete for prizes, they often experience an ②inevitable tension between the desire to win and the desire to maintain positive relationships with those they are competing against. Competitors who care about being liked by their rivals may unconsciously ③reduce their effort to avoid the discomfort of surpassing others. Studies also suggest that performing well in front of peers who are worse-off triggers feelings of guilt — an emotion that, counter-intuitively, leads to ④stronger effort and higher achievement in competitive tasks. This emotional complexity helps explain why competitive environments produce such variable results, with some individuals thriving and others ⑤withdrawing from the challenge.`,
    question: '다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은? [3점]',
    underlines: ['①undermine', '②inevitable', '③reduce', '④stronger', '⑤withdrawing'],
    options: ['①', '②', '③', '④', '⑤'],
    answer: 4,
    explanation: `④ "stronger" 앞 문장에서 죄책감은 반직관적으로 더 강한 노력으로 이어진다고 했는데, 문맥상 이는 실제로는 경쟁 목표 추구 동기를 약화시키는 내용이어야 한다. 따라서 "stronger"는 "weaker"로 바뀌어야 문맥에 맞다. 정답은 ④이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 31번: 빈칸 ──────────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '빈칸',
    difficulty: 8,
    cefrLevel: 'B2 하',
    questionNumber: 31,
    passage: `Fiction offers something that language textbooks cannot: the opportunity for __________. A grammar exercise teaches rules; a novel draws the learner into a living world where rules operate invisibly. As the story unfolds, the reader's attention shifts from the code itself to the human realities the code conveys. Characters become familiar, their concerns feel urgent, and the language that carries them becomes, in a sense, transparent — no longer an obstacle to meaning but its vehicle. Learners who are drawn into a narrative in this way begin to absorb the rhythms and patterns of the language without consciously studying them, much as a child acquires a mother tongue through immersion in its use rather than through explicit instruction.`,
    question: '다음 빈칸에 들어갈 말로 가장 적절한 것은?',
    options: [
      'linguistic insight',
      'artistic imagination',
      'literary sensibility',
      'alternative perspective',
      'personal involvement',
    ],
    answer: 5,
    explanation: `빈칸 뒤에서 소설은 학습자가 이야기 속으로 빨려들어 언어를 무의식적으로 흡수하게 만든다고 설명한다. 이는 '개인적 몰입(personal involvement)'에 해당한다. 정답은 ⑤이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 32번: 빈칸 [3점] ────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '빈칸',
    difficulty: 8,
    cefrLevel: 'B2 하',
    questionNumber: 32,
    passage: `Critical thinking, properly understood, is not a set of logical tools applied from the outside to a problem. It is a disposition — an internal orientation that __________. Living by instinct and immediate emotion is, in many respects, effortless; thought is hard, particularly for those unaccustomed to it. But the short-term ease of heuristic responses carries a long-term cost. Just as habitual consumption of nutritionally empty food depletes physical resilience over time, habitual reliance on unconsidered reaction depletes the mind's capacity to distinguish short-term satisfaction from genuine wellbeing. Education, at its best, cultivates the habit of pausing: of inserting a moment of reflection between stimulus and response. This pause, modest as it seems, is what separates reactive from truly deliberate life.`,
    question: '다음 빈칸에 들어갈 말로 가장 적절한 것은? [3점]',
    options: [
      'intensifies people\'s instinctive responses to difficulty',
      'enhances understanding of others\' perspectives',
      'frees a person from the burden of stimulus-driven reaction',
      'allows one to accept the inevitability of emotional decisions',
      'requires extensive prior experience to develop effectively',
    ],
    answer: 3,
    explanation: `빈칸은 비판적 사고가 즉각적 반응(stimulus-driven reaction)에서 벗어나게 해준다는 내용이어야 한다. 정답은 ③이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 33번: 빈칸 [3점] ────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '빈칸',
    difficulty: 8,
    cefrLevel: 'B2 하',
    questionNumber: 33,
    passage: `We live inside what economists call the attention economy, and the largest companies in the world compete not for our money but for our hours. The social media platforms, streaming services, and search engines that dominate daily life are offered without charge, but the exchange is rarely made explicit to users. When a product is presented as free, the question of who is actually paying for it — and why — tends to go unasked. But the business model is straightforward: your patterns of attention, desire, and social connection are continuously harvested, packaged, and sold to advertisers and, increasingly, to political actors. In this arrangement, __________. You are not the customer; you are the inventory. [3점]`,
    question: '다음 빈칸에 들어갈 말로 가장 적절한 것은? [3점]',
    options: [
      'all of your attention has already been spent',
      'you are the real product being sold',
      'your privacy is being legally protected',
      'the public ultimately benefits from free services',
      'you owe the platform a debt of gratitude',
    ],
    answer: 2,
    explanation: `"You are not the customer; you are the inventory"라는 다음 문장이 힌트이다. 무료 서비스에서 실제로 팔리는 것은 이용자 자신이라는 의미이다. 정답은 ②이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 34번: 빈칸 [3점] ────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '빈칸',
    difficulty: 8,
    cefrLevel: 'B2 하',
    questionNumber: 34,
    passage: `It is tempting to think of formal rules as constraints — barriers that prevent people from doing what they would otherwise choose. But this view misses the more fundamental function that rules perform: they __________. A road traffic code does not merely restrict driving; it makes the practice of driving safely alongside strangers possible. Contract law does not merely bind parties to their promises; it creates the conditions under which complex economic cooperation can occur. Without the rules that constitute professional licensing, neither the role of physician nor that of barrister could exist. Rules, in this sense, are generative rather than merely restrictive. They bring social practices into existence and sustain them, making possible forms of human cooperation and achievement that would otherwise be inaccessible. [3점]`,
    question: '다음 빈칸에 들어갈 말로 가장 적절한 것은? [3점]',
    options: [
      'categorise patterns of conduct in legally binding ways',
      'lead people to question the legitimacy of existing institutions',
      'promote creative solutions to problems in bureaucratic systems',
      'reinforce individual behaviour within established social norms',
      'make productive social practices and roles possible',
    ],
    answer: 5,
    explanation: `글은 규칙이 단순히 제약하는 것이 아니라 사회적 관행과 역할을 가능하게 한다는 것을 주장한다. 정답은 ⑤이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 35번: 무관 문장 ─────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '무관 문장',
    difficulty: 8,
    cefrLevel: 'B2 하',
    questionNumber: 35,
    passage: `The rise of adventure tourism during the late twentieth century was closely linked to improvements in private transportation. ① As roads extended into previously inaccessible mountain and coastal regions, travellers who sought active outdoor experiences could reach them far more easily than before. ② The personal vehicle, in particular, offered both the flexibility to stop and explore spontaneously and the capacity to carry the specialist equipment that hiking, climbing, and water sports demand. ③ The rapid growth of budget airlines in the same period further increased access to international destinations, transforming long-haul adventure travel into a mainstream pursuit. ④ The expansion of roadside accommodation chains during this period made it more affordable to stay close to natural attractions, directly supporting the growth of locally based restaurants and hospitality services. ⑤ Without these transportation changes, the remote landscapes that define adventure tourism would have remained effectively out of reach for most ordinary travellers.`,
    question: '다음 글에서 전체 흐름과 관계없는 문장은?',
    options: ['①', '②', '③', '④', '⑤'],
    answer: 4,
    explanation: `전체 글은 교통 발전이 어드벤처 관광의 성장에 미친 영향을 다루고 있다. ④는 숙박 시설과 지역 식당 및 서비스업의 성장을 언급하는 내용으로 교통 발전과 어드벤처 관광의 직접적 연결과 무관하다. 정답은 ④이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 36번: 글의 순서 ─────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '글의 순서',
    difficulty: 8,
    cefrLevel: 'B2 하',
    questionNumber: 36,
    passage: `In long-term contractual relationships, informal reputation mechanisms can substitute for costly legal enforcement.

(A) Similarly, a tenant who consistently fails to report maintenance problems or who causes repeated damage to the property will find that this reputation travels among landlords operating in the same area, reducing their future rental options.

(B) Over time, landlords monitor tenants informally by observing payment reliability, property care, and how disputes are handled. A tenant's track record functions as a kind of security deposit that does not expire.

(C) Landlords and tenants develop reputations for dependability, transparency, and fair dealing. In tight urban rental markets, these reputations circulate through networks of agents and past tenants and can be decisive in whether a new tenancy is granted.`,
    question: '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?',
    introPassage: 'In long-term contractual relationships, informal reputation mechanisms can substitute for costly legal enforcement.',
    paragraphs: {
      A: 'Similarly, a tenant who consistently fails to report maintenance problems or who causes repeated damage to the property will find that this reputation travels among landlords operating in the same area, reducing their future rental options.',
      B: 'Over time, landlords monitor tenants informally by observing payment reliability, property care, and how disputes are handled. A tenant\'s track record functions as a kind of security deposit that does not expire.',
      C: 'Landlords and tenants develop reputations for dependability, transparency, and fair dealing. In tight urban rental markets, these reputations circulate through networks of agents and past tenants and can be decisive in whether a new tenancy is granted.',
    },
    options: [
      '(A) – (B) – (C)',
      '(B) – (C) – (A)',
      '(C) – (A) – (B)',
      '(C) – (B) – (A)',
      '(B) – (A) – (C)',
    ],
    answer: 4,
    explanation: `도입문에서 평판 메커니즘을 소개한다. (C)에서 임대인·임차인 양측이 평판을 형성하는 방식을 설명하고, (B)에서 임대인이 임차인을 비공식적으로 모니터링하는 방식을 설명하며, (A)에서 나쁜 평판의 결과를 구체적 사례로 제시한다. 정답은 ④ (C)-(B)-(A)이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 37번: 글의 순서 [3점] ───────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '글의 순서',
    difficulty: 8,
    cefrLevel: 'B2 하',
    questionNumber: 37,
    passage: `Stand at the edge of a flock of starlings in flight. If one bird at the centre suddenly changes direction, the response radiates outward through the flock in less than a second — far faster than any individual bird could consciously observe and react to its neighbour. This is social contagion in action.

(A) A researcher studying starling murmurations noted that birds at the perimeter of the flock, who had fewer immediate neighbours, changed direction later and less precisely than those at the dense core, where each individual had more contact points transmitting the directional signal.

(B) In a series of computer simulations, teams modelled the effect of network density on the speed and fidelity of signal propagation. They found that tightly connected individuals transmitted change faster and with less distortion than loosely connected ones.

(C) The birds at the perimeter also made more independent direction corrections — minor idiosyncratic movements not shared by the rest — suggesting that reduced connectivity not only slowed their response but introduced a degree of individual noise that weakened the collective coherence of the murmuration. [3점]`,
    question: '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은? [3점]',
    introPassage: 'Stand at the edge of a flock of starlings in flight. If one bird at the centre suddenly changes direction, the response radiates outward through the flock in less than a second...',
    paragraphs: {
      A: "A researcher studying starling murmurations noted that birds at the perimeter of the flock, who had fewer immediate neighbours, changed direction later and less precisely than those at the dense core...",
      B: "In a series of computer simulations, teams modelled the effect of network density on the speed and fidelity of signal propagation. They found that tightly connected individuals transmitted change faster...",
      C: "The birds at the perimeter also made more independent direction corrections — minor idiosyncratic movements not shared by the rest — suggesting that reduced connectivity not only slowed their response but introduced a degree of individual noise...",
    },
    options: [
      '(A) – (B) – (C)',
      '(A) – (C) – (B)',
      '(B) – (A) – (C)',
      '(B) – (C) – (A)',
      '(C) – (A) – (B)',
    ],
    answer: 3,
    explanation: `도입문이 사회적 전염(social contagion) 현상을 소개한다. (B)에서 컴퓨터 시뮬레이션으로 네트워크 밀도의 영향을 설명하고, (A)에서 실제 찌르레기 군무 연구 사례로 구체화하며, (C)에서 주변부 새들의 추가적 문제(개별적 방향 수정)로 결론짓는다. 정답은 ③ (B)-(A)-(C)이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 38번: 문장 삽입 [3점] ───────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '문장 삽입',
    difficulty: 8,
    cefrLevel: 'B2 하',
    questionNumber: 38,
    passage: `Trade secret protection and patent protection represent two distinct approaches to encouraging innovation. ( ① ) Patent law grants a temporary monopoly in exchange for full public disclosure of the invention; trade secret law protects information that is kept confidential, with no requirement of disclosure and no fixed expiry date. ( ② ) Many innovators prefer trade secret protection precisely because it can last indefinitely, whereas a patent expires after a set number of years and then passes into the public domain. ( ③ ) They may also believe that the cost and complexity of the patent application process outweigh its benefits, particularly when the invention is difficult for competitors to reverse-engineer. ( ④ ) However, this preference for secrecy comes with a significant vulnerability: without legal protection, a single act of disclosure by a disloyal employee or contractor can eliminate the advantage entirely. ( ⑤ ) Trade secret law exists to provide a remedy in such situations, making it possible for innovators to pursue a secrecy strategy without accepting unlimited risk.`,
    question: '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은? [3점]',
    insertSentence: 'Without any special legal protection, however, the innovator who relies on secrecy faces the constant risk that confidential information will be disclosed.',
    options: ['①', '②', '③', '④', '⑤'],
    answer: 4,
    explanation: `④ 앞 문장은 비밀 보호를 선호하는 이유를 설명하고, 삽입 문장은 법적 보호 없이는 기밀 공개 위험이 있다는 전환점을 제시한다. ⑤에서 영업비밀법이 이를 해결한다고 마무리된다. 정답은 ④이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 39번: 문장 삽입 ─────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '문장 삽입',
    difficulty: 8,
    cefrLevel: 'B2 하',
    questionNumber: 39,
    passage: `Scholars of material culture have long approached objects through the lens of the lifecycle — acquisition, use, and disposal forming a neat linear progression. ( ① ) This framework captures something real about the typical trajectory of manufactured goods, but it distorts more than it clarifies. ( ② ) Objects constantly escape this script: they are repaired, passed on, stored, rediscovered, repurposed, and recycled in ways that give them histories far more tangled than any single linear sequence can represent. ( ③ ) Critics of the lifecycle model point out that it treats disposal as an endpoint when, in reality, it is often merely a transition — a shift of ownership, context, or use. ( ④ ) A piece of furniture donated to a charity shop enters a second life; a broken appliance kept in a garage may eventually be repaired or cannibalised for parts. ( ⑤ ) Understanding objects as participants in dynamic, non-linear histories rather than as items passing through fixed stages opens new ways of thinking about ownership, value, and sustainability.`,
    question: '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?',
    insertSentence: 'In reality, the actual biography of most objects bears little resemblance to this tidy progression.',
    options: ['①', '②', '③', '④', '⑤'],
    answer: 2,
    explanation: `① 뒤에서 lifecycle 프레임이 "something real"을 포착하지만 왜곡한다고 했으므로, 삽입 문장("실제 객체의 전기는 이 깔끔한 진행과 거의 다르다")은 ②에 위치해 이 전환을 설명하기에 적합하다. 정답은 ②이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 40번: 요약 완성 ─────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '요약 완성',
    difficulty: 8,
    cefrLevel: 'B2 하',
    questionNumber: 40,
    passage: `The public tends to regard synthetic food additives as inherently riskier than natural ingredients, yet this intuition is not well supported by evidence. Synthetic compounds are produced under controlled conditions that allow precise specification of their composition and purity, enabling rigorous safety testing. Natural food ingredients, by contrast, are highly variable: their chemical profiles shift with growing region, season, soil conditions, and storage method. A plant extract consumed for centuries without observable ill effect may carry trace compounds whose concentrations vary unpredictably and whose long-term effects at high doses remain poorly characterised. The naturalness of an ingredient is not, in itself, a reliable guide to its safety, and the assumption that it is can lead regulators and consumers alike to underestimate genuine risks.`,
    question: '다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?',
    summary: 'The (A) __________ of synthetic food additives and the (B) __________ of natural ingredients challenge the common assumption that natural products are inherently safer.',
    options: [
      { A: 'controllability', B: 'variability' },
      { A: 'predictability', B: 'affordability' },
      { A: 'controllability', B: 'availability' },
      { A: 'manageability', B: 'sustainability' },
      { A: 'accessibility', B: 'popularity' },
    ],
    answer: 1,
    explanation: `합성 첨가물의 '통제 가능성(controllability)'과 천연 원료의 '가변성(variability)'이 천연 = 안전하다는 통념에 도전한다는 내용이다. 정답은 ①이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 41번: 장문 제목 (41·42 공유 지문) ──────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '장문 제목',
    difficulty: 8,
    cefrLevel: 'B2 하',
    questionNumber: 41,
    linkedPassage: 'holsu2025_long1',
    passage: LONG_PASSAGE_1,
    question: '윗글의 제목으로 가장 적절한 것은?',
    options: [
      'Anatomical Distance Between Humans and Other Primates',
      'Human Hands: A Decisive Leap in the Evolutionary Path',
      'Our Hands: An Unexpected Outcome of Random Mutation',
      'The Precision Grip: A Dilemma of Modern Humans',
      'Hidden Power of Everyday Tool Use',
    ],
    answer: 2,
    explanation: `지문 전체는 정밀 파지 능력이 인간 진화에서 결정적 도약이었음을 주장한다. 정답은 ②이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 42번: 장문 어휘 ─────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.VOCABULARY,
    subCategory: '어휘',
    difficulty: 8,
    cefrLevel: 'B2 하',
    questionNumber: 42,
    linkedPassage: 'holsu2025_long1',
    passage: LONG_PASSAGE_1_ANNOTATED,
    question: '밑줄 친 (a)~(e) 중에서 문맥상 낱말의 쓰임이 적절하지 않은 것은? [3점]',
    underlines: ['(a)trivial', '(b)parallel', '(c)transformed', '(d)severed', '(e)obstacle'],
    options: ['(a)', '(b)', '(c)', '(d)', '(e)'],
    answer: 5,
    explanation: `(e) "obstacle"(장애물)은 문맥상 부적절하다. 앞 문장들은 정밀 파지 능력이 인간 문명을 가능하게 한 핵심 요소임을 주장하므로, "obstacle" 대신 "foundation"(기반) 또는 "key"(열쇠)가 적절하다. 정답은 ⑤이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 43번: 장문 순서 (43·44·45 공유 지문) ────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '장문 독해',
    difficulty: 8,
    cefrLevel: 'B2 하',
    questionNumber: 43,
    linkedPassage: 'holsu2025_long2',
    passage: LONG_PASSAGE_2,
    question: '주어진 글 (A)에 이어질 내용을 순서에 맞게 배열한 것으로 가장 적절한 것은?',
    options: [
      '(B) – (C) – (D)',
      '(B) – (D) – (C)',
      '(C) – (B) – (D)',
      '(C) – (D) – (B)',
      '(D) – (B) – (C)',
    ],
    answer: 3,
    explanation: `(A): David와 Helen이 재킷 찾으러 가기로 함. (C): 세탁소에서 재킷 회수. (B): 집에 돌아와 준비하고 Clara를 설득. (D): 식물원에서 감동적인 대화. 순서는 (C)-(B)-(D). 정답은 ③이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 44번: 장문 지칭 ─────────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '장문 독해',
    difficulty: 8,
    cefrLevel: 'B2 하',
    questionNumber: 44,
    linkedPassage: 'holsu2025_long2',
    passage: LONG_PASSAGE_2,
    question: '밑줄 친 (a)~(e) 중에서 가리키는 대상이 나머지 넷과 다른 것은?',
    underlines: ['(a)his', '(b)him', '(c)she', '(d)him', '(e)you'],
    options: ['①(a)', '②(b)', '③(c)', '④(d)', '⑤(e)'],
    answer: 3,
    explanation: `(a) David의 딸 = Clara, (b) him = David, (c) she agreed = Clara ← 나머지와 다름, (d) him = David, (e) you = David. ③ (c)만 Clara를 가리키고 나머지는 David를 가리킨다. 정답은 ③이다.\n\n${SOURCE_LABEL}`,
  },

  // ─── 45번: 장문 내용 일치 ────────────────────────────────────────────────────
  {
    domain: QuestionDomain.READING,
    subCategory: '장문 독해',
    difficulty: 8,
    cefrLevel: 'B2 하',
    questionNumber: 45,
    linkedPassage: 'holsu2025_long2',
    passage: LONG_PASSAGE_2,
    question: '윗글에 관한 내용으로 적절하지 않은 것은?',
    options: [
      'Helen은 David와 Clara의 관계가 예전에는 매우 가까웠다고 말했다.',
      'Helen은 David에게 Clara와 단둘이 식물원을 방문할 것을 제안했다.',
      'Clara의 등산화가 옷장에서 발견되었다.',
      'David는 혼자 세탁소에 재킷을 찾으러 갔다.',
      'Clara는 처음에 주말 계획이 있다고 했다.',
    ],
    answer: 4,
    explanation: `본문에서 "David asked Helen to come with him to pick them up" — David는 Helen과 함께 세탁소에 갔다. ④ "혼자 갔다"는 일치하지 않는다. 정답은 ④이다.\n\n${SOURCE_LABEL}`,
  },
]

async function main() {
  console.log('기존 holsu2025 데이터 삭제 중...')

  const existing = await prisma.question.findMany({
    where: {
      academyId: null,
      contentJson: { path: ['grade'], equals: 'holsu2025' },
    },
    select: { id: true },
  })

  if (existing.length > 0) {
    await prisma.question.deleteMany({ where: { id: { in: existing.map((q) => q.id) } } })
    console.log(`  → ${existing.length}개 삭제 완료\n`)
  } else {
    console.log('  → 삭제할 기존 데이터 없음\n')
  }

  console.log('2025 수능 영어 홀수형 유사문제 시드 데이터 등록 시작...')
  console.log(`총 ${questions.length}개 문제 처리 예정\n`)

  const letters = ['A', 'B', 'C', 'D', 'E']
  let created = 0

  for (const q of questions) {
    type Q = typeof q & Record<string, unknown>
    const qr = q as Q

    const correctAnswer = letters[(q.answer as number) - 1] ?? 'A'

    const contentJson: Record<string, unknown> = {
      type: 'multiple_choice',
      questionNumber: q.questionNumber,
      grade: 'holsu2025',
      passage: q.passage,
      question_text: q.question,
      options: q.options,
      correct_answer: correctAnswer,
      explanation: q.explanation,
    }

    if (qr.type) contentJson.listeningType = qr.type
    if (qr.underline) contentJson.underline = qr.underline
    if (qr.underlines) contentJson.underlines = qr.underlines
    if (qr.insertSentence) contentJson.insertSentence = qr.insertSentence
    if (qr.introPassage) contentJson.introPassage = qr.introPassage
    if (qr.paragraphs) contentJson.paragraphs = qr.paragraphs
    if (qr.chartData) contentJson.chartData = qr.chartData
    if (qr.summary) contentJson.summary = qr.summary
    if (qr.linkedPassage) contentJson.linkedPassage = qr.linkedPassage

    await prisma.question.create({
      data: {
        domain: q.domain,
        subCategory: q.subCategory,
        difficulty: q.difficulty,
        cefrLevel: q.cefrLevel,
        source: QuestionSource.SYSTEM,
        isVerified: true,
        isActive: true,
        academyId: null,
        contentJson,
        statsJson: { timesUsed: 0, avgScore: null },
      },
    })

    console.log(`✅  ${q.questionNumber}번 (${q.subCategory}) — 등록 완료`)
    created++
  }

  console.log(`\n───────────────────────────────`)
  console.log(`완료: ${created}개 생성`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
