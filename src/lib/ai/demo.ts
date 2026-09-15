import {
  FRONTEND_FIRST_PHASES,
  type ApiSpec,
  type ArchitectureSpec,
  type AssetEntry,
  type AssetPlanSpec,
  type AssetSource,
  type ClarificationAnswer,
  type DataModelSpec,
  type FeatureSpec,
  type IdeaAnalysis,
  type ImplementationTask,
  type ProjectDefinition,
  type IconSystem,
  type SpecDocument,
  type UiDesignSpec,
  type UserFlow,
} from "@/lib/schemas";
import { makePrefix, slugId } from "./normalize";

/**
 * Deterministic generator used when no AI credentials are configured.
 * It derives everything from the user's own idea so the full workflow, the
 * workspace, and the export package can be exercised without a provider.
 */

type Category =
  | "payment"
  | "marketplace"
  | "announcement"
  | "complaint"
  | "panic"
  | "auth"
  | "chat"
  | "booking"
  | "reporting"
  | "generic";

const CATEGORY_PATTERNS: { category: Category; pattern: RegExp }[] = [
  { category: "panic", pattern: /panic|darurat|emergency|sos|alarm/i },
  { category: "payment", pattern: /payment|pembayaran|ipl|tagihan|bayar|qris|invoice|iuran/i },
  { category: "marketplace", pattern: /marketplace|market|jual beli|toko|listing|produk|shop/i },
  { category: "complaint", pattern: /complaint|keluhan|pengaduan|komplain|laporan warga/i },
  { category: "announcement", pattern: /announce|pengumuman|broadcast|berita|informasi/i },
  { category: "chat", pattern: /chat|obrolan|pesan|messaging|diskusi/i },
  { category: "booking", pattern: /booking|reservasi|jadwal|appointment|sewa|tenant/i },
  { category: "reporting", pattern: /report|analitik|analytics|statistik|dashboard|rekap/i },
  { category: "auth", pattern: /login|auth|akun|register|daftar|sso/i },
];

function detectCategory(value: string): Category {
  for (const entry of CATEGORY_PATTERNS) {
    if (entry.pattern.test(value)) return entry.category;
  }
  return "generic";
}

export function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length <= 2 ? word : word[0].toUpperCase() + word.slice(1)))
    .join(" ")
    .replace(/^./, (char) => char.toUpperCase());
}

/** Derives a product name from the idea instead of copying the first words verbatim. */
export function suggestName(idea: string) {
  let cleaned = idea
    .split(/[\n.;:]/)[0]
    .replace(/\([^)]*\)/g, " ")
    .replace(/^[^:]{0,40}?:\s*/, "");

  for (let index = 0; index < 4; index += 1) {
    const next = cleaned
      .replace(INTENT_PREFIX, "")
      .replace(/^(aplikasi|app|sistem|platform)\s+/i, "");
    if (next === cleaned) break;
    cleaned = next;
  }

  cleaned = cleaned
    .replace(/\s+(dengan fitur|with features?|yang|dengan|for|untuk)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").slice(0, 6).join(" ").replace(/[.,;:]$/, "");
  return titleCase(words) || "New Product";
}

const INTENT_PREFIX =
  /^(aplikasi|app|sistem|platform|website|web|buat|build|membuat|bikin|i want to build|i want|saya ingin|saya mau|untuk)\s+/i;
const TECH_CLAUSE =
  /(backend|frontend|database|db|framework|stack|deploy|hosting)\s*(pakai|menggunakan|using|with|:)/i;
const SCOPE_CLAUSE = /(tidak perlu|tanpa|tidak ada|no need|without|exclude[sd]?|di luar scope)/i;
const TECH_ONLY_SEGMENT = /^(backend|frontend|database|db|stack|framework|hosting|deployment)\b/i;
/** Style clauses describe the look of the product, not a feature it must ship. */
const STYLE_ONLY_SEGMENT = /^(gaya|style|tampilan|tema|theme|warna|visual|ui\b|ux\b|look)\s/i;
const STYLE_PHRASE = /\b(dark mode|light mode|warna aksen|warna utama|color palette)\b/i;

function extractFeatureCandidates(idea: string) {
  // Drop everything the user explicitly excluded before looking for features.
  const scoped = idea.replace(/(?:tidak perlu|tanpa|tidak ada|no need|without)[^.;\n]*/gi, " ");

  const segments = scoped
    .split(/[\n;•*]|[.]\s|,\s|\s+dan\s+|\s+and\s+/i)
    .map((segment) => segment.replace(/^[\s\-–—]+|[\s.;,]+$/g, "").trim())
    .filter((segment) => segment.length > 2);

  const seen = new Set<string>();
  const candidates: { name: string; description: string }[] = [];

  for (const segment of segments) {
    if (
      SCOPE_CLAUSE.test(segment) ||
      TECH_CLAUSE.test(segment) ||
      TECH_ONLY_SEGMENT.test(segment) ||
      STYLE_ONLY_SEGMENT.test(segment) ||
      STYLE_PHRASE.test(segment)
    ) {
      continue;
    }

    const cleaned = segment
      .replace(/\([^)]*\)/g, " ")
      .replace(INTENT_PREFIX, "")
      .replace(/^(dan|atau|with|and|serta|juga)\s+/i, "")
      .replace(/^.*?\b(?:dengan fitur|with features?|fitur|features?)\b[:\s]*/i, "")
      .replace(/^(fitur|feature|modul|module)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned.length < 3 || cleaned.length > 56) continue;

    const words = cleaned
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5)
      .join(" ")
      .replace(/[.,;:]$/, "");
    const name = titleCase(words);
    const key = name.toLowerCase();
    if (seen.has(key) || name.split(/\s+/).length > 5) continue;
    seen.add(key);
    candidates.push({
      name,
      description: TEMPLATES[detectCategory(name)].description,
    });
    if (candidates.length >= 9) break;
  }

  return candidates;
}

export function demoAnalyze(idea: string): IdeaAnalysis {
  const features = extractFeatureCandidates(idea);
  const platform = /mobile|android|ios|ponsel|hp\b/i.test(idea) ? ["Web", "Mobile"] : ["Web"];
  const mentionsAdmin = /admin|pengurus|pengelola|management|manajemen/i.test(idea);
  const mentionsEndUser = /warga|resident|user|pengguna|pelanggan|customer|pembeli|penjual|seller|tenant/i.test(
    idea,
  );

  const users = [
    ...(mentionsEndUser ? [extractAudience(idea)] : ["End user"]),
    ...(mentionsAdmin ? ["Administrator"] : []),
  ];

  const nonGoals = Array.from(
    idea.matchAll(/(?:tanpa|tidak perlu|tidak ada|no|without|exclude[sd]?)\s+([a-z0-9 ]{3,40})/gi),
  ).map((match) => titleCase(match[1].trim()));

  const productType = /komunitas|perumahan|warga|residential|community/i.test(idea)
    ? "community application"
    : /marketplace|toko|jual beli|shop/i.test(idea)
      ? "marketplace application"
      : "web application";
  const name = suggestName(idea);

  return {
    suggestedName: name,
    summary: `${name} is a ${productType} for ${users.length > 0 ? users.join(" and ") : "its users"}. Core features: ${features.map((feature) => feature.name).join(", ") || "to be defined"}.`,
    productType: /marketplace|toko/i.test(idea) ? "Marketplace application" : "Web application",
    purpose: "Give its users a single place to complete the workflows described in the idea.",
    platform,
    targetUsers: users.length > 0 ? Array.from(new Set(users)) : ["End user", "Administrator"],
    roles: [
      ...(mentionsEndUser
        ? [
            {
              name: extractAudience(idea),
              description: "Primary user of the product.",
              responsibilities: ["Registers", "Uses the core features"],
            },
          ]
        : []),
      {
        name: "Administrator",
        description: "Operates and moderates the product.",
        responsibilities: ["Manages data", "Handles exceptions"],
      },
    ],
    coreFeatures: features,
    businessRules: [
      "Only authenticated users may access protected features.",
      "Every state-changing action is recorded with actor and timestamp.",
    ],
    integrations: /whatsapp|email|sms|payment gateway|midtrans|xendit/i.test(idea)
      ? ["Notification or payment provider mentioned in the idea"]
      : [],
    technicalPreferences: detectTechnicalPreferences(idea),
    visualPreferences: detectVisualPreferences(idea),
    constraints: [],
    nonGoals: nonGoals.length > 0 ? nonGoals : ["Anything not listed in the core features"],
    ambiguities: [
      "Who can perform each state-changing action?",
      "How should the primary workflow be completed end to end?",
      "Does any external service need to be integrated?",
    ],
  };
}

function extractAudience(idea: string) {
  if (/warga|resident/i.test(idea)) return "Resident";
  if (/pembeli|customer|buyer/i.test(idea)) return "Customer";
  if (/penjual|seller|merchant/i.test(idea)) return "Seller";
  if (/guru|teacher|siswa|student/i.test(idea)) return "Student";
  if (/pasien|patient/i.test(idea)) return "Patient";
  return "User";
}

function detectTechnicalPreferences(idea: string) {
  const preferences: IdeaAnalysis["technicalPreferences"] = [];
  const matches: { component: string; pattern: RegExp; technology: string }[] = [
    { component: "Frontend", pattern: /next\.?js/i, technology: "Next.js" },
    { component: "Frontend", pattern: /react native|flutter/i, technology: "React Native" },
    { component: "Backend", pattern: /laravel/i, technology: "Laravel" },
    { component: "Backend", pattern: /nest\.?js|nestjs/i, technology: "NestJS" },
    { component: "Backend", pattern: /express/i, technology: "Express" },
    { component: "Database", pattern: /mysql/i, technology: "MySQL" },
    { component: "Database", pattern: /postgres/i, technology: "PostgreSQL" },
    { component: "Database", pattern: /supabase/i, technology: "Supabase" },
    { component: "Database", pattern: /firebase|firestore/i, technology: "Firestore" },
  ];

  for (const match of matches) {
    if (!match.pattern.test(idea)) continue;
    if (preferences.some((entry) => entry.component === match.component)) continue;
    preferences.push({
      component: match.component,
      technology: match.technology,
      source: "user-selected",
      rationale: "Stated explicitly in the project idea.",
      alternatives: [],
    });
  }
  return preferences;
}

function detectVisualPreferences(idea: string) {
  const preferences: string[] = [];
  if (/dark mode|mode gelap|dark theme/i.test(idea)) preferences.push("Dark theme");
  if (/minimal|sederhana|simple|clean|bersih/i.test(idea)) preferences.push("Minimal, low-chrome interface");
  if (/premium|elegan|editorial|mewah/i.test(idea)) preferences.push("Premium editorial layout");
  if (/playful|ceria|colorful|warna warni|friendly/i.test(idea)) preferences.push("Friendly, colorful interface");
  if (/dashboard|analitik|analytics|data-heavy|padat data/i.test(idea))
    preferences.push("Dense, data-first dashboard");
  for (const match of idea.matchAll(/(?:seperti|mirip|like)\s+([A-Z][A-Za-z0-9.]{2,24})/g)) {
    preferences.push(`Reference product: ${match[1]}`);
  }
  return preferences;
}

