import { DurableObject } from "cloudflare:workers";
import { TRIBES, TRIBE_KEYS, QUESTIONS, OPENER, SEED_NAMES, SEED_HOMES } from "./data.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffled = (arr) => [...arr].sort(() => Math.random() - 0.5);
const today = () =>
  new Date().toLocaleDateString("en-US", { timeZone: "America/Toronto", month: "long", day: "numeric", year: "numeric" });

export default {
  fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/")) return env.ROOM.get(env.ROOM.idFromName("main")).fetch(request);
    return env.ASSETS.fetch(request);
  },
};

// Total points per tribe for a list of answer indexes.
function score(answers) {
  const s = Object.fromEntries(TRIBE_KEYS.map((k) => [k, 0]));
  answers.forEach((a, i) => {
    for (const [k, w] of Object.entries(QUESTIONS[i].options[a].w)) s[k] += w;
  });
  return s;
}

// Highest score wins, but a tribe one point behind can take you if it has BALANCE fewer people.
// Keeps groups roughly even without ignoring answers.
const BALANCE = 3;
function chooseTribe(scores, counts) {
  const max = Math.max(...Object.values(scores));
  let best = null;
  let bestCost = Infinity;
  for (const k of shuffled(TRIBE_KEYS)) {
    if (scores[k] < max - 1) continue;
    const cost = counts[k] + BALANCE * (max - scores[k]);
    if (cost < bestCost || (cost === bestCost && scores[k] > scores[best])) {
      best = k;
      bestCost = cost;
    }
  }
  return best;
}

function templateLine(p) {
  const [a, b, c] = p.answers.map((a, i) => QUESTIONS[i].options[a].bit);
  return `${p.home ? `From ${p.home} to Toronto. ` : ""}You ${a}, lose track of time ${b}, and still miss ${c}.`;
}

function tally(list) {
  const m = new Map();
  for (const x of list) if (x) m.set(x, (m.get(x) || 0) + 1);
  return [...m.entries()].sort((x, y) => y[1] - x[1]);
}

async function grok(env, system, user, maxTokens = 300) {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.XAI_API_KEY}` },
    body: JSON.stringify({
      model: env.XAI_MODEL || "grok-4-1-fast-non-reasoning",
      max_tokens: maxTokens,
      temperature: 0.8,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`xAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const text = (await res.json()).choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("xAI returned an empty message");
  return text.replace(/^["“]+|["”]+$/g, "").trim();
}

