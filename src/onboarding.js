/**
 * PeopleOps onboarding: turning a template into dated tasks.
 *
 * Templates are offsets in working days around the start date, so a task can be
 * due before day one (a laptop has to exist before someone arrives). The
 * conversion to calendar dates is the only real logic here, and it reuses the
 * same "Saturday and holidays are not working days" rule as leave.
 */

import { DAY, ONBOARDING_TEMPLATES, holidayDates, isHoliday, isWeekend } from "./data.js";

/** Add (or subtract) working days, skipping Saturdays and holidays. */
export function addWorkingDays(date, offset, holidays = holidayDates()) {
  let ts = date;
  let left = Math.abs(offset);
  while (left > 0) {
    ts += offset < 0 ? -DAY : DAY;
    if (!isWeekend(ts) && !isHoliday(ts, holidays)) left--;
  }
  return ts;
}

/** Board column for a task, based on its offset from the start date. */
export function phaseFor(offset) {
  if (offset < 0) return "Pre-start";
  if (offset === 0) return "Day 1";
  if (offset <= 5) return "Week 1";
  if (offset <= 14) return "Week 2";
  return "Day 30+";
}

export const PHASES = ["Pre-start", "Day 1", "Week 1", "Week 2", "Day 30+"];

/**
 * Dated checklist for one onboarding entry.
 *
 * @param {{personId:string, template:string, done?:string[], startDate:number}} entry
 * @param {{now?:number, holidays?:number[], templates?:object}} [options]
 */
export function buildChecklist(entry, { now = Date.now(), holidays = holidayDates(), templates = ONBOARDING_TEMPLATES } = {}) {
  const template = templates[entry.template] ?? [];
  const startDate = entry.startDate;
  const done = new Set(entry.done ?? []);
  return template
    .map((task) => {
      const dueAt = addWorkingDays(startDate, task.offset, holidays);
      return {
        ...task,
        phase: phaseFor(task.offset),
        dueAt,
        done: done.has(task.id),
        overdue: !done.has(task.id) && dueAt < now,
      };
    })
    .sort((a, b) => a.dueAt - b.dueAt || a.label.localeCompare(b.label));
}

export function checklistProgress(tasks, { now = Date.now() } = {}) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const overdue = tasks.filter((t) => !t.done && t.dueAt < now);
  const next = tasks.find((t) => !t.done) ?? null;
  return {
    total,
    done,
    pct: total ? done / total : 1,
    overdue,
    overdueCount: overdue.length,
    next,
    complete: done === total,
  };
}

/** Group into ordered board columns. */
export function groupByPhase(tasks) {
  return PHASES.map((phase) => ({ phase, tasks: tasks.filter((t) => t.phase === phase) }))
    .filter((column) => column.tasks.length > 0);
}

/** Board data for every person currently onboarding. */
export function onboardingBoard(people, entries, { now = Date.now(), holidays = holidayDates(), templates = ONBOARDING_TEMPLATES } = {}) {
  const byId = new Map(people.map((p) => [p.id, p]));
  return entries
    .map((entry) => {
      const person = byId.get(entry.personId);
      if (!person) return null;
      const tasks = buildChecklist({ ...entry, startDate: person.startDate }, { now, holidays, templates });
      return {
        person,
        entry,
        tasks,
        progress: checklistProgress(tasks, { now }),
        startDate: person.startDate,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.startDate - b.startDate);
}

/** Equipment currently issued to a person. */
export function equipmentHoldings(person) {
  const issued = person.equipment.filter((e) => !e.returnedAt);
  return { issued, count: issued.length };
}
