// PeopleOps demo — rendering and interaction only.
// Leave arithmetic is in ../src/leave.js, onboarding dates in
// ../src/onboarding.js, and both are exercised by the test suite.
import {
  DAY, LEAVE_TYPES, DEPARTMENTS, HOLIDAYS, generateTeam,
} from "../src/data.js";
import {
  workingDays, leaveBalance, balancesFor, validateRequest, decide,
  pendingRequests, whoIsOut, availability, leaveType,
} from "../src/leave.js";
import {
  onboardingBoard, groupByPhase, equipmentHoldings, PHASES,
} from "../src/onboarding.js";

const $ = A.$, $$ = A.$$, el = A.el, fmt = A.fmt;
const STORE_KEY = "peopleops";
const TODAY = (() => {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
})();

const state = {
  view: "team",
  dept: "all",
  hireId: "p14",
  leavePerson: "p6",
  leaveType: "annual",
  from: null,
  to: null,
  calMonth: Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
};

/* ------------------------------------------------------------------ state */

function freshData() {
  return generateTeam({ now: Date.now() });
}

function restore() {
  const fresh = freshData();
  const saved = A.store.get(STORE_KEY, null);
  if (!saved) return fresh;
  return {
    ...fresh,
    requests: Array.isArray(saved.requests) ? saved.requests : fresh.requests,
    onboarding: fresh.onboarding.map((entry) => ({
      ...entry,
      done: Array.isArray(saved.done?.[entry.personId]) ? saved.done[entry.personId] : entry.done,
    })),
  };
}

let data = restore();

function persist() {
  A.store.set(STORE_KEY, {
    requests: data.requests,
    done: Object.fromEntries(data.onboarding.map((e) => [e.personId, e.done])),
  });
}

const personById = (id) => data.people.find((p) => p.id === id) ?? null;
const deptLabel = (id) => DEPARTMENTS.find((d) => d.id === id)?.label ?? id;
const dateLabel = (ts) => new Date(ts).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const shortDate = (ts) => new Date(ts).toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
const weekdayLabel = (ts) => new Date(ts).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
const isoDate = (ts) => new Date(ts).toISOString().slice(0, 10);

const typeBadge = (typeId) => {
  const type = leaveType(typeId);
  return el("span", { class: `badge ${type?.tone ?? ""}`, text: type?.label ?? typeId });
};
const statusBadge = (status) => el("span", {
  class: `badge ${status === "approved" ? "green" : status === "rejected" ? "red" : "gold"}`,
  text: status,
});
const progressBar = (value, tone = "") => el("div", { class: `progress ${tone}` }, el("i", { style: `width:${Math.min(100, Math.max(0, value * 100))}%` }));

const personLine = (person, sub, right) => el("div", { class: "person-line" },
  el("span", { class: "avatar sm", text: fmt.initials(person.name) }),
  el("div", { style: "min-width:0" },
    el("div", { class: "name", text: person.name }),
    el("div", { class: "sub", text: sub })),
  el("span", { class: "spacer" }),
  right ?? null);

