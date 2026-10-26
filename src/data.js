// Tribes, questions and seed data. Single source of truth: the client gets this via GET /api/config.

export const TRIBES = {
  red: {
    label: "Red", color: "#FF2D3D", ink: "#FFFFFF",
    name: "Sunrise Sweat",
    tagline: "Runs, lifts, rides. The workout is the excuse. The crew is the point.",
    ritual: "Saturday 8am · easy 5K · meet at Sugar Beach",
    prompts: [
      "What's the most pointless physical thing you're proud of?",
      "What sport did you play back home that nobody here has heard of?",
      "Pick a date in the next two weeks. Who's in?",
    ],
  },
  orange: {
    label: "Orange", color: "#FF8A00", ink: "#1A0E00",
    name: "The Long Table",
    tagline: "Cooks, hosts, eaters. Food from home tastes better shared.",
    ritual: "Last Sunday of the month · potluck · bring a dish from home",
    prompts: [
      "What dish from home have you failed to recreate here?",
      "Where in Toronto actually tastes like home?",
      "Who's hosting the first potluck, and what are you bringing?",
    ],
  },
  yellow: {
    label: "Yellow", color: "#FFD60A", ink: "#1A1600",
    name: "Night Builders",
    tagline: "Side projects, hacks, half-finished ideas. Ship something nobody asked for.",
    ritual: "Thursdays 7pm · build night · bring a laptop",
    prompts: [
      "What's the side project you never finished?",
      "What would you build with one free month?",
      "What could this group ship by next Thursday?",
    ],
  },
  green: {
    label: "Green", color: "#22D46B", ink: "#00180A",
    name: "Trailheads",
    tagline: "Hikers, wanderers, explorers. Out of the city, into the quiet.",
    ritual: "Next Sunday 10am · hike the Rouge · carpool from Kennedy",
    prompts: [
      "Most beautiful place you've found since moving here?",
      "Which landscape from home do you miss the most?",
      "Rouge, Don Valley or Scarborough Bluffs: which one first?",
    ],
  },
  cyan: {
    label: "Cyan", color: "#18C8F5", ink: "#00161C",
    name: "Game Night",
    tagline: "Board games, video games, rec leagues. Friendly rivalries, unfriendly scorekeeping.",
    ritual: "Friday 7pm · board game night · Snakes & Lattes Annex",
    prompts: [
      "What game from your childhood would you teach this group?",
      "Most competitive you've ever been about something stupid?",
      "Which game first, and who's bringing it?",
    ],
  },
  blue: {
    label: "Blue", color: "#2F5BFF", ink: "#FFFFFF",
    name: "The Deep End",
    tagline: "Readers, thinkers, long talkers. Skip the small talk.",
    ritual: "Every other Sunday · walk & talk · High Park, 11am",
    prompts: [
      "What changed your mind about something this year?",
      "What do you understand about home now that you've left it?",
      "One book everyone here should read?",
    ],
  },
  purple: {
    label: "Purple", color: "#9B3BFF", ink: "#FFFFFF",
    name: "The Studio",
    tagline: "Music, art, photos, words. Make things and show each other.",
    ritual: "First Wednesday · open studio · bring whatever you make",
    prompts: [
      "What did you make back home that you stopped making here?",
      "Show us something you made. It's on your phone, we know.",
      "What could this group make by the end of the month?",
    ],
  },
  pink: {
    label: "Pink", color: "#FF4FB3", ink: "#22000F",
    name: "The Porch",
    tagline: "Hosts, dancers, connectors. Everyone's welcome. Bring one more.",
    ritual: "First Friday · social night · everyone brings one new person",
    prompts: [
      "Who was the first person who made Toronto feel like home?",
      "What tradition from home should we steal?",
      "Where do we go first, and who are you bringing?",
    ],
  },
};

export const TRIBE_KEYS = Object.keys(TRIBES);

export const OPENER = "Go around: name, where's home, and the moment Toronto first felt like home (or hasn't yet).";

