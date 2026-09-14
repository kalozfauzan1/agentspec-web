import {
  FRONTEND_FIRST_PHASES,
  type ApiSpec,
  type ArchitectureSpec,
  type ClarificationAnswer,
  type DataModelSpec,
  type FeatureSpec,
  type IdeaAnalysis,
  type ImplementationTask,
  type ProjectDefinition,
  type SpecDocument,
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
    if (SCOPE_CLAUSE.test(segment) || TECH_CLAUSE.test(segment) || TECH_ONLY_SEGMENT.test(segment)) {
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

export function demoFeatures(definition: ProjectDefinition): FeatureSpec[] {
  return definition.features.map((outline) => {
    const category = detectCategory(`${outline.name} ${outline.description}`);
    const template = TEMPLATES[category];
    const prefix = makePrefix(outline.name);
    const actors = definition.users.length > 0 ? definition.users.slice(0, 2) : ["User"];

    return {
      id: slugId(outline.name, "feature"),
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
    acceptanceCriteria: ["The project builds and type checks without errors."],
    optional: false,
  });

  const frontendFoundation = push({
    title: "Build the application shell and design tokens",
    type: "frontend",
    phase: strategy === "module-first" ? "Foundation" : FRONTEND_FIRST_PHASES[1],
    featureId: "",
    dependencies: [foundation],
    references: [],
    contextDocs: ["docs/PRD.md", "docs/user-flows.md"],
    requirements: [
      "Implement the application layout, navigation, and shared UI primitives.",
      "Implement loading, empty, and error primitives reused by feature screens.",
    ],
    uiStates: ["loading", "empty", "error", "responsive"],
    acceptanceCriteria: ["Navigation works on desktop and tablet widths."],
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
      contextDocs: ["docs/PRD.md", `docs/features/${feature.id}.md`, "docs/user-flows.md"],
      requirements: [
        `Render the ${feature.name.toLowerCase()} list from the ${service} interface.`,
        "Implement search and filtering where the specification requires it.",
        `Use the mock ${service} implementation during the frontend phase.`,
      ],
      uiStates: ["loading", "empty", "populated", "error", "responsive"],
      acceptanceCriteria: [
        "All required UI states are implemented.",
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
      contextDocs: [`docs/features/${feature.id}.md`, "docs/user-flows.md"],
      requirements: [
        `Implement the main flow: ${feature.mainFlow.slice(0, 3).join(" → ")}.`,
        "Validate input before submitting and surface validation errors.",
        `Keep all data access behind the ${service} interface.`,
      ],
      uiStates: ["loading", "validation", "success", "error"],
      acceptanceCriteria: [
        "The main flow completes against the mock service.",
        "Invalid input is rejected with a visible message.",
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
      contextDocs: ["docs/api.md", `docs/features/${feature.id}.md`],
      requirements: [
        `Replace the mock ${perFeature[feature.id]?.service ?? "service"} with the API implementation.`,
        "Handle network failure, retries, and empty responses.",
      ],
      uiStates: ["loading", "empty", "error", "success"],
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
      acceptanceCriteria: [
        "Every acceptance criterion passes.",
        "Business rules are covered by automated tests.",
      ],
      optional: false,
    });
  }

  void architecture;
  return tasks;
}

export function demoAgentInstructions(
  definition: ProjectDefinition,
  tasks: ImplementationTask[],
  architecture: ArchitectureSpec | null,
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