function tenure(startDate) {
  const months = Math.max(0, Math.floor((Date.now() - startDate) / (30.44 * DAY)));
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years}y ${rest}m` : `${years}y`;
}

function statCard({ label, value, sub, tone = "" }) {
  const color = tone === "green" ? "var(--green)" : tone === "red" ? "var(--red)" : tone === "blue" ? "#8fb4ff" : "var(--gold)";
  return el("div", { class: "card" },
    el("div", { class: "stat" },
      el("div", { class: "stat-label", text: label }),
      el("div", { class: "stat-value", style: `color:${color}`, text: value }),
      el("div", { class: "small muted", text: sub })));
}

/* ------------------------------------------------------------------- team */

function renderTeam() {
  const people = data.people.filter((p) => state.dept === "all" || p.departmentId === state.dept);
  const out = whoIsOut(data.requests, data.people, { from: TODAY, to: TODAY }).filter((d) => d.entries.length)[0]?.entries ?? [];
  const pending = data.requests.filter((r) => r.status === "pending");
  const active = data.people.filter((p) => p.status === "active");
  const upcoming = data.people.filter((p) => p.status === "upcoming");
  const board = onboardingBoard(data.people, data.onboarding, { now: Date.now() });
  const overdueTasks = board.reduce((a, row) => a + row.progress.overdueCount, 0);

  $("#team-kpis").replaceChildren(
    statCard({ label: "Headcount", value: String(data.people.length), sub: `${active.length} active · ${upcoming.length} starting soon` }),
    statCard({ label: "Out today", value: String(out.length), sub: out.length ? out.map((e) => e.person.name.split(" ")[0]).join(", ") : "everyone is in", tone: out.length ? "gold" : "green" }),
    statCard({ label: "Pending approvals", value: String(pending.length), sub: pending.length ? "waiting on people ops" : "queue is clear", tone: pending.length ? "blue" : "green" }),
    statCard({ label: "Onboarding", value: String(board.length), sub: `${overdueTasks} overdue task${overdueTasks === 1 ? "" : "s"}`, tone: overdueTasks ? "red" : "green" }),
  );

  $("#directory-count").textContent = `${people.length} people`;
  $("#directory-table").replaceChildren(el("div", { class: "directory" },
    ...people.map((p) => {
      const balance = leaveBalance(p, data.requests, "annual");
      return el("div", { class: "dir-row" },
        el("span", { class: "avatar sm", text: fmt.initials(p.name) }),
        el("div", { style: "min-width:0" },
          el("div", { class: "dir-name", text: p.name }),
          el("div", { class: "dir-sub", text: `${p.role} · ${deptLabel(p.departmentId)}` })),
        el("span", { class: "spacer" }),
        el("div", { style: "text-align:right;flex:none" },
          el("div", { class: "mono", style: `font-size:12px;color:${balance.available < 0 ? "var(--red)" : "var(--gold)"}`, title: "Annual leave available", text: balance.unlimited ? "∞" : `${balance.available}d` }),
          el("div", { class: "dir-sub", text: p.status === "upcoming" ? "starts soon" : tenure(p.startDate) })));
    })));

  $("#out-count").textContent = out.length ? `${out.length} out` : "all in";
  $("#out-today").replaceChildren(...[
    ...out.map((entry) => personLine(entry.person, `${entry.type?.label} · back ${shortDate(entry.request.to)}`, typeBadge(entry.request.type))),
    out.length === 0 ? el("p", { class: "small muted mb-0", text: "Nobody is on approved leave today. Requests waiting for approval are in the queue." }) : null,
  ].filter(Boolean));

  $("#onboarding-mini").replaceChildren(...board.map((row) => el("div", { style: "padding:8px 0;border-bottom:1px solid var(--line);cursor:pointer", onclick: () => { state.hireId = row.person.id; location.hash = "#onboarding"; } },
    el("div", { class: "row", style: "margin-bottom:6px" },
      el("span", { class: "small", style: "font-weight:600", text: row.person.name }),
      el("span", { class: "spacer" }),
      el("span", { class: "mono small muted", text: `${row.progress.done}/${row.progress.total}` })),
    progressBar(row.progress.pct, "green"),
    el("div", { class: "row", style: "margin-top:5px;font-size:10.5px;color:var(--muted)" },
      el("span", { text: `starts ${shortDate(row.startDate)}` }),
      el("span", { class: "spacer" }),
      row.progress.overdueCount
        ? el("span", { class: "badge red", text: `${row.progress.overdueCount} overdue` })
        : el("span", { class: "badge green", text: "on track" })))));
}

/* ------------------------------------------------------------- onboarding */

function currentBoardRow() {
  const board = onboardingBoard(data.people, data.onboarding, { now: Date.now() });
  return board.find((row) => row.person.id === state.hireId) ?? board[0] ?? null;
}

function toggleTask(personId, taskId) {
  const entry = data.onboarding.find((e) => e.personId === personId);
  if (!entry) return;
  const set = new Set(entry.done);
  if (set.has(taskId)) set.delete(taskId);
  else set.add(taskId);
  entry.done = [...set];
  persist();
  renderOnboarding();
  A.toast(set.has(taskId) ? "Task marked done" : "Task reopened", "success", 1400);
}

function renderOnboarding() {
  const board = onboardingBoard(data.people, data.onboarding, { now: Date.now() });
  $("#onboarding-tabs").replaceChildren(...board.map((row) => el("button", {
    class: `tab ${row.person.id === state.hireId ? "active" : ""}`,
    onclick: () => { state.hireId = row.person.id; renderOnboarding(); },
    text: row.person.name.split(" ")[0],
  })));
  const row = currentBoardRow();
  if (!row) return;
  state.hireId = row.person.id;
  const { person, tasks, progress } = row;

  $("#onboarding-progress-badge").textContent = `${progress.done} / ${progress.total}`;
  $("#onboarding-summary").replaceChildren(
    el("div", { class: "row", style: "align-items:baseline;gap:8px" },
      el("span", { class: "stat-value", style: "font-size:28px;color:var(--gold)", text: fmt.pct(progress.pct, 0) }),
      el("span", { class: "small muted", text: "complete" })),
    progressBar(progress.pct, "green"),
    el("dl", { class: "kv mt-2" },
      el("dt", { text: "Start date" }), el("dd", { text: dateLabel(row.startDate) }),
      el("dt", { text: "Department" }), el("dd", { text: deptLabel(person.departmentId) }),
      el("dt", { text: "Manager" }), el("dd", { text: personById(person.managerId)?.name ?? "—" }),
      el("dt", { text: "Tasks" }), el("dd", { class: "mono", text: `${progress.done} of ${progress.total}` }),
      el("dt", { text: "Overdue" }), el("dd", { class: "mono", style: progress.overdueCount ? "color:var(--red)" : null, text: progress.overdueCount ? String(progress.overdueCount) : "none" }),
      el("dt", { text: "Next" }), el("dd", { text: progress.next ? progress.next.label : "All done" })),
  );

  const holdings = equipmentHoldings(person);
  $("#equipment-panel").replaceChildren(
    ...person.equipment.map((item) => el("div", { class: "row", style: "padding:5px 0;border-bottom:1px solid var(--line);font-size:11.5px" },
      el("span", { class: "mono small muted", text: item.serial }),
      el("span", { class: "spacer" }),
      el("span", { class: "small", text: item.item }),
      el("span", { class: `badge ${item.returnedAt ? "red" : "green"}`, text: item.returnedAt ? "returned" : "issued" }))),
    el("p", { class: "small muted", style: "margin:8px 0 0", text: `${holdings.count} items currently issued` }),
  );

  const owners = [...new Set(tasks.map((t) => t.owner))];
  $("#ownership-panel").replaceChildren(...owners.map((ownerName) => {
    const own = tasks.filter((t) => t.owner === ownerName);
    const done = own.filter((t) => t.done).length;
    return el("div", { style: "padding:6px 0;border-bottom:1px solid var(--line);font-size:11.5px" },
      el("div", { class: "row", style: "margin-bottom:4px" },
        el("span", { class: "small", text: ownerName }),
        el("span", { class: "spacer" }),
        el("span", { class: "mono small muted", text: `${done}/${own.length}` })),
      progressBar(own.length ? done / own.length : 0, done === own.length ? "green" : ""));
  }));

  const columns = groupByPhase(tasks);
  $("#onboarding-board").replaceChildren(...PHASES.map((phase) => {
    const items = columns.find((c) => c.phase === phase)?.tasks ?? [];
    return el("div", { class: "phase-col" },
      el("div", { class: "phase-head" },
        el("span", { class: "name", text: phase }),
        el("span", { class: "count", text: String(items.length) })),
      ...items.map((task) => el("div", { class: `task-card${task.done ? " is-done" : ""}${task.overdue ? " is-overdue" : ""}` },
        el("div", { class: "row", style: "gap:7px;align-items:flex-start" },
          el("button", {
            class: "task-toggle", role: "checkbox", "aria-checked": task.done ? "true" : "false",
            "aria-label": `${task.label} done`, onclick: () => toggleTask(person.id, task.id),
            text: task.done ? "✓" : "",
          }),
          el("div", { class: "task-label", text: task.label })),
        el("div", { class: "task-meta" },
          el("span", { class: "task-owner", text: task.owner }),
          el("span", { class: "spacer" }),
          el("span", { class: "mono", style: task.overdue ? "color:var(--red)" : null, text: fmt.date(task.dueAt) })))),
      items.length === 0 ? el("div", { class: "small muted center", style: "padding:14px 0", text: "—" }) : null);
  }));
}

/* ------------------------------------------------------------------ leave */

function leaveContext() {
  return {
    person: personById(state.leavePerson),
    type: leaveType(state.leaveType),
    from: state.from,
    to: state.to,
  };
}

function renderLeave() {
  $("#leave-person").replaceChildren(...data.people.filter((p) => p.status === "active").map((p) => el("option", {
    value: p.id, text: `${p.name} · ${deptLabel(p.departmentId)}`, selected: p.id === state.leavePerson ? "" : null,
  })));
  $("#leave-type").replaceChildren(...LEAVE_TYPES.map((t) => el("option", {
    value: t.id, text: t.label, selected: t.id === state.leaveType ? "" : null,
  })));
  $("#leave-from").value = isoDate(state.from);
  $("#leave-to").value = isoDate(state.to);

  const person = personById(state.leavePerson);
  $("#balance-person").textContent = person ? person.name : "—";
  $("#balance-panel").replaceChildren(...(person ? balancesFor(person, data.requests) : []).map((balance) => {
    const cap = balance.accrued + balance.carried;
    return el("div", { class: "balance-row" },
      el("div", { class: "row", style: "margin-bottom:5px" },
        typeBadge(balance.type.id),
        el("span", { class: "small muted", text: balance.unlimited ? "not limited" : `${balance.accrued} accrued + ${balance.carried} carried` }),
        el("span", { class: "spacer" }),
        el("span", { class: "balance-num", style: balance.available < 0 ? "color:var(--red)" : "color:var(--gold)", text: balance.unlimited ? "∞" : String(balance.available) })),
      progressBar(balance.unlimited ? 1 : Math.max(0, balance.available) / Math.max(1, balance.type.entitlement), balance.available < 0 ? "" : "green"),
      el("div", { class: "row", style: "margin-top:4px;font-size:10.5px;color:var(--muted)" },
        el("span", { text: `used ${balance.used} · booked ${balance.booked}` }),
        el("span", { class: "spacer" }),
        el("span", { text: balance.unlimited ? "" : `cap ${balance.type.entitlement}/yr` })));
  }));

  renderLeaveValidation();
}

function renderLeaveValidation() {
  const { person, type } = leaveContext();
  if (!person || !type) return;
  const candidate = { id: "draft", personId: person.id, type: type.id, from: state.from, to: state.to };
  const result = validateRequest(candidate, {
    person,
    requests: data.requests.filter((r) => r.id !== candidate.id),
    now: Date.now(),
  });
  $("#leave-validation").replaceChildren(...(result.ok
    ? [el("div", { class: "validation ok" },
      el("span", { class: "dot" }),
      el("span", { text: `${result.workingDays} working day${result.workingDays === 1 ? "" : "s"} · ${result.remaining} available after approval · no overlap` }))]
    : result.errors.map((error) => el("div", { class: "validation err" },
      el("span", { class: "dot" }), el("span", { text: error.message })))));
  const days = workingDays(state.from, state.to);
  $("#leave-range-note").textContent = `${days} working day${days === 1 ? "" : "s"} selected`;
  $("#leave-submit").disabled = !result.ok;

  const recent = data.requests
    .slice()
    .sort((a, b) => b.requestedAt - a.requestedAt)
    .slice(0, 5);
  $("#request-count").textContent = `${data.requests.length} requests`;
  $("#request-table").replaceChildren(A.dataTable({
    columns: [
      { label: "Person", render: (r) => el("span", { class: "small", text: personById(r.personId)?.name ?? r.personId }) },
      { label: "Type", render: (r) => typeBadge(r.type) },
      { label: "Dates", render: (r) => el("span", { class: "small", text: `${shortDate(r.from)} – ${shortDate(r.to)}` }) },
      { label: "Days", align: "right", render: (r) => el("span", { class: "mono small", text: String(workingDays(r.from, r.to)) }) },
      { label: "Status", align: "right", render: (r) => statusBadge(r.status) },
      {
        label: "Balance", align: "right",
        render: (r) => el("span", { class: "mono small muted", text: String(leaveBalance(personById(r.personId), data.requests, r.type).available) }),
      },
    ],
    rows: recent,
    empty: "No requests in the log yet.",
  }));

  const upcoming = whoIsOut(data.requests, data.people, { from: TODAY, to: TODAY + 6 * DAY }).filter((d) => !d.weekend);
  $("#out-strip").replaceChildren(...upcoming.map((day) => el("div", { class: "availability-row" },
    el("span", { class: "date", text: shortDate(day.date) }),
    el("span", { class: "small muted", style: "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap", text: day.entries.length ? day.entries.map((e) => e.person.name.split(" ")[0]).join(", ") : "—" }),
    el("span", { class: "spacer" }),
    el("span", { class: `badge ${day.holiday ? "gold" : day.entries.length ? "red" : ""}`, text: day.holiday ? "holiday" : `${day.entries.length} out` }))));
}

function submitLeave() {
  const { person, type } = leaveContext();
  if (!person || !type) return;
  const candidate = {
    id: `LR-${Date.now().toString().slice(-6)}`,
    personId: person.id,
    type: type.id,
    from: state.from,
    to: state.to,
    status: "pending",
    note: ($("#leave-note")?.value ?? "").trim(),
    requestedAt: Date.now(),
    decidedAt: null,
    decidedBy: null,
  };
  const result = validateRequest(candidate, { person, requests: data.requests, now: Date.now() });
  if (!result.ok) {
    A.toast(result.errors[0].message, "error", 3600);
    return;
  }
  data.requests.push(candidate);
  persist();
  $("#leave-note").value = "";
  renderLeave();
  renderPendingBadge();
  A.toast(`Request sent to ${person.name}'s manager`, "success");
}

