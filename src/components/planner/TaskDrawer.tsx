import { useEffect, useRef, useState } from "react";
import { activityAction } from "@/app/actions/tasks";
import { addDays, parseISODate } from "@/lib/dates";
import {
  AREA_LABEL,
  PRIORITY_LABEL,
  QUADRANTS,
  REPEAT_LABEL,
  REPEATS,
  STATUS_LABEL,
  type Activity,
  type Quadrant,
  type Repeat,
  type Status,
  type Tag,
  type Task,
  type TaskPatch,
} from "@/lib/model";
import { BotIcon, CheckIcon, CloseIcon, TrashIcon, UserIcon } from "../icons";
import { Button, QuadChip, Segmented, cx, inputClass } from "../ui";

type Props = {
  task: Task;
  tags: Tag[];
  today: string;
  onClose: () => void;
  onPatch: (id: number, patch: TaskPatch) => void;
  onDelete: (id: number) => void;
};

/** Side sheet for editing every field of a task. Uses <dialog> for focus trapping and Esc handling. */
export function TaskDrawer({ task, tags, today, onClose, onPatch, onDelete }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // null means "not edited", so a change made elsewhere (say, by the agent) isn't overwritten on blur.
  const [title, setTitle] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const patch = (p: TaskPatch) => onPatch(task.id, p);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    let live = true;
    activityAction(task.id).then((r) => live && r.ok && setActivity(r.data));
    return () => {
      live = false;
    };
  }, [task.id, task.updatedAt]);

  const saveTitle = () => {
    if (title === null) return;
    const v = title.trim();
    setTitle(null);
    if (v && v !== task.title) patch({ title: v });
  };
  const saveNotes = () => {
    if (notes === null) return;
    setNotes(null);
    if (notes !== task.notes) patch({ notes });
  };
  const toggleTag = (name: string) =>
    patch({ tags: task.tags.some((t) => t.toLowerCase() === name.toLowerCase()) ? task.tags.filter((t) => t.toLowerCase() !== name.toLowerCase()) : [...task.tags, name] });

  return (
    <dialog
      ref={ref}
      aria-labelledby="task-drawer-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-[540px] bg-transparent p-0 backdrop:bg-[var(--overlay)] backdrop:animate-[odot-fade-in_.15s_ease-out]"
    >
      <div className="flex h-full animate-[odot-slide-in_.2s_ease-out] flex-col overflow-y-auto border-l border-line bg-card text-fg shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-card/95 px-5 py-3 backdrop-blur">
          <QuadChip q={task.quadrant} long />
          <span className="text-[13px] font-semibold text-muted">{STATUS_LABEL[task.status]}</span>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="ml-auto flex size-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg">
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-6 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <button
              type="button"
              aria-label={task.status === "done" ? "Mark not done" : "Mark done"}
              onClick={() => patch({ status: task.status === "done" ? "todo" : "done" })}
              className={cx(
                "mt-1.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                task.status === "done" ? "border-ok bg-ok text-white" : "border-faint hover:border-ok",
              )}
            >
              {task.status === "done" && <CheckIcon size={15} className="stroke-[3.2]" />}
            </button>
            <textarea
              id="task-drawer-title"
              aria-label="Title"
              rows={1}
              value={title ?? task.title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              className="field-sizing-content min-h-10 w-full resize-none bg-transparent text-2xl font-bold leading-tight tracking-[-0.01em] outline-none"
            />
          </div>

          <textarea
            aria-label="Notes"
            placeholder="Add notes…"
            value={notes ?? task.notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            className="field-sizing-content min-h-24 w-full resize-y rounded-xl border border-line-strong bg-card px-3.5 py-3 text-[15px] leading-relaxed outline-none placeholder:text-faint focus:border-ink"
          />

          <Row label="Quadrant" hint={task.quadrant ? QUADRANTS[task.quadrant - 1].sub : "Inbox: not classified yet"}>
            <Segmented<"inbox" | 1 | 2 | 3 | 4>
              label="Quadrant"
              size="sm"
              value={task.quadrant ?? "inbox"}
              onChange={(v) => patch({ quadrant: v === "inbox" ? null : (v as Quadrant) })}
              options={[
                { value: "inbox", label: "Inbox" },
                ...QUADRANTS.map((q) => ({ value: q.id, label: `${q.name} ${q.title}`, title: q.sub })),
              ]}
            />
          </Row>

          <Row label="Status">
            <Segmented<Status>
              label="Status"
              size="sm"
              value={task.status}
              onChange={(status) => patch({ status })}
              options={(["todo", "doing", "done", "dropped"] as const).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
          </Row>

          <div className="grid gap-6 sm:grid-cols-2">
            <Row label="Priority">
              <Segmented
                label="Priority"
                size="sm"
                value={task.priority}
                onChange={(priority) => patch({ priority })}
                options={(["high", "medium", "low"] as const).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
              />
            </Row>
            <Row label="Area">
              <Segmented
                label="Area"
                size="sm"
                value={task.area}
                onChange={(area) => patch({ area })}
                options={(["work", "personal"] as const).map((a) => ({ value: a, label: AREA_LABEL[a] }))}
              />
            </Row>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Row label="Due date">
              <input type="date" aria-label="Due date" value={task.dueDate ?? ""} onChange={(e) => patch({ dueDate: e.target.value || null })} className={inputClass} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  ["Today", today],
                  ["Tomorrow", addDays(today, 1)],
                  ["Next week", addDays(today, 7)],
                ].map(([label, date]) => (
                  <button key={label} type="button" onClick={() => patch({ dueDate: date })} className="h-8 rounded-full bg-chip px-3 text-[13px] font-semibold text-chip-ink hover:bg-surface-2">
                    {label}
                  </button>
                ))}
                {task.dueDate && (
                  <button type="button" onClick={() => patch({ dueDate: null })} className="h-8 rounded-full px-3 text-[13px] font-semibold text-muted hover:bg-surface-2">
                    Clear
                  </button>
                )}
              </div>
            </Row>
            <Row label="Repeat" hint={task.repeat ? "Completing it schedules the next one." : undefined}>
              <select aria-label="Repeat" value={task.repeat ?? ""} onChange={(e) => patch({ repeat: (e.target.value || null) as Repeat | null })} className={inputClass}>
                <option value="">Doesn’t repeat</option>
                {REPEATS.map((r) => (
                  <option key={r} value={r}>
                    {REPEAT_LABEL[r]}
                  </option>
                ))}
              </select>
            </Row>
          </div>

          <Row label="Tags">
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const on = task.tags.some((n) => n.toLowerCase() === t.name.toLowerCase());
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleTag(t.name)}
                    className={cx(
                      "tag inline-flex h-8 items-center gap-1 rounded-full border-2 px-3 text-[13px] font-semibold transition-opacity",
                      `tag-${t.color}`,
                      on ? "border-current" : "border-transparent opacity-55 hover:opacity-100",
                    )}
                  >
                    {on && <CheckIcon size={12} className="stroke-[3]" />}
                    {t.name}
                  </button>
                );
              })}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newTag.trim();
                  if (name) toggleTag(name);
                  setNewTag("");
                }}
              >
                <input
                  aria-label="New tag"
                  placeholder="+ New tag"
                  value={newTag}
                  maxLength={40}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="h-8 w-28 rounded-full border border-dashed border-line-strong bg-transparent px-3 text-[13px] outline-none placeholder:text-faint focus:w-40 focus:border-ink"
                />
              </form>
            </div>
          </Row>

          <section className="border-t border-line pt-5">
            <h3 className="text-[13px] font-semibold text-muted">Activity</h3>
            {!activity || activity.length === 0 ? (
              <p className="mt-3 text-sm text-faint">{activity ? "No changes recorded yet." : "Loading…"}</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-3">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-3 text-sm">
                    <span className={cx("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full", a.actorKind === "agent" ? "bg-info-chip text-info-ink" : "bg-surface-2 text-muted")}>
                      {a.actorKind === "agent" ? <BotIcon size={13} /> : <UserIcon size={13} />}
                    </span>
                    <span className="min-w-0">
                      <span className="font-semibold">{a.actorName}</span> {describe(a)}
                      <span className="block text-[12.5px] text-faint" title={new Date(a.at).toLocaleString()}>
                        {ago(a.at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="mt-auto flex items-center gap-3 border-t border-line px-5 py-4 sm:px-6">
          <span className="text-[12.5px] text-muted">
            Created {new Date(task.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            {task.createdBy === "agent" && " by an agent"}
          </span>
          <Button variant="danger" size="sm" className="ml-auto" onClick={() => onDelete(task.id)}>
            <TrashIcon size={15} />
            Delete
          </Button>
        </div>
      </div>
    </dialog>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="text-[12.5px] text-muted">{hint}</span>}
    </div>
  );
}

// ---- activity wording ----

const FIELD: Record<string, string> = {
  title: "the title",
  quadrant: "quadrant",
  status: "status",
  priority: "priority",
  area: "area",
  dueDate: "due date",
  repeat: "repeat",
  tags: "tags",
};

function fmt(field: string, v: unknown): string {
  if (field === "quadrant") return v ? `Q${v}` : "Inbox";
  if (v === null || v === undefined || (Array.isArray(v) && v.length === 0)) return "none";
  if (field === "status") return STATUS_LABEL[v as Status];
  if (field === "priority") return PRIORITY_LABEL[v as Task["priority"]];
  if (field === "area") return AREA_LABEL[v as Task["area"]];
  if (field === "repeat") return REPEAT_LABEL[v as Repeat];
  if (field === "dueDate") return parseISODate(String(v)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (field === "tags") return (v as string[]).join(", ");
  return `“${String(v)}”`;
}

const VERB: Record<string, string> = {
  created: "created this task",
  repeated: "scheduled this repeat",
  completed: "completed it",
  reopened: "reopened it",
  started: "started it",
  dropped: "dropped it",
  deleted: "moved it to the trash",
  restored: "restored it",
};

function describe(a: Activity) {
  const parts = Object.entries(a.changes ?? {})
    .filter(([k]) => !(k === "status" && a.action !== "updated"))
    .map(([k, [from, to]]) => (k === "notes" ? "edited the notes" : `changed ${FIELD[k] ?? k} from ${fmt(k, from)} to ${fmt(k, to)}`));
  return [VERB[a.action], ...parts].filter(Boolean).join(", ") || a.action;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const STEPS: [number, Intl.RelativeTimeFormatUnit][] = [
  [60, "second"],
  [60, "minute"],
  [24, "hour"],
  [7, "day"],
  [4.35, "week"],
  [12, "month"],
  [Infinity, "year"],
];

export function ago(iso: string) {
  let v = (Date.parse(iso) - Date.now()) / 1000;
  for (const [n, unit] of STEPS) {
    if (Math.abs(v) < n) return rtf.format(Math.round(v), unit);
    v /= n;
  }
  return "";
}
