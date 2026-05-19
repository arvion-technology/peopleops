/**
 * PeopleOps demo data.
 *
 * Fourteen people, four leave policies and three onboarding templates. Dates are
 * fixed calendar dates so the demo shows a believable Nepali office: the week
 * runs Sunday to Friday, Saturday is off, and the Tihar holidays sit in November.
 *
 * Leave year starts 1 January. Each person carries a small carry-over balance
 * from the previous year, because that is the part people argue about.
 */

export const DAY = 86_400_000;

export const LEAVE_TYPES = [
  { id: "annual", label: "Annual", monthlyRate: 1.5, entitlement: 18, carryOverCap: 5, paid: true, tone: "gold" },
  { id: "sick", label: "Sick", monthlyRate: 1, entitlement: 12, carryOverCap: 0, paid: true, tone: "blue" },
  { id: "casual", label: "Casual", monthlyRate: 0.5, entitlement: 6, carryOverCap: 0, paid: true, tone: "green" },
  { id: "unpaid", label: "Unpaid", monthlyRate: 0, entitlement: 0, carryOverCap: 0, paid: false, tone: "red" },
];

/** Public holidays the office is closed for. */
export const HOLIDAYS = [
  { date: "2026-10-20", name: "Vijaya Dashami" },
  { date: "2026-10-21", name: "Dashain holiday" },
  { date: "2026-11-08", name: "Laxmi Puja" },
  { date: "2026-11-09", name: "Govardhan Puja" },
  { date: "2026-11-10", name: "Bhai Tika" },
  { date: "2026-12-25", name: "Christmas" },
];

export function holidayDates() {
  return HOLIDAYS.map((h) => Date.parse(`${h.date}T00:00:00Z`));
}

export function isWeekend(ts) {
  return new Date(ts).getUTCDay() === 6; // Saturday
}

export function isHoliday(ts, holidays = holidayDates()) {
  return holidays.includes(ts);
}

export const DEPARTMENTS = [
  { id: "eng", label: "Engineering" },
  { id: "design", label: "Design" },
  { id: "sales", label: "Sales" },
  { id: "ops", label: "Operations" },
];