// w = points per tribe. bit = phrase for the fallback one-line story (first three questions only).
export const QUESTIONS = [
  {
    q: "Saturday, 8am. Where are we finding you?",
    options: [
      { e: "🏃", t: "Already mid-run", w: { red: 2, green: 1 }, bit: "are mid-run by 8am on Saturdays" },
      { e: "🥘", t: "At the market, planning a feast", w: { orange: 2, pink: 1 }, bit: "spend Saturday mornings planning feasts" },
      { e: "😴", t: "Asleep. Game night went late.", w: { cyan: 2, pink: 1 }, bit: "sleep off Friday game night" },
      { e: "☕", t: "Coffee, a book, a quiet corner", w: { blue: 2, purple: 1 }, bit: "guard your Saturday coffee-and-book hour" },
    ],
  },
  {
    q: "You lose track of time when you're…",
    options: [
      { e: "🛠️", t: "Building something that doesn't exist yet", w: { yellow: 2, cyan: 1 }, bit: "building things that don't exist yet" },
      { e: "🎨", t: "Making music, art, anything creative", w: { purple: 2, yellow: 1 }, bit: "making music and art" },
      { e: "🌲", t: "Outside, somewhere with no signal", w: { green: 2, red: 1 }, bit: "somewhere with no signal" },
      { e: "💬", t: "In a conversation that started at dinner", w: { blue: 2, orange: 1 }, bit: "in conversations that outlast dinner" },
    ],
  },
  {
    q: "What do you miss most from home?",
    options: [
      { e: "🍲", t: "The food. Obviously.", w: { orange: 2, blue: 1 }, bit: "the food" },
      { e: "🫂", t: "People showing up without texting first", w: { pink: 2, orange: 1 }, bit: "people showing up without texting first" },
      { e: "🌄", t: "The landscape: the sea, the mountains, the sun", w: { green: 2, purple: 1 }, bit: "the landscape back home" },
      { e: "⚽", t: "The team, the league, the rivalry", w: { cyan: 2, red: 1 }, bit: "the rivalries back home" },
    ],
  },
  {
    q: "Pick a superpower for your Toronto winter",
    options: [
      { e: "🔥", t: "Never cold. Run outside all year.", w: { red: 2, green: 1 } },
      { e: "🎉", t: "Instant friends at any party", w: { pink: 2, cyan: 1 } },
      { e: "⚡", t: "Turn any idea into an app overnight", w: { yellow: 2, blue: 1 } },
      { e: "🌈", t: "Paint the grey sky any color", w: { purple: 2, pink: 1 } },
    ],
  },
  {
    q: "Your ideal Friday night",
    options: [
      { e: "🍝", t: "Hosting dinner. Way too much food.", w: { orange: 2, pink: 1 } },
      { e: "💻", t: "A hackathon. Like this one.", w: { yellow: 2, cyan: 1 } },
      { e: "🎤", t: "A small gig, a gallery, an open mic", w: { purple: 2, blue: 1 } },
      { e: "🎲", t: "Board games or a pickup game with the crew", w: { cyan: 2, red: 1 } },
      { e: "🌙", t: "A long walk with someone interesting", w: { blue: 2, green: 1 } },
    ],
  },
];

// Fake attendees for testing the wall (POST /api/admin/seed).
export const SEED_NAMES = [
  "Ana", "Raj", "Olu", "Mei", "Diego", "Fatima", "Yuki", "Priya", "Omar", "Sofia", "Arjun", "Lina",
  "Kwame", "Daria", "Mateo", "Aisha", "Chen", "Nadia", "Tomás", "Zara", "Leila", "Kofi", "Ingrid",
  "Hiro", "Amara", "Luca", "Noor", "Santiago", "Esther", "Bilal", "Camila", "Dmytro", "Grace", "Reza",
  "Isabela", "Tariq", "Hana", "Emeka", "Olga", "Javier", "Sana", "Minh",
];

export const SEED_HOMES = [
  ["IN", "India"], ["IN", "India"], ["IN", "India"], ["CN", "China"], ["CN", "China"], ["PH", "Philippines"],
  ["PH", "Philippines"], ["PK", "Pakistan"], ["IR", "Iran"], ["UA", "Ukraine"], ["UA", "Ukraine"], ["BR", "Brazil"],
  ["BR", "Brazil"], ["NG", "Nigeria"], ["NG", "Nigeria"], ["MX", "Mexico"], ["KR", "South Korea"], ["VN", "Vietnam"],
  ["CO", "Colombia"], ["JM", "Jamaica"], ["SY", "Syria"], ["EG", "Egypt"], ["BD", "Bangladesh"], ["LK", "Sri Lanka"],
  ["TR", "Türkiye"], ["FR", "France"], ["GB", "United Kingdom"], ["PL", "Poland"], ["PT", "Portugal"], ["ET", "Ethiopia"],
  ["GH", "Ghana"], ["KE", "Kenya"], ["AR", "Argentina"], ["VE", "Venezuela"], ["NP", "Nepal"], ["CA", "Canada"],
];
