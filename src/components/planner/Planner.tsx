"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type SubmitEvent } from "react";
import { activeTasksAction, createTaskAction, deleteTaskAction, restoreTaskAction, updateTaskAction } from "@/app/actions/tasks";
import { addDays, dueLabel, parseISODate, toISODate, todayISO } from "@/lib/dates";
import { AREAS, AREA_LABEL, PRIORITY_RANK, QUADRANTS, isClosed, type Area, type Quadrant, type Tag, type TagColor, type Task, type TaskPatch } from "@/lib/model";
import { PREFS_COOKIE, type Prefs, type SortKey } from "@/lib/prefs";
import { BoardIcon, InboxIcon, ListIcon, MatrixIcon, PlusIcon, SearchIcon, TargetIcon } from "../icons";
import { Toast, type ToastState } from "../Toast";
import { Button, Segmented, Toggle, cx, inputClass } from "../ui";
import { TaskDrawer } from "./TaskDrawer";
import { BoardView, ListView, MatrixView, type ViewProps } from "./views";

type QuadFilter = "all" | "inbox" | 1 | 2 | 3 | 4;

const subscribeClock = (cb: () => void) => {
  const t = setInterval(cb, 60_000);
  window.addEventListener("focus", cb);
  return () => {
    clearInterval(t);
    window.removeEventListener("focus", cb);
  };
};

const localDay = (iso: string) => toISODate(new Date(iso));

function merge(list: Task[], incoming: Task[]) {
  const byId = new Map(incoming.map((t) => [t.id, t]));
  const kept = list.map((t) => byId.get(t.id) ?? t);
  return [...kept, ...incoming.filter((t) => !list.some((x) => x.id === t.id))];
}

function optimistic(t: Task, p: TaskPatch): Task {
  const now = new Date().toISOString();
  const status = p.status ?? t.status;
  return {
    ...t,
    ...p,
    startedAt: status === "doing" ? (t.startedAt ?? now) : t.startedAt,
    completedAt: status === t.status ? t.completedAt : isClosed(status) ? now : null,
  };
}

const dueKey = (t: Task) => t.dueDate ?? "9999-12-31";
const COMPARE: Record<SortKey, (a: Task, b: Task) => number> = {
  priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || dueKey(a).localeCompare(dueKey(b)),
  due: (a, b) => dueKey(a).localeCompare(dueKey(b)) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  tag: (a, b) => (a.tags[0] ?? "~").localeCompare(b.tags[0] ?? "~"),
  title: (a, b) => a.title.localeCompare(b.title),
};

