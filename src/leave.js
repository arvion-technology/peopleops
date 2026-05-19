/**
 * PeopleOps leave maths.
 *
 * Leave is the part of HR software everyone has an opinion about, so the rules
 * are explicit and small:
 *
 *   - leave year starts 1 January;
 *   - annual accrues 1.5 days per completed month, capped at 18 for the year;
 *   - carry-over is capped per policy (annual 5, everything else 0);
 *   - availability = accrued + carried − used − booked;
 *   - a request is measured in *working* days: Saturday and public holidays
 *     do not consume leave.
 *
 * `validateRequest` returns every reason a request cannot be approved instead of
 * the first one, because the form shows all of them at once.
 */

import { DAY, LEAVE_TYPES, holidayDates, isWeekend, isHoliday } from "./data.js";

const round = (n, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function leaveType(typeId) {
  return LEAVE_TYPES.find((t) => t.id === typeId) ?? null;
}

export function leaveYearStart(ts) {
  return Date.UTC(new Date(ts).getUTCFullYear(), 0, 1);
}

/** Whole months between two dates, ignoring the day-of-month remainder. */
export function completedMonths(from, to) {
  if (to <= from) return 0;
  const a = new Date(from), b = new Date(to);
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months--;
  return Math.max(0, months);
}

/** Inclusive list of days between two timestamps (midnight UTC aligned). */
export function daysBetweenList(from, to) {
  const days = [];
  for (let ts = from; ts <= to; ts += DAY) days.push(ts);
  return days;
}

/** Working days in an inclusive range; Saturday and listed holidays are skipped. */
export function workingDays(from, to, holidays = holidayDates()) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0;
  let count = 0;
  for (const ts of daysBetweenList(from, to)) {
    if (isWeekend(ts) || isHoliday(ts, holidays)) continue;
    count++;
  }
  return count;
}

/** Do two inclusive date ranges share a day? */
export function overlaps(a, b) {
  return a.from <= b.to && b.from <= a.to;
}

/** Existing requests (pending or approved) for the same person that clash. */
export function findConflicts(request, requests, { ignoreId = null } = {}) {
  return requests.filter((other) =>
    other.id !== request.id
    && other.id !== ignoreId
    && other.personId === request.personId
    && (other.status === "pending" || other.status === "approved")
    && overlaps(request, other));
}

function approvedDays(personId, requests, typeId, { asOf, holidays }) {
  const yearStart = leaveYearStart(asOf);
  let used = 0;
  let booked = 0;
  for (const request of requests) {
    if (request.personId !== personId || request.type !== typeId) continue;
    if (request.status !== "approved") continue;
    if (request.to < yearStart || request.from > asOf + 366 * DAY) continue;
    const days = workingDays(request.from, request.to, holidays);
    if (request.from <= asOf) used += days;
    else booked += days;
  }
  return { used, booked };
}

/**
 * One person's position on one leave type.
 *
 * `available` can go negative if a policy changed after leave was booked; the
 * number is left honest rather than clamped, and the UI shows it in red.
 */
export function leaveBalance(person, requests, typeId, { asOf = Date.now(), holidays = holidayDates() } = {}) {
  const type = leaveType(typeId);
  if (!type) throw new Error(`unknown leave type: ${typeId}`);
  const yearStart = leaveYearStart(asOf);
  const from = Math.max(yearStart, person.startDate ?? yearStart);
  const months = completedMonths(from, asOf);
  const accrued = round(Math.min(type.entitlement, months * type.monthlyRate));
  const carried = round(Math.min(type.carryOverCap, person.carryOver?.[typeId] ?? 0));
  const { used, booked } = approvedDays(person.id, requests, typeId, { asOf, holidays });
  return {
    type,
    months,
    accrued,
    carried,
    used,
    booked,
    available: round(accrued + carried - used - booked),
    unlimited: !type.paid && type.monthlyRate === 0,
  };
}

/** All leave balances for one person, in policy order. */
export function balancesFor(person, requests, options = {}) {
  return LEAVE_TYPES.map((type) => leaveBalance(person, requests, type.id, options));
}

/**
 * Validate a leave request against balance, overlap and policy limits.
 * Returns every problem, not just the first, plus the numbers behind them.
 */
