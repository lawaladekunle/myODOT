"use client";

import { useCallback, useState } from "react";
import { purgeTrashAction, restoreTaskAction } from "@/app/actions/tasks";
import { UndoIcon } from "@/components/icons";
import { ago } from "@/components/planner/TaskDrawer";
import { Toast, type ToastState } from "@/components/Toast";
import { AgentBadge, Button, QuadChip } from "@/components/ui";
import type { Task } from "@/lib/model";

export function TrashList({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [toast, setToast] = useState<ToastState | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const fail = (text: string) => setToast({ id: Date.now(), text, tone: "error" });

  const restore = async (t: Task) => {
    const r = await restoreTaskAction(t.id);
    if (!r.ok) return fail(r.error);
    setTasks((ts) => ts.filter((x) => x.id !== t.id));
    setToast({ id: Date.now(), text: `Restored “${t.title}”.` });
  };
  const purge = async (t?: Task) => {
    const msg = t ? `Delete “${t.title}” forever? This can't be undone.` : `Delete all ${tasks.length} tasks in the trash forever? This can't be undone.`;
    if (!confirm(msg)) return;
    const r = await purgeTrashAction(t?.id);
    if (!r.ok) return fail(r.error);
    setTasks((ts) => (t ? ts.filter((x) => x.id !== t.id) : []));
  };

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-4 pb-20 pt-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[44px]">Trash</h1>
          <p className="mt-2 text-[17px] text-muted">Deleted tasks wait here until you restore them or empty the trash.</p>
        </div>
        {tasks.length > 0 && (
          <Button variant="danger" onClick={() => purge()}>
            Empty trash
          </Button>
        )}
      </header>

      {tasks.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-line-strong px-6 py-12 text-center text-[15px] text-muted">The trash is empty.</p>
      ) : (
        <ul className="overflow-hidden rounded-[20px] border border-line">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-5 py-3.5 last:border-b-0">
              <QuadChip q={t.quadrant} />
              <div className="min-w-0 flex-[1_1_220px]">
                <div className="font-semibold">{t.title}</div>
                <div className="text-[13px] text-muted">Deleted {ago(t.deletedAt!)}</div>
              </div>
              <AgentBadge task={t} />
              <div className="ml-auto flex gap-2">
                <Button size="sm" onClick={() => restore(t)}>
                  <UndoIcon size={14} />
                  Restore
                </Button>
                <Button size="sm" variant="ghost" onClick={() => purge(t)}>
                  Delete forever
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}
