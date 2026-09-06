import { reminderStatus } from "./store";
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

// Per the requirements doc (§3.5): the agent guides and informs, but never gives
// final financial advice or acts on the client's behalf — those always escalate.
// Keyword sets are duplicated per language so intent detection works regardless
// of which language the client is typing in.
const ESCALATE_TRIGGERS: Record<ChatLang, string[]> = {
  en: ["advice", "invest", "recommend", "should i", "talk to", "speak to", "adviser", "human", "call me", "urgent", "complain"],
  af: ["advies", "belê", "beveel aan", "moet ek", "praat met", "adviseur", "mens", "bel my", "dringend", "kla"],
  zu: ["iseluleko", "tshala", "ngincome", "kufanele ngi", "khuluma no", "umeluleki", "umuntu", "ngishayele", "okuphuthumayo", "sikhalazo"],
  xh: ["icebiso", "tyala", "ndicebise", "ndifanele", "thetha no", "umcebisi", "umntu", "nditsalele", "ngxamisekileyo", "isikhalazo"],
};

const CLAIM_WORDS: Record<ChatLang, string[]> = {
  en: ["claim"],
  af: ["eis"],
  zu: ["isicelo sokulimala", "imangalo"],
  xh: ["ibango"],
};

const REMINDER_WORDS: Record<ChatLang, string[]> = {
  en: ["remind"],
  af: ["herinner"],
  zu: ["khumbuza"],
  xh: ["khumbuza"],
};

const GOAL_WORDS: Record<ChatLang, string[]> = {
  en: ["goal"],
  af: ["doel"],
  zu: ["inhloso"],
  xh: ["injongo"],
};

const REQUEST_WORDS: Record<ChatLang, string[]> = {
  en: ["request", "document", "address", "bank"],
  af: ["versoek", "dokument", "adres", "bank"],
  zu: ["isicelo", "idokhumenti", "ikheli", "ibhange"],
  xh: ["isicelo", "uxwebhu", "idilesi", "ibhanki"],
};

const GREETING_WORDS: Record<ChatLang, string[]> = {
  en: ["hello", "hi"],
  af: ["hallo", "haai"],
  zu: ["sawubona", "yebo"],
  xh: ["molo"],
};

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
  fallback: string;
}

const PHRASES: Record<ChatLang, Phrases> = {
  en: {
    greeting: (n) => `Hi ${n}! I can help with claims, reminders, goals and service requests. What do you need?`,
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
    fallback: "I'm not sure about that yet. I can help with claims status, reminders, goals and service requests — or escalate this to your adviser.",
  },
  af: {
    greeting: (n) => `Hallo ${n}! Ek kan help met eise, herinneringe, doelwitte en versoeke. Wat het jy nodig?`,
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
    fallback: "Ek is nog nie seker daarvan nie. Ek kan help met eisstatus, herinneringe, doelwitte en versoeke — of dit na jou adviseur eskaleer.",
  },
  zu: {
    greeting: (n) => `Sawubona ${n}! Ngingakusiza ngezimangalo, izikhumbuzo, izinhloso nezicelo. Yini oyidingayo?`,
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
    fallback: "Angikaqiniseki ngalokho okwamanje. Ngingakusiza ngesimo sezimangalo, izikhumbuzo, izinhloso nezicelo — noma ngikuphakamisele kumeluleki wakho.",
  },
  xh: {
    greeting: (n) => `Molo ${n}! Ndingakunceda ngamabango, izikhumbuzo, iinjongo nezicelo. Ufuna ntoni?`,
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
    fallback: "Andikaqiniseki ngoko okwangoku. Ndingakunceda ngobume bebango, izikhumbuzo, iinjongo nezicelo — okanye ndikudlulisele kumcebisi wakho.",
  },
};

export function respond(message: string, ctx: ChatContext): ChatReply {
  const q = message.toLowerCase().trim();
  const { db, session, lang } = ctx;
  const t = PHRASES[lang];

  if (ESCALATE_TRIGGERS[lang].some((w) => q.includes(w)) || ESCALATE_TRIGGERS.en.some((w) => q.includes(w))) {
    return { text: t.escalated, escalate: true };
  }

  if (session.role === "client") {
    if (CLAIM_WORDS[lang].some((w) => q.includes(w)) || CLAIM_WORDS.en.some((w) => q.includes(w))) {
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

    if (REMINDER_WORDS[lang].some((w) => q.includes(w)) || REMINDER_WORDS.en.some((w) => q.includes(w))) {
      const reminders = db.reminders.filter(
        (r) => r.client_id === session.userId && r.audience !== "adviser" && !r.dismissed,
      );
      const overdue = reminders.filter((r) => reminderStatus(r.due_date) === "overdue");
      if (overdue.length > 0) return { text: t.overdueReminder(overdue.length, overdue[0]!.message), escalate: false };
      if (reminders.length === 0) return { text: t.noReminders, escalate: false };
      return { text: t.nextReminder(reminders.length, reminders[0]!.message), escalate: false };
    }

    if (GOAL_WORDS[lang].some((w) => q.includes(w)) || GOAL_WORDS.en.some((w) => q.includes(w))) {
      const goals = db.goals.filter((g) => g.shared_client_ids.includes(session.userId));
      if (goals.length === 0) return { text: t.noGoals, escalate: false };
      const g = goals[0]!;
      const pct = Math.round((g.current_amount / g.target_amount) * 100);
      return { text: t.goalProgress(g.goal_name, pct, `R${g.target_amount.toLocaleString("en-ZA")}`), escalate: false };
    }

    if (REQUEST_WORDS[lang].some((w) => q.includes(w)) || REQUEST_WORDS.en.some((w) => q.includes(w))) {
      return { text: t.requestsInfo, escalate: false };
    }
  }

  if (q === "" || GREETING_WORDS[lang].some((w) => q.includes(w)) || GREETING_WORDS.en.some((w) => q.includes(w))) {
    return { text: t.greeting(session.name.split(" ")[0]!), escalate: false };
  }

  return { text: t.fallback, escalate: false };
}
