import { FORM_TYPES, reminderStatus } from "./store";
import type { ClaimStatus, DB, Session } from "./types";

export type ChatLang = "en" | "af" | "zu" | "xh";

export interface ChatContext {
  db: DB;
  session: Session;
  lang: ChatLang;
}

export interface ChatReply {
  text: string;
  escalate: boolean;
}

/* ------------------------------- fuzzy matching ------------------------------ */
// No LLM is wired up (client-only static app, no API key configured), so this is
// deliberately a richer pattern-matcher rather than true language understanding:
// broader synonym coverage per intent, typo tolerance via edit distance, and an
// intent-scoring pass instead of "first matching if-branch wins".

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

function matchesKeyword(tokens: string[], fullText: string, keyword: string): boolean {
  if (keyword.includes(" ")) return fullText.includes(keyword);
  return tokens.some((tok) => {
    if (tok.length < 2) return false;
    if (tok === keyword) return true;
    if (tok.length >= 3 && keyword.startsWith(tok)) return true;
    if (keyword.length >= 3 && tok.startsWith(keyword)) return true;
    const maxDist = keyword.length <= 4 ? 1 : 2;
    return levenshtein(tok, keyword) <= maxDist;
  });
}

function intentScore(tokens: string[], fullText: string, lang: ChatLang, words: Record<ChatLang, string[]>): number {
  const bag = new Set([...words[lang], ...words.en]);
  let score = 0;
  for (const w of bag) if (matchesKeyword(tokens, fullText, w)) score++;
  return score;
}