/** Turns the user's own words about look and feel into a structured direction. */
function detectVisualDirection(idea: string, analysis: IdeaAnalysis, answerText: string) {
  const source = `${idea} ${analysis.visualPreferences.join(" ")} ${answerText}`;

  const style = /dense|padat|data-heavy|dashboard|admin/i.test(source)
    ? "Dense, data-first dashboard: information-rich tables and compact spacing, built for operators who work in the product all day."
    : /premium|elegan|editorial|mewah/i.test(source)
      ? "Premium editorial layout: generous whitespace, a single strong accent, restrained borders, and typography that carries the hierarchy."
      : /playful|ceria|colorful|warna warni|friendly|ramah/i.test(source)
        ? "Friendly consumer interface: rounded surfaces, a warm accent color, and clear illustrations or icons in empty states."
        : "Clean product interface: neutral surfaces, one accent color used only for primary actions and selected states, and strong typographic hierarchy.";

  const themeMode = /dark mode|mode gelap|dark theme/i.test(source)
    ? "dark"
    : /light mode|mode terang/i.test(source)
      ? "light"
      : /both|keduanya|light dan dark|light and dark/i.test(source)
        ? "both"
        : "light";

  const references = Array.from(source.matchAll(/(?:seperti|mirip|like)\s+([A-Z][A-Za-z0-9.]{2,24})/g)).map(
    (match) => match[1],
  );

  const personality = /playful|ceria|colorful|warna warni|friendly|ramah/i.test(source)
    ? "Warm and approachable, without becoming cartoonish"
    : /premium|elegan|editorial|mewah/i.test(source)
      ? "Composed and premium, with typography carrying the hierarchy"
      : "Calm, precise, and quietly confident";

  const informationDensity = /dense|padat|data-heavy|dashboard|admin/i.test(source)
    ? "Dense: information-rich rows with compact spacing for operators who work all day"
    : "Comfortable: readable spacing with one clear focal point per screen";

  const mediaPreferences: string[] = [];
  if (/foto|photo|image|gambar/i.test(source)) mediaPreferences.push("Real photography over generic illustrations");
  if (/ilustrasi|illustration|vektor|vector/i.test(source)) mediaPreferences.push("Line illustrations for empty and success states");
  if (/tanpa gambar|no image|no photo|text only/i.test(source)) mediaPreferences.push("Text-first screens with no decorative imagery");
  if (/ikon|icon|svg/i.test(source)) mediaPreferences.push("One open-source icon family per platform");

  const avoidPatterns: string[] = [];
  if (/bukan dashboard|not a dashboard|bukan admin/i.test(source)) avoidPatterns.push("Dashboard KPI tiles");
  if (/minimal|sederhana|simple|clean|bersih/i.test(source)) avoidPatterns.push("Decorative gradients, glassmorphism, and heavy shadows");

  return {
    style,
    themeMode,
    references: Array.from(new Set(references)),
    notes:
      themeMode === "dark"
        ? "Dark surfaces are the default; keep contrast high and avoid pure black."
        : "Light surfaces are the default; keep shadows subtle and borders visible.",
    personality,
    audienceContext: analysis.targetUsers.length > 0
      ? `Built for ${analysis.targetUsers.slice(0, 3).join(", ")}`
      : "Built for the documented audience",
    desiredEmotion: /panic|emergency|darurat|safety|safety/i.test(source)
      ? "Reassured and in control during a stressful moment"
      : "Confident that the work can be finished quickly and correctly",
    informationDensity,
    mediaPreferences,
    brandConstraints: [],
    avoidPatterns,
  };
}

export function demoDefinition(
  idea: string,
  analysis: IdeaAnalysis,
  _questions: unknown,
  answers: ClarificationAnswer[],
): ProjectDefinition {
  const answerText = answers
    .map((answer) => `${answer.values.join(", ")} ${answer.custom}`.trim())
    .join(" | ");

  const platform = new Set(analysis.platform);
  if (/mobile/i.test(answerText)) platform.add("Mobile");
  if (/web/i.test(answerText)) platform.add("Web");

  const moduleFirst = /per module|vertical slice|end-to-end|module.first|per fitur/i.test(
    `${idea} ${answerText}`,
  );

  const features =
    analysis.coreFeatures.length > 0
      ? analysis.coreFeatures
      : [{ name: "Core Workspace", description: "Primary product workflow." }];

  return {
    name: analysis.suggestedName,
    summary: analysis.summary,
    platform: Array.from(platform.size > 0 ? platform : new Set(["Web"])),
    users: analysis.targetUsers,
    roles: analysis.roles,
    features,
    requirements: [
      "The product must work on the platforms listed above.",
      "Every feature must implement loading, empty, and error states.",
    ],
    businessRules: analysis.businessRules,
    constraints: analysis.constraints,
    nonGoals: analysis.nonGoals,
    integrations: analysis.integrations,
    technicalPreferences: analysis.technicalPreferences,
    visualDirection: detectVisualDirection(idea, analysis, answerText),
    implementation: { strategy: moduleFirst ? "module-first" : "frontend-first" },
  };
}

/* ------------------------------------------------------------------ */
/* Feature specifications                                             */
/* ------------------------------------------------------------------ */

const TEMPLATES: Record<
  Category,
  {
    description: string;
    purpose: string;
    requirements: string[];
    rules: string[];
    edgeCases: string[];
    acceptance: string[];
    flow: string[];
  }
> = {
  payment: {
    description: "Collect periodic payments and keep a verifiable record of every transaction.",
    purpose: "Collect periodic payments from users and keep a verifiable record of every transaction.",
    requirements: [
      "The user can see the outstanding amount for the current period.",
      "The user can start a payment and receive a payable reference.",
      "The system records provider reference, amount, and paid timestamp for every successful payment.",
      "An administrator can record a manual payment when the provider is unavailable.",
      "The user can see the payment history for previous periods.",
    ],
    rules: [
      "A payment is only marked paid after a confirmed provider callback or an administrator action.",
      "Amounts are stored as integers in the smallest currency unit.",
      "Duplicate callbacks for the same reference must not create a second payment.",
    ],
    edgeCases: [
      "The provider callback arrives before the user returns to the application.",
      "The user closes the payment page before completing it.",
      "Two callbacks arrive for the same reference.",
    ],
    acceptance: [
      "Outstanding amount matches the recorded payments.",
      "A repeated callback does not duplicate a payment record.",
    ],
    flow: [
      "User opens the payment section",
      "System lists outstanding bills",
      "User starts a payment",
      "System creates a pending payment and returns a payment reference",
      "User completes the payment with the provider",
      "System confirms the callback and marks the bill as paid",
    ],
  },
  marketplace: {
    description: "Publish listings and let other users contact the publisher.",
    purpose: "Let users publish listings and let other users contact the publisher without leaving the product.",
    requirements: [
      "The user can browse published listings with search and category filters.",
      "The user can open a listing to see its full detail.",
      "The user can publish a listing with title, description, price, and at least one photo.",
      "The user can contact the publisher from the listing detail.",
      "The publisher can mark a listing as sold or remove it.",
    ],
    rules: [
      "Only the owner can edit or remove a listing.",
      "Removed listings disappear from search results immediately.",
      "Contact details are only revealed after the user requests contact.",
    ],
    edgeCases: [
      "A listing with no photo is submitted.",
      "Two users edit the same listing concurrently.",
      "Search returns no result.",
    ],
    acceptance: [
      "Published listings appear in search results.",
      "A non-owner cannot edit or delete another user's listing.",
    ],
    flow: [
      "User opens the listing list",
      "System shows published listings",
      "User searches or filters",
      "User opens a listing detail",
      "User requests contact with the publisher",
      "System reveals contact details and records the request",
    ],
  },
  complaint: {
    description: "Submit reports and track them until they are resolved.",
    purpose: "Give users a trackable channel to report problems and give administrators a queue to resolve them.",
    requirements: [
      "The user can submit a complaint with category, description, and optional photo.",
      "The user can see the status of every complaint they submitted.",
      "The administrator can see all complaints and change their status.",
      "The system records status transitions with actor and timestamp.",
    ],
    rules: [
      "A complaint always has one of: open, in progress, resolved, rejected.",
      "Only an administrator can move a complaint to resolved or rejected.",
      "A resolved complaint cannot be reopened by the user.",
    ],
    edgeCases: [
      "The user submits an empty description.",
      "Two administrators update the same complaint.",
      "The attached photo exceeds the size limit.",
    ],
    acceptance: [
      "A submitted complaint appears in the user's complaint list.",
      "Status changes are visible to the reporter.",
    ],
    flow: [
      "User opens the complaint section",
      "User creates a complaint and chooses a category",
      "User writes the description and submits",
      "System creates the complaint with status open",
      "Administrator reviews and updates the status",
      "User sees the updated status",
    ],
  },
  panic: {
    description: "Request emergency assistance with an intentional confirmation step.",
    purpose: "Allow users to request emergency assistance quickly and reliably.",
    requirements: [
      "The user can activate an emergency request.",
      "Activation requires an intentional confirmation step.",
      "The system records the requester and trigger time.",
      "The responsible party is notified immediately.",
      "The user can cancel an accidental activation within a short window.",
    ],
    rules: [
      "Only one active emergency request per user at a time.",
      "Every activation is logged permanently, including cancellations.",
    ],
    edgeCases: [
      "The user activates the button without network connectivity.",
      "The user activates twice within the confirmation window.",
      "No responsible party is currently on duty.",
    ],
    acceptance: [
      "Accidental activation is prevented by the confirmation step.",
      "The requester and trigger time are recorded for every event.",
    ],
    flow: [
      "User opens the emergency action",
      "System asks for intentional confirmation",
      "User confirms",
      "System creates the emergency event",
      "System notifies the responsible party",
      "User sees the result and escalation status",
    ],
  },
  announcement: {
    description: "Publish announcements that reach the intended audience.",
    purpose: "Publish announcements that reach the intended audience and stay readable over time.",
    requirements: [
      "The administrator can publish an announcement with title and body.",
      "Users can see the announcement list ordered by publish date.",
      "Users can open a single announcement.",
      "The administrator can edit or remove an announcement.",
    ],
    rules: [
      "Published announcements are visible to every user in the audience.",
      "Removed announcements are no longer visible but stay in the audit log.",
    ],
    edgeCases: [
      "An announcement is published with an empty body.",
      "An announcement is removed while a user is reading it.",
    ],
    acceptance: [
      "A published announcement appears at the top of the list.",
      "Removed announcements disappear for every user.",
    ],
    flow: [
      "Administrator opens the announcement section",
      "Administrator creates an announcement",
      "System validates and publishes it",
      "User opens the announcement list",
      "User reads the announcement",
    ],
  },
  chat: {
    description: "Exchange messages inside the product's own workflows.",
    purpose: "Let users exchange messages in the context of the product without leaving it.",
    requirements: [
      "The user can open a conversation and see its message history.",
      "The user can send a message that appears for the other participant.",
      "The system indicates unread messages.",
    ],
    rules: [
      "A conversation is only visible to its participants.",
      "Messages keep their original send order.",
    ],
    edgeCases: [
      "A message is sent while offline.",
      "The other participant deletes their account.",
    ],
    acceptance: [
      "Sent messages appear in the conversation history.",
      "Unread counters reset after the conversation is opened.",
    ],
    flow: [
      "User opens the conversation list",
      "User selects a conversation",
      "System shows the message history",
      "User sends a message",
      "System delivers the message and updates the unread state",
    ],
  },
  booking: {
    description: "Reserve a limited resource without double booking.",
    purpose: "Let users reserve a limited resource and let administrators control availability.",
    requirements: [
      "The user can see availability for a selected period.",
      "The user can create a booking for an available slot.",
      "The administrator can block or release a slot.",
      "The system prevents double booking of the same slot.",
    ],
    rules: [
      "A slot can only be booked by one user at a time.",
      "Cancellation frees the slot immediately.",
    ],
    edgeCases: [
      "Two users book the same slot at the same moment.",
      "The user cancels after the allowed window.",
    ],
    acceptance: [
      "An already booked slot cannot be booked again.",
      "Cancelled slots become available.",
    ],
    flow: [
      "User opens the availability view",
      "User selects a period",
      "System shows available slots",
      "User confirms a booking",
      "System reserves the slot and shows the confirmation",
    ],
  },
  reporting: {
    description: "Give administrators an accurate operational summary.",
    purpose: "Give administrators an accurate operational summary they can act on.",
    requirements: [
      "The administrator can view totals for the current period.",
      "The administrator can filter the summary by date range.",
      "The administrator can export the summary.",
    ],
    rules: [
      "Summary numbers are derived from recorded events, never recalculated by hand.",
      "Only administrators can access the summary.",
    ],
    edgeCases: ["The selected period has no data.", "The user is not an administrator."],
    acceptance: [
      "Totals match the underlying records.",
      "Non-administrators receive a forbidden response.",
    ],
    flow: [
      "Administrator opens the summary",
      "System loads the current period totals",
      "Administrator adjusts the date filter",
      "System recalculates and displays the totals",
    ],
  },
  auth: {
    description: "Identify users and protect the features behind an account.",
    purpose: "Identify users reliably and protect the features that require an account.",
    requirements: [
      "The user can register with an identifier and a secret.",
      "The user can sign in and stay signed in across sessions.",
      "The user can sign out from any screen.",
      "Protected routes reject unauthenticated access.",
    ],
    rules: [
      "Passwords or secrets are never stored in plain text.",
      "Only an administrator can change another user's role.",
    ],
    edgeCases: [
      "The user submits a duplicate identifier.",
      "The session expires while the user is working.",
    ],
    acceptance: [
      "A protected route redirects unauthenticated users.",
      "Signing out invalidates the session.",
    ],
    flow: [
      "User opens the sign-in screen",
      "User submits credentials",
      "System validates and creates a session",
      "System redirects to the requested protected screen",
    ],
  },
  generic: {
    description: "Deliver this feature's workflow end to end.",
    purpose: "Deliver the workflow described in the project definition.",
    requirements: [
      "The user can open the feature and see its current state.",
      "The user can complete the primary action of the feature.",
      "The system refuses invalid input with a clear message.",
    ],
    rules: ["Only authorised users may perform state-changing actions."],
    edgeCases: ["The data set is empty.", "The request fails."],
    acceptance: ["The primary action completes and the result is visible."],
    flow: ["User opens the feature", "System loads the current state", "User performs the action", "System records and confirms the result"],
  },
};

