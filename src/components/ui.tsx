import type { ButtonHTMLAttributes, ReactNode } from "react";
import { dueLabel } from "@/lib/dates";
import { PRIORITY_LABEL, QUADRANTS, REPEAT_LABEL, quadrantKey, type Priority, type Quadrant, type TagColor, type Task } from "@/lib/model";
import { BotIcon, CheckIcon, DelegateIcon, EliminateIcon, InboxIcon, RepeatIcon, ScheduleIcon, UrgentIcon } from "./icons";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" };

export function Button({ variant = "secondary", size = "md", className, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-50",
        size === "md" ? "h-11 px-4 text-sm" : "h-9 px-3 text-[13px]",
        variant === "primary" && "bg-ink text-ink-fg hover:opacity-90",
        variant === "secondary" && "border border-line-strong bg-card text-fg hover:bg-surface-2",
        variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-fg",
        variant === "danger" && "border border-line-strong bg-card text-hot-ink hover:bg-hot-soft",
        className,
      )}
    />
  );
}

/** A pill that is either on (filled) or off (outlined). */
export function Toggle({ on, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      {...rest}
      className={cx(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-semibold transition-colors",
        on ? "border-ink bg-ink text-ink-fg" : "border-line-strong bg-card text-fg hover:bg-surface-2",
        className,
      )}
    />
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-[14px] bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "inline-flex shrink-0 items-center gap-1.5 rounded-[10px] font-semibold transition-all",
            size === "md" ? "h-10 px-4 text-[15px]" : "h-8 px-3 text-[13px]",
            o.value === value ? "bg-card text-fg shadow-[0_1px_3px_rgb(0_0_0/0.15)]" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function QuadIcon({ q, size = 20 }: { q: Quadrant; size?: number }) {
  const Icon = q === null ? InboxIcon : [UrgentIcon, ScheduleIcon, DelegateIcon, EliminateIcon][q - 1];
  return <Icon size={size} className="text-q-ink" />;
}

export function QuadChip({ q, long }: { q: Quadrant; long?: boolean }) {
  const meta = q ? QUADRANTS[q - 1] : null;
  return (
    <span className={cx(`q-${quadrantKey(q)}`, "inline-flex shrink-0 items-center rounded-md bg-q-chip px-2 py-0.5 text-xs font-bold text-fg")}>
      {meta ? (long ? `${meta.name} · ${meta.title}` : meta.name) : "Inbox"}
    </span>
  );
}

export function TagChip({ name, color, className }: { name: string; color?: TagColor; className?: string }) {
  return (
    <span className={cx("tag", `tag-${color ?? "gray"}`, "inline-flex items-center rounded-full px-2.5 py-[3px] text-[12.5px] font-semibold", className)}>
      {name}
    </span>
  );
}

export function DueChip({ task, today, onQuadrant }: { task: Task; today: string; onQuadrant?: boolean }) {
  if (!task.dueDate && (task.repeat || task.status === "done" || task.status === "dropped")) return null;
  const { label, tone } = dueLabel(task.dueDate, today);
  const hot = (tone === "overdue" || tone === "today") && task.status !== "done";
  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12.5px] font-semibold",
        hot ? "bg-hot-soft text-hot-ink" : onQuadrant ? "bg-card/75 text-chip-ink" : "bg-chip text-chip-ink",
      )}
    >
      {label}
    </span>
  );
}

export function RepeatChip({ task, onQuadrant }: { task: Task; onQuadrant?: boolean }) {
  if (!task.repeat) return null;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12.5px] font-semibold text-chip-ink",
        onQuadrant ? "bg-card/75" : "bg-chip",
      )}
    >
      <RepeatIcon size={12} />
      {REPEAT_LABEL[task.repeat]}
    </span>
  );
}

const PRI_COLOR: Record<Priority, string> = { high: "bg-[var(--pri-high)]", medium: "bg-[var(--pri-medium)]", low: "bg-[var(--pri-low)]" };

export function PriorityLabel({ p }: { p: Priority }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold text-chip-ink">
      <span className={cx("size-2 rounded-full", PRI_COLOR[p])} />
      {PRIORITY_LABEL[p]}
    </span>
  );
}

export function AgentBadge({ task }: { task: Task }) {
  if (task.createdBy !== "agent") return null;
  return (
    <span title="Added by an AI agent" className="inline-flex items-center gap-1 rounded-full bg-info-chip px-2 py-[3px] text-[12px] font-semibold text-info-ink">
      <BotIcon size={12} />
      Agent
    </span>
  );
}

export function DoingBadge({ task }: { task: Task }) {
  if (task.status !== "doing") return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--pri-medium)_18%,transparent)] px-2.5 py-[3px] text-[12.5px] font-semibold text-fg">
      <span className="size-1.5 rounded-full bg-[var(--pri-medium)]" />
      In progress
    </span>
  );
}

/** The round checkbox from the mockups, with a 44px hit area. */
export function CheckCircle({ done, onClick, title }: { done: boolean; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      aria-label={(done ? "Mark not done: " : "Mark done: ") + title}
      aria-pressed={done}
      onClick={onClick}
      className="group -my-2.5 -ml-2.5 flex size-11 shrink-0 items-center justify-center"
    >
      <span
        className={cx(
          "flex size-6 items-center justify-center rounded-full border-2 transition-colors",
          done ? "border-ok bg-ok text-white" : "border-faint bg-card/60 group-hover:border-ok",
        )}
      >
        {done ? <CheckIcon size={14} className="stroke-[3.2]" /> : <CheckIcon size={12} className="stroke-[3] text-ok opacity-0 group-hover:opacity-60" />}
      </span>
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-3.5 text-[15px] text-muted">{children}</p>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="text-[12.5px] text-muted">{hint}</span>}
    </label>
  );
}

// No width here: inputs stretch inside flex columns, and callers add a width without fighting this one.
const inputBase = "min-w-0 rounded-xl border border-line-strong bg-card text-fg outline-none placeholder:text-faint focus:border-ink";
export const inputClass = `${inputBase} h-11 px-3.5 text-[15px]`;
export const inputSmClass = `${inputBase} h-9 px-3 text-sm`;