function renderPendingBadge() {
  const pending = data.requests.filter((r) => r.status === "pending").length;
  $("#nav-pending").textContent = String(pending);
}

/* -------------------------------------------------------------- approvals */

function renderApprovals() {
  const rows = pendingRequests(data.requests, data.people);
  $("#approval-count").textContent = `${rows.length} pending`;
  $("#approval-queue").replaceChildren(...rows.map(({ request, person }) => {
    const others = data.requests.filter((r) => r.id !== request.id);
    const check = validateRequest(request, { person, requests: others, now: Date.now() });
    const balance = leaveBalance(person, others, request.type);
    const days = workingDays(request.from, request.to);
    return el("div", { class: `approval-card${check.ok ? "" : " has-error"}` },
      el("div", { class: "row", style: "gap:10px" },
        el("span", { class: "avatar", text: fmt.initials(person.name) }),
        el("div", {},
          el("div", { class: "strong", text: person.name }),
          el("div", { class: "small muted", text: `${person.role} · ${deptLabel(person.departmentId)}` })),
        el("span", { class: "spacer" }),
        typeBadge(request.type),
        statusBadge(request.status)),
      el("div", { class: "approval-dates", style: "margin-top:8px" },
        `${dateLabel(request.from)} → ${dateLabel(request.to)} · ${days} working day${days === 1 ? "" : "s"} · requested ${fmt.relative(request.requestedAt)}`),
      request.note ? el("div", { class: "approval-note", text: `“${request.note}”` }) : null,
      el("div", { class: "row", style: "margin-top:9px;gap:14px;font-size:11.5px;color:var(--muted)" },
        el("span", { text: `Available: ${balance.available} days` }),
        el("span", { text: `After: ${Math.round((balance.available - days) * 100) / 100} days` }),
        el("span", { class: "mono", text: request.id }),
        el("span", { class: "spacer" }),
        el("button", { class: "btn sm", onclick: () => askReject(request), text: "Reject" }),
        el("button", { class: "btn sm primary", onclick: () => approve(request), text: "Approve" })),
      check.ok ? null : el("div", { class: "approval-warn", text: check.errors.map((e) => e.message).join(" · ") }));
  }), rows.length === 0
    ? el("div", { class: "empty" }, el("strong", { text: "Queue is clear" }), el("span", { text: "New requests appear here with a fresh balance check." }))
    : null);

  const decided = data.requests
    .filter((r) => r.status !== "pending" && r.decidedAt)
    .sort((a, b) => b.decidedAt - a.decidedAt)
    .slice(0, 7);
  $("#decisions-list").replaceChildren(...[
    ...decided.map((request) => {
      const person = personById(request.personId);
      return el("div", { class: "row", style: "padding:8px 0;border-bottom:1px solid var(--line);gap:9px" },
        el("span", { class: "avatar sm", text: fmt.initials(person?.name ?? "?") }),
        el("div", { style: "min-width:0" },
          el("div", { class: "small strong", text: person?.name ?? request.personId }),
          el("div", { class: "small muted", text: `${shortDate(request.from)} · ${leaveType(request.type)?.label}` })),
        el("span", { class: "spacer" }),
        statusBadge(request.status));
    }),
    decided.length === 0 ? el("p", { class: "small muted mb-0", text: "No decisions recorded yet." }) : null,
  ].filter(Boolean));
}