interface SurfaceBlueprint {
  key: string;
  name: string;
  purpose: string;
  states: string[];
}

const SURFACE_BLUEPRINTS: Record<Category, SurfaceBlueprint[]> = {
  payment: [
    {
      key: "overview",
      name: "Payments overview",
      purpose: "Review every invoice, its due date, and its payment status.",
      states: ["loading", "empty", "populated", "error"],
    },
    {
      key: "detail",
      name: "Payment detail",
      purpose: "Open one invoice, confirm the amount, and record the payment.",
      states: ["loading", "populated", "validation", "success", "error"],
    },
  ],
  marketplace: [
    {
      key: "browse",
      name: "Listings",
      purpose: "Browse and search the listings published by the community.",
      states: ["loading", "empty", "populated", "error"],
    },
    {
      key: "detail",
      name: "Listing detail",
      purpose: "Open one listing and contact the seller.",
      states: ["loading", "populated", "error"],
    },
  ],
  complaint: [
    {
      key: "inbox",
      name: "Complaints",
      purpose: "Review incoming complaints and their progress.",
      states: ["loading", "empty", "populated", "error"],
    },
    {
      key: "detail",
      name: "Complaint detail and action",
      purpose: "Open one complaint, add evidence, and move it forward.",
      states: ["loading", "populated", "validation", "success", "error"],
    },
  ],
  panic: [
    {
      key: "trigger",
      name: "Panic trigger",
      purpose: "Request emergency assistance with an intentional confirmation.",
      states: ["idle", "confirming", "sending", "success", "error"],
    },
    {
      key: "history",
      name: "Panic history",
      purpose: "Review past emergency events and how they were resolved.",
      states: ["loading", "empty", "populated", "error"],
    },
  ],
  announcement: [
    {
      key: "inbox",
      name: "Announcements",
      purpose: "Read the latest announcements published to the community.",
      states: ["loading", "empty", "populated", "error"],
    },
    {
      key: "detail",
      name: "Announcement detail",
      purpose: "Read one announcement in full and keep its attachments.",
      states: ["loading", "populated", "error"],
    },
  ],
  chat: [
    {
      key: "inbox",
      name: "Conversations",
      purpose: "See every conversation and open the one that needs attention.",
      states: ["loading", "empty", "populated", "error"],
    },
    {
      key: "thread",
      name: "Conversation thread",
      purpose: "Read and send messages inside one conversation.",
      states: ["loading", "populated", "sending", "error"],
    },
  ],
  booking: [
    {
      key: "calendar",
      name: "Bookings",
      purpose: "See which resources are booked and which are still available.",
      states: ["loading", "empty", "populated", "error"],
    },
    {
      key: "detail",
      name: "Booking detail",
      purpose: "Open one booking, change it, or cancel it with confirmation.",
      states: ["loading", "populated", "validation", "success", "error"],
    },
  ],
  reporting: [
    {
      key: "dashboard",
      name: "Reporting dashboard",
      purpose: "Read the periodic summaries that drive decisions.",
      states: ["loading", "empty", "populated", "error"],
    },
  ],
  auth: [
    {
      key: "signin",
      name: "Sign in",
      purpose: "Authenticate before reaching the protected screens.",
      states: ["idle", "validation", "submitting", "error"],
    },
    {
      key: "recovery",
      name: "Account recovery",
      purpose: "Recover access when the credentials are no longer available.",
      states: ["idle", "validation", "submitting", "success", "error"],
    },
  ],
  generic: [
    {
      key: "overview",
      name: "Overview",
      purpose: "Review every record and its current state.",
      states: ["loading", "empty", "populated", "error"],
    },
    {
      key: "detail",
      name: "Record detail",
      purpose: "Open one record, review its history, and act on it.",
      states: ["loading", "populated", "validation", "success", "error"],
    },
  ],
};

const MEDIA_REQUIREMENTS: Partial<Record<Category, string[]>> = {
  marketplace: ["A listing photo supplied by the seller", "A seller avatar"],
  complaint: ["Optional photo evidence attached to a complaint"],
  announcement: ["An optional cover image for the announcement"],
};

export function demoFeatures(definition: ProjectDefinition): FeatureSpec[] {
  return definition.features.map((outline) => {
    const category = detectCategory(`${outline.name} ${outline.description}`);
    const template = TEMPLATES[category];
    const prefix = makePrefix(outline.name);
    const actors = definition.users.length > 0 ? definition.users.slice(0, 2) : ["User"];
    const featureId = slugId(outline.name, "feature");
    const blueprints = SURFACE_BLUEPRINTS[category];

    return {
      id: featureId,
      prefix,
      name: outline.name,
      purpose: outline.description || template.purpose,
      actors,
      mainFlow: template.flow,
      requirements: template.requirements.map((text, index) => ({
        id: `${prefix}-${String(index + 1).padStart(3, "0")}`,
        text,
      })),
      businessRules: template.rules,
      edgeCases: template.edgeCases,
      acceptanceCriteria: template.acceptance,
      userFacing: true,
      uiSurfaces: blueprints.map((blueprint) => ({
        id: `${featureId}-${blueprint.key}`,
        name: blueprint.name,
        purpose: blueprint.purpose,
        states: blueprint.states,
      })),
      mediaRequirements: MEDIA_REQUIREMENTS[category] ?? [],
    };
  });
}

/* ------------------------------------------------------------------ */
/* Documents                                                          */
/* ------------------------------------------------------------------ */

export function demoPrd(definition: ProjectDefinition, features: FeatureSpec[]): SpecDocument {
  const paragraphs = (text: string) => [{ type: "paragraph" as const, text }];
  const bullets = (items: string[]) => [{ type: "bullets" as const, items }];

  return {
    title: `Product Requirements Document — ${definition.name}`,
    summary: definition.summary,
    sections: [
      {
        id: "product-overview",
        title: "Product Overview",
        blocks: bullets([
          `Product name: ${definition.name}`,
          `Summary: ${definition.summary}`,
          `Platform: ${definition.platform.join(", ")}`,
          `Users: ${definition.users.join(", ")}`,
        ]),
      },
      {
        id: "problem-statement",
        title: "Problem Statement",
        blocks: paragraphs(
          `Users currently complete this work without a single structured tool, which causes duplicated effort and lost information.`,
        ),
      },
      {
        id: "product-goals",
        title: "Product Goals",
        blocks: bullets([
          "Provide one place to complete the core workflows end to end.",
          "Make the state of every request visible to the user who created it.",
          "Reduce manual coordination for administrators.",
        ]),
      },
      {
        id: "target-users",
        title: "Target Users",
        blocks: bullets(definition.users),
      },
      {
        id: "user-roles",
        title: "User Roles",
        blocks: bullets(
          definition.roles.map(
            (role) => `**${role.name}** — ${role.description || role.responsibilities.join(", ")}`,
          ),
        ),
      },
      {
        id: "core-features",
        title: "Core Features",
        blocks: bullets(features.map((feature) => `**${feature.name}** — ${feature.purpose}`)),
      },
      {
        id: "functional-requirements",
        title: "Functional Requirements",
        blocks: features.map((feature) => ({
          type: "bullets" as const,
          items: feature.requirements.map((requirement) => `${requirement.id} ${requirement.text}`),
        })),
      },
      {
        id: "user-flows",
        title: "User Flows",
        blocks: features.slice(0, 4).map((feature) => ({
          type: "steps" as const,
          items: [`${feature.name}:`, ...feature.mainFlow],
        })),
      },
      {
        id: "business-rules",
        title: "Business Rules",
        blocks: bullets(features.flatMap((feature) => feature.businessRules)),
      },
      {
        id: "edge-cases",
        title: "Edge Cases",
        blocks: bullets(features.flatMap((feature) => feature.edgeCases)),
      },
      {
        id: "non-functional-requirements",
        title: "Non-Functional Requirements",
        blocks: bullets([
          "The authoring experience must work on desktop and tablet.",
          "Every long-running action must show progress.",
          "A failed step must not discard already generated content.",
        ]),
      },
      {
        id: "non-goals",
        title: "Non-Goals",
        blocks: bullets(
          definition.nonGoals.length > 0 ? definition.nonGoals : ["Nothing outside the core features."],
        ),
      },
      {
        id: "mvp-scope",
        title: "MVP Scope",
        blocks: bullets([
          `In scope: ${features.map((feature) => feature.name).join(", ")}.`,
          "Deferred: advanced automation, analytics, and anything listed under Non-Goals.",
        ]),
      },
    ],
  };
}

export function demoFlows(definition: ProjectDefinition, features: FeatureSpec[]): UserFlow[] {
  return features.map((feature) => ({
    id: `${feature.id}-flow`,
    name: feature.name,
    featureId: feature.id,
    primaryActor: feature.actors[0] ?? definition.users[0] ?? "User",
    trigger: feature.mainFlow[0] ?? "The user opens the feature.",
    steps: feature.mainFlow,
    outcome: feature.acceptanceCriteria[0] ?? "The action completes successfully.",
  }));
}

interface PaletteTokens {
  canvas: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  foreground: string;
  mutedForeground: string;
  primary: string;
  primaryHover: string;
  primarySoft: string;
  ring: string;
  success: string;
  warning: string;
  danger: string;
}

const PALETTES: Record<"indigo" | "ocean" | "ember", { light: PaletteTokens; dark: PaletteTokens }> = {
  indigo: {
    light: {
      canvas: "#f7f8fb",
      surface: "#ffffff",
      surfaceMuted: "#f8fafc",
      border: "#e6e8ef",
      borderStrong: "#d5d9e4",
      foreground: "#0f172a",
      mutedForeground: "#64748b",
      primary: "#4f46e5",
      primaryHover: "#4338ca",
      primarySoft: "#eef1fe",
      ring: "#a5b4fc",
      success: "#15803d",
      warning: "#b45309",
      danger: "#b91c1c",
    },
    dark: {
      canvas: "#0b1120",
      surface: "#111827",
      surfaceMuted: "#161f31",
      border: "#1f2937",
      borderStrong: "#334155",
      foreground: "#f8fafc",
      mutedForeground: "#94a3b8",
      primary: "#818cf8",
      primaryHover: "#a5b4fc",
      primarySoft: "#1e1b4b",
      ring: "#6366f1",
      success: "#4ade80",
      warning: "#fbbf24",
      danger: "#f87171",
    },
  },
  ocean: {
    light: {
      canvas: "#f6f8fa",
      surface: "#ffffff",
      surfaceMuted: "#f7f9fb",
      border: "#e3e8ef",
      borderStrong: "#cfd8e3",
      foreground: "#0d1b2a",
      mutedForeground: "#5b6b7c",
      primary: "#0f766e",
      primaryHover: "#115e59",
      primarySoft: "#ecfdf5",
      ring: "#5eead4",
      success: "#15803d",
      warning: "#b45309",
      danger: "#b91c1c",
    },
    dark: {
      canvas: "#08131a",
      surface: "#0f1f27",
      surfaceMuted: "#132730",
      border: "#1d3640",
      borderStrong: "#2c4a55",
      foreground: "#f1f5f9",
      mutedForeground: "#93a7b5",
      primary: "#2dd4bf",
      primaryHover: "#5eead4",
      primarySoft: "#0f2f2b",
      ring: "#14b8a6",
      success: "#4ade80",
      warning: "#fbbf24",
      danger: "#f87171",
    },
  },
  ember: {
    light: {
      canvas: "#fdf9f5",
      surface: "#ffffff",
      surfaceMuted: "#fbf6f1",
      border: "#eee2d8",
      borderStrong: "#dfcdbd",
      foreground: "#211a15",
      mutedForeground: "#7a6a5d",
      primary: "#c2410c",
      primaryHover: "#9a3412",
      primarySoft: "#fff2e8",
      ring: "#fdba74",
      success: "#15803d",
      warning: "#b45309",
      danger: "#b91c1c",
    },
    dark: {
      canvas: "#140f0c",
      surface: "#1e1712",
      surfaceMuted: "#251c16",
      border: "#33261d",
      borderStrong: "#4a3729",
      foreground: "#fdf6f0",
      mutedForeground: "#b8a396",
      primary: "#fb923c",
      primaryHover: "#fdba74",
      primarySoft: "#3a1d0c",
      ring: "#f97316",
      success: "#4ade80",
      warning: "#fbbf24",
      danger: "#f87171",
    },
  },
};

