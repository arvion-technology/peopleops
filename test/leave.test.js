import test from "node:test";
import assert from "node:assert/strict";
import {
  DAY, LEAVE_TYPES, holidayDates,
} from "../src/data.js";
import {
  workingDays, completedMonths, overlaps, findConflicts, leaveBalance, balancesFor,
  validateRequest, decide, whoIsOut, availability, pendingRequests, leaveSummary,
  leaveYearStart, accrualSeries,
} from "../src/leave.js";

const NOW = Date.UTC(2026, 9, 28, 12, 0, 0); // Wed 28 Oct 2026
const ts = (iso) => Date.parse(`${iso}T00:00:00Z`);

const person = (over = {}) => ({
  id: "p1",
  name: "Anisha Shrestha",
  startDate: ts("2020-01-01"),
  carryOver: { annual: 7, sick: 0, casual: 0, unpaid: 0 },
  ...over,
});

const request = (id, from, to, status = "approved", type = "annual", personId = "p1") => ({
  id, personId, type, from: ts(from), to: ts(to), status, requestedAt: ts(from) - 6 * DAY,
});

const baseRequests = [
  request("LR-1", "2026-10-12", "2026-10-16", "approved"), // 5 days used
  request("LR-2", "2026-11-02", "2026-11-06", "approved"), // 5 days booked
  request("LR-3", "2026-11-09", "2026-11-10", "pending"), // not counted
];

/* ------------------------------------------------------------ calendar */

test("workingDays skips Saturdays and public holidays", () => {
  assert.equal(workingDays(ts("2026-10-26"), ts("2026-10-30")), 5);
  assert.equal(workingDays(ts("2026-10-26"), ts("2026-10-31")), 5); // Saturday excluded
  assert.equal(workingDays(ts("2026-10-19"), ts("2026-10-21")), 1); // Dashain closes the 20th and 21st
  assert.equal(workingDays(ts("2026-10-31"), ts("2026-10-31")), 0);
  assert.equal(workingDays(ts("2026-10-30"), ts("2026-10-26")), 0); // reversed range
});

test("holidayDates matches the published holiday list", () => {
  const dates = holidayDates();
  assert.equal(dates.length, 6);
  assert.ok(dates.includes(ts("2026-11-08")));
  assert.ok(!dates.includes(ts("2026-11-11")));
});

test("completedMonths ignores a partial month", () => {
  assert.equal(completedMonths(ts("2026-01-01"), ts("2026-10-28")), 9);
  assert.equal(completedMonths(ts("2026-01-15"), ts("2026-10-10")), 8);
  assert.equal(completedMonths(ts("2026-01-01"), ts("2026-01-01")), 0);
  assert.equal(leaveYearStart(NOW), Date.UTC(2026, 0, 1));
});

/* -------------------------------------------------------------- balances */

test("annual leave accrues monthly, capped by the carry-over policy", () => {
  const balance = leaveBalance(person(), baseRequests, "annual", { asOf: NOW });
  assert.equal(balance.months, 9);
  assert.equal(balance.accrued, 13.5); // 9 × 1.5
  assert.equal(balance.carried, 5); // 7 requested, policy caps at 5
  assert.equal(balance.used, 5);
  assert.equal(balance.booked, 5);
  assert.equal(balance.available, 8.5);
});

test("a new joiner accrues only from their start date", () => {
  const joiner = person({ startDate: ts("2026-07-01"), carryOver: {} });
  const balance = leaveBalance(joiner, [], "annual", { asOf: NOW });
  assert.equal(balance.months, 3);
  assert.equal(balance.accrued, 4.5);
  assert.equal(balance.carried, 0);
  assert.equal(balance.available, 4.5);
});

test("unpaid leave is not limited by a balance", () => {
  const balance = leaveBalance(person(), [], "unpaid", { asOf: NOW });
  assert.equal(balance.unlimited, true);
  assert.equal(balance.available, 0);
  assert.equal(balancesFor(person(), [], { asOf: NOW }).length, LEAVE_TYPES.length);
});

test("accrual series ends at the current month", () => {
  const series = accrualSeries(person(), baseRequests, "annual", { asOf: NOW, months: 12 });
  assert.equal(series.length, 9); // complete months only: Jan..Sep
  assert.equal(series[0].label, "Jan");
  assert.equal(series.at(-1).label, "Sep");
  // Each point is the balance as it stood at that month end, including leave
  // already booked for later in the year.
  assert.equal(series[8].available, leaveBalance(person(), baseRequests, "annual", { asOf: series[8].at }).available);
  assert.equal(series[1].available - series[0].available, 1.5);
});

/* --------------------------------------------------------------- overlap */

test("overlap is inclusive at both ends", () => {
  const a = { from: ts("2026-11-02"), to: ts("2026-11-04") };
  assert.equal(overlaps(a, { from: ts("2026-11-04"), to: ts("2026-11-06") }), true);
  assert.equal(overlaps(a, { from: ts("2026-11-05"), to: ts("2026-11-06") }), false);
  assert.equal(overlaps(a, { from: ts("2026-10-30"), to: ts("2026-11-02") }), true);
});

test("findConflicts ignores rejected requests, other people and itself", () => {
  const requests = [
    ...baseRequests,
    request("LR-4", "2026-11-16", "2026-11-18", "rejected", "annual", "p1"),
    request("LR-5", "2026-11-16", "2026-11-18", "approved", "annual", "p2"),
  ];
  const candidate = { id: "LR-new", personId: "p1", from: ts("2026-11-16"), to: ts("2026-11-17") };
  const conflicts = findConflicts(candidate, requests);
  assert.deepEqual(conflicts.map((r) => r.id), ["LR-1"].filter(() => false));
  // LR-1 is October, the rejected one is skipped, and the p2 one belongs to someone else
  assert.deepEqual(conflicts, []);

  const overlapping = { id: "LR-new", personId: "p1", from: ts("2026-11-04"), to: ts("2026-11-05") };
  assert.deepEqual(findConflicts(overlapping, requests).map((r) => r.id), ["LR-2"]);
});