function approve(request) {
  const next = decide(request, "approved", { by: "p5", at: Date.now(), note: "Approved from queue" });
  data.requests = data.requests.map((r) => (r.id === request.id ? next : r));
  persist();
  renderApprovals();
  renderPendingBadge();
  A.toast(`Approved ${request.id}`, "success");
}

function askReject(request) {
  const person = personById(request.personId);
  A.modal({
    title: `Reject ${request.id}`,
    body: el("div", { class: "col", style: "gap:12px" },
      el("p", { class: "small muted mb-0", text: `${person.name}: ${dateLabel(request.from)} to ${dateLabel(request.to)}. The reason is shown to the requester.` }),
      el("input", { class: "input", id: "reject-note", placeholder: "Reason for the decision" })),
    actions: [
      { label: "Cancel" },
      {
        label: "Reject request", kind: "danger", onClick: () => {
          const next = decide(request, "rejected", { by: "p5", at: Date.now(), note: $("#reject-note")?.value ?? "" });
          data.requests = data.requests.map((r) => (r.id === request.id ? next : r));
          persist();
          renderApprovals();
          renderPendingBadge();
          A.toast(`Rejected ${request.id}`, "error");
          return true;
        },
      },
    ],
  });
}

/* --------------------------------------------------------------- calendar */