export function Planner({
  initialTasks,
  initialTags,
  initialPrefs,
  serverToday,
}: {
  initialTasks: Task[];
  initialTags: Tag[];
  initialPrefs: Prefs;
  serverToday: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [tags, setTags] = useState(initialTags);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [tag, setTag] = useState<string | null>(null);
  const [quad, setQuad] = useState<QuadFilter>("all");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [addQuad, setAddQuad] = useState<Quadrant>(null);
  const [addArea, setAddArea] = useState<Area>("work");
  const [openId, setOpenId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const today = useSyncExternalStore(subscribeClock, todayISO, () => serverToday);

  const update = useCallback((p: Partial<Prefs>) => setPrefs((old) => ({ ...old, ...p })), []);
  useEffect(() => {
    document.cookie = `${PREFS_COOKIE}=${encodeURIComponent(JSON.stringify(prefs))}; path=/; max-age=31536000; samesite=lax`;
  }, [prefs]);

  const notify = useCallback((text: string, opts: Omit<ToastState, "id" | "text"> = {}) => setToast({ id: Date.now(), text, ...opts }), []);
  const clearToast = useCallback(() => setToast(null), []);

  // Pick up changes made by an agent or on another device.
  const refresh = useCallback(async () => {
    const r = await activeTasksAction();
    if (!r.ok) return;
    setTasks(r.data.tasks);
    setTags(r.data.tags);
  }, []);
  useEffect(() => {
    const onWake = () => document.visibilityState === "visible" && refresh();
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    const t = setInterval(onWake, 60_000);
    return () => {
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
      clearInterval(t);
    };
  }, [refresh]);

  // Keyboard: / search, n new task, 1 2 3 switch view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest("input, textarea, select, dialog, [contenteditable]")) return;
      const view = ({ "1": "matrix", "2": "list", "3": "board" } as const)[e.key as "1" | "2" | "3"];
      if (view) update({ view });
      else if (e.key === "/") searchRef.current?.focus();
      else if (e.key === "n") addRef.current?.focus();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [update]);

  const patch = useCallback(
    async (id: number, p: TaskPatch) => {
      setTasks((ts) => ts.map((t) => (t.id === id ? optimistic(t, p) : t)));
      const r = await updateTaskAction(id, p);
      if (!r.ok) {
        notify(r.error, { tone: "error" });
        refresh();
        return;
      }
      setTasks((ts) => merge(ts, r.data.next ? [r.data.task, r.data.next] : [r.data.task]));
      setTags(r.data.tags);
      if (r.data.next) notify(`Repeats ${r.data.next.repeat}. Next one is due ${dueLabel(r.data.next.dueDate, todayISO()).label}.`);
    },
    [notify, refresh],
  );

  const toggle = useCallback((t: Task) => patch(t.id, { status: t.status === "done" ? "todo" : "done" }), [patch]);

  const remove = async (id: number) => {
    setOpenId(null);
    setTasks((ts) => ts.filter((t) => t.id !== id));
    const r = await deleteTaskAction(id);
    if (!r.ok) {
      notify(r.error, { tone: "error" });
      refresh();
      return;
    }
    notify("Moved to trash.", {
      action: {
        label: "Undo",
        run: async () => {
          const back = await restoreTaskAction(id);
          if (back.ok) setTasks((ts) => merge(ts, [back.data]));
        },
      },
    });
  };

  const add = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    const r = await createTaskAction({
      title,
      quadrant: addQuad,
      area: prefs.area === "all" ? addArea : prefs.area,
      tags: tag ? [tag] : [],
    });
    if (!r.ok) {
      notify(r.error, { tone: "error" });
      setDraft(title);
      return;
    }
    setTasks((ts) => merge(ts, [r.data.task]));
    setTags(r.data.tags);
  };

  // ---- derived data ----
  const d = useMemo(() => {
    const doneToday = (t: Task) => t.status === "done" && !!t.completedAt && localDay(t.completedAt) === today;
    const weekAgo = addDays(today, -6);
    const recentlyDone = (t: Task) => t.status === "done" && !!t.completedAt && localDay(t.completedAt) >= weekAgo;
    const live = (t: Task) => t.status === "todo" || t.status === "doing";
    const showDone = prefs.view === "board" ? recentlyDone : doneToday;

    const todays = tasks.filter((t) => live(t) || doneToday(t));
    const shown = tasks.filter((t) => live(t) || showDone(t));
    const areaCount = { all: shown.length, work: 0, personal: 0 };
    for (const t of shown) areaCount[t.area]++;

    const inArea = (t: Task) => prefs.area === "all" || t.area === prefs.area;
    const scope = shown.filter(inArea);
    const tagCount = new Map<string, number>();
    for (const t of scope) for (const n of t.tags) tagCount.set(n.toLowerCase(), (tagCount.get(n.toLowerCase()) ?? 0) + 1);
    const quadCount = new Map<QuadFilter, number>([["all", scope.length]]);
    for (const t of scope) quadCount.set(t.quadrant ?? "inbox", (quadCount.get(t.quadrant ?? "inbox") ?? 0) + 1);

    const needle = q.trim().toLowerCase();
    const quadF = prefs.view === "matrix" ? "all" : quad;
    const visible = scope.filter(
      (t) =>
        (!tag || t.tags.some((n) => n.toLowerCase() === tag.toLowerCase())) &&
        (quadF === "all" || (quadF === "inbox" ? t.quadrant === null : t.quadrant === quadF)) &&
        (!prefs.hideDone || t.status !== "done") &&
        (!needle || `${t.title}\n${t.notes}\n${t.tags.join(" ")}`.toLowerCase().includes(needle)),
    );
    const cmp = COMPARE[prefs.sort];
    // Done tasks sink to the bottom of each group, the way a paper list fills up.
    visible.sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || prefs.dir * cmp(a, b) || a.id - b.id);

    const areaToday = todays.filter(inArea);
    const open = areaToday.filter(live).sort((a, b) => COMPARE.priority(a, b));
    return {
      visible,
      areaCount,
      tagCount,
      quadCount,
      done: areaToday.filter(doneToday).length,
      total: areaToday.length,
      overdue: open.filter((t) => t.dueDate && t.dueDate < today).length,
      nextUp: open.find((t) => t.quadrant === 1) ?? null,
      nextQ2: open.find((t) => t.quadrant === 2) ?? null,
      inbox: open.filter((t) => t.quadrant === null).length,
    };
  }, [tasks, prefs, tag, quad, q, today]);

  const tagColor = useMemo(() => {
    const m = new Map(tags.map((t) => [t.name.toLowerCase(), t.color]));
    return (name: string): TagColor | undefined => m.get(name.toLowerCase());
  }, [tags]);

  const viewProps: ViewProps = { tasks: d.visible, today, tagColor, onToggle: toggle, onOpen: setOpenId, onPatch: patch };
  const openTask = openId === null ? null : tasks.find((t) => t.id === openId) ?? null;
  const pct = d.total ? Math.round((100 * d.done) / d.total) : 0;

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 pb-20 pt-8 sm:px-6 lg:px-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[44px]">My tasks</h1>
          <p className="mt-2 text-[17px] text-muted">Organise your priorities. Focus on what matters.</p>
        </div>
        <div className="flex items-center gap-3.5">
          <div className="text-right">
            <div className="text-sm font-semibold">
              {d.done} of {d.total} done today
            </div>
            <div className="mt-1.5 h-1.5 w-40 rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Done today">
              <div className="h-1.5 rounded-full bg-ok transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <span className="rounded-full bg-ok-soft px-4 py-2 text-[15px] font-semibold text-ok-ink">
            {parseISODate(today).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          </span>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[20px] bg-info-soft px-5 py-4">
        <TargetIcon size={20} className="shrink-0 text-info-ink" />
        <div className="min-w-0 flex-[1_1_260px]">
          <div className="text-[15px] font-semibold">
            {d.nextUp ? (
              <>
                Next up:{" "}
                <button type="button" className="underline decoration-info-ink/40 underline-offset-4 hover:decoration-info-ink" onClick={() => setOpenId(d.nextUp!.id)}>
                  {d.nextUp.title}
                </button>
              </>
            ) : d.nextQ2 ? (
              <>Q1 is clear. Invest time in “{d.nextQ2.title}”.</>
            ) : (
              <>Nothing urgent. Plan something worth doing.</>
            )}
          </div>
          <div className="mt-0.5 text-sm text-muted">Prioritise Q1, invest most of your time in Q2, delegate Q3 and minimise Q4.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {d.overdue > 0 && <span className="rounded-full bg-hot-soft px-3 py-1 text-[13px] font-semibold text-hot-ink">{d.overdue} overdue</span>}
          {d.inbox > 0 && <span className="rounded-full bg-info-chip px-3 py-1 text-[13px] font-semibold text-info-ink">{d.inbox} in Inbox</span>}
        </div>
      </div>

      <section aria-label="Filters" className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Area"
            value={prefs.area}
            onChange={(area) => update({ area })}
            options={(
              [
                ["all", "All"],
                ["work", "Work"],
                ["personal", "Personal"],
              ] as const
            ).map(([value, label]) => ({
              value,
              label: (
                <>
                  {label} <span className="text-[12.5px] text-muted">{d.areaCount[value]}</span>
                </>
              ),
            }))}
          />
          <div className="flex flex-[1_1_420px] flex-wrap items-center justify-end gap-3">
            <label className="flex h-11 min-w-0 flex-[1_1_220px] items-center gap-2 rounded-xl border border-line-strong bg-card px-3.5 focus-within:border-ink sm:max-w-80">
              <SearchIcon size={16} className="shrink-0 text-muted" />
              <input
                ref={searchRef}
                aria-label="Search tasks"
                placeholder="Search tasks"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && (setQ(""), e.currentTarget.blur())}
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
              />
              <kbd className="hidden rounded-md border border-line-strong px-1.5 text-xs text-faint sm:block">/</kbd>
            </label>
            <Segmented
              label="View"
              value={prefs.view}
              onChange={(view) => update({ view })}
              options={[
                { value: "matrix", label: <><MatrixIcon size={16} /><span className="hidden sm:inline">Matrix</span></>, title: "Matrix (1)" },
                { value: "list", label: <><ListIcon size={16} /><span className="hidden sm:inline">List</span></>, title: "Focus list (2)" },
                { value: "board", label: <><BoardIcon size={16} /><span className="hidden sm:inline">Board</span></>, title: "Status board (3)" },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[13px] font-semibold text-muted">Tags</span>
          <button
            type="button"
            aria-pressed={tag === null}
            onClick={() => setTag(null)}
            className={cx("h-9 rounded-full border-2 bg-surface-2 px-3.5 text-sm font-semibold", tag === null ? "border-fg" : "border-transparent")}
          >
            All tags <span className="opacity-75">{d.quadCount.get("all") ?? 0}</span>
          </button>
          {tags.map((t) => {
            const n = d.tagCount.get(t.name.toLowerCase()) ?? 0;
            const on = tag?.toLowerCase() === t.name.toLowerCase();
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => setTag(on ? null : t.name)}
                className={cx("tag h-9 rounded-full border-2 px-3.5 text-sm font-semibold", `tag-${t.color}`, on ? "border-current" : "border-transparent", !n && !on && "opacity-50")}
              >
                {t.name} <span className="opacity-75">{n}</span>
              </button>
            );
          })}
        </div>

        {prefs.view !== "matrix" && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[13px] font-semibold text-muted">Quadrant</span>
            {(["all", "inbox", 1, 2, 3, 4] as QuadFilter[]).map((v) => {
              const meta = typeof v === "number" ? QUADRANTS[v - 1] : null;
              return (
                <Toggle
                  key={v}
                  on={quad === v}
                  className="h-9 rounded-full"
                  onClick={() => {
                    setQuad(v);
                    if (v !== "all") setAddQuad(v === "inbox" ? null : v);
                  }}
                >
                  {meta ? `${meta.name} ${meta.title}` : v === "inbox" ? "Inbox" : "All"}
                  <span className="text-[12.5px] opacity-70">{d.quadCount.get(v) ?? 0}</span>
                </Toggle>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[13px] font-semibold text-muted">Sort by</span>
          {(
            [
              ["priority", "Priority"],
              ["due", "Due date"],
              ["tag", "Tag A–Z"],
            ] as const
          ).map(([k, label]) => (
            <Toggle key={k} on={prefs.sort === k} onClick={() => update({ sort: k, dir: 1 })}>
              {label}
            </Toggle>
          ))}
          <span className="mx-1 hidden h-6 w-px bg-line-strong sm:block" />
          <Toggle on={prefs.hideDone} onClick={() => update({ hideDone: !prefs.hideDone })}>
            Hide completed
          </Toggle>
          {prefs.view === "list" && (
            <Toggle on={prefs.group} onClick={() => update({ group: !prefs.group })}>
              Group by quadrant
            </Toggle>
          )}
        </div>

        <form onSubmit={add} className="flex flex-wrap items-center gap-2.5 border-t border-line-strong/70 pt-3.5">
          <input
            ref={addRef}
            aria-label="New task"
            placeholder="Add a task…"
            maxLength={300}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={cx(inputClass, "flex-[1_1_260px]")}
          />
          {/* Under a Work or Personal tab the tab decides, so the picker only shows under All. */}
          {prefs.area === "all" && (
            <Segmented
              label="Area for the new task"
              size="sm"
              value={addArea}
              onChange={setAddArea}
              options={AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] }))}
            />
          )}
          <div role="group" aria-label="Quadrant for the new task" className="flex gap-1.5">
            {([null, 1, 2, 3, 4] as Quadrant[]).map((v) => (
              <Toggle
                key={String(v)}
                on={addQuad === v}
                onClick={() => setAddQuad(v)}
                title={v ? `${QUADRANTS[v - 1].title}: ${QUADRANTS[v - 1].sub}` : "Inbox: classify later"}
                aria-label={v ? QUADRANTS[v - 1].title : "Inbox"}
                className="h-11 px-3"
              >
                {v ? `Q${v}` : <InboxIcon size={17} />}
              </Toggle>
            ))}
          </div>
          <Button type="submit" variant="primary">
            <PlusIcon size={17} />
            Add task
          </Button>
        </form>
      </section>

      {d.visible.length === 0 && (q.trim() || tag || (quad !== "all" && prefs.view !== "matrix")) && (
        <p role="status" className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-[15px] text-muted">
          {q.trim() ? `No tasks match “${q.trim()}”.` : "No tasks match these filters."}
          <Button
            onClick={() => {
              setQ("");
              setTag(null);
              setQuad("all");
            }}
          >
            Clear filters
          </Button>
        </p>
      )}

      {prefs.view === "matrix" && <MatrixView {...viewProps} />}
      {prefs.view === "list" && (
        <ListView
          {...viewProps}
          group={prefs.group}
          sort={prefs.sort}
          dir={prefs.dir}
          onSort={(k) => update(prefs.sort === k ? { dir: prefs.dir === 1 ? -1 : 1 } : { sort: k, dir: 1 })}
        />
      )}
      {prefs.view === "board" && <BoardView {...viewProps} />}

      <p className="text-center text-[13px] text-faint">
        Shortcuts: <kbd>n</kbd> new task · <kbd>/</kbd> search · <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> switch view
      </p>

      {openTask && (
        <TaskDrawer key={openTask.id} task={openTask} tags={tags} today={today} onClose={() => setOpenId(null)} onPatch={patch} onDelete={remove} />
      )}
      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}
