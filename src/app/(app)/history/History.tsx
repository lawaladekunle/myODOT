"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { updateTaskAction } from "@/app/actions/tasks";
import { CheckIcon, CloseIcon, SearchIcon } from "@/components/icons";
import { Toast, type ToastState } from "@/components/Toast";
import { AgentBadge, Button, QuadChip, Segmented, TagChip, cx } from "@/components/ui";
import { toISODate } from "@/lib/dates";
import { QUADRANTS, quadrantKey, type Area, type Tag, type Task } from "@/lib/model";

const levelClass = [
  "bg-surface-2",
  "bg-[color-mix(in_srgb,var(--ok)_30%,var(--surface-2))]",
  "bg-[color-mix(in_srgb,var(--ok)_55%,var(--surface-2))]",
  "bg-[color-mix(in_srgb,var(--ok)_80%,var(--surface-2))]",
  "bg-ok",
];
const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4);
const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", opts);

export function History({ year, years, initialTasks, tags }: { year: number; years: number[]; initialTasks: Task[]; tags: Tag[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "done" | "dropped">("all");
  const [area, setArea] = useState<"all" | Area>("all");
  const [tag, setTag] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const tagColor = useMemo(() => new Map(tags.map((t) => [t.name.toLowerCase(), t.color])), [tags]);

  const d = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const items = tasks
      .map((t) => ({ t, day: toISODate(new Date(t.completedAt!)) }))
      .filter(
        ({ t, day }) =>
          day.startsWith(`${year}-`) &&
          (status === "all" || t.status === status) &&
          (area === "all" || t.area === area) &&
          (!tag || t.tags.some((n) => n.toLowerCase() === tag.toLowerCase())) &&
          (!needle || `${t.title}\n${t.notes}`.toLowerCase().includes(needle)),
      );

    const perDay = new Map<string, number>();
    for (const { t, day } of items) if (t.status === "done") perDay.set(day, (perDay.get(day) ?? 0) + 1);

    let streak = 0;
    let best = 0;
    let busiest: [string, number] | null = null;
    for (let i = 0, x = new Date(year, 0, 1); x.getFullYear() === year; x = new Date(year, 0, 1 + ++i)) {
      const n = perDay.get(toISODate(x)) ?? 0;
      streak = n ? streak + 1 : 0;
      best = Math.max(best, streak);
      if (n && (!busiest || n > busiest[1])) busiest = [toISODate(x), n];
    }

    const byQuad = new Map<string, number>();
    const byTag = new Map<string, number>();
    for (const { t } of items) {
      if (t.status !== "done") continue;
      byQuad.set(quadrantKey(t.quadrant), (byQuad.get(quadrantKey(t.quadrant)) ?? 0) + 1);
      for (const n of t.tags) byTag.set(n, (byTag.get(n) ?? 0) + 1);
    }

    const months = new Map<string, Map<string, Task[]>>();
    for (const { t, day: dd } of items) {
      if (day && dd !== day) continue;
      const m = dd.slice(0, 7);
      if (!months.has(m)) months.set(m, new Map());
      const days = months.get(m)!;
      days.set(dd, [...(days.get(dd) ?? []), t]);
    }

    return {
      perDay,
      done: items.filter((x) => x.t.status === "done").length,
      dropped: items.filter((x) => x.t.status === "dropped").length,
      activeDays: perDay.size,
      best,
      busiest,
      byQuad,
      topTags: [...byTag.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      months: [...months.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([m, days]) => ({
        m,
        count: [...days.values()].reduce((s, l) => s + l.length, 0),
        days: [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])),
      })),
    };
  }, [tasks, q, status, area, tag, day, year]);

  const reopen = async (t: Task) => {
    const r = await updateTaskAction(t.id, { status: "todo" });
    if (!r.ok) return setToast({ id: Date.now(), text: r.error, tone: "error" });
    setTasks((ts) => ts.filter((x) => x.id !== t.id));
    setToast({ id: Date.now(), text: `“${t.title}” is back on your planner.` });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 pb-20 pt-8 sm:px-6 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[44px]">History</h1>
          <p className="mt-2 text-[17px] text-muted">Everything you finished, year by year.</p>
        </div>
        <nav aria-label="Year" className="flex flex-wrap gap-1.5">
          {years.map((y) => (
            <Link
              key={y}
              href={`/history?year=${y}`}
              aria-current={y === year ? "page" : undefined}
              className={cx(
                "flex h-10 items-center rounded-xl border px-4 text-sm font-semibold",
                y === year ? "border-ink bg-ink text-ink-fg" : "border-line-strong bg-card hover:bg-surface-2",
              )}
            >
              {y}
            </Link>
          ))}
        </nav>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Completed" value={d.done} />
        <Stat label="Active days" value={d.activeDays} />
        <Stat label="Longest streak" value={d.best} unit={d.best === 1 ? "day" : "days"} />
        <Stat
          label="Busiest day"
          value={d.busiest ? d.busiest[1] : 0}
          unit={d.busiest ? `on ${fmtDay(d.busiest[0], { day: "numeric", month: "short" })}` : undefined}
        />
      </div>

      <section className="rounded-[20px] border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{d.done} {d.done === 1 ? "task" : "tasks"} completed in {year}</h2>
          {day && (
            <Button size="sm" variant="ghost" onClick={() => setDay(null)}>
              <CloseIcon size={14} />
              {fmtDay(day, { weekday: "short", day: "numeric", month: "short" })}
            </Button>
          )}
        </div>
        <Heatmap year={year} perDay={d.perDay} selected={day} onSelect={(x) => setDay(x === day ? null : x)} />
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <QuadrantBar byQuad={d.byQuad} total={d.done} />
          <div>
            <h3 className="text-[13px] font-semibold text-muted">Top tags</h3>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {d.topTags.length === 0 && <span className="text-sm text-faint">No tags yet.</span>}
              {d.topTags.map(([n, c]) => (
                <button key={n} type="button" onClick={() => setTag(tag === n ? null : n)} aria-pressed={tag === n}>
                  <TagChip name={`${n} · ${c}`} color={tagColor.get(n.toLowerCase())} className={tag === n ? "ring-2 ring-current" : undefined} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-11 min-w-0 flex-[1_1_240px] items-center gap-2 rounded-xl border border-line-strong bg-card px-3.5 focus-within:border-ink sm:max-w-80">
          <SearchIcon size={16} className="shrink-0 text-muted" />
          <input aria-label="Search history" placeholder="Search history" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" />
        </label>
        <Segmented
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All" },
            { value: "done", label: `Done ${d.done}` },
            { value: "dropped", label: `Dropped ${d.dropped}` },
          ]}
        />
        <Segmented
          label="Area"
          value={area}
          onChange={setArea}
          options={[
            { value: "all", label: "Everything" },
            { value: "work", label: "Work" },
            { value: "personal", label: "Personal" },
          ]}
        />
        {tag && (
          <Button size="sm" variant="ghost" onClick={() => setTag(null)}>
            <CloseIcon size={14} />
            {tag}
          </Button>
        )}
      </div>

      {d.months.length === 0 && (
        <p className="rounded-[20px] border border-dashed border-line-strong px-6 py-12 text-center text-[15px] text-muted">
          Nothing here for {year} yet. Tasks you complete show up here.
        </p>
      )}

      {d.months.map(({ m, count, days }) => (
        <section key={m} className="overflow-hidden rounded-[20px] border border-line">
          <h2 className="flex items-baseline justify-between bg-surface px-5 py-3">
            <span className="text-lg font-bold">{new Date(`${m}-01T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
            <span className="text-[13px] font-semibold text-muted">{count} {count === 1 ? "task" : "tasks"}</span>
          </h2>
          {days.map(([dd, list]) => (
            <div key={dd} className="grid gap-x-4 border-t border-line px-5 py-3 sm:grid-cols-[110px_minmax(0,1fr)]">
              <div className="pt-2 text-sm font-semibold text-muted">{fmtDay(dd, { weekday: "short", day: "numeric", month: "short" })}</div>
              <ul>
                {list.map((t) => (
                  <li key={t.id} className="group flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
                    <span
                      title={t.status === "done" ? "Done" : "Dropped"}
                      className={cx("flex size-6 shrink-0 items-center justify-center rounded-full", t.status === "done" ? "bg-ok text-white" : "bg-surface-2 text-faint")}
                    >
                      {t.status === "done" ? <CheckIcon size={13} className="stroke-[3.2]" /> : <CloseIcon size={12} className="stroke-[3]" />}
                    </span>
                    <span className={cx("min-w-0 flex-[1_1_200px] font-semibold", t.status === "dropped" && "text-muted line-through")}>{t.title}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <QuadChip q={t.quadrant} />
                      {t.tags.map((n) => (
                        <TagChip key={n} name={n} color={tagColor.get(n.toLowerCase())} />
                      ))}
                      <AgentBadge task={t} />
                      <span className="text-[12.5px] tabular-nums text-faint">
                        {new Date(t.completedAt!).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </span>
                    <Button size="sm" variant="ghost" className="ml-auto sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100" onClick={() => reopen(t)}>
                      Reopen
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}

      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div className="rounded-[20px] border border-line bg-card p-4">
      <div className="text-[13px] font-semibold text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums tracking-[-0.02em]">{value}</span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
    </div>
  );
}

const CELL = 16; // 13px square + 3px gap

function Heatmap({ year, perDay, selected, onSelect }: { year: number; perDay: Map<string, number>; selected: string | null; onSelect: (day: string) => void }) {
  const { weeks, months } = useMemo(() => {
    const jan1 = new Date(year, 0, 1);
    const start = new Date(year, 0, 1 - ((jan1.getDay() + 6) % 7)); // Monday on or before 1 Jan
    const weeks: (string | null)[][] = [];
    const months: { label: string; col: number }[] = [];
    for (let w = 0; ; w++) {
      const week: (string | null)[] = [];
      for (let i = 0; i < 7; i++) {
        const x = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i);
        if (x.getFullYear() !== year) week.push(null);
        else {
          week.push(toISODate(x));
          if (x.getDate() === 1) months.push({ label: x.toLocaleDateString("en-GB", { month: "short" }), col: w });
        }
      }
      if (week.every((c) => c === null) && w > 0) break;
      weeks.push(week);
    }
    return { weeks, months };
  }, [year]);

  return (
    <div className="mt-4 overflow-x-auto pb-1">
      <div className="relative ml-8 h-5" style={{ width: weeks.length * CELL }}>
        {months.map((m) => (
          <span key={m.label} className="absolute top-0 text-[11px] text-muted" style={{ left: m.col * CELL }}>
            {m.label}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="grid w-6 grid-rows-7 gap-[3px] text-[10px] leading-[13px] text-muted">
          {["Mon", "", "Wed", "", "Fri", "", ""].map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
        <div className="flex gap-[3px]">
          {weeks.map((week, w) => (
            <div key={w} className="grid grid-rows-7 gap-[3px]">
              {week.map((dd, i) => {
                if (!dd) return <span key={i} className="size-[13px]" />;
                const n = perDay.get(dd) ?? 0;
                return (
                  <button
                    key={dd}
                    type="button"
                    title={`${n} done on ${fmtDay(dd, { weekday: "short", day: "numeric", month: "short" })}`}
                    aria-label={`${n} done on ${dd}`}
                    onClick={() => onSelect(dd)}
                    className={cx("size-[13px] rounded-[3px]", levelClass[level(n)], selected === dd && "ring-2 ring-fg ring-offset-1 ring-offset-surface")}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-muted">
        Less
        {levelClass.map((c) => (
          <span key={c} className={cx("size-[13px] rounded-[3px]", c)} />
        ))}
        More
      </div>
    </div>
  );
}

function QuadrantBar({ byQuad, total }: { byQuad: Map<string, number>; total: number }) {
  const parts = [...QUADRANTS.map((q) => ({ key: `q${q.id}`, label: `${q.name} ${q.title}` })), { key: "inbox", label: "Inbox" }];
  return (
    <div>
      <h3 className="text-[13px] font-semibold text-muted">Where your effort went</h3>
      <div className="mt-2.5 flex h-3 overflow-hidden rounded-full bg-surface-2">
        {total > 0 &&
          parts.map((p) => (
            <span key={p.key} className={cx(`q-${p.key}`, "h-full bg-q-ink")} style={{ width: `${(100 * (byQuad.get(p.key) ?? 0)) / total}%` }} />
          ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((p) => (
          <span key={p.key} className={cx(`q-${p.key}`, "inline-flex items-center gap-1.5 text-[13px] text-muted")}>
            <span className="size-2 rounded-full bg-q-ink" />
            {p.label} <span className="font-semibold tabular-nums text-fg">{byQuad.get(p.key) ?? 0}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