const COLOR_USAGE: Record<keyof PaletteTokens, string> = {
  canvas: "page background behind every surface",
  surface: "cards, panels, popovers, and the main content area",
  surfaceMuted: "table headers, inset sections, and read-only rows",
  border: "default divider and card outline",
  borderStrong: "input borders and emphasised separation",
  foreground: "headings and primary text",
  mutedForeground: "secondary text, captions, and metadata",
  primary: "primary buttons, links, and the active navigation item",
  primaryHover: "hover and pressed state of primary elements",
  primarySoft: "selected rows, active navigation background, subtle highlights",
  ring: "focus ring on every interactive element",
  success: "success feedback, successful status badges, and confirmed actions",
  warning: "warning feedback, pending status badges, and cautionary notices",
  danger: "danger actions, error feedback, and destructive confirmations",
};

const SAMPLE_CONTENT: Record<Category, string[]> = {
  payment: [
    "Iuran Juli 2026 — Rp 150.000 — paid on 5 Jul 2026",
    "Iuran Agustus 2026 — Rp 150.000 — pending",
    "Iuran Juni 2026 — Rp 150.000 — paid on 3 Jun 2026",
  ],
  marketplace: [
    "Sepeda lipat 20 inci — Rp 1.250.000 — published 3 days ago",
    "Etalase kayu jati — Rp 350.000 — published today",
    "Kipas angin dinding — Rp 180.000 — sold",
  ],
  complaint: [
    "Lampu jalan mati di Blok C — in progress, 2 days open",
    "Sampah tidak terangkut sejak Senin — open",
    "Kebocoran pipa di Blok A — resolved 12 Jul 2026",
  ],
  panic: [
    "Active emergency — Blok B2 — triggered 21:04",
    "Resolved — Blok A1 — 12 Jul 2026 18:20",
    "No active emergency events in the last 30 days",
  ],
  announcement: [
    "Kerja bakti lingkungan — published today",
    "Pemadaman air sementara — published 2 days ago",
    "Jadwal ronda malam — updated yesterday",
  ],
  chat: [
    "Rina — “Pesanan sudah dikirim” — 2 unread",
    "Budi — “Terima kasih, sudah diterima” — read 09:12",
  ],
  booking: [
    "Balai warga — 20 Jul 2026, 09:00–11:00 — booked by Rina",
    "Lapangan futsal — 21 Jul 2026, 19:00 — available",
  ],
  reporting: [
    "Collected this month — Rp 12.450.000 (+8% vs last month)",
    "Open complaints — 7 · resolved this week — 12",
    "Payments this period — 83 records",
  ],
  auth: ["resident@example.com", "administrator@example.com", "Two-factor code: 482913"],
  generic: [
    "Record 1 — status open — updated today",
    "Another sample record with a realistic title and date",
    "An older record in a completed state",
  ],
};

const DESIGN_COMPONENTS: UiDesignSpec["components"] = [
  {
    name: "AppShell",
    purpose: "Frame every authenticated screen with navigation, header, and content area.",
    variants: ["with sidebar", "with top bar only"],
    states: ["default"],
    rules: ["Content width is capped at 1120px and never stretches edge to edge on desktop."],
  },
  {
    name: "NavigationItem",
    purpose: "Move between the main sections of the product.",
    variants: ["default", "collapsed"],
    states: ["default", "hover", "focus-visible", "active"],
    rules: ["The active item uses the primary-soft background plus a primary icon and text."],
  },
  {
    name: "FilterBar",
    purpose: "Narrow a result list with search, status, and date controls.",
    variants: ["inline", "collapsed sheet"],
    states: ["default", "focus-visible", "loading", "empty"],
    rules: [
      "Filters apply without a full page reload and keep the current scroll position.",
      "Below 768px the bar collapses into a single button that opens a sheet.",
    ],
  },
  {
    name: "PageHeader",
    purpose: "Name the screen and hold its primary action.",
    variants: ["with actions", "read-only"],
    states: ["default", "loading"],
    rules: ["Exactly one primary action; secondary actions are ghost buttons."],
  },
  {
    name: "Button",
    purpose: "Trigger an action.",
    variants: ["primary", "secondary", "ghost", "danger"],
    states: ["default", "hover", "focus-visible", "active", "disabled", "loading"],
    rules: ["A loading button keeps its width and blocks a second submit."],
  },
  {
    name: "FormField",
    purpose: "Label, hint, control, and validation message as one unit.",
    variants: ["default", "inline"],
    states: ["default", "focus-visible", "invalid", "disabled"],
    rules: ["The error message sits below the control and replaces the hint, never both at once."],
  },
  {
    name: "Input",
    purpose: "Collect a single line of text, number, or date.",
    variants: ["text", "number", "date", "search"],
    states: ["default", "hover", "focus-visible", "invalid", "disabled"],
    rules: ["Never rely on placeholder text as the label."],
  },
  {
    name: "Textarea",
    purpose: "Collect a longer description.",
    variants: ["default", "auto-resize"],
    states: ["default", "focus-visible", "invalid", "disabled"],
    rules: ["Show the character limit when the field has one."],
  },
  {
    name: "Select",
    purpose: "Choose one value from a short list.",
    variants: ["default", "filter"],
    states: ["default", "open", "focus-visible", "invalid", "disabled"],
    rules: ["Never style the native select; use the shared dropdown."],
  },
  {
    name: "Card",
    purpose: "Group related information under one heading.",
    variants: ["default", "interactive", "muted"],
    states: ["default", "hover", "focus-visible"],
    rules: ["Cards use the surface color, the border token, and the card radius."],
  },
  {
    name: "Table",
    purpose: "Show many records with comparable fields.",
    variants: ["default", "compact"],
    states: ["loading", "empty", "populated", "error"],
    rules: ["Headers use the label typography; numeric columns align right with tabular numbers."],
  },
  {
    name: "StatusBadge",
    purpose: "Show the workflow state of a record.",
    variants: ["neutral", "success", "warning", "danger", "primary"],
    states: ["default"],
    rules: ["Always pair the color with the status text; never signal state by color alone."],
  },
  {
    name: "EmptyState",
    purpose: "Explain that there is no data yet and what to do next.",
    variants: ["first use", "no results"],
    states: ["default"],
    rules: ["Every empty state carries one sentence of explanation and one primary action."],
  },
  {
    name: "ErrorState",
    purpose: "Explain that a request failed and offer a retry.",
    variants: ["inline", "full screen"],
    states: ["default", "retrying"],
    rules: ["Always show a retry action and keep the user's filter or form input."],
  },
  {
    name: "Skeleton",
    purpose: "Hold the layout while data loads.",
    variants: ["text", "row", "card"],
    states: ["default"],
    rules: ["Match the size of the content it replaces; never use a spinner for a full list."],
  },
  {
    name: "Toast",
    purpose: "Confirm an action without blocking the screen.",
    variants: ["success", "error", "info"],
    states: ["entering", "visible", "leaving"],
    rules: ["Auto-dismiss after 4 seconds; errors stay until dismissed."],
  },
  {
    name: "ConfirmDialog",
    purpose: "Confirm an action that cannot be undone.",
    variants: ["default", "danger"],
    states: ["default", "submitting", "error"],
    rules: ["The confirm button names the action, and the destructive variant is required for deletion."],
  },
  {
    name: "Pagination",
    purpose: "Move through long result sets.",
    variants: ["numbered", "load more"],
    states: ["default", "loading", "disabled"],
    rules: ["Keep the current page visible while the next page loads."],
  },
];

const PLATFORM_PROFILES: Record<
  string,
  { navigation: string; units: string; inputModes: string[]; safeAreas: string; resizing: string; adaptiveBehavior: string }
> = {
  web: {
    navigation: "Persistent navigation with a visible focus order and deep-linkable screens.",
    units: "CSS px with rem-based typography and spacing.",
    inputModes: ["pointer", "keyboard", "touch"],
    safeAreas: "Browser chrome, on-screen keyboards, and mobile URL bars.",
    resizing: "Fluid layout that honours the documented breakpoints.",
    adaptiveBehavior: "Reflows between the documented breakpoints without hiding primary actions.",
  },
  ios: {
    navigation: "Native navigation stack with a tab bar for top-level sections.",
    units: "Points (pt) with dynamic type where the platform expects it.",
    inputModes: ["touch", "keyboard", "pointer"],
    safeAreas: "Notch, dynamic island, and home indicator insets.",
    resizing: "Adapts to split view, stage manager, and orientation changes.",
    adaptiveBehavior: "Uses size classes to switch between compact and regular layouts.",
  },
  android: {
    navigation: "Material navigation patterns: bottom navigation or navigation rail.",
    units: "Density-independent pixels (dp) with scalable pixels (sp) for text.",
    inputModes: ["touch", "keyboard", "stylus"],
    safeAreas: "Status bar, navigation bar, and gesture insets.",
    resizing: "Adapts to foldables, split-screen, and orientation changes.",
    adaptiveBehavior: "Uses window size classes to choose list-only, list-detail, or supporting-pane layouts.",
  },
  desktop: {
    navigation: "Menu bar or persistent side navigation with full keyboard shortcuts.",
    units: "Logical pixels that respect operating-system scaling.",
    inputModes: ["pointer", "keyboard", "trackpad"],
    safeAreas: "Window chrome, title bar, and operating-system scaling.",
    resizing: "Honours a documented minimum window size and remembers the last window state.",
    adaptiveBehavior: "Expands panels and multi-column layouts as the window grows.",
  },
  mobile: {
    navigation: "Compact push navigation with one primary action per screen.",
    units: "Platform-native density-independent units.",
    inputModes: ["touch", "keyboard"],
    safeAreas: "Device insets and on-screen keyboards.",
    resizing: "Adapts across phone sizes and orientations.",
    adaptiveBehavior: "Collapses secondary panels into progressive disclosure.",
  },
  tablet: {
    navigation: "Split navigation that keeps the primary list beside the detail pane.",
    units: "Platform-native density-independent units.",
    inputModes: ["touch", "pointer", "keyboard"],
    safeAreas: "Device insets in both orientations.",
    resizing: "Adapts across tablet sizes, split view, and orientation changes.",
    adaptiveBehavior: "Uses list-detail layouts and keeps secondary actions reachable.",
  },
};

function platformProfile(platform: string) {
  const key = platform.trim().toLowerCase();
  const profile = PLATFORM_PROFILES[key] ?? PLATFORM_PROFILES.web;
  return { platform: platform.trim() || "web", ...profile };
}

function requiresAuthentication(definition: ProjectDefinition) {
  const excluded = definition.nonGoals.some((goal) =>
    /auth|account|login|sign[ -]?in|akun|masuk/i.test(goal),
  );
  if (excluded) return false;
  const rolesImplyAccounts = definition.roles.some((role) =>
    /admin|owner|staff|operator|manager|moderator/i.test(role.name),
  );
  const prefers = definition.technicalPreferences.some((preference) =>
    /auth/i.test(preference.component),
  );
  const featureImplies = definition.features.some((feature) =>
    /login|auth|akun|account|register|sign/i.test(`${feature.name} ${feature.description}`),
  );
  return prefers || featureImplies || rolesImplyAccounts;
}

function screenForSurface(
  surface: { id: string; name: string; purpose: string; states: string[] },
  feature: FeatureSpec,
  samples: string[],
) {
  const components = [
    "PageHeader",
    "Card",
    "FormField",
    "Input",
    "Textarea",
    "Select",
    "Button",
    "StatusBadge",
    "EmptyState",
    "ErrorState",
    "Skeleton",
    "ConfirmDialog",
    "Toast",
  ];
  return {
    id: surface.id,
    name: surface.name,
    featureId: feature.id,
    purpose:
      surface.purpose ||
      `Complete the ${surface.name.toLowerCase()} step of the ${feature.name.toLowerCase()} flow.`,
    layout: [
      `Page header: ${surface.name} with exactly one primary action`,
      `Context strip: the identity of the record plus the one fact that decides the next step`,
      `Working region: the ${feature.name.toLowerCase()} content this screen exists for`,
      "Feedback region: inline validation, confirmation, and the safe exit for destructive actions",
    ],
    components,
    states: surface.states.length > 0 ? surface.states : ["loading", "empty", "populated", "error"],
    responsive: [
      "Below 768px the working region becomes a single column and the primary action stays reachable",
      "The documented breakpoints change density, never the information hierarchy",
    ],
    sampleContent: samples,
    assetIds: [] as string[],
  };
}