function tokenize(q: string): string[] {
  return q.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/* --------------------------------- keyword sets ------------------------------- */
// Duplicated per language so intent detection works regardless of which language
// the client is typing in — English keywords are always checked as a fallback too.

// Deliberately specific multi-word phrases only — a bare "adviser" or "human"
// would swallow the informational adviser-contact intent below (e.g. "who is my
// adviser" should answer, not escalate).
const ESCALATE_TRIGGERS: Record<ChatLang, string[]> = {
  en: ["advice", "recommend", "should i", "talk to my adviser", "speak to my adviser", "speak to a human", "talk to a human", "speak to someone", "talk to someone", "call me", "urgent", "complain", "financial advice", "what should i do", "help me decide", "escalate"],
  af: ["advies", "beveel aan", "moet ek", "praat met my adviseur", "praat met 'n mens", "bel my", "dringend", "kla"],
  zu: ["iseluleko", "ngincome", "kufanele ngi", "khuluma nomeluleki wami", "khuluma nomuntu", "ngishayele", "okuphuthumayo", "isikhalazo"],
  xh: ["icebiso", "ndicebise", "ndifanele", "thetha nomcebisi wam", "thetha nomntu", "nditsalele", "ngxamisekileyo", "isikhalazo"],
};

const CLAIM_WORDS: Record<ChatLang, string[]> = {
  en: ["claim", "claims", "accident", "crash", "collision", "repair", "assessor", "assessment", "panel beater", "insurer"],
  af: ["eis", "eise", "ongeluk", "botsing", "herstelwerk"],
  zu: ["isicelo sokulimala", "imangalo", "ingozi", "ukushayisana"],
  xh: ["ibango", "amabango", "ingozi", "ukungqubana"],
};

const REMINDER_WORDS: Record<ChatLang, string[]> = {
  en: ["remind", "reminder", "reminders", "due", "overdue", "renewal", "expiry", "expire", "licence", "upcoming", "task"],
  af: ["herinner", "herinnering", "vervaldatum", "hernuwing", "verval"],
  zu: ["khumbuza", "isikhumbuzo", "iviki", "kuphelelwe"],
  xh: ["khumbuza", "isikhumbuzo", "iphelelwe"],
};

const GOAL_WORDS: Record<ChatLang, string[]> = {
  en: ["goal", "goals", "target", "savings", "save", "progress", "emergency fund", "retirement"],
  af: ["doel", "doelwit", "teiken", "spaar", "vordering"],
  zu: ["inhloso", "izinhloso", "ukonga", "inqubekelaphambili"],
  xh: ["injongo", "iinjongo", "ukonga", "inkqubela"],
};

const REQUEST_WORDS: Record<ChatLang, string[]> = {
  en: ["request", "requests", "document", "documents", "address", "bank", "change my", "update my", "irp5", "border letter", "consultation"],
  af: ["versoek", "dokument", "adres", "bank", "verander my"],
  zu: ["isicelo", "idokhumenti", "ikheli", "ibhange", "shintsha"],
  xh: ["isicelo", "uxwebhu", "idilesi", "ibhanki", "tshintsha"],
};

const POLICY_WORDS: Record<ChatLang, string[]> = {
  en: ["policy", "policies", "invest", "net worth", "networth", "portfolio", "premium", "how much do i have", "how much money"],
  af: ["polis", "belegging", "netto waarde", "premie"],
  zu: ["iphalisi", "utshalomali", "inani lemali"],
  xh: ["iphalisi", "utyalo-mali", "ixabiso lam"],
};

const ADVISER_WORDS: Record<ChatLang, string[]> = {
  en: ["adviser", "advisor", "contact", "phone number", "email address", "who is my adviser"],
  af: ["adviseur", "kontak"],
  zu: ["umeluleki", "xhumana"],
  xh: ["umcebisi", "qhagamshelana"],
};

const DOCUMENT_WORDS: Record<ChatLang, string[]> = {
  en: ["document", "documents", "sign", "signed", "onboarding", "forms", "popia", "consent"],
  af: ["dokument", "onderteken"],
  zu: ["idokhumenti", "sayina"],
  xh: ["uxwebhu", "tyikitya"],
};

const HELP_WORDS: Record<ChatLang, string[]> = {
  en: ["help", "what can you do", "options", "menu", "assist"],
  af: ["help", "wat kan jy doen"],
  zu: ["usizo", "yini ongayenza"],
  xh: ["uncedo", "yintoni onokuyenza"],
};

const GREETING_WORDS: Record<ChatLang, string[]> = {
  en: ["hello", "hi", "hey", "good morning", "good afternoon"],
  af: ["hallo", "haai"],
  zu: ["sawubona", "yebo"],
  xh: ["molo"],
};

/* ----------------------------------- phrases ---------------------------------- */

const CLAIM_STATUS_LABELS: Record<ChatLang, Record<ClaimStatus, string>> = {
  en: {
    submitted: "submitted", processing: "processing", assessment_scheduled: "assessment scheduled",
    under_assessment: "under assessment", quote_received: "repair quote received",
    repair_authorised: "repair authorised", repair_in_progress: "repair in progress", completed: "completed",
  },
  af: {
    submitted: "ingedien", processing: "word verwerk", assessment_scheduled: "assessering geskeduleer",
    under_assessment: "onder assessering", quote_received: "herstelkwotasie ontvang",
    repair_authorised: "herstelwerk gemagtig", repair_in_progress: "herstelwerk aan die gang", completed: "voltooi",
  },
  zu: {
    submitted: "sithunyelwe", processing: "siyacutshungulwa", assessment_scheduled: "ukuhlolwa kuhlelwe",
    under_assessment: "kuyahlolwa", quote_received: "isilinganiso sokulungisa sitholiwe",
    repair_authorised: "ukulungiswa kugunyaziwe", repair_in_progress: "ukulungiswa kuyaqhubeka", completed: "kuqediwe",
  },
  xh: {
    submitted: "ithunyelwe", processing: "iyacutshungulwa", assessment_scheduled: "uvavanyo lucwangcisiwe",
    under_assessment: "phantsi kovavanyo", quote_received: "ixabiso lokulungisa lifunyenwe",
    repair_authorised: "ukulungiswa kugunyazisiwe", repair_in_progress: "ukulungiswa kuyaqhubeka", completed: "kugqityiwe",
  },
};

interface Phrases {
  greeting: (firstName: string) => string;
  escalated: string;
  noClaims: string;
  claimStatus: (claimNumber: string, insurer: string, status: string) => string;
  claimNumberPending: string;
  overdueReminder: (count: number, message: string) => string;
  noReminders: string;
  nextReminder: (count: number, message: string) => string;
  noGoals: string;
  goalProgress: (name: string, pct: number, target: string) => string;
  requestsInfo: string;
  noPolicies: string;
  policySummary: (count: number, netWorth: string) => string;
  adviserInfo: (name: string, phone: string, email: string) => string;
  noAdviser: string;
  documentsInfo: (signed: number, total: number) => string;
  help: string;
  fallback: string;
}

const PHRASES: Record<ChatLang, Phrases> = {
  en: {
    greeting: (n) => `Hi ${n}! I can help with claims, reminders, goals, policies, your adviser's details and service requests. What do you need?`,
    escalated: "That needs your adviser's judgement, not mine. I've raised it as a consultation request — you'll see it under Requests.",
    noClaims: 'You don\'t have any motor claims on file yet. Tap "Report an Accident or Loss" on your dashboard to start one.',
    claimStatus: (num, insurer, status) => `Your most recent claim ${num} with ${insurer} is currently "${status}". Open Claims for the full timeline.`,
    claimNumberPending: "claim number pending",
    overdueReminder: (n, m) => `You have ${n} overdue reminder(s), including: "${m}".`,
    noReminders: "You have no open reminders right now.",
    nextReminder: (n, m) => `You have ${n} open reminder(s). Next: "${m}".`,
    noGoals: "No goals have been set up for you yet — your adviser can create one.",
    goalProgress: (name, pct, target) => `"${name}" is ${pct}% toward its target of ${target}.`,
    requestsInfo: "You can raise address changes, bank detail changes, document requests and more from the Requests page. Want me to escalate this to your adviser instead?",
    noPolicies: "You don't have any policies or investments on file yet.",
    policySummary: (n, nw) => `You have ${n} polic${n === 1 ? "y" : "ies"}/investment(s) on file with an estimated net worth of ${nw}.`,
    adviserInfo: (name, phone, email) => `Your adviser is ${name}. Reach them on ${phone} or ${email}.`,
    noAdviser: "You don't have an adviser assigned yet.",
    documentsInfo: (signed, total) => `You've signed ${signed} of ${total} onboarding documents.`,
    help: "I can help with: claim status, reminders, goals, your policies and net worth, your adviser's contact details, signed documents, and service requests like address or bank changes. Just ask!",
    fallback: "I'm not sure about that yet. I can help with claims status, reminders, goals, policies, your adviser and service requests — or escalate this to your adviser.",
  },
  af: {
    greeting: (n) => `Hallo ${n}! Ek kan help met eise, herinneringe, doelwitte, polisse, jou adviseur se besonderhede en versoeke. Wat het jy nodig?`,
    escalated: "Dit het jou adviseur se oordeel nodig, nie myne nie. Ek het dit as 'n konsultasieversoek opgeteken — jy sal dit onder Versoeke sien.",
    noClaims: 'Jy het nog geen motoreise aangeteken nie. Tik "Report an Accident or Loss" op jou paneelbord om een te begin.',
    claimStatus: (num, insurer, status) => `Jou mees onlangse eis ${num} by ${insurer} is tans "${status}". Maak Eise oop vir die volledige tydlyn.`,
    claimNumberPending: "eisnommer word gewag",
    overdueReminder: (n, m) => `Jy het ${n} agterstallige herinnering(s), insluitend: "${m}".`,
    noReminders: "Jy het tans geen oop herinneringe nie.",
    nextReminder: (n, m) => `Jy het ${n} oop herinnering(s). Volgende: "${m}".`,
    noGoals: "Daar is nog geen doelwitte vir jou opgestel nie — jou adviseur kan een skep.",
    goalProgress: (name, pct, target) => `"${name}" is ${pct}% na sy teiken van ${target}.`,
    requestsInfo: "Jy kan adres- en bankveranderinge, dokumentversoeke en meer op die Versoeke-bladsy indien. Wil jy hê ek moet dit eerder na jou adviseur eskaleer?",
    noPolicies: "Jy het nog geen polisse of beleggings aangeteken nie.",
    policySummary: (n, nw) => `Jy het ${n} polis(se)/belegging(s) met 'n geskatte netto waarde van ${nw}.`,
    adviserInfo: (name, phone, email) => `Jou adviseur is ${name}. Kontak hulle by ${phone} of ${email}.`,
    noAdviser: "Jy het nog nie 'n adviseur toegewys nie.",
    documentsInfo: (signed, total) => `Jy het ${signed} van ${total} inskrywingsdokumente onderteken.`,
    help: "Ek kan help met: eisstatus, herinneringe, doelwitte, jou polisse en netto waarde, jou adviseur se kontakbesonderhede, ondertekende dokumente, en versoeke soos adres- of bankveranderinge. Vra gerus!",
    fallback: "Ek is nog nie seker daarvan nie. Ek kan help met eisstatus, herinneringe, doelwitte, polisse, jou adviseur en versoeke — of dit na jou adviseur eskaleer.",
  },
  zu: {
    greeting: (n) => `Sawubona ${n}! Ngingakusiza ngezimangalo, izikhumbuzo, izinhloso, amaphalisi, imininingwane yomeluleki wakho nezicelo. Yini oyidingayo?`,
    escalated: "Lokho kudinga ukwahlulela komeluleki wakho, hhayi okwami. Ngikuphakamise njengesicelo sokubonisana — uzosibona ngaphansi kwezicelo.",
    noClaims: 'Awukabi nazo izimangalo zemoto ezibhaliswe. Thepha u"Report an Accident or Loss" kwideshibhodi yakho ukuze uqale enye.',
    claimStatus: (num, insurer, status) => `Isimangalo sakho sakamuva ${num} no-${insurer} sesikuma "${status}". Vula Izimangalo ukuze ubone yonke iminyango.`,
    claimNumberPending: "inombolo yesimangalo isalindile",
    overdueReminder: (n, m) => `Unezikhumbuzo ezi-${n} ezidlulelwe isikhathi, kufaka: "${m}".`,
    noReminders: "Awunazo izikhumbuzo ezivulekile njengamanje.",
    nextReminder: (n, m) => `Unezikhumbuzo ezi-${n} ezivulekile. Elandelayo: "${m}".`,
    noGoals: "Azikho izinhloso ezisungulelwe wena okwamanje — umeluleki wakho angadala enye.",
    goalProgress: (name, pct, target) => `"${name}" isesigabeni esingu-${pct}% kuya kunjongo yayo ka-${target}.`,
    requestsInfo: "Ungafaka izicelo zokushintsha ikheli, imininingwane yebhange, amadokhumenti nokunye ekhasini Lezicelo. Ufuna ngikwedlulisele kumeluleki wakho?",
    noPolicies: "Awunawo amaphalisi noma utshalomali obhaliswe okwamanje.",
    policySummary: (n, nw) => `Unamaphalisi/utshalomali ${n} anenani lemali elilinganiselwa ku-${nw}.`,
    adviserInfo: (name, phone, email) => `Umeluleki wakho ngu-${name}. Mthinte ku-${phone} noma ku-${email}.`,
    noAdviser: "Awukabelwa umeluleki okwamanje.",
    documentsInfo: (signed, total) => `Usayine amadokhumenti ${signed} kwangu-${total} okubhaliswa.`,
    help: "Ngingakusiza nge: isimo sesimangalo, izikhumbuzo, izinhloso, amaphalisi wakho nenani lemali, imininingwane yokuxhumana nomeluleki wakho, amadokhumenti asayiniwe, kanye nezicelo ezifana nokushintsha ikheli noma ibhange. Ake ubuze!",
    fallback: "Angikaqiniseki ngalokho okwamanje. Ngingakusiza ngesimo sezimangalo, izikhumbuzo, izinhloso, amaphalisi, umeluleki wakho nezicelo — noma ngikuphakamisele kumeluleki wakho.",
  },
  xh: {
    greeting: (n) => `Molo ${n}! Ndingakunceda ngamabango, izikhumbuzo, iinjongo, amaphalisi, iinkcukacha zomcebisi wakho nezicelo. Ufuna ntoni?`,
    escalated: "Oko kufuna ukugweba komcebisi wakho, hayi okwam. Ndikuphakamise njengesicelo sengcebiso — uya kusibona phantsi kweZicelo.",
    noClaims: 'Awukabi namabango emoto abhalisiweyo. Cofa u"Report an Accident or Loss" kwideshibhodi yakho ukuqalisa elinye.',
    claimStatus: (num, insurer, status) => `Ibango lakho lamva nje ${num} no-${insurer} ngoku li-"${status}". Vula Amabango ukubona yonke imigca yamaxesha.`,
    claimNumberPending: "inombolo yebango isalindile",
    overdueReminder: (n, m) => `Unesikhumbuzo esi-${n} esidlule ixesha, kubandakanya: "${m}".`,
    noReminders: "Awunazo izikhumbuzo ezivulekileyo ngoku.",
    nextReminder: (n, m) => `Unezikhumbuzo ezi-${n} ezivulekileyo. Elandelayo: "${m}".`,
    noGoals: "Azikho iinjongo ezisekwe kuwe okwangoku — umcebisi wakho angadala enye.",
    goalProgress: (name, pct, target) => `"${name}" isekwinqanaba eli-${pct}% ukuya kwinjongo yayo ye-${target}.`,
    requestsInfo: "Ungenza izicelo zotshintsho lwedilesi, iinkcukacha zebhanki, uxwebhu nokunye kwiphepha leZicelo. Ufuna ndikudlulisele kumcebisi wakho endaweni yoko?",
    noPolicies: "Awukabi namaphalisi okanye utyalo-mali olubhalisiweyo okwangoku.",
    policySummary: (n, nw) => `Unamaphalisi/utyalo-mali ${n} anexabiso eliqikelelwayo lika-${nw}.`,
    adviserInfo: (name, phone, email) => `Umcebisi wakho ngu-${name}. Qhagamshelana naye ku-${phone} okanye ku-${email}.`,
    noAdviser: "Awukabelwa umcebisi okwangoku.",
    documentsInfo: (signed, total) => `Utyikitye uxwebhu ${signed} kwe-${total} ekubhaliseni.`,
    help: "Ndingakunceda nge: ubume bebango, izikhumbuzo, iinjongo, amaphalisi wakho nexabiso lakho, iinkcukacha zonxibelelwano nomcebisi wakho, uxwebhu olutyikitiweyo, kunye nezicelo ezinjengotshintsho lwedilesi okanye ibhanki. Khawubuze!",
    fallback: "Andikaqiniseki ngoko okwangoku. Ndingakunceda ngobume bebango, izikhumbuzo, iinjongo, amaphalisi, umcebisi wakho nezicelo — okanye ndikudlulisele kumcebisi wakho.",
  },
};

/* ---------------------------------- responder ---------------------------------- */

export function respond(message: string, ctx: ChatContext): ChatReply {
  const q = message.toLowerCase().trim();
  const { db, session, lang } = ctx;
  const t = PHRASES[lang];

  if (ESCALATE_TRIGGERS[lang].some((w) => q.includes(w)) || ESCALATE_TRIGGERS.en.some((w) => q.includes(w))) {
    return { text: t.escalated, escalate: true };
  }

  if (q === "") return { text: t.greeting(session.name.split(" ")[0]!), escalate: false };

  if (session.role === "client") {
    const tokens = tokenize(q);
    const scores = [
      { key: "claim", score: intentScore(tokens, q, lang, CLAIM_WORDS) },
      { key: "reminder", score: intentScore(tokens, q, lang, REMINDER_WORDS) },
      { key: "goal", score: intentScore(tokens, q, lang, GOAL_WORDS) },
      { key: "policy", score: intentScore(tokens, q, lang, POLICY_WORDS) },
      { key: "adviser", score: intentScore(tokens, q, lang, ADVISER_WORDS) },
      { key: "document", score: intentScore(tokens, q, lang, DOCUMENT_WORDS) },
      { key: "request", score: intentScore(tokens, q, lang, REQUEST_WORDS) },
      { key: "help", score: intentScore(tokens, q, lang, HELP_WORDS) },
    ] as const;
    const best = scores.reduce((a, b) => (b.score > a.score ? b : a));

    if (best.score > 0) {
      switch (best.key) {
        case "claim": {
          const claims = db.claims.filter((c) => c.client_id === session.userId);
          if (claims.length === 0) return { text: t.noClaims, escalate: false };
          const latest = [...claims].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]!;
          return {
            text: t.claimStatus(
              latest.claim_number ?? `(${t.claimNumberPending})`,
              latest.insurer,
              CLAIM_STATUS_LABELS[lang][latest.status],
            ),
            escalate: false,
          };
        }
        case "reminder": {
          const reminders = db.reminders.filter(
            (r) => r.client_id === session.userId && r.audience !== "adviser" && !r.dismissed,
          );
          const overdue = reminders.filter((r) => reminderStatus(r.due_date) === "overdue");
          if (overdue.length > 0) return { text: t.overdueReminder(overdue.length, overdue[0]!.message), escalate: false };
          if (reminders.length === 0) return { text: t.noReminders, escalate: false };
          return { text: t.nextReminder(reminders.length, reminders[0]!.message), escalate: false };
        }
        case "goal": {
          const goals = db.goals.filter((g) => g.shared_client_ids.includes(session.userId));
          if (goals.length === 0) return { text: t.noGoals, escalate: false };
          const g = goals[0]!;
          const pct = Math.round((g.current_amount / g.target_amount) * 100);
          return { text: t.goalProgress(g.goal_name, pct, `R${g.target_amount.toLocaleString("en-ZA")}`), escalate: false };
        }
        case "policy": {
          const policies = db.policies.filter((p) => p.client_id === session.userId);
          if (policies.length === 0) return { text: t.noPolicies, escalate: false };
          const netWorthVal = policies.reduce((s, p) => s + p.value, 0);
          return { text: t.policySummary(policies.length, `R${Math.round(netWorthVal).toLocaleString("en-ZA")}`), escalate: false };
        }
        case "adviser": {
          const client = db.clients.find((c) => c.id === session.userId);
          const adviser = client ? db.advisers.find((a) => a.id === client.adviser_id) : undefined;
          if (!adviser) return { text: t.noAdviser, escalate: false };
          return { text: t.adviserInfo(adviser.name, adviser.phone, adviser.email), escalate: false };
        }
        case "document": {
          const signed = db.forms.filter((f) => f.client_id === session.userId && f.signed).length;
          return { text: t.documentsInfo(signed, FORM_TYPES.length), escalate: false };
        }
        case "request":
          return { text: t.requestsInfo, escalate: false };
        case "help":
          return { text: t.help, escalate: false };
      }
    }
  }

  if (GREETING_WORDS[lang].some((w) => q.includes(w)) || GREETING_WORDS.en.some((w) => q.includes(w))) {
    return { text: t.greeting(session.name.split(" ")[0]!), escalate: false };
  }

  return { text: t.fallback, escalate: false };
}
