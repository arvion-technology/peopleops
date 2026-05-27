import test from "node:test";
import assert from "node:assert/strict";
import { DAY } from "../src/data.js";
import {
  addWorkingDays, phaseFor, buildChecklist, checklistProgress, groupByPhase,
  onboardingBoard, equipmentHoldings, PHASES,
} from "../src/onboarding.js";

const ts = (iso) => Date.parse(`${iso}T00:00:00Z`);
const NOW = Date.UTC(2026, 9, 28, 12, 0, 0);

const person = (over = {}) => ({
  id: "p14",
  name: "Nisha Tamang",
  startDate: ts("2026-11-02"),
  equipment: [
    { item: "MacBook Pro 14", serial: "MBP-1", issuedAt: ts("2026-10-30"), returnedAt: null },
    { item: "Access card", serial: "AC-1", issuedAt: ts("2026-10-30"), returnedAt: ts("2026-10-31") },
  ],
  ...over,
});

test("addWorkingDays skips Saturdays and holidays in both directions", () => {
  assert.equal(addWorkingDays(ts("2026-10-30"), 1), ts("2026-11-01")); // Sat 31 skipped
  assert.equal(addWorkingDays(ts("2026-11-01"), -2), ts("2026-10-29"));
  assert.equal(addWorkingDays(ts("2026-10-19"), 2), ts("2026-10-23")); // the 20th and 21st are holidays
  assert.equal(addWorkingDays(ts("2026-11-02"), 0), ts("2026-11-02"));
});

test("phaseFor maps offsets onto the five board columns", () => {
  assert.equal(phaseFor(-3), "Pre-start");
  assert.equal(phaseFor(0), "Day 1");
  assert.equal(phaseFor(3), "Week 1");
  assert.equal(phaseFor(9), "Week 2");
  assert.equal(phaseFor(30), "Day 30+");
  assert.deepEqual(PHASES, ["Pre-start", "Day 1", "Week 1", "Week 2", "Day 30+"]);
});

test("buildChecklist dates every task and marks what is already done", () => {
  const startDate = ts("2026-11-02");
  const tasks = buildChecklist({ personId: "p14", template: "eng", startDate, done: ["contract"] }, { now: NOW });
  assert.equal(tasks.length, 11);
  const contract = tasks.find((t) => t.id === "contract");
  assert.equal(contract.done, true);
  assert.equal(contract.phase, "Pre-start");
  assert.equal(contract.dueAt, addWorkingDays(startDate, -5));
  assert.equal(tasks.find((t) => t.id === "laptop").done, false);
  assert.equal(tasks.find((t) => t.id === "probation").phase, "Day 30+");
  for (let i = 1; i < tasks.length; i++) assert.ok(tasks[i].dueAt >= tasks[i - 1].dueAt);
});

test("checklistProgress reports the next task, overdue work and completion", () => {
  const startDate = ts("2026-11-02");
  const tasks = buildChecklist({ personId: "p14", template: "eng", startDate, done: [] }, { now: NOW });
  const progress = checklistProgress(tasks, { now: NOW });
  assert.equal(progress.total, 11);
  assert.equal(progress.done, 0);
  assert.equal(progress.pct, 0);
  assert.equal(progress.overdueCount, 1); // only the contract task is past due
  assert.equal(progress.next.id, "contract");
  assert.equal(progress.complete, false);

  const finished = tasks.map((t) => ({ ...t, done: true }));
  assert.equal(checklistProgress(finished, { now: NOW }).complete, true);
});

test("a task is not overdue once it is done", () => {
  const tasks = buildChecklist({ personId: "p14", template: "eng", startDate: ts("2026-11-02"), done: ["contract", "payroll", "laptop"] }, { now: NOW });
  const progress = checklistProgress(tasks, { now: NOW });
  assert.equal(progress.overdueCount, 0);
});

test("groupByPhase keeps the column order and drops empty ones", () => {
  const tasks = buildChecklist({ personId: "p14", template: "sales", startDate: ts("2026-11-02"), done: [] }, { now: NOW });
  const columns = groupByPhase(tasks);
  assert.deepEqual(columns.map((c) => c.phase), ["Pre-start", "Day 1", "Week 1", "Week 2", "Day 30+"]);
  assert.equal(columns.reduce((a, c) => a + c.tasks.length, 0), tasks.length);
});

test("onboardingBoard attaches the person and sorts by start date", () => {
  const people = [
    person({ id: "p14", name: "Nisha Tamang", startDate: ts("2026-11-02") }),
    person({ id: "p12", name: "Dipesh Shahi", startDate: ts("2026-08-04") }),
  ];
  const board = onboardingBoard(people, [
    { personId: "p14", template: "eng" },
    { personId: "p12", template: "eng", done: ["contract", "payroll", "laptop"] },
    { personId: "missing", template: "eng" },
  ], { now: NOW });
  assert.deepEqual(board.map((row) => row.person.id), ["p12", "p14"]);
  assert.equal(board[0].progress.done, 3);
  assert.equal(board[1].progress.done, 0);
  assert.equal(board[0].startDate, ts("2026-08-04"));
});

test("equipmentHoldings ignores returned gear", () => {
  const holdings = equipmentHoldings(person());
  assert.equal(holdings.count, 1);
  assert.equal(holdings.issued[0].item, "MacBook Pro 14");
});