export function validateRequest(request, {
  person, requests = [], holidays = holidayDates(), now = Date.now(), maxConsecutiveDays = 15,
} = {}) {
  const errors = [];
  if (!person) errors.push({ code: "no-person", message: "Choose a person." });
  const validDates = Number.isFinite(request.from) && Number.isFinite(request.to);
  if (!validDates) errors.push({ code: "invalid-range", message: "Both dates are required." });
  if (validDates && request.to < request.from) errors.push({ code: "invalid-range", message: "The end date is before the start date." });
  if (validDates && request.from < Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate())) {
    errors.push({ code: "starts-in-past", message: "Leave cannot start in the past." });
  }

  const type = leaveType(request.type);
  if (!type) errors.push({ code: "no-type", message: "Choose a leave type." });

  let days = 0;
  let balance = null;
  let remaining = null;
  if (validDates && request.to >= request.from && type) {
    days = workingDays(request.from, request.to, holidays);
    if (days === 0) errors.push({ code: "no-working-days", message: "That range contains no working days." });
    if (days > maxConsecutiveDays) {
      errors.push({ code: "too-long", message: `More than ${maxConsecutiveDays} working days needs a written plan.` });
    }
    if (person) {
      balance = leaveBalance(person, requests, request.type, { asOf: now, holidays });
      remaining = round(balance.available - days);
      if (!balance.unlimited && days > balance.available) {
        errors.push({
          code: "insufficient-balance",
          message: `Needs ${days} days but only ${Math.max(0, balance.available)} are available.`,
        });
      }
    }
    if (!errors.some((e) => e.code === "invalid-range")) {
      const conflicts = findConflicts(request, requests);
      if (conflicts.length) {
        errors.push({
          code: "overlap",
          message: `Overlaps ${conflicts.map((c) => `${c.id} (${c.status})`).join(", ")}.`,
        });
      }
    }
  }

  return { ok: errors.length === 0, errors, workingDays: days, balance, remaining };
}

/** Approve or reject a pending request. Returns a new object; input untouched. */
export function decide(request, decision, { by = "people-ops", at = Date.now(), note = "" } = {}) {
  if (request.status !== "pending") {
    throw new Error(`request ${request.id} is already ${request.status}`);
  }
  if (decision !== "approved" && decision !== "rejected") {
    throw new Error(`invalid decision: ${decision}`);
  }
  return { ...request, status: decision, decidedAt: at, decidedBy: by, decisionNote: note };
}

/**
 * Who is out on each day in the range, for the team calendar.
 * Weekends are skipped; holidays are returned with `holiday: true`.
 */
export function whoIsOut(requests, people, { from, to, holidays = holidayDates() } = {}) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const approved = requests.filter((r) => r.status === "approved");
  return daysBetweenList(from, to).map((date) => {
    const holiday = isHoliday(date, holidays);
    const entries = holiday || isWeekend(date) ? [] : approved
      .filter((r) => r.from <= date && r.to >= date)
      .map((r) => ({ request: r, person: byId.get(r.personId), type: leaveType(r.type) }))
      .filter((e) => e.person);
    return { date, holiday, weekend: isWeekend(date), entries };
  });
}

/** Headcount available per day, used for the team load strip. */
export function availability(requests, people, options = {}) {
  return whoIsOut(requests, people, options).map((day) => ({
    ...day,
    out: day.entries.length,
    headcount: people.length,
    rate: people.length ? day.entries.length / people.length : 0,
  }));
}

/** Pending requests oldest-start first, with the person attached. */
export function pendingRequests(requests, people) {
  const byId = new Map(people.map((p) => [p.id, p]));
  return requests
    .filter((r) => r.status === "pending")
    .map((request) => ({ request, person: byId.get(request.personId) }))
    .filter((row) => row.person)
    .sort((a, b) => a.request.from - b.request.from || a.person.name.localeCompare(b.person.name));
}

/** Days per leave type and status, for the summary strip. */
export function leaveSummary(requests, people, { asOf = Date.now(), holidays = holidayDates() } = {}) {
  const yearStart = leaveYearStart(asOf);
  const byType = LEAVE_TYPES.map((type) => {
    const rows = requests.filter((r) => r.type === type.id && r.status === "approved" && r.to >= yearStart && r.from <= asOf + 366 * DAY);
    return {
      type,
      days: rows.reduce((a, r) => a + workingDays(r.from, r.to, holidays), 0),
      requests: rows.length,
    };
  });
  const pending = requests.filter((r) => r.status === "pending").length;
  const approved = requests.filter((r) => r.status === "approved").length;
  const rejected = requests.filter((r) => r.status === "rejected").length;
  return { byType, pending, approved, rejected, people: people.length };
}

/** The accrual/usage line for one person, month by month. */
export function accrualSeries(person, requests, typeId, { asOf = Date.now(), months = 10, holidays = holidayDates() } = {}) {
  const yearStart = leaveYearStart(asOf);
  const points = [];
  for (let m = 0; m < months; m++) {
    const at = Date.UTC(new Date(yearStart).getUTCFullYear(), m + 1, 0); // end of month m
    if (at > asOf) break;
    const balance = leaveBalance(person, requests, typeId, { asOf: at, holidays });
    points.push({ at, label: new Date(at).toLocaleString("en-US", { month: "short", timeZone: "UTC" }), available: balance.available, used: balance.used });
  }
  return points;
}

export { clamp };