function genericScreensForFeature(feature: FeatureSpec, samples: string[]) {
  const components = [
    "PageHeader",
    "FilterBar",
    "Table",
    "StatusBadge",
    "Pagination",
    "EmptyState",
    "ErrorState",
    "Skeleton",
  ];
  return [
    {
      id: `${feature.id}-list`,
      name: `${feature.name} list`,
      featureId: feature.id,
      purpose: `Browse, search, and filter every ${feature.name.toLowerCase()} record the actor is allowed to see.`,
      layout: [
        "PageHeader: screen title, record count, and the primary action",
        "FilterBar: search input, status filter, and date range",
        "Table: one row per record with the fields that identify it and a status badge",
        "Pagination footer showing the current range and total",
      ],
      components,
      states: ["loading", "empty", "populated", "error"],
      responsive: [
        "below 768px the table becomes stacked cards with the record title as the card heading",
        "the filter bar collapses into a single button that opens a sheet",
      ],
      sampleContent: samples,
      assetIds: [] as string[],
    },
    {
      id: `${feature.id}-detail`,
      name: `${feature.name} detail and action`,
      featureId: feature.id,
      purpose: `Open one ${feature.name.toLowerCase()} record and act on it.`,
      layout: [
        "PageHeader: record title, StatusBadge, and secondary actions",
        "Summary block with the fields that identify the record",
        "Main action area holding the form or the workflow action",
        "ConfirmDialog for any destructive action",
      ],
      components: [
        "PageHeader",
        "StatusBadge",
        "Card",
        "FormField",
        "Input",
        "Textarea",
        "Select",
        "Button",
        "ConfirmDialog",
        "Toast",
      ],
      states: ["loading", "populated", "validation", "success", "error"],
      responsive: [
        "below 768px the summary block stacks and the primary action becomes a sticky bottom bar",
      ],
      sampleContent: samples.slice(0, 2),
      assetIds: [] as string[],
    },
  ];
}

function iconDependencyForPlatforms(platforms: string[]) {
  const supported = (value: string, library: string) => {
    const match = platforms.some((platform) => platform.trim().toLowerCase() === value);
    return match ? library : "";
  };
  const libraries = [
    { name: supported("web", "lucide-react") || supported("desktop", "lucide-react"), purpose: "Interface iconography for web and desktop surfaces" },
    { name: supported("ios", "SF Symbols"), purpose: "Native iconography on iOS" },
    { name: supported("android", "Material Symbols"), purpose: "Material iconography on Android" },
    { name: supported("mobile", "lucide-react-native"), purpose: "Iconography on cross-platform mobile builds" },
    { name: supported("tablet", "lucide-react"), purpose: "Iconography on tablet layouts" },
  ];
  return libraries
    .filter((entry) => entry.name)
    .map((entry) => ({
      name: entry.name,
      purpose: entry.purpose,
      source: "recommended" as const,
      platforms: platforms.slice(),
    }));
}

