import { useState, type DragEvent } from "react";
import { QUADRANTS, isClosed, quadrantKey, type Quadrant, type Status, type TagColor, type Task, type TaskPatch } from "@/lib/model";
import type { SortKey } from "@/lib/prefs";
import {
  AgentBadge,
  Button,
  CheckCircle,
  DoingBadge,
  DueChip,
  Empty,
  PriorityLabel,
  QuadChip,
  QuadIcon,
  RepeatChip,
  TagChip,
  cx,
} from "../ui";

export type ViewProps = {
  tasks: Task[];
  today: string;
  tagColor: (name: string) => TagColor | undefined;
  onToggle: (t: Task) => void;
  onOpen: (id: number) => void;
  onPatch: (id: number, patch: TaskPatch) => void;
};

// ---- drag and drop (desktop). Phones use the buttons and the edit drawer. ----

const DND = "application/x-odot-task";

const draggable = (id: number) => ({
  draggable: true,
  onDragStart: (e: DragEvent) => {
    e.dataTransfer.setData(DND, String(id));
    e.dataTransfer.effectAllowed = "move";
  },
});

function useDrop(onDrop: (id: number) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e: DragEvent) => {
        if (!e.dataTransfer.types.includes(DND)) return;
        e.preventDefault();
        setOver(true);
      },
      onDragLeave: (e: DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      },
      onDrop: (e: DragEvent) => {
        setOver(false);
        const id = Number(e.dataTransfer.getData(DND));
        if (!id) return;
        e.preventDefault();
        onDrop(id);
      },
    },
  };
}

// ---- shared bits ----

function TitleButton({ t, onOpen, className }: { t: Task; onOpen: (id: number) => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(t.id)}
      className={cx(
        "min-w-0 text-left font-semibold decoration-faint underline-offset-4 hover:underline",
        t.status === "done" ? "text-muted line-through" : "text-fg",
        className,
      )}
    >
      {t.title}
    </button>
  );
}

function Meta({ t, today, tagColor, onQuadrant }: { t: Task; today: string; tagColor: ViewProps["tagColor"]; onQuadrant?: boolean }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <DoingBadge task={t} />
      {t.tags.map((n) => (
        <TagChip key={n} name={n} color={tagColor(n)} />
      ))}
      <DueChip task={t} today={today} onQuadrant={onQuadrant} />
      <RepeatChip task={t} onQuadrant={onQuadrant} />
      <PriorityLabel p={t.priority} />
      <AgentBadge task={t} />
    </div>
  );
}

const openCount = (ts: Task[]) => ts.filter((t) => !isClosed(t.status)).length;

// ---- A · Matrix ----

export function MatrixView(p: ViewProps) {
  const inbox = p.tasks.filter((t) => t.quadrant === null);
  return (
    <div className="flex flex-col gap-5">
      {inbox.length > 0 && <InboxPanel {...p} tasks={inbox} />}
      <div className="grid gap-5 lg:grid-cols-2">
        {QUADRANTS.map((q) => (
          <QuadrantCard key={q.id} q={q} {...p} tasks={p.tasks.filter((t) => t.quadrant === q.id)} />
        ))}
      </div>
    </div>
  );
}