function monthDays(monthStart) {
  const year = new Date(monthStart).getUTCFullYear();
  const month = new Date(monthStart).getUTCMonth();
  const startWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0 = Sunday
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(Date.UTC(year, month, d));
  return cells;
}

function renderCalendar() {
  const monthStart = state.calMonth;
  $("#cal-label").textContent = new Date(monthStart).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  $("#calendar-head").replaceChildren(...["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => el("span", { text: d })));
  const days = monthDays(monthStart);
  const monthEnd = Date.UTC(new Date(monthStart).getUTCFullYear(), new Date(monthStart).getUTCMonth() + 1, 0);
  const out = whoIsOut(data.requests, data.people, { from: monthStart, to: monthEnd });
  const holidayNames = new Map(HOLIDAYS.map((h) => [Date.parse(`${h.date}T00:00:00Z`), h.name]));

  $("#calendar-grid").replaceChildren(...days.map((ts) => {
    if (ts === null) return el("div", { class: "cal-day is-blank" });
    const day = out.find((d) => d.date === ts);
    const cls = `cal-day${day.weekend ? " is-off" : ""}${day.holiday ? " is-holiday" : ""}${ts === TODAY ? " is-today" : ""}`;
    return el("div", { class: cls },
      el("div", { class: "cal-num", text: String(new Date(ts).getUTCDate()) }),
      day.holiday ? el("div", { class: "cal-holiday-name", text: holidayNames.get(ts) ?? "Holiday" }) : null,
      ...day.entries.slice(0, 2).map((entry) => el("span", {
        class: `cal-chip ${entry.request.type}`,
        title: `${entry.person.name} · ${entry.type.label}`,
        text: entry.person.name.split(" ")[0],
      })),
      day.entries.length > 2 ? el("span", { class: "cal-more", text: `+${day.entries.length - 2} more` }) : null);
  }));

  $("#calendar-legend").replaceChildren(
    ...["annual", "sick", "casual", "unpaid"].map((id) => el("span", { class: "cal-legend-item" },
      el("i", { style: `background:${id === "annual" ? "var(--gold)" : id === "sick" ? "var(--blue)" : id === "casual" ? "var(--green)" : "var(--red)"}` }),
      el("span", { text: leaveType(id)?.label }))),
    el("span", { class: "cal-legend-item" }, el("i", { style: "background:transparent;border:1px solid var(--gold-line)" }), el("span", { text: "Holiday" })),
    el("span", { class: "cal-legend-item" }, el("i", { style: "background:transparent;border:1px dashed var(--line-strong)" }), el("span", { text: "Saturday" })),
  );

  const next = availability(data.requests, data.people, { from: TODAY, to: TODAY + 13 * DAY }).filter((d) => !d.weekend && !d.holiday);
  $("#availability-strip").replaceChildren(...[
    ...next.map((day) => el("div", { class: "availability-row" },
      el("span", { class: "date", text: `${weekdayLabel(day.date)} ${new Date(day.date).getUTCDate()}` }),
      progressBar(day.rate, day.rate > 0.2 ? "" : "green"),
      el("span", { class: "mono small muted", style: "width:44px;text-align:right", text: `${day.out}/${day.headcount}` }))),
    next.length === 0 ? el("p", { class: "small muted", text: "No working days in this range." }) : null,
  ].filter(Boolean));
}

/* ----------------------------------------------------------------- routing */

const VIEWS = ["team", "onboarding", "leave", "approvals", "calendar"];

function route() {
  const requested = (location.hash || "#team").slice(1).split("/")[0];
  state.view = VIEWS.includes(requested) ? requested : "team";
  $$("[data-view-panel]").forEach((panel) => { panel.hidden = panel.dataset.viewPanel !== state.view; });
  $$("[data-view]").forEach((a) => a.classList.toggle("active", a.dataset.view === state.view));
  if (state.view === "team") renderTeam();
  else if (state.view === "onboarding") renderOnboarding();
  else if (state.view === "leave") renderLeave();
  else if (state.view === "approvals") renderApprovals();
  else if (state.view === "calendar") renderCalendar();
  window.scrollTo({ top: 0 });
}

/* -------------------------------------------------------------------- wire */

function wire() {
  $("#today").textContent = new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  renderPendingBadge();

  $("#dept-filter").replaceChildren(
    el("option", { value: "all", text: "All departments" }),
    ...DEPARTMENTS.map((d) => el("option", { value: d.id, text: d.label })));
  $("#dept-filter").addEventListener("change", (e) => { state.dept = e.target.value; renderTeam(); });

  $("#team-goto-leave").addEventListener("click", () => { location.hash = "#leave"; });

  // Default leave form: the next Monday, three days long.
  let nextMonday = TODAY + DAY;
  for (let i = 0; i < 8; i++) {
    const candidate = TODAY + i * DAY;
    if (candidate > TODAY && new Date(candidate).getUTCDay() === 1) { nextMonday = candidate; break; }
  }
  state.from = nextMonday;
  state.to = nextMonday + 2 * DAY;

  $("#leave-person").addEventListener("change", (e) => { state.leavePerson = e.target.value; renderLeave(); });
  $("#leave-type").addEventListener("change", (e) => { state.leaveType = e.target.value; renderLeave(); });
  $("#leave-from").addEventListener("change", (e) => {
    state.from = Date.parse(`${e.target.value}T00:00:00Z`);
    if (state.to < state.from) state.to = state.from;
    renderLeave();
  });
  $("#leave-to").addEventListener("change", (e) => { state.to = Date.parse(`${e.target.value}T00:00:00Z`); renderLeave(); });
  $("#leave-submit").addEventListener("click", submitLeave);

  $("#cal-prev").addEventListener("click", () => {
    state.calMonth = Date.UTC(new Date(state.calMonth).getUTCFullYear(), new Date(state.calMonth).getUTCMonth() - 1, 1);
    renderCalendar();
  });
  $("#cal-next").addEventListener("click", () => {
    state.calMonth = Date.UTC(new Date(state.calMonth).getUTCFullYear(), new Date(state.calMonth).getUTCMonth() + 1, 1);
    renderCalendar();
  });

  $("#reset-data").addEventListener("click", () => {
    A.store.remove(STORE_KEY);
    data = freshData();
    renderPendingBadge();
    route();
    A.toast("Demo data regenerated from the seed", "success");
  });

  window.addEventListener("hashchange", route);
}

wire();
route();