export function demoUiDesign(definition: ProjectDefinition, features: FeatureSpec[]): UiDesignSpec {
  const direction = definition.visualDirection;
  const themeMode =
    direction.themeMode === "dark" || direction.themeMode === "both" ? direction.themeMode : "light";
  const categories = features.map((feature) => detectCategory(`${feature.name} ${feature.purpose}`));
  const paletteKey: keyof typeof PALETTES = categories.some(
    (category) => category === "reporting" || category === "payment",
  )
    ? "ocean"
    : categories.some((category) => category === "marketplace" || category === "announcement")
      ? "ember"
      : "indigo";

  const palette = PALETTES[paletteKey].light;
  const darkPalette = PALETTES[paletteKey].dark;
  const tokenName = (key: string) => `--color-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`;

  const colorTokens: UiDesignSpec["colorTokens"] = (Object.keys(COLOR_USAGE) as (keyof PaletteTokens)[]).map(
    (key) => ({
      name: tokenName(key),
      value: (themeMode === "dark" ? darkPalette : palette)[key],
      usage: COLOR_USAGE[key],
    }),
  );

  if (themeMode === "both") {
    for (const key of Object.keys(COLOR_USAGE) as (keyof PaletteTokens)[]) {
      colorTokens.push({
        name: `--dark-${tokenName(key).replace(/^--/, "")}`,
        value: darkPalette[key],
        usage: `dark theme override for ${COLOR_USAGE[key]}`,
      });
    }
  }

  const screens: UiDesignSpec["screens"] = [];

  if (requiresAuthentication(definition)) {
    screens.push({
      id: "sign-in",
      name: "Sign in",
      featureId: "",
      purpose: "Authenticate a user before any protected screen is reachable.",
      layout: [
        "Centered card on the canvas background, max width 420px",
        "Product name and one sentence explaining the product",
        "Email field, password field, remember-me checkbox",
        "Primary sign-in button with inline error area",
      ],
      components: ["Card", "FormField", "Input", "Button"],
      states: ["idle", "loading", "validation", "error", "success"],
      responsive: ["on mobile the card fills the width with 16px side padding and the fields stretch"],
      sampleContent: SAMPLE_CONTENT.auth,
      assetIds: [],
    });
  }

  for (const feature of features) {
    const category = detectCategory(`${feature.name} ${feature.purpose}`);
    const samples = SAMPLE_CONTENT[category] ?? SAMPLE_CONTENT.generic;
    if (feature.uiSurfaces.length > 0) {
      for (const surface of feature.uiSurfaces) {
        screens.push(screenForSurface(surface, feature, samples));
      }
    } else {
      screens.push(...genericScreensForFeature(feature, samples));
    }
  }

  const primaryFeature = features[0];
  const featureScreens = primaryFeature
    ? screens.filter((screen) => screen.featureId === primaryFeature.id)
    : [];
  const momentScreens =
    featureScreens.length >= 3
      ? featureScreens.slice(0, 3)
      : featureScreens.length === 2
        ? featureScreens
        : featureScreens.length === 1
          ? [featureScreens[0], featureScreens[0]]
          : [];
  const momentSuffixes = ["the anchor moment", "the feedback moment", "the payoff moment"];
  const signatureMoments: UiDesignSpec["signatureMoments"] = momentScreens.map((screen, index) => ({
    name: `${screen.name} — ${momentSuffixes[index] ?? "a designed moment"}`,
    description: `The ${screen.name} screen makes the ${primaryFeature?.name.toLowerCase() ?? "product"} work feel deliberate: it carries the ${definition.name} hierarchy, states, and tone through every step instead of settling for a default form.`,
    screenIds: [screen.id],
  }));

  const userSelectedIcons = definition.technicalPreferences
    .filter((preference) => /icon|iconograph/i.test(preference.component) && preference.technology)
    .map((preference) => ({
      name: preference.technology as string,
      purpose: `${preference.component} chosen explicitly by the user`,
      source: "user-selected" as const,
      platforms: definition.platform.slice(),
    }));

  const approvedDependencies: UiDesignSpec["approvedDependencies"] = [
    ...userSelectedIcons,
    ...iconDependencyForPlatforms(definition.platform),
  ];
  if (categories.some((category) => category === "reporting")) {
    const chartPlatforms = definition.platform.filter((platform) =>
      /web|desktop/i.test(platform),
    );
    if (chartPlatforms.length > 0) {
      approvedDependencies.push({
        name: "Recharts",
        purpose: "Accessible SVG charts for the reporting surfaces",
        source: "recommended",
        platforms: chartPlatforms,
      });
    }
  }

  return {
    overview: `${definition.name} is presented as a ${themeMode === "dark" ? "dark-themed" : themeMode === "both" ? "light and dark themed" : "light-themed"} ${definition.platform.join("/")} interface. Screens share one shell, one card style, one table style, and one accent color, so the product reads as a single application instead of a collection of pages.`,
    styleDirection:
      direction.style ||
      "Clean product interface: neutral surfaces, one accent color used only for primary actions and selected states, and strong typographic hierarchy.",
    creativeConcept: direction.personality
      ? `${direction.personality} — ${direction.style || "a focused product surface"}.`
      : `A ${direction.style || "deliberate, product-specific"} interface built around the ${primaryFeature?.name.toLowerCase() ?? definition.name.toLowerCase()} workflow rather than a generic dashboard.`,
    creativeRationale:
      direction.audienceContext || direction.desiredEmotion
        ? `Chosen for ${direction.audienceContext || "the documented audience"} so the product feels ${direction.desiredEmotion || "trustworthy and clear"} during repeated daily use.`
        : `Chosen because the documented audience uses this product repeatedly for the same workflow, so clarity and speed matter more than decoration.`,
    themeMode,
    principles: [
      "Every screen states the next action; no dead ends and no empty screens without guidance.",
      "One accent color marks the primary action and the current selection, and nothing else competes with it.",
      "Information is grouped into cards with a visible heading instead of long paragraphs.",
      "Every list screen implements the same loading, empty, and error skeleton before its populated state.",
      "Forms validate inline before submit and never discard what the user already typed.",
      themeMode === "dark"
        ? "Dark surfaces are the default; never use pure black, and keep text contrast at 4.5:1 or better."
        : "Light surfaces are the default; keep borders visible and shadows subtle.",
    ],
    signatureMoments,
    fontFamilies: [
      {
        family: "Inter",
        source: "Open-source variable font from theInter repository",
        fallback: "system-ui, -apple-system, Segoe UI, sans-serif",
        weights: ["400", "500", "600", "700"],
      },
      {
        family: "JetBrains Mono",
        source: "Open-source font from JetBrains",
        fallback: "ui-monospace, SFMono-Regular, Menlo, monospace",
        weights: ["400", "600"],
      },
    ],
    colorTokens,
    typographyScale: [
      { role: "Page title", size: "24px", weight: "600", lineHeight: "1.3", usage: "top-level heading of every screen" },
      { role: "Section title", size: "18px", weight: "600", lineHeight: "1.4", usage: "card and dialog headings" },
      { role: "Body", size: "14px", weight: "400", lineHeight: "1.6", usage: "paragraphs, table cells, and form values" },
      { role: "Body small", size: "13px", weight: "400", lineHeight: "1.55", usage: "secondary text, helper text, and metadata" },
      { role: "Label", size: "12px", weight: "600", lineHeight: "1.4", usage: "form labels, table headers, and section eyebrows" },
      { role: "Numeric", size: "20px", weight: "600", lineHeight: "1.3", usage: "amounts, totals, and KPI values; always tabular numerals" },
    ],
    spacingScale: [
      { name: "--space-1", value: "4px", usage: "gap between an icon and its label" },
      { name: "--space-2", value: "8px", usage: "gap inside a control group" },
      { name: "--space-3", value: "12px", usage: "padding inside compact controls" },
      { name: "--space-4", value: "16px", usage: "default padding inside cards and form rows" },
      { name: "--space-5", value: "24px", usage: "gap between cards and page gutters" },
      { name: "--space-6", value: "32px", usage: "gap between page sections" },
      { name: "--space-7", value: "48px", usage: "top and bottom padding of a page" },
      { name: "--space-8", value: "64px", usage: "space around an empty state" },
    ],
    radiusTokens: [
      { name: "--radius-control", value: "8px", usage: "buttons, inputs, and selects" },
      { name: "--radius-card", value: "12px", usage: "cards, panels, and table containers" },
      { name: "--radius-panel", value: "16px", usage: "dialogs and large surfaces" },
      { name: "--radius-pill", value: "999px", usage: "badges, chips, and avatars" },
    ],
    shadowTokens: [
      { name: "--shadow-card", value: "0 1px 2px rgba(15, 23, 42, 0.06)", usage: "resting cards and tables" },
      { name: "--shadow-raised", value: "0 8px 24px rgba(15, 23, 42, 0.10)", usage: "dropdowns, popovers, and sticky bars" },
      { name: "--shadow-overlay", value: "0 24px 60px rgba(15, 23, 42, 0.22)", usage: "dialogs and sheets" },
    ],
    layout: {
      shell:
        "Desktop: fixed left sidebar 240px, sticky top bar 56px, scrollable content area capped at 1120px with 24px gutters. Mobile: top bar with a menu button and one scrollable column.",
      navigation:
        "Primary sections live in the sidebar (or in the mobile sheet), ordered exactly like the product's features; the active item uses the primary-soft background.",
      grid:
        "12-column grid, 24px gutters, 1120px maximum content width. Detail forms use a single column capped at 640px; list screens use the full width.",
      breakpoints: [
        { name: "mobile", width: "< 640px", behavior: "single column, sidebar becomes a sheet, tables become stacked cards" },
        { name: "tablet", width: "640–1023px", behavior: "two-column grids, sidebar collapses to icons" },
        { name: "desktop", width: "≥ 1024px", behavior: "sidebar visible, multi-column dashboards, full tables" },
      ],
    },
    platformProfiles: definition.platform.map((platform) => platformProfile(platform)),
    approvedDependencies,
    components: DESIGN_COMPONENTS,
    screens,
    interactionRules: [
      "Interactive elements transition opacity, background, and border in 120–160ms ease-out; never animate layout.",
      "Every interactive element shows a visible focus ring using the ring token with a 2px offset.",
      "A submit button enters a loading state and blocks a second submission until the request settles.",
      "Actions that cannot be undone require a ConfirmDialog with a danger button that names the action.",
      "Success is confirmed with a toast; failures keep the user's input and show the reason inline next to the field or the action.",
      "Hover states are only used on elements that are actually clickable.",
    ],
    accessibilityRules: [
      "Body text meets 4.5:1 contrast against its surface; large text meets 3:1.",
      "Every input has a visible label tied to it, plus an accessible error message.",
      "Keyboard order follows the visual order, and the primary action is reachable without a mouse.",
      "Status is never communicated by color alone; always include text or an icon.",
      "Target sizes are at least 32px on desktop and 44px on touch screens.",
    ],
    contentRules: [
      "Render realistic domain data on every screen, never \"Lorem ipsum\", \"Item 1\", \"User A\", \"Test\", or \"Example\".",
      "Empty states explain why the list is empty and offer the action that fills it.",
      "Format dates as 12 Aug 2026, money with its currency code, and counts with thousand separators.",
      "Button labels are verbs in the user's language; error messages say what to do next, not only what failed.",
      "Use sentence case for labels and headings, and keep every visible string in the product's own language.",
    ],
    antiPatterns: [
      "No default browser form controls, unstyled tables, or raw HTML buttons.",
      "No emoji used as interface icons and no mixed icon families.",
      "No dashboard KPI tiles, gradient blobs, glassmorphism, or decorative icon tiles unless the requirements justify them.",
      "No generic list/detail/table pattern for products whose workflow does not need it.",
      "No placeholder copy such as \"Lorem ipsum\", \"Item 1\", or \"User A\".",
    ],
    visualQaRules: [
      "Run the product and inspect every documented screen at each documented breakpoint before the task is complete.",
      "Capture a screenshot per documented state and compare it with the hierarchy and composition described here.",
      "Verify every asset renders from its documented local path with the documented fallback in place.",
      "Confirm no screen shows default browser styling, inconsistent spacing, or an undocumented component.",
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Asset plan                                                        */
/* ------------------------------------------------------------------ */

const ASSET_SOURCES: AssetSource[] = [
  {
    id: "lucide",
    name: "Lucide",
    officialUrl: "https://lucide.dev",
    assetTypes: ["icon"],
    license: "ISC License",
    attributionRequired: false,
    platformRestrictions: ["web", "desktop"],
  },
  {
    id: "sf-symbols",
    name: "SF Symbols",
    officialUrl: "https://developer.apple.com/sf-symbols/",
    assetTypes: ["icon"],
    license: "Apple SF Symbols License",
    attributionRequired: false,
    platformRestrictions: ["iOS", "macOS"],
  },
  {
    id: "material-symbols",
    name: "Material Symbols",
    officialUrl: "https://fonts.google.com/icons",
    assetTypes: ["icon"],
    license: "Apache License 2.0",
    attributionRequired: false,
    platformRestrictions: ["Android", "web"],
  },
  {
    id: "unsplash",
    name: "Unsplash",
    officialUrl: "https://unsplash.com",
    assetTypes: ["photography"],
    license: "Unsplash License",
    attributionRequired: true,
    platformRestrictions: [],
  },
  {
    id: "undraw",
    name: "unDraw",
    officialUrl: "https://undraw.co",
    assetTypes: ["illustration"],
    license: "unDraw License",
    attributionRequired: false,
    platformRestrictions: [],
  },
];

function iconSystemForPlatform(platform: string): IconSystem {
  const key = platform.trim().toLowerCase();
  const shared = {
    platform: platform.trim() || "web",
    size: "20px (16px inside dense rows)",
    stroke: "1.75px stroke, never scaled unevenly",
    fill: "Outlined icons only; filled variants are reserved for the selected state",
    opticalAlignment: "Optically centered on the text baseline with an 8px gap",
    color: "currentColor mapped to the surrounding text token",
    accessibility:
      "Decorative icons are hidden from assistive technology; action icons carry an accessible label",
  };

  if (key === "ios" || key === "ipados") {
    return {
      ...shared,
      family: "SF Symbols",
      mappings: [
        { action: "Search", icon: "magnifyingglass" },
        { action: "Create", icon: "plus" },
        { action: "Delete", icon: "trash" },
        { action: "Settings", icon: "gearshape" },
        { action: "Back", icon: "chevron.left" },
      ],
    };
  }
  if (key === "android") {
    return {
      ...shared,
      family: "Material Symbols",
      mappings: [
        { action: "Search", icon: "search" },
        { action: "Create", icon: "add" },
        { action: "Delete", icon: "delete" },
        { action: "Settings", icon: "settings" },
        { action: "Back", icon: "arrow_back" },
      ],
    };
  }
  if (key === "mobile") {
    return {
      ...shared,
      family: "Lucide React Native",
      mappings: [
        { action: "Search", icon: "Search" },
        { action: "Create", icon: "Plus" },
        { action: "Delete", icon: "Trash2" },
        { action: "Settings", icon: "Settings" },
      ],
    };
  }
  return {
    ...shared,
    family: "Lucide",
    mappings: [
      { action: "Search", icon: "Search" },
      { action: "Create", icon: "Plus" },
      { action: "Edit", icon: "Pencil" },
      { action: "Delete", icon: "Trash2" },
      { action: "Settings", icon: "Settings" },
      { action: "Back", icon: "ArrowLeft" },
    ],
  };
}

export function demoAssetPlan(
  definition: ProjectDefinition,
  features: FeatureSpec[],
  uiDesign: UiDesignSpec,
): AssetPlanSpec {
  const iconSystems = definition.platform.map((platform) => iconSystemForPlatform(platform));
  const assets: AssetEntry[] = [];

  for (const feature of features) {
    const featureScreens = uiDesign.screens.filter((screen) => screen.featureId === feature.id);
    if (featureScreens.length === 0) continue;
    const screen = featureScreens[0];
    const hasEmptyState = featureScreens.some((entry) => entry.states.includes("empty"));

    if (hasEmptyState) {
      assets.push({
        id: `${feature.id}-empty-state`,
        type: "illustration",
        purpose: `Explain the empty ${feature.name.toLowerCase()} state and point to the action that fills it.`,
        screenIds: featureScreens.map((entry) => entry.id),
        placement: `Empty state of the ${screen.name} screen, centered in the working region`,
        sourceMethod: "Download the unDraw illustration and store it in the repository",
        sourceId: "undraw",
        query: `empty state for ${feature.name.toLowerCase()}`,
        destinationPath: `public/assets/${feature.id}-empty-state.svg`,
        format: "SVG with a 1.5px stroke and the primary token applied to the accent shape",
        dimensions: "640×480 px design frame",
        aspectRatio: "4:3",
        treatment: "Recolor the accent shape with the primary token and keep the neutral shapes at 60% opacity",
        altText: `Illustration explaining that no ${feature.name.toLowerCase()} records exist yet`,
        fallback: "If the illustration fails to load, render a neutral icon tile with the same aspect ratio and the documented empty-state copy",
        platformVariants: definition.platform.map((platform) => `${platform}: single responsive SVG`),
        license: "unDraw License",
        attribution: "No attribution required; keep the license note in the asset README.",
      });
    }

    if (feature.mediaRequirements.length > 0) {
      assets.push({
        id: `${feature.id}-media`,
        type: "photography",
        purpose: feature.mediaRequirements[0],
        screenIds: featureScreens.map((entry) => entry.id),
        placement: `Supporting region of the ${screen.name} screen, above the fold on wide layouts`,
        sourceMethod: "Download a free-license photograph from Unsplash and commit it to the repository",
        sourceId: "unsplash",
        query: `${feature.name.toLowerCase()} in a residential community, natural light, uncluttered`,
        destinationPath: `public/assets/${feature.id}-media.jpg`,
        format: "JPEG, progressive, quality 82",
        dimensions: "1600×900 px",
        aspectRatio: "16:9",
        treatment: "Slight desaturation with a 2% primary tint overlay; never crop the subject out",
        altText: `Photograph representing ${feature.name.toLowerCase()} in the product`,
        fallback: "If the photograph cannot be sourced, use the documented gradient-free neutral placeholder with the same aspect ratio",
        platformVariants: definition.platform.map((platform) => `${platform}: 1600×900 master with a 800×450 derivative`),
        license: "Unsplash License",
        attribution: "No attribution required; record the photographer name in the asset README when it is available.",
      });
    }
  }

  if (assets.length === 0 && uiDesign.screens.length > 0) {
    const screen = uiDesign.screens[0];
    assets.push({
      id: `${screen.id}-empty-state`,
      type: "illustration",
      purpose: "Explain the empty state and point to the action that creates the first record.",
      screenIds: [screen.id],
      placement: `Empty state of the ${screen.name} screen, centered in the working region`,
      sourceMethod: "Download the unDraw illustration and store it in the repository",
      sourceId: "undraw",
      query: `empty state for ${definition.name.toLowerCase()}`,
      destinationPath: `public/assets/${screen.id}-empty-state.svg`,
      format: "SVG with a 1.5px stroke and the primary token applied to the accent shape",
      dimensions: "640×480 px design frame",
      aspectRatio: "4:3",
      treatment: "Recolor the accent shape with the primary token and keep the neutral shapes at 60% opacity",
      altText: "Illustration explaining that no records exist yet",
      fallback: "If the illustration fails to load, render a neutral icon tile with the same aspect ratio and the documented empty-state copy",
      platformVariants: definition.platform.map((platform) => `${platform}: single responsive SVG`),
      license: "unDraw License",
      attribution: "No attribution required; keep the license note in the asset README.",
    });
  }

  return {
    strategy:
      "Ship one coherent icon family per platform from open-source libraries, and use free-license illustrations or photography only where they explain a documented screen state.",
    sourcePolicy: {
      rationale:
        "The product must remain shippable without paid licenses, so every asset comes from a free, clearly licensed source and is stored in the repository.",
      freeOnly: true,
      legalOnly: true,
      localOnly: true,
    },
    iconSystems,
    sources: ASSET_SOURCES,
    assets,
  };
}

export function demoArchitecture(definition: ProjectDefinition): ArchitectureSpec {
  const apply = (component: string, technology: string, rationale: string) => {
    const explicit = definition.technicalPreferences.find(
      (preference) => preference.component.toLowerCase() === component.toLowerCase(),
    );
    if (explicit) return explicit;
    return {
      component,
      technology,
      source: "recommended" as const,
      rationale,
      alternatives: [],
    };
  };

  const hasPayment = definition.features.some(
    (feature) => detectCategory(`${feature.name} ${feature.description}`) === "payment",
  );

  return {
    overview: `${definition.name} is ${definition.platform.join(" and ")} product. The recommendation below favours a single deployable frontend that talks to one backend service, so a coding agent can deliver the frontend experience before the backend exists.`,
    decisions: [
      apply("Frontend", "Next.js", "Supports the documented platform and server-side rendering out of the box."),
      apply("Backend", "REST API (Node.js)", "Matches the frontend toolchain and keeps the contract explicit."),
      apply("Database", "PostgreSQL", "Relational model fits the entities and relationships in the specification."),
      apply("Authentication", "Session-based authentication", "Required by the protected features."),
      {
        component: "Realtime",
        technology: null,
        source: "undecided",
        rationale: "Only needed if live updates become a requirement.",
        alternatives: ["WebSocket", "Server-Sent Events", "Polling"],
      },
      {
        component: "Payment",
        technology: null,
        source: "undecided",
        rationale: hasPayment
          ? "Payment is in scope but no provider was selected."
          : "Not required by the current specification.",
        alternatives: ["Payment gateway", "Manual recording"],
      },
    ],
    systemBoundaries: {
      inside: [
        "Frontend application and its routes",
        "Backend API and business rules",
        "Database schema and migrations",
      ],
      outside: [
        "Identity provider, if external authentication is chosen",
        "Payment provider, if payment is enabled",
        "Notification delivery channel",
      ],
    },
    dataFlow: [
      "1. The frontend calls a service interface.",
      "2. The service interface calls the backend API (or the mock implementation during the frontend phase).",
      "3. The backend applies business rules and persists through the database layer.",
      "4. The backend returns the updated resource to the frontend.",
      "5. The frontend renders the new state, including loading, empty, and error states.",
    ],
    externalServices: hasPayment
      ? [
          {
            name: "Payment provider",
            purpose: "Collect payments and confirm them through callbacks.",
            source: "undecided" as const,
          },
        ]
      : [],
    rules: [
      "Business rules live in the backend; the frontend never becomes the source of truth.",
      "The frontend must work against service interfaces so a mock implementation can replace the API.",
      "Every state-changing operation is authenticated and audited.",
    ],
  };
}

export function demoDataModel(definition: ProjectDefinition, features: FeatureSpec[]): DataModelSpec {
  const entities: DataModelSpec["entities"] = [
    {
      name: "users",
      purpose: "Every person who can sign in to the product.",
      fields: [
        { name: "id", type: "uuid", purpose: "Primary identifier.", constraints: ["primary key"] },
        { name: "name", type: "text", purpose: "Display name.", constraints: ["required"] },
        { name: "email", type: "text", purpose: "Sign-in identifier.", constraints: ["required", "unique"] },
        { name: "role", type: "text", purpose: `One of: ${definition.roles.map((role) => role.name).join(", ")}.`, constraints: ["required"] },
        { name: "created_at", type: "timestamp", purpose: "", constraints: ["required", "default now"] },
        { name: "updated_at", type: "timestamp", purpose: "", constraints: ["required"] },
      ],
      notes: "",
    },
  ];

  const relationships: DataModelSpec["relationships"] = [];

  for (const feature of features) {
    const table = slugId(feature.name, "record").replace(/-/g, "_");
    const category = detectCategory(`${feature.name} ${feature.purpose}`);
    const extraFields: DataModelSpec["entities"][number]["fields"] = [];

    if (category === "payment") {
      extraFields.push(
        { name: "amount", type: "integer", purpose: "Amount in the smallest currency unit.", constraints: ["required"] },
        { name: "provider_reference", type: "text", purpose: "", constraints: ["nullable", "unique"] },
        { name: "status", type: "text", purpose: "pending | paid | failed.", constraints: ["required", "default pending"] },
        { name: "paid_at", type: "timestamp", purpose: "", constraints: ["nullable"] },
      );
    } else if (category === "complaint") {
      extraFields.push(
        { name: "category", type: "text", purpose: "", constraints: ["required"] },
        { name: "description", type: "text", purpose: "", constraints: ["required"] },
        { name: "status", type: "text", purpose: "open | in_progress | resolved | rejected.", constraints: ["required", "default open"] },
      );
    } else if (category === "panic") {
      extraFields.push(
        { name: "status", type: "text", purpose: "active | cancelled | resolved.", constraints: ["required", "default active"] },
        { name: "triggered_at", type: "timestamp", purpose: "", constraints: ["required"] },
        { name: "resolved_at", type: "timestamp", purpose: "", constraints: ["nullable"] },
      );
    } else if (category === "marketplace") {
      extraFields.push(
        { name: "title", type: "text", purpose: "", constraints: ["required"] },
        { name: "price", type: "integer", purpose: "", constraints: ["required"] },
        { name: "status", type: "text", purpose: "draft | published | sold | removed.", constraints: ["required", "default draft"] },
      );
    } else if (category === "announcement") {
      extraFields.push(
        { name: "title", type: "text", purpose: "", constraints: ["required"] },
        { name: "body", type: "text", purpose: "", constraints: ["required"] },
        { name: "published_at", type: "timestamp", purpose: "", constraints: ["nullable"] },
      );
    } else {
      extraFields.push(
        { name: "title", type: "text", purpose: "", constraints: ["required"] },
        { name: "status", type: "text", purpose: "Current workflow state.", constraints: ["required"] },
      );
    }

    entities.push({
      name: table,
      purpose: feature.purpose,
      fields: [
        { name: "id", type: "uuid", purpose: "Primary identifier.", constraints: ["primary key"] },
        { name: "user_id", type: "uuid", purpose: "Owner of the record.", constraints: ["required", "foreign key users.id"] },
        ...extraFields,
        { name: "created_at", type: "timestamp", purpose: "", constraints: ["required", "default now"] },
        { name: "updated_at", type: "timestamp", purpose: "", constraints: ["required"] },
      ],
      notes: `Supports ${feature.requirements.length} requirements of the ${feature.name} feature.`,
    });

    relationships.push({
      from: "users",
      to: table,
      type: "1:N",
      description: `A user can own many ${table} records.`,
    });
  }

  return {
    overview: `The schema covers ${features.length} core features and their workflow states.`,
    entities,
    relationships,
  };
}

export function demoApi(
  definition: ProjectDefinition,
  features: FeatureSpec[],
  dataModel: DataModelSpec | null,
): ApiSpec {
  const tables = new Map(
    (dataModel?.entities ?? [])
      .filter((entity) => entity.name !== "users")
      .map((entity) => [entity.purpose, entity.name]),
  );

  const endpoints: ApiSpec["endpoints"] = [];
  let counter = 1;

  for (const feature of features) {
    const table = tables.get(feature.purpose) ?? slugId(feature.name, "record").replace(/-/g, "_");
    const base = `/api/${table.replace(/_/g, "-")}`;
    const id = () => `api-${String(counter++).padStart(3, "0")}`;

    endpoints.push({
      id: id(),
      method: "GET",
      path: base,
      purpose: `List ${table} records visible to the current actor.`,
      actor: feature.actors[0] ?? "User",
      authentication: "required",
      featureId: feature.id,
      request: "{ page?: number, pageSize?: number, query?: string }",
      response: "{ items: [{ id: uuid, status: string, createdAt: timestamp }], total: number }",
      errors: [
        { status: "401", meaning: "Unauthenticated" },
        { status: "403", meaning: "Not allowed for this actor" },
      ],
    });

    endpoints.push({
      id: id(),
      method: "POST",
      path: base,
      purpose: `Create a ${table} record.`,
      actor: feature.actors[0] ?? "User",
      authentication: "required",
      featureId: feature.id,
      request: "{ ...fields required by the feature }",
      response: "{ id: uuid, status: string, createdAt: timestamp }",
      errors: [
        { status: "401", meaning: "Unauthenticated" },
        { status: "422", meaning: "Validation failed" },
      ],
    });

    endpoints.push({
      id: id(),
      method: "GET",
      path: `${base}/:id`,
      purpose: `Read one ${table} record.`,
      actor: feature.actors[0] ?? "User",
      authentication: "required",
      featureId: feature.id,
      request: "",
      response: "{ id: uuid, ...record fields }",
      errors: [
        { status: "401", meaning: "Unauthenticated" },
        { status: "404", meaning: "Record not found" },
      ],
    });

    endpoints.push({
      id: id(),
      method: "PATCH",
      path: `${base}/:id`,
      purpose: `Update the workflow state of a ${table} record.`,
      actor: definition.roles.at(-1)?.name ?? "Administrator",
      authentication: "required",
      featureId: feature.id,
      request: "{ status: string }",
      response: "{ id: uuid, status: string, updatedAt: timestamp }",
      errors: [
        { status: "401", meaning: "Unauthenticated" },
        { status: "403", meaning: "Only an authorised actor may change the state" },
        { status: "409", meaning: "Illegal state transition" },
      ],
    });
  }

  return {
    overview: `REST contract for ${features.length} features. The frontend implements its service interfaces against these endpoints.`,
    authentication: "Session cookie issued by the backend after sign-in; every protected route requires it.",
    endpoints,
  };
}

export function demoTasks(
  definition: ProjectDefinition,
  features: FeatureSpec[],
  architecture: ArchitectureSpec | null,
  uiDesign: UiDesignSpec | null = null,
  assetPlan: AssetPlanSpec | null = null,
): ImplementationTask[] {
  const tasks: ImplementationTask[] = [];
  let counter = 1;
  const nextId = () => `TASK-${String(counter++).padStart(3, "0")}`;
  const strategy = definition.implementation.strategy;

  const push = (task: Omit<ImplementationTask, "id">) => {
    const id = nextId();
    tasks.push({ ...task, id });
    return id;
  };

  const screensForFeature = (featureId: string) =>
    (uiDesign?.screens ?? []).filter((screen) => screen.featureId === featureId);
  const assetIdsForScreens = (screenIds: string[]) =>
    (assetPlan?.assets ?? [])
      .filter((asset) => asset.screenIds.some((id) => screenIds.includes(id)))
      .map((asset) => asset.id);

  const foundation = push({
    title: "Set up project foundation",
    type: "foundation",
    phase: strategy === "module-first" ? "Foundation" : FRONTEND_FIRST_PHASES[0],
    featureId: "",
    dependencies: [],
    references: [],
    contextDocs: ["docs/PRD.md", "docs/architecture.md", "AGENTS.md"],
    requirements: [
      "Initialise the repository with the stack recorded in the architecture document.",
      "Configure formatting, linting, and type checking.",
      "Add the environment configuration described in the architecture rules.",
    ],
    uiStates: [],
    screenIds: [],
    assetIds: [],
    acceptanceCriteria: ["The project builds and type checks without errors."],
    optional: false,
  });

  const frontendFoundation = push({
    title: "Build the application shell, design tokens, and shared UI primitives",
    type: "frontend",
    phase: strategy === "module-first" ? "Foundation" : FRONTEND_FIRST_PHASES[1],
    featureId: "",
    dependencies: [foundation],
    references: [],
    contextDocs: [
      "docs/ui-design.md",
      "docs/asset-plan.md",
      "docs/PRD.md",
      "docs/user-flows.md",
    ],
    requirements: [
      "Implement every design token from the design specification as CSS custom properties.",
      "Install only the approved UI dependencies listed in the design specification.",
      "Build the application shell: navigation, page header, and the content container.",
      "Build the shared component primitives with the variants and states the design specification documents.",
      "Implement loading, empty, and error primitives reused by every feature screen.",
      "Do not hard-code a color, spacing value, radius, or shadow that is missing from the token list.",
    ],
    uiStates: ["loading", "empty", "error", "responsive"],
    screenIds: [],
    assetIds: (assetPlan?.assets ?? []).map((asset) => asset.id),
    acceptanceCriteria: [
      "Navigation works at every documented breakpoint.",
      "Every component in the design specification exists with its documented variants and states.",
      "No screen introduces a color, spacing value, or component outside the design specification.",
    ],
    optional: false,
  });

  const perFeature: Record<string, { service: string; screens: string[] }> = {};

  for (const feature of features) {
    const phase =
      strategy === "module-first"
        ? feature.name
        : FRONTEND_FIRST_PHASES[2];
    const service = `${feature.name.replace(/[^A-Za-z0-9]/g, "")}Service`;
    const listScreen = push({
      title: `Build ${feature.name} list screen`,
      type: "frontend",
      phase,
      featureId: feature.id,
      dependencies: [frontendFoundation],
      references: feature.requirements.map((requirement) => requirement.id),
      contextDocs: [
        "docs/ui-design.md",
        "docs/asset-plan.md",
        "docs/PRD.md",
        `docs/features/${feature.id}.md`,
        "docs/user-flows.md",
      ],
      requirements: [
        `Implement the "${feature.name} list" screen exactly as the design specification describes it.`,
        `Render the ${feature.name.toLowerCase()} list from the ${service} interface.`,
        "Implement search and filtering with the documented filter bar.",
        `Use the mock ${service} implementation during the frontend phase.`,
      ],
      uiStates: ["loading", "empty", "populated", "error", "responsive"],
      screenIds: screensForFeature(feature.id).map((screen) => screen.id),
      assetIds: assetIdsForScreens(screensForFeature(feature.id).map((screen) => screen.id)),
      acceptanceCriteria: [
        "All required UI states are implemented with realistic sample records.",
        "Every asset renders from its documented local path with its documented fallback.",
        "The screen matches the layout and components documented for it.",
        "The screen works without a running backend.",
        "Mock data is not coupled directly to the UI components.",
      ],
      optional: false,
    });

    const detailScreen = push({
      title: `Build ${feature.name} detail and action flow`,
      type: "frontend",
      phase,
      featureId: feature.id,
      dependencies: [listScreen],
      references: feature.requirements.map((requirement) => requirement.id),
      contextDocs: [
        "docs/ui-design.md",
        "docs/asset-plan.md",
        `docs/features/${feature.id}.md`,
        "docs/user-flows.md",
      ],
      requirements: [
        `Implement the "${feature.name} detail and action" screen exactly as the design specification describes it.`,
        `Implement the main flow: ${feature.mainFlow.slice(0, 3).join(" → ")}.`,
        "Validate input before submitting and surface validation errors next to the field.",
        "Require confirmation before any action that cannot be undone.",
        `Keep all data access behind the ${service} interface.`,
      ],
      uiStates: ["loading", "validation", "success", "error"],
      screenIds: screensForFeature(feature.id).map((screen) => screen.id),
      assetIds: assetIdsForScreens(screensForFeature(feature.id).map((screen) => screen.id)),
      acceptanceCriteria: [
        "The main flow completes against the mock service.",
        "Invalid input is rejected with a visible message next to the field.",
        "The screen matches the layout and components documented for it.",
      ],
      optional: false,
    });

    const serviceTask = push({
      title: `Define ${feature.name} service interface and mock implementation`,
      type: "frontend",
      phase,
      featureId: feature.id,
      dependencies: [frontendFoundation],
      references: feature.requirements.map((requirement) => requirement.id),
      contextDocs: [`docs/features/${feature.id}.md`, "docs/api.md"],
      requirements: [
        `Declare the ${service} interface with the operations the screens need.`,
        "Provide a mock implementation with realistic data and failure cases.",
        "Do not import the mock implementation directly in components.",
      ],
      uiStates: [],
      screenIds: [],
      assetIds: [],
      acceptanceCriteria: [
        "Screens depend only on the interface.",
        "Swapping the mock for the API implementation requires no UI change.",
      ],
      optional: false,
    });

    perFeature[feature.id] = { service, screens: [listScreen, detailScreen, serviceTask].filter(Boolean) };
  }

  const backendFoundation = push({
    title: "Create database schema and seed data",
    type: "database",
    phase: strategy === "module-first" ? "Foundation" : FRONTEND_FIRST_PHASES[4],
    featureId: "",
    dependencies: [foundation],
    references: [],
    contextDocs: ["docs/data-model.md", "docs/architecture.md"],
    requirements: [
      "Create migrations for every entity in the data model.",
      "Add constraints, foreign keys, and indexes described in the specification.",
      "Provide seed data for local development.",
    ],
    uiStates: [],
    screenIds: [],
    assetIds: [],
    acceptanceCriteria: [
      "Migrations run from an empty database.",
      "Seed data matches the documented entities and relationships.",
    ],
    optional: false,
  });

  for (const feature of features) {
    const phase = strategy === "module-first" ? feature.name : FRONTEND_FIRST_PHASES[5];
    const backendTask = push({
      title: `Implement ${feature.name} backend endpoints`,
      type: "backend",
      phase,
      featureId: feature.id,
      dependencies: [backendFoundation],
      references: feature.requirements.map((requirement) => requirement.id),
      contextDocs: ["docs/api.md", "docs/features/" + feature.id + ".md", "docs/data-model.md"],
      requirements: [
        `Implement the endpoints listed for ${feature.name} in the API specification.`,
        "Enforce the business rules in the backend, not in the frontend.",
        "Return the documented error cases with the documented status codes.",
      ],
      uiStates: [],
      screenIds: [],
      assetIds: [],
      acceptanceCriteria: [
        "Documented success and error responses are returned correctly.",
        "Only authorised actors can change state.",
      ],
      optional: false,
    });

    const integrationTask = push({
      title: `Connect ${feature.name} UI to the real API`,
      type: "integration",
      phase: strategy === "module-first" ? feature.name : FRONTEND_FIRST_PHASES[6],
      featureId: feature.id,
      dependencies: [backendTask, ...(perFeature[feature.id]?.screens ?? [])],
      references: feature.requirements.map((requirement) => requirement.id),
      contextDocs: [
        "docs/ui-design.md",
        "docs/asset-plan.md",
        "docs/api.md",
        `docs/features/${feature.id}.md`,
      ],
      requirements: [
        `Replace the mock ${perFeature[feature.id]?.service ?? "service"} with the API implementation.`,
        "Handle network failure, retries, and empty responses.",
        "Keep every state documented in the design specification; the interface must not change.",
      ],
      uiStates: ["loading", "empty", "error", "success"],
      screenIds: screensForFeature(feature.id).map((screen) => screen.id),
      assetIds: assetIdsForScreens(screensForFeature(feature.id).map((screen) => screen.id)),
      acceptanceCriteria: [
        "The feature works end to end against the real backend.",
        "Failure paths still render the documented error state.",
      ],
      optional: false,
    });

    push({
      title: `Validate ${feature.name} against its acceptance criteria`,
      type: "testing",
      phase: "Testing & Validation",
      featureId: feature.id,
      dependencies: [integrationTask],
      references: feature.requirements.map((requirement) => requirement.id),
      contextDocs: [`docs/features/${feature.id}.md`, "docs/PRD.md"],
      requirements: [
        "Walk through every acceptance criterion for this feature.",
        "Add automated coverage for the business rules.",
      ],
      uiStates: [],
      screenIds: [],
      assetIds: [],
      acceptanceCriteria: [
        "Every acceptance criterion passes.",
        "Business rules are covered by automated tests.",
      ],
      optional: false,
    });
  }

  push({
    title: "Run the visual QA pass across every documented screen",
    type: "testing",
    phase: "Testing & Validation",
    featureId: "",
    dependencies: [],
    references: [],
    contextDocs: ["docs/ui-design.md", "docs/asset-plan.md", "AGENTS.md"],
    requirements: [
      "Run the product and capture a screenshot for every documented screen and state at each documented breakpoint.",
      "Compare each screenshot with the documented hierarchy, composition, typography, iconography, and asset placement.",
      "Verify every asset loads from its documented local path and its documented fallback works when it fails.",
      "Fix overflow, default browser styling, mixed icon families, placeholder copy, contrast failures, and responsive mismatches before finishing.",
    ],
    uiStates: ["loading", "empty", "populated", "error", "validation", "success", "responsive"],
    screenIds: (uiDesign?.screens ?? []).map((screen) => screen.id),
    assetIds: (assetPlan?.assets ?? []).map((asset) => asset.id),
    acceptanceCriteria: [
      "Every documented screen renders at every documented breakpoint without visual defects.",
      "No placeholder content, default control, or undocumented component remains.",
      "The screenshot evidence exists for each documented state.",
    ],
    optional: false,
  });

  void architecture;
  return tasks;
}

export function demoAgentInstructions(
  definition: ProjectDefinition,
  tasks: ImplementationTask[],
  architecture: ArchitectureSpec | null,
  design: UiDesignSpec | null,
  assetPlan: AssetPlanSpec | null = null,
): SpecDocument {
  const phases = Array.from(new Set(tasks.map((task) => task.phase)));
  const strategy = definition.implementation.strategy;

  return {
    title: "AGENTS.md",
    summary: "Global rules the coding agent must follow while implementing this project.",
    sections: [
      {
        id: "project-overview",
        title: "Project Overview",
        blocks: [
          { type: "paragraph", text: `${definition.name} — ${definition.summary}` },
          { type: "bullets", items: [`Platform: ${definition.platform.join(", ")}`, `Users: ${definition.users.join(", ")}`] },
        ],
      },
      {
        id: "source-of-truth",
        title: "Source of Truth",
        blocks: [
          {
            type: "paragraph",
            text: "The project definition drives every document in this package. When a decision changes, update the definition and every affected document together — never patch a single document in isolation.",
          },
        ],
      },
      {
        id: "technology-stack",
        title: "Technology Stack",
        blocks: [
          {
            type: "bullets",
            items: (architecture?.decisions ?? []).map(
              (decision) =>
                `${decision.component}: ${decision.technology ?? "undecided"} (${decision.source})`,
            ),
          },
        ],
      },
      {
        id: "architecture-rules",
        title: "Architecture Rules",
        blocks: [{ type: "bullets", items: architecture?.rules ?? [] }],
      },
      {
        id: "implementation-strategy",
        title: "Implementation Strategy",
        blocks: [
          {
            type: "paragraph",
            text:
              strategy === "module-first"
                ? "This project follows a module-first implementation strategy: finish each feature module end to end before starting the next one."
                : "This project follows a frontend-first implementation strategy.",
          },
          { type: "steps", items: phases },
          ...(strategy === "frontend-first"
            ? [
                {
                  type: "bullets" as const,
                  items: [
                    "Complete the frontend experience before backend implementation.",
                    "Build all required screens and user flows.",
                    "Implement loading, empty, error and populated states.",
                    "Use mock services when backend functionality is unavailable.",
                    "Keep mock implementations behind service interfaces.",
                    "Do not implement backend functionality during frontend-only tasks.",
                    "Do not expand the product scope beyond the specification.",
                  ],
                },
              ]
            : []),
        ],
      },
      {
        id: "design-system-rules",
        title: "Design System Rules",
        blocks: [
          {
            type: "paragraph",
            text: design
              ? `docs/ui-design.md is the only source of visual truth for this project. It defines ${design.screens.length} screens and ${design.components.length} shared components, with the tokens, variants, and states every screen must use, and no screen may introduce a visual decision of its own.`
              : "The UI design specification has not been generated yet. Generate it before writing interface code so screens are not styled ad hoc.",
          },
          {
            type: "paragraph",
            text: assetPlan
              ? `docs/asset-plan.md is the only source of truth for iconography and media. It defines ${assetPlan.iconSystems.length} icon systems and ${assetPlan.assets.length} media assets with their sources, licenses, local paths, and fallbacks.`
              : "The asset plan has not been generated yet. Generate it before sourcing icons, illustrations, or photography.",
          },
          {
            type: "bullets",
            items: [
              "Read docs/ui-design.md before writing any interface code.",
              "Implement the design tokens exactly as documented; never hard-code a color, font size, spacing, radius, or shadow that is not in the token list.",
              "Build the shared component primitives before the feature screens and reuse them instead of writing one-off markup per screen.",
              "Style every element deliberately: no browser default form controls, no unstyled tables, no emoji used as interface icons, and no inconsistent spacing between similar screens.",
              "Implement every state the design specification lists for a screen — loading, empty, populated, error, validation, and success — not only the happy path.",
              "Render realistic domain sample data; never ship placeholder content such as \"Lorem ipsum\", \"Item 1\", or \"User A\".",
              "Follow the documented layout, grid, and breakpoint behaviour, and check the screen at each breakpoint.",
              "When a screen needs something the design specification does not cover, extend the specification first instead of inventing a one-off style.",
              "Use exactly one icon family per platform as documented in docs/asset-plan.md; never mix icon families and never use emoji as interface icons.",
              "Download or create every required asset and commit it to its documented local path; never hotlink an external asset.",
              "Install only the approved UI dependencies named in the design specification, and import only the individual icons that are used.",
              "Implement the documented fallback for every asset so a failed asset never breaks the layout.",
              "Run the product and capture a screenshot for every documented screen and state at each documented breakpoint before calling a task complete.",
              "Fix overflow, placeholder copy, default controls, contrast failures, broken assets, and responsive mismatches before finishing.",
            ],
          },
        ],
      },
      {
        id: "asset-and-visual-qa-rules",
        title: "Asset and Visual QA Rules",
        blocks: [
          {
            type: "paragraph",
            text: assetPlan
              ? `docs/asset-plan.md is the only source of truth for iconography and media. It defines ${assetPlan.iconSystems.length} icon system(s) and ${assetPlan.assets.length} media assets, each with an approved free and legal source, license, local path, and fallback.`
              : "The asset plan has not been generated yet. Generate it before sourcing any icon, illustration, or photograph.",
          },
          {
            type: "bullets",
            items: [
              "Read docs/asset-plan.md before adding any icon, illustration, photograph, or media element.",
              "Source every asset from an approved free and legal source, commit it to its documented local path, and keep its license and attribution note.",
              "Use exactly one icon family per platform and import only the individual icons that are used.",
              "Implement the documented fallback for every asset; never hotlink an external file.",
              "Run the product before declaring a task complete, and capture a screenshot for every documented screen and state at each documented breakpoint.",
              "Compare each screenshot with docs/ui-design.md and fix overflow, default controls, placeholders, mixed icons, missing assets, contrast failures, and responsive mismatches.",
            ],
          },
        ],
      },
      {
        id: "scope-rules",
        title: "Scope Rules",
        blocks: [
          { type: "paragraph", text: "Do not implement anything in this list:" },
          { type: "bullets", items: definition.nonGoals.length > 0 ? definition.nonGoals : ["Nothing outside the specification."] },
        ],
      },
      {
        id: "coding-guidelines",
        title: "Coding Guidelines",
        blocks: [
          {
            type: "bullets",
            items: [
              "Follow the existing project conventions before introducing new ones.",
              "Keep business rules in the backend and UI concerns in the frontend.",
              "Never hardcode mock data inside UI components.",
              "Keep requirement identifiers in comments or documentation references when they clarify intent.",
            ],
          },
        ],
      },
      {
        id: "testing-expectations",
        title: "Testing Expectations",
        blocks: [
          {
            type: "bullets",
            items: [
              "Every acceptance criterion must be verifiable.",
              "Cover the business rules with automated tests.",
              "Verify the loading, empty, and error states of every screen.",
            ],
          },
        ],
      },
      {
        id: "task-execution-workflow",
        title: "Task Execution Workflow",
        blocks: [
          {
            type: "steps",
            items: [
              "Read AGENTS.md and the context documents listed on the task.",
              "Inspect the repository and confirm the task is unblocked.",
              "Implement only what the task requires.",
              "Check the acceptance criteria before marking the task complete.",
              "Move to the next unblocked task in phase order.",
            ],
          },
        ],
      },
    ],
  };
}