function QuadrantCard({ q, ...p }: ViewProps & { q: (typeof QUADRANTS)[number] }) {
  const drop = useDrop((id) => p.onPatch(id, { quadrant: q.id }));
  return (
    <section
      aria-label={`${q.name} ${q.title}`}
      {...drop.props}
      className={cx(`q-q${q.id}`, "min-w-0 rounded-3xl bg-q px-5 pb-3.5 pt-5 transition-shadow sm:px-6", drop.over && "ring-2 ring-q-ink/60")}
    >
      <div className="flex items-center gap-2.5">
        <QuadIcon q={q.id} size={22} />
        <span className="text-xl font-bold">{q.name}</span>
        <span className="ml-auto text-[13px] font-semibold text-muted">{openCount(p.tasks)} open</span>
      </div>
      <div className="mt-3 text-lg font-semibold">{q.title}</div>
      <div className="mt-0.5 text-[15px] text-muted">{q.sub}</div>
      <div className="mb-1 mt-4 h-px bg-fg/10" />
      {p.tasks.length === 0 ? (
        <Empty>{drop.over ? "Drop to move here." : "Nothing here for this view."}</Empty>
      ) : (
        p.tasks.map((t) => (
          <div key={t.id} {...draggable(t.id)} className="flex items-start gap-1.5 py-1.5">
            <CheckCircle done={t.status === "done"} title={t.title} onClick={() => p.onToggle(t)} />
            <div className="min-w-0 flex-1">
              <TitleButton t={t} onOpen={p.onOpen} className="text-[17px]" />
              {t.notes && <p className="mt-0.5 line-clamp-2 text-[15px] text-muted">{t.notes}</p>}
              <Meta t={t} today={p.today} tagColor={p.tagColor} onQuadrant />
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function InboxPanel(p: ViewProps) {
  const drop = useDrop((id) => p.onPatch(id, { quadrant: null }));
  return (
    <section aria-label="Inbox" {...drop.props} className={cx("q-inbox rounded-3xl bg-q px-5 pb-3 pt-5 sm:px-6", drop.over && "ring-2 ring-q-ink/60")}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <QuadIcon q={null} size={22} />
        <span className="text-xl font-bold">Inbox</span>
        <span className="text-[15px] text-muted">Not classified yet. Pick a quadrant or drag the task into one.</span>
        <span className="ml-auto text-[13px] font-semibold text-muted">{p.tasks.length} to sort</span>
      </div>
      <div className="mt-3 divide-y divide-fg/10">
        {p.tasks.map((t) => (
          <div key={t.id} {...draggable(t.id)} className="flex flex-wrap items-start gap-x-1.5 gap-y-2 py-2.5">
            <CheckCircle done={t.status === "done"} title={t.title} onClick={() => p.onToggle(t)} />
            <div className="min-w-0 flex-[1_1_240px]">
              <TitleButton t={t} onOpen={p.onOpen} className="text-[17px]" />
              {t.notes && <p className="mt-0.5 line-clamp-1 text-[15px] text-muted">{t.notes}</p>}
              <Meta t={t} today={p.today} tagColor={p.tagColor} onQuadrant />
            </div>
            <div role="group" aria-label={`Classify ${t.title}`} className="flex gap-1.5 pl-9 sm:pl-0">
              {QUADRANTS.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  title={`${q.title}: ${q.sub}`}
                  onClick={() => p.onPatch(t.id, { quadrant: q.id })}
                  className={cx(`q-q${q.id}`, "h-9 rounded-lg bg-q-chip px-3 text-[13px] font-bold text-fg transition-transform hover:-translate-y-px")}
                >
                  {q.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- B · Focus list ----

const LIST_COLS = "md:grid-cols-[44px_minmax(0,1fr)_200px_130px_100px]";
const HEADS: [SortKey, string][] = [
  ["title", "Task"],
  ["tag", "Tags"],
  ["due", "Due"],
  ["priority", "Priority"],
];

export function ListView(p: ViewProps & { group: boolean; sort: SortKey; dir: 1 | -1; onSort: (k: SortKey) => void }) {
  const groups: { q: Quadrant | "none"; rows: Task[] }[] = p.group
    ? ([null, 1, 2, 3, 4] as Quadrant[]).map((q) => ({ q, rows: p.tasks.filter((t) => t.quadrant === q) })).filter((g) => g.rows.length)
    : p.tasks.length
      ? [{ q: "none", rows: p.tasks }]
      : [];

  return (
    <div className="overflow-hidden rounded-[20px] border border-line">
      <div className={cx("hidden items-center border-b border-line bg-surface px-4 py-1 md:grid", LIST_COLS)}>
        <span />
        {HEADS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-label={`Sort by ${label}`}
            onClick={() => p.onSort(k)}
            className={cx("min-h-11 text-left text-[13px] font-bold uppercase tracking-[0.04em]", p.sort === k ? "text-fg" : "text-muted hover:text-fg")}
          >
            {label} <span aria-hidden="true">{p.sort === k ? (p.dir === 1 ? "↑" : "↓") : ""}</span>
          </button>
        ))}
      </div>

      {groups.length === 0 && <p className="px-5 py-7 text-[15px] text-muted">Nothing matches this view.</p>}

      {groups.map((g) => (
        <div key={String(g.q)} className={g.q === "none" ? undefined : `q-${quadrantKey(g.q)}`}>
          {g.q !== "none" && <GroupHead q={g.q} open={openCount(g.rows)} />}
          {g.rows.map((t) => (
            <div key={t.id} className={cx("grid grid-cols-[44px_minmax(0,1fr)] items-center border-b border-line px-4 py-1.5 last:border-b-0", LIST_COLS)}>
              <CheckCircle done={t.status === "done"} title={t.title} onClick={() => p.onToggle(t)} />
              <div className="min-w-0 py-1.5 pr-3">
                <div className="flex items-center gap-2">
                  <QuadChip q={t.quadrant} />
                  <TitleButton t={t} onOpen={p.onOpen} className="truncate text-base" />
                </div>
                {t.notes && <div className="mt-0.5 truncate text-sm text-muted">{t.notes}</div>}
                <div className="md:hidden">
                  <Meta t={t} today={p.today} tagColor={p.tagColor} />
                </div>
              </div>
              <div className="hidden flex-wrap gap-1.5 pr-2 md:flex">
                {t.tags.map((n) => (
                  <TagChip key={n} name={n} color={p.tagColor(n)} />
                ))}
                <AgentBadge task={t} />
              </div>
              <div className="hidden flex-wrap gap-1.5 md:flex">
                <DueChip task={t} today={p.today} />
                <RepeatChip task={t} />
              </div>
              <div className="hidden md:block">
                <PriorityLabel p={t.priority} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function GroupHead({ q, open }: { q: Quadrant; open: number }) {
  const meta = q ? QUADRANTS[q - 1] : null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 bg-q px-4 py-2.5">
      <span className="text-base font-bold">{meta ? meta.name : "Inbox"}</span>
      <span className="text-[15px] font-semibold">{meta ? meta.title : "Not classified"}</span>
      {meta && <span className="text-sm text-muted">{meta.sub}</span>}
      <span className="ml-auto text-[13px] font-semibold text-muted">{open} open</span>
    </div>
  );
}

// ---- C · Status board ----

const COLUMNS: { status: Status; label: string; dot: string; hint?: string }[] = [
  { status: "todo", label: "To do", dot: "bg-faint" },
  { status: "doing", label: "In progress", dot: "bg-[var(--pri-medium)]" },
  { status: "done", label: "Done", dot: "bg-ok", hint: "last 7 days" },
];

export function BoardView(p: ViewProps) {
  return (
    <div className="grid items-start gap-5 md:grid-cols-3">
      {COLUMNS.map((c) => (
        <BoardColumn key={c.status} col={c} {...p} tasks={p.tasks.filter((t) => t.status === c.status)} />
      ))}
    </div>
  );
}

function BoardColumn({ col, ...p }: ViewProps & { col: (typeof COLUMNS)[number] }) {
  const drop = useDrop((id) => p.onPatch(id, { status: col.status }));
  return (
    <section
      aria-label={col.label}
      {...drop.props}
      className={cx("flex min-w-0 flex-col gap-3 rounded-3xl bg-surface-2/70 p-3.5 transition-shadow", drop.over && "ring-2 ring-ink/30")}
    >
      <div className="flex items-center gap-2.5 px-1.5 pt-1">
        <span className={cx("size-3 rounded-full", col.dot)} />
        <h2 className="text-lg font-semibold">{col.label}</h2>
        {col.hint && <span className="text-[13px] text-muted">{col.hint}</span>}
        <span className="ml-auto rounded-full bg-card px-2.5 py-0.5 text-[13px] font-semibold">{p.tasks.length}</span>
      </div>
      {p.tasks.length === 0 && <p className="px-2 py-8 text-center text-sm text-muted">Drop tasks here</p>}
      {p.tasks.map((t) => (
        <BoardCard key={t.id} t={t} {...p} />
      ))}
    </section>
  );
}

const FLOW: Status[] = ["todo", "doing", "done"];

function BoardCard({ t, ...p }: ViewProps & { t: Task }) {
  const i = FLOW.indexOf(t.status);
  return (
    <article {...draggable(t.id)} className="flex flex-col gap-2.5 rounded-[18px] bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <QuadChip q={t.quadrant} long />
        <PriorityLabel p={t.priority} />
      </div>
      <TitleButton t={t} onOpen={p.onOpen} className="text-[17px]" />
      {t.notes && <p className="line-clamp-3 text-sm text-muted">{t.notes}</p>}
      {(t.tags.length > 0 || t.createdBy === "agent") && (
        <div className="flex flex-wrap gap-1.5">
          {t.tags.map((n) => (
            <TagChip key={n} name={n} color={p.tagColor(n)} />
          ))}
          <AgentBadge task={t} />
        </div>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <DueChip task={t} today={p.today} />
        <RepeatChip task={t} />
        <div className="ml-auto flex gap-2">
          {i > 0 && (
            <Button size="sm" onClick={() => p.onPatch(t.id, { status: FLOW[i - 1] })} aria-label={`Move back: ${t.title}`}>
              Back
            </Button>
          )}
          {i < 2 && (
            <Button size="sm" variant="primary" onClick={() => p.onPatch(t.id, { status: FLOW[i + 1] })} aria-label={`${i === 0 ? "Start" : "Mark done"}: ${t.title}`}>
              {i === 0 ? "Start" : "Mark done"}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