const STYLE =
  "Plain, warm, specific, a little funny. Ground every line in the facts given and invent nothing. " +
  "Avoid clichés: no 'tapestry', 'journey', 'melting pot', 'vibrant', 'diverse backgrounds', 'kindred spirits'. " +
  "No emojis, hashtags, quotes, titles or markdown. Plain text only.";

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.people = new Map();
    this.tribes = {};
    this.room = {};
    this.writing = new Set();
    ctx.blockConcurrencyWhile(async () => {
      for (const [k, v] of await ctx.storage.list()) {
        if (k.startsWith("p:")) this.people.set(v.id, v);
        else if (k.startsWith("t:")) this.tribes[k.slice(2)] = v;
        else if (k === "room") this.room = v;
      }
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    try {
      switch (`${request.method} ${url.pathname}`) {
        case "GET /api/config": return json(this.config());
        case "GET /api/state": return json(this.state());
        case "GET /api/me": return json(this.meView(this.person(url.searchParams.get("id"))));
        case "POST /api/join": return json(this.join(body));
        case "POST /api/found": return json(this.found(body));
        case "POST /api/seal": return json(this.seal(body));
        case "POST /api/leave": return json(this.leave(body));
        case "POST /api/admin/stories": this.admin(body); return json(await this.writeAllStories());
        case "POST /api/admin/seed": this.admin(body); return json(this.seed(body.n));
        case "POST /api/admin/reset": this.admin(body); return json(await this.reset(body.fakesOnly));
      }
      return json({ error: "Not found" }, 404);
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e);
      return json({ error: e.message || "Server error" }, e.status || 500);
    }
  }

  // ---------- data helpers ----------

  person(id) {
    const p = this.people.get(id);
    if (!p) throw new HttpError(404, "Unknown person");
    return p;
  }

  putPerson(p) {
    this.people.set(p.id, p);
    this.ctx.storage.put(`p:${p.id}`, p);
  }

  tribeState(key) {
    return (this.tribes[key] ??= {});
  }

  saveTribe(key) {
    this.ctx.storage.put(`t:${key}`, this.tribes[key]);
  }

  members(key) {
    return [...this.people.values()].filter((p) => p.tribe === key).sort((a, b) => a.at - b.at);
  }

  counts() {
    const c = Object.fromEntries(TRIBE_KEYS.map((k) => [k, 0]));
    for (const p of this.people.values()) c[p.tribe]++;
    return c;
  }

  circleSize() {
    return Number(this.env.CIRCLE_SIZE) || 8;
  }

  admin(body) {
    if (!this.env.ADMIN_KEY || body.key !== this.env.ADMIN_KEY) throw new HttpError(403, "Wrong admin key");
  }

  // ---------- views ----------

  config() {
    return {
      event: this.env.EVENT_NAME || "Toronto",
      opener: OPENER,
      tribes: Object.fromEntries(
        TRIBE_KEYS.map((k) => {
          const { label, color, ink, name, tagline, ritual, prompts } = TRIBES[k];
          return [k, { label, color, ink, name, tagline, ritual, prompts }];
        }),
      ),
      questions: QUESTIONS.map((q) => ({ q: q.q, options: q.options.map(({ e, t, w }) => ({ e, t, w })) })),
    };
  }

  meView(p) {
    const t = this.tribes[p.tribe] || {};
    const members = this.members(p.tribe);
    return {
      me: { id: p.id, name: p.name, home: p.home, cc: p.cc, tribe: p.tribe, circle: p.circle, found: p.found, line: p.line },
      tribe: {
        key: p.tribe,
        count: members.length,
        found: members.filter((m) => m.found).length,
        countries: new Set(members.map((m) => m.cc).filter(Boolean)).size,
        circle: members
          .filter((m) => m.circle === p.circle)
          .map((m) => ({ name: m.name || "Someone", cc: m.cc, home: m.home, found: m.found, me: m.id === p.id })),
        seal: t.sealedAt ? { name: t.name, ritual: t.ritual, chat: t.chat, by: t.by } : null,
        story: t.story || "",
      },
    };
  }

  state() {
    const people = [...this.people.values()];
    return {
      event: this.env.EVENT_NAME || "Toronto",
      ai: Boolean(this.env.XAI_API_KEY),
      total: people.length,
      countries: new Set(people.map((p) => p.cc).filter(Boolean)).size,
      tribes: TRIBE_KEYS.map((k) => {
        const t = this.tribes[k] || {};
        const members = this.members(k);
        return {
          key: k,
          name: t.sealedAt ? t.name : TRIBES[k].name,
          sealed: Boolean(t.sealedAt),
          ritual: t.sealedAt ? t.ritual : "",
          count: members.length,
          found: members.filter((m) => m.found).length,
          flags: members.slice(0, 120).map((m) => m.cc),
          countries: tally(members.map((m) => m.home)).slice(0, 6).map(([h]) => h),
          story: t.story || "",
        };
      }),
      feed: people
        .sort((a, b) => b.at - a.at)
        .slice(0, 14)
        .map((p) => ({ name: p.name || "Someone", cc: p.cc, tribe: p.tribe })),
      room: this.room.story || "",
    };
  }

  // ---------- actions ----------

  join(body) {
    const answers = body.answers;
    const valid =
      Array.isArray(answers) &&
      answers.length === QUESTIONS.length &&
      answers.every((a, i) => Number.isInteger(a) && a >= 0 && a < QUESTIONS[i].options.length);
    if (!valid) throw new HttpError(400, "Answer every question");

    const counts = this.counts();
    const tribe = chooseTribe(score(answers), counts);
    const p = {
      id: crypto.randomUUID(),
      name: clip(body.name, 24),
      home: clip(body.home, 40),
      cc: /^[A-Z]{2}$/.test(body.cc) ? body.cc : "",
      answers,
      tribe,
      circle: Math.floor(counts[tribe] / this.circleSize()) + 1,
      found: false,
      line: "",
      at: Date.now(),
      fake: Boolean(body.fake),
    };
    if (p.fake || !this.env.XAI_API_KEY) p.line = templateLine(p);
    this.putPerson(p);
    if (!p.line) this.writeLine(p);
    return this.meView(p);
  }

  found(body) {
    const p = this.person(body.id);
    p.found = body.found !== false;
    this.putPerson(p);
    return this.meView(p);
  }

  seal(body) {
    const p = this.person(body.id);
    const chat = clip(body.chat, 300);
    if (chat && !/^https?:\/\/\S+$/i.test(chat)) throw new HttpError(400, "The chat link should start with https://");
    const t = this.tribeState(p.tribe);
    const isNew = !t.sealedAt;
    t.name = clip(body.name, 40) || TRIBES[p.tribe].name;
    t.ritual = clip(body.ritual, 140) || TRIBES[p.tribe].ritual;
    t.chat = chat;
    t.by = p.name || "Someone";
    t.sealedAt = Date.now();
    this.saveTribe(p.tribe);
    if (isNew || !t.story) this.writeStory(p.tribe);
    return this.meView(p);
  }

  leave(body) {
    if (this.people.delete(body.id)) this.ctx.storage.delete(`p:${body.id}`);
    return { ok: true };
  }

  seed(n) {
    const count = Math.min(Math.max(Number(n) || 30, 1), 300);
    for (let i = 0; i < count; i++) {
      const [cc, home] = pickOne(SEED_HOMES);
      this.join({
        name: pickOne(SEED_NAMES),
        home,
        cc,
        answers: QUESTIONS.map((q) => Math.floor(Math.random() * q.options.length)),
        fake: true,
      });
    }
    return this.state();
  }

  async reset(fakesOnly) {
    if (fakesOnly) {
      const ids = [...this.people.values()].filter((p) => p.fake).map((p) => p.id);
      ids.forEach((id) => this.people.delete(id));
      for (let i = 0; i < ids.length; i += 128) await this.ctx.storage.delete(ids.slice(i, i + 128).map((id) => `p:${id}`));
    } else {
      await this.ctx.storage.deleteAll();
      this.people.clear();
      this.tribes = {};
      this.room = {};
    }
    return this.state();
  }

  // ---------- Grok ----------

  async writeLine(p) {
    const answers = p.answers.map((a, i) => `- ${QUESTIONS[i].q} → ${QUESTIONS[i].options[a].t}`).join("\n");
    const tribe = TRIBES[p.tribe];
    try {
      p.line = clip(
        await grok(
          this.env,
          `You write one-sentence portraits of people at a live meetup in Toronto, based on their quiz answers. ` +
            `One sentence, at most 22 words, second person ("you"). ${STYLE}`,
          `Name: ${p.name || "(not given)"}\nHome country: ${p.home || "(not given)"}\nAnswers:\n${answers}\n` +
            `Their color: ${tribe.label} (${tribe.name}: ${tribe.tagline})`,
          120,
        ),
        240,
      );
    } catch (e) {
      console.error("line", e.message);
      p.line = templateLine(p);
    }
    if (this.people.has(p.id)) this.putPerson(p);
  }

  tribeFacts(key) {
    const tribe = TRIBES[key];
    const t = this.tribes[key] || {};
    const members = this.members(key);
    const answerLines = QUESTIONS.map((q, i) => {
      const top = tally(members.map((m) => q.options[m.answers[i]].t)).slice(0, 3);
      return `- ${q.q} ${top.map(([a, n]) => `"${a}" ×${n}`).join(", ")}`;
    }).join("\n");
    const homes = tally(members.map((m) => m.home)).map(([h, n]) => (n > 1 ? `${h} ×${n}` : h));
    const names = [...new Set(members.map((m) => m.name).filter(Boolean))].slice(0, 25);
    return {
      members,
      text:
        `Color: ${tribe.label}. Default name: "${tribe.name}" (${tribe.tagline})\n` +
        (t.sealedAt ? `They named themselves: "${t.name}"\nFirst ritual they committed to: ${t.ritual}\n` : "") +
        `People: ${members.length}\n` +
        `First names: ${names.join(", ") || "(none given)"}\n` +
        `Home countries: ${homes.join(", ") || "(none given)"}\n` +
        `How they answered:\n${answerLines}`,
    };
  }

  templateStory(key) {
    const tribe = TRIBES[key];
    const t = this.tribes[key] || {};
    const members = this.members(key);
    const homes = tally(members.map((m) => m.home)).map(([h]) => h);
    const where = homes.length ? ` from ${homes.slice(0, 4).join(", ")}${homes.length > 4 ? ` and ${homes.length - 4} more places` : ""}` : "";
    const [miss, missN] = tally(members.map((m) => QUESTIONS[2].options[m.answers[2]].bit))[0] || [];
    return (
      `On ${today()}, ${members.length} ${members.length === 1 ? "person" : "people"}${where} raised ${tribe.label.toLowerCase()} phones in a room in Toronto and found each other. ` +
      (miss && members.length > 1 ? `${missN} of you miss ${miss}. ` : "") +
      `You called yourselves ${t.name || tribe.name}. ` +
      (t.ritual ? `Chapter two: ${t.ritual.replace(/[.!]+$/, "")}.` : `Chapter two is yours to write.`)
    );
  }

  async writeStory(key) {
    if (this.writing.has(key)) return;
    this.writing.add(key);
    try {
      const { members, text } = this.tribeFacts(key);
      if (!members.length) return;
      let story = "";
      if (this.env.XAI_API_KEY) {
        try {
          story = await grok(
            this.env,
            `You write origin stories for communities that formed minutes ago at a live event: ` +
              `${this.env.EVENT_NAME || "a meetup"} in Toronto on ${today()}. Most people there are immigrants who work from home. ` +
              `People answered a five-question quiz, got a color, raised their phones to find each other, then named their group and committed to a first ritual. ${STYLE}`,
            `${text}\n\nWrite this group's origin story in 70 to 100 words, addressing them as "you". ` +
              `Mention at least two home countries and two first names if available. End with one short line about their first ritual as the next chapter.`,
            400,
          );
        } catch (e) {
          console.error("story", key, e.message);
        }
      }
      const t = this.tribeState(key);
      t.story = story || this.templateStory(key);
      t.storyAt = Date.now();
      this.saveTribe(key);
    } finally {
      this.writing.delete(key);
    }
  }

  async writeRoomStory() {
    const people = [...this.people.values()];
    if (!people.length) return;
    const homes = tally(people.map((p) => p.home));
    const tribeLines = TRIBE_KEYS.map((k) => {
      const t = this.tribes[k] || {};
      const n = people.filter((p) => p.tribe === k).length;
      if (!n) return null;
      return `- ${TRIBES[k].label}: ${n} people, called "${t.sealedAt ? t.name : TRIBES[k].name}"${t.sealedAt ? `, first ritual: ${t.ritual}` : ", no ritual yet"}`;
    }).filter(Boolean);
    let story = "";
    if (this.env.XAI_API_KEY) {
      try {
        story = await grok(
          this.env,
          `You write the closing story for a live event: ${this.env.EVENT_NAME || "a meetup"} in Toronto on ${today()}. ` +
            `Most people there are immigrants who work from home, where it gets lonely. Tonight they answered a quiz, got a color, ` +
            `raised their phones, found strangers who share what they love, and turned those strangers into groups with a first ritual. ${STYLE}`,
          `People: ${people.length}\nHome countries (${homes.length}): ${homes.map(([h, n]) => `${h} ×${n}`).join(", ")}\n` +
            `Groups:\n${tribeLines.join("\n")}\n\nWrite the story of this room in 90 to 130 words, addressing everyone as "you". ` +
            `Name a few countries and a few of the group names and rituals. End on what happens next week.`,
          500,
        );
      } catch (e) {
        console.error("room", e.message);
      }
    }
    this.room = {
      story:
        story ||
        `Tonight ${people.length} people from ${homes.length} places walked into a room in Toronto as strangers. ` +
          `You answered five questions, raised your phones, and found the people who light up the way you do. ` +
          `${tribeLines.length} groups formed. Some will run on Saturday. Some will cook. Some will build. ` +
          `None of it means much on its own. Together, it's a reason to show up next week.`,
      storyAt: Date.now(),
    };
    await this.ctx.storage.put("room", this.room);
  }

  async writeAllStories() {
    await Promise.all(TRIBE_KEYS.filter((k) => this.members(k).length).map((k) => this.writeStory(k)));
    await this.writeRoomStory();
    return this.state();
  }
}