/** Template tasks are offsets in *working* days from the start date. */
export const ONBOARDING_TEMPLATES = {
  eng: [
    { id: "contract", label: "Contract and NDA signed", offset: -5, owner: "People Ops" },
    { id: "payroll", label: "Payroll, PAN and bank details", offset: -3, owner: "Finance" },
    { id: "laptop", label: "Laptop issued and asset tagged", offset: -1, owner: "IT" },
    { id: "welcome", label: "Welcome session and team lunch", offset: 0, owner: "Manager" },
    { id: "accounts", label: "Email, GitHub and Slack access", offset: 0, owner: "IT" },
    { id: "repo", label: "Local environment running, first PR merged", offset: 2, owner: "Buddy" },
    { id: "standup", label: "Presents at team standup", offset: 3, owner: "Manager" },
    { id: "oncall", label: "Reads the on-call runbook", offset: 5, owner: "Buddy" },
    { id: "goals", label: "30-day goals agreed with manager", offset: 7, owner: "Manager" },
    { id: "review", label: "Two-week check-in", offset: 14, owner: "People Ops" },
    { id: "probation", label: "Probation review scheduled", offset: 30, owner: "Manager" },
  ],
  design: [
    { id: "contract", label: "Contract and NDA signed", offset: -5, owner: "People Ops" },
    { id: "payroll", label: "Payroll, PAN and bank details", offset: -3, owner: "Finance" },
    { id: "laptop", label: "Laptop issued and asset tagged", offset: -1, owner: "IT" },
    { id: "welcome", label: "Welcome session and studio tour", offset: 0, owner: "Manager" },
    { id: "accounts", label: "Figma, Linear and Slack access", offset: 0, owner: "IT" },
    { id: "design-system", label: "Walks through the design system", offset: 2, owner: "Buddy" },
    { id: "shadow", label: "Shadows two user interviews", offset: 4, owner: "Buddy" },
    { id: "goals", label: "30-day goals agreed with manager", offset: 7, owner: "Manager" },
    { id: "review", label: "Two-week check-in", offset: 14, owner: "People Ops" },
    { id: "probation", label: "Probation review scheduled", offset: 30, owner: "Manager" },
  ],
  sales: [
    { id: "contract", label: "Contract and NDA signed", offset: -5, owner: "People Ops" },
    { id: "payroll", label: "Payroll, PAN and bank details", offset: -3, owner: "Finance" },
    { id: "laptop", label: "Laptop and phone issued", offset: -1, owner: "IT" },
    { id: "welcome", label: "Welcome session and team lunch", offset: 0, owner: "Manager" },
    { id: "accounts", label: "CRM, email and Slack access", offset: 0, owner: "IT" },
    { id: "pitch", label: "Reads the pitch deck and pricing", offset: 1, owner: "Buddy" },
    { id: "shadow", label: "Shadows three discovery calls", offset: 3, owner: "Buddy" },
    { id: "pipeline", label: "Owns first pipeline review", offset: 7, owner: "Manager" },
    { id: "review", label: "Two-week check-in", offset: 14, owner: "People Ops" },
    { id: "probation", label: "Probation review scheduled", offset: 30, owner: "Manager" },
  ],
  ops: [
    { id: "contract", label: "Contract and NDA signed", offset: -5, owner: "People Ops" },
    { id: "payroll", label: "Payroll, PAN and bank details", offset: -3, owner: "Finance" },
    { id: "laptop", label: "Laptop issued and asset tagged", offset: -1, owner: "IT" },
    { id: "welcome", label: "Welcome session and office tour", offset: 0, owner: "Manager" },
    { id: "accounts", label: "Email and Slack access", offset: 0, owner: "IT" },
    { id: "runbook", label: "Reads the operations runbook", offset: 2, owner: "Buddy" },
    { id: "vendor", label: "Sits in on the vendor review", offset: 4, owner: "Buddy" },
    { id: "goals", label: "30-day goals agreed with manager", offset: 7, owner: "Manager" },
    { id: "review", label: "Two-week check-in", offset: 14, owner: "People Ops" },
    { id: "probation", label: "Probation review scheduled", offset: 30, owner: "Manager" },
  ],
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateTeam({ seed = 20261028, now = Date.now() } = {}) {
  const r = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const int = (min, max) => Math.floor(min + r() * (max - min + 1));

  const people = [
    ["p1", "Anisha Shrestha", "Engineering Manager", "eng", "2021-03-01", "Nepal", "Kathmandu"],
    ["p2", "Bikash Adhikari", "Senior Backend Engineer", "eng", "2022-01-16", "Nepal", "Kathmandu"],
    ["p3", "Priya Gurung", "Product Designer", "design", "2023-06-05", "Nepal", "Lalitpur"],
    ["p4", "Nabin Thapa", "Frontend Engineer", "eng", "2023-09-11", "Nepal", "Kathmandu"],
    ["p5", "Sabina Rai", "People Ops Lead", "ops", "2022-08-01", "Nepal", "Bhaktapur"],
    ["p6", "Kiran Maharjan", "DevOps Engineer", "eng", "2024-02-19", "Nepal", "Kathmandu"],
    ["p7", "Meera Joshi", "QA Engineer", "eng", "2024-07-08", "Nepal", "Patan"],
    ["p8", "Prakash Bhattarai", "Account Manager", "sales", "2023-02-20", "Nepal", "Pokhara"],
    ["p9", "Rojina Karki", "Content Designer", "design", "2025-01-13", "Nepal", "Kathmandu"],
    ["p10", "Suman Basnet", "Sales Lead", "sales", "2022-11-07", "Nepal", "Kathmandu"],
    ["p11", "Anjali Singh", "Support Engineer", "ops", "2025-04-21", "Nepal", "Birgunj"],
    ["p12", "Dipesh Shahi", "Data Analyst", "eng", "2025-08-04", "Nepal", "Nepalgunj"],
    ["p13", "Laxmi Bhandari", "Finance Officer", "ops", "2024-03-18", "Nepal", "Kathmandu"],
    ["p14", "Nisha Tamang", "Mobile Engineer", "eng", "2026-11-02", "Nepal", "Kathmandu"],
  ].map(([id, name, role, dept, start, country, city]) => ({
    id, name, role, departmentId: dept,
    startDate: Date.parse(`${start}T00:00:00Z`),
    email: `${name.split(" ")[0].toLowerCase()}@arviontech.example`,
    phone: `98${String(41000000 + Number(id.slice(1)) * 2741).slice(0, 8)}`,
    location: `${city}, ${country}`,
    managerId: dept === "eng" ? "p1" : dept === "design" ? "p3" : dept === "sales" ? "p10" : "p5",
    equipment: [
      { item: "MacBook Pro 14", serial: `MBP-${4100 + Number(id.slice(1))}`, issuedAt: Date.parse(`${start}T00:00:00Z`), returnedAt: null },
      { item: "Dell 27 monitor", serial: `MON-${2200 + Number(id.slice(1))}`, issuedAt: Date.parse(`${start}T00:00:00Z`), returnedAt: null },
      { item: "Access card", serial: `AC-${Number(id.slice(1))}`, issuedAt: Date.parse(`${start}T00:00:00Z`), returnedAt: null },
    ],
    carryOver: { annual: int(0, 5), sick: 0, casual: 0, unpaid: 0 },
    status: Date.parse(`${start}T00:00:00Z`) > now ? "upcoming" : "active",
  }));

  // Seeded leave: history people already took, plus pending requests.
  const requests = [];
  let serial = 100;
  const addRequest = (personId, type, from, to, status, note = "") => {
    serial += 3;
    requests.push({
      id: `LR-${serial}`,
      personId,
      type,
      from: Date.parse(`${from}T00:00:00Z`),
      to: Date.parse(`${to}T00:00:00Z`),
      status,
      note,
      requestedAt: Math.min(Date.parse(`${from}T00:00:00Z`) - 6 * DAY, now - (2 + (serial % 6)) * DAY),
      decidedAt: status === "pending" ? null : Date.parse(`${from}T00:00:00Z`) - 4 * DAY,
      decidedBy: status === "pending" ? null : "p5",
    });
  };

  addRequest("p2", "annual", "2026-10-12", "2026-10-16", "approved", "Family visit");
  addRequest("p3", "sick", "2026-10-05", "2026-10-06", "approved", "");
  addRequest("p4", "annual", "2026-10-26", "2026-10-30", "approved", "Dashain travel");
  addRequest("p6", "casual", "2026-10-08", "2026-10-08", "approved", "");
  addRequest("p7", "annual", "2026-11-02", "2026-11-06", "pending", "Wedding in Chitwan");
  addRequest("p8", "annual", "2026-11-09", "2026-11-11", "pending", "Tihar at home");
  addRequest("p9", "sick", "2026-10-22", "2026-10-23", "approved", "");
  addRequest("p10", "annual", "2026-10-19", "2026-10-23", "approved", "Dashain");
  addRequest("p11", "casual", "2026-11-04", "2026-11-04", "pending", "Paperwork at the bank");
  addRequest("p12", "annual", "2026-12-21", "2026-12-25", "pending", "Holiday travel");
  addRequest("p2", "sick", "2026-09-14", "2026-09-15", "approved", "");
  addRequest("p4", "casual", "2026-09-02", "2026-09-02", "rejected", "Overlaps release week");
  addRequest("p13", "annual", "2026-10-27", "2026-10-29", "approved", "Dashain");
  // One request that deliberately overlaps a pending one, so the form can show it.
  addRequest("p7", "casual", "2026-11-04", "2026-11-04", "pending", "Sibling visit");

  // Onboarding checklists for the two newest hires.
  const onboarding = [
    {
      personId: "p12",
      template: "eng",
      startedAt: Date.parse("2026-08-04T00:00:00Z"),
      done: ["contract", "payroll", "laptop", "welcome", "accounts", "repo", "standup", "oncall", "goals", "review", "probation"],
    },
    {
      personId: "p14",
      template: "eng",
      startedAt: Date.parse("2026-11-02T00:00:00Z"),
      done: ["contract", "payroll"],
    },
  ];

  return { people, requests, onboarding, generatedAt: now, seed };
}