/* -------------------------------------------------------------- validate */

test("a valid request reports its working days and remaining balance", () => {
  const result = validateRequest(
    { personId: "p1", type: "annual", from: ts("2026-11-16"), to: ts("2026-11-18") },
    { person: person(), requests: baseRequests, now: NOW },
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.workingDays, 3);
  assert.equal(result.remaining, 5.5);
});

test("validation collects every problem, not just the first", () => {
  const result = validateRequest(
    { personId: "p1", type: "annual", from: ts("2026-11-04"), to: ts("2026-11-30") },
    { person: person(), requests: baseRequests, now: NOW },
  );
  assert.equal(result.ok, false);
  const codes = result.errors.map((e) => e.code);
  assert.ok(codes.includes("overlap"));
  assert.ok(codes.includes("too-long"));
});

test("validation rejects past and reversed dates plus empty ranges", () => {
  const past = validateRequest(
    { personId: "p1", type: "annual", from: ts("2026-10-01"), to: ts("2026-10-02") },
    { person: person(), requests: [], now: NOW },
  );
  assert.ok(past.errors.some((e) => e.code === "starts-in-past"));

  const reversed = validateRequest(
    { personId: "p1", type: "annual", from: ts("2026-11-10"), to: ts("2026-11-09") },
    { person: person(), requests: [], now: NOW },
  );
  assert.ok(reversed.errors.some((e) => e.code === "invalid-range"));

  const saturday = validateRequest(
    { personId: "p1", type: "annual", from: ts("2026-10-31"), to: ts("2026-10-31") },
    { person: person(), requests: [], now: NOW },
  );
  assert.ok(saturday.errors.some((e) => e.code === "no-working-days"));
});

test("validation refuses a request bigger than the available balance", () => {
  const joiner = person({ startDate: ts("2026-07-01"), carryOver: {} });
  const result = validateRequest(
    { personId: "p1", type: "annual", from: ts("2026-11-02"), to: ts("2026-11-06") },
    { person: joiner, requests: [], now: NOW },
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === "insufficient-balance"));
  assert.equal(result.remaining, -0.5);
});

/* ----------------------------------------------------------------- decide */

test("decide approves a pending request without mutating it", () => {
  const pending = request("LR-9", "2026-11-16", "2026-11-17", "pending");
  const approved = decide(pending, "approved", { by: "p5", at: NOW, note: "ok" });
  assert.equal(approved.status, "approved");
  assert.equal(approved.decidedBy, "p5");
  assert.equal(approved.decisionNote, "ok");
  assert.equal(pending.status, "pending");
  assert.throws(() => decide(approved, "approved"), /already approved/);
  assert.throws(() => decide(pending, "maybe"), /invalid decision/);
});

/* ------------------------------------------------------------------ who */

test("whoIsOut lists approved leave on working days only", () => {
  const people = [person(), person({ id: "p2", name: "Bikash" })];
  const requests = [request("LR-1", "2026-10-26", "2026-10-30", "approved", "annual", "p1")];
  const days = whoIsOut(requests, people, { from: ts("2026-10-26"), to: ts("2026-11-01") });
  assert.equal(days.length, 7);
  assert.equal(days.filter((d) => d.entries.length).length, 5);
  assert.equal(days[5].weekend, true);
  assert.equal(days[5].entries.length, 0);
  assert.equal(days[0].entries[0].person.name, "Anisha Shrestha");
});

test("holidays are marked and nobody is counted out on them", () => {
  const people = [person()];
  const requests = [request("LR-1", "2026-10-19", "2026-10-21", "approved")];
  const days = whoIsOut(requests, people, { from: ts("2026-10-19"), to: ts("2026-10-21") });
  const holiday = days.find((d) => d.holiday);
  assert.equal(holiday.date, ts("2026-10-20"));
  assert.equal(holiday.entries.length, 0);
});

test("availability reports the share of the team out", () => {
  const people = [person(), person({ id: "p2" }), person({ id: "p3" })];
  const requests = [request("LR-1", "2026-10-26", "2026-10-26", "approved", "annual", "p1")];
  const rows = availability(requests, people, { from: ts("2026-10-26"), to: ts("2026-10-26") });
  assert.equal(rows[0].out, 1);
  assert.equal(rows[0].rate, 1 / 3);
});

test("pendingRequests is sorted by start date with the person attached", () => {
  const people = [person(), person({ id: "p2", name: "Bikash" })];
  const requests = [
    request("LR-2", "2026-11-16", "2026-11-17", "pending", "annual", "p1"),
    request("LR-1", "2026-11-02", "2026-11-03", "pending", "annual", "p2"),
    request("LR-3", "2026-11-20", "2026-11-20", "approved", "annual", "p1"),
  ];
  const rows = pendingRequests(requests, people);
  assert.deepEqual(rows.map((r) => r.request.id), ["LR-1", "LR-2"]);
  assert.equal(rows[0].person.name, "Bikash");
});

test("leaveSummary counts approved days per type and pending requests", () => {
  const summary = leaveSummary(baseRequests, [person()], { asOf: NOW });
  const annual = summary.byType.find((t) => t.type.id === "annual");
  assert.equal(annual.days, 10); // 5 used + 5 booked
  assert.equal(summary.pending, 1);
  assert.equal(summary.approved, 2);
  assert.equal(summary.rejected, 0);
});
