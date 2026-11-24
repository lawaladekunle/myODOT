"use client";

import { useActionState, useState, useSyncExternalStore, useTransition } from "react";
import {
  changePasswordAction,
  createTokenAction,
  createUserAction,
  deleteUserAction,
  resetPasswordAction,
  revokeTokenAction,
  setAdminAction,
  updateProfileAction,
  type FormState,
} from "@/app/actions/account";
import { createTagAction, deleteTagAction, updateTagAction } from "@/app/actions/tasks";
import { CopyIcon, TrashIcon } from "@/components/icons";
import { ago } from "@/components/planner/TaskDrawer";
import { Button, Field, TagChip, cx, inputClass, inputSmClass } from "@/components/ui";
import { TAG_COLORS, type Tag, type TagColor } from "@/lib/model";

function Message({ state }: { state: FormState }) {
  if (state?.error)
    return (
      <p role="alert" className="rounded-xl bg-hot-soft px-3.5 py-2.5 text-sm font-medium text-hot-ink">
        {state.error}
      </p>
    );
  if (state?.ok)
    return (
      <p role="status" className="rounded-xl bg-ok-soft px-3.5 py-2.5 text-sm font-medium text-ok-ink">
        {state.ok}
      </p>
    );
  return null;
}

export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-[1_1_260px]">
          <Field label="Name">
            <input name="name" defaultValue={name} required maxLength={80} className={inputClass} />
          </Field>
        </div>
        <Button type="submit" disabled={pending}>
          Save name
        </Button>
      </div>
      <Message state={state} />
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Current password">
          <input name="current" type="password" autoComplete="current-password" required className={inputClass} />
        </Field>
        <Field label="New password">
          <input name="password" type="password" autoComplete="new-password" required minLength={10} className={inputClass} />
        </Field>
        <Button type="submit" disabled={pending}>
          Change password
        </Button>
      </div>
      <Message state={state} />
    </form>
  );
}

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-stretch gap-2">
      <code aria-label={label} className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-xl border border-line-strong bg-card px-3.5 py-2.5 font-mono text-[13px]">
        {value}
      </code>
      <Button
        size="sm"
        className="h-auto"
        aria-label={`Copy ${label}`}
        onClick={() => navigator.clipboard.writeText(value).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}
      >
        <CopyIcon size={14} />
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

const noSubscribe = () => () => {};

export function AgentAccess({ tokens }: { tokens: { id: number; name: string; createdAt: string; lastUsedAt: string | null }[] }) {
  const [state, action, pending] = useActionState(createTokenAction, undefined);
  const origin = useSyncExternalStore(noSubscribe, () => location.origin, () => "https://your-odot-address");
  const url = `${origin}/api/mcp`;
  const token = state?.token ?? "<token>";

  return (
    <>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="flex-[1_1_260px]">
          <Field label="Token name">
            <input name="name" required maxLength={60} placeholder="For example: Claude planner agent" className={inputClass} />
          </Field>
        </div>
        <Button type="submit" variant="primary" disabled={pending}>
          Create token
        </Button>
      </form>
      <Message state={state} />

      <div className={cx("flex flex-col gap-3 rounded-2xl p-4", state?.token ? "bg-ok-soft" : "bg-surface")}>
        {state?.token ? (
          <>
            <p className="text-sm font-semibold text-ok-ink">Copy this token now. ODOT stores only a hash and can’t show it again.</p>
            <CopyField label="API token" value={state.token} />
          </>
        ) : (
          <p className="text-sm font-semibold">How to connect an agent</p>
        )}
        <p className="text-sm text-muted">Claude Code:</p>
        <CopyField label="Claude Code command" value={`claude mcp add --transport http odot ${url} --header "Authorization: Bearer ${token}"`} />
        <p className="text-sm text-muted">
          Any other MCP client: use the Streamable HTTP URL <code className="font-mono text-fg">{url}</code> with the header{" "}
          <code className="font-mono text-fg">Authorization: Bearer {state?.token ? "…" : "<token>"}</code>.
        </p>
      </div>

      {tokens.length > 0 && (
        <ul className="overflow-hidden rounded-2xl border border-line">
          {tokens.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{t.name}</div>
                <div className="text-[13px] text-muted">
                  Created {ago(t.createdAt)} · {t.lastUsedAt ? `last used ${ago(t.lastUsedAt)}` : "never used"}
                </div>
              </div>
              <form action={revokeTokenAction.bind(null, t.id)}>
                <Button type="submit" size="sm" variant="danger">
                  Revoke
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function TagManager({ initialTags }: { initialTags: Tag[] }) {
  const [tags, setTags] = useState(initialTags);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = async (p: Promise<{ ok: true; data: Tag[] } | { ok: false; error: string }>) => {
    const r = await p;
    setError(r.ok ? null : r.error);
    if (r.ok) setTags(r.data);
  };

  return (
    <>
      <ul className="flex flex-col gap-2">
        {tags.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3">
            <TagChip name={t.name} color={t.color} className="w-28 justify-center" />
            <input
              aria-label={`Rename ${t.name}`}
              defaultValue={t.name}
              maxLength={40}
              onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== t.name && run(updateTagAction(t.id, { name: e.target.value.trim() }))}
              className={cx(inputSmClass, "w-40")}
            />
            <div role="group" aria-label={`Colour for ${t.name}`} className="flex flex-wrap gap-1">
              {TAG_COLORS.map((c: TagColor) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  aria-label={c}
                  aria-pressed={t.color === c}
                  onClick={() => run(updateTagAction(t.id, { color: c }))}
                  className={cx("tag size-5 rounded-full", `tag-${c}`, t.color === c && "ring-2 ring-fg ring-offset-2 ring-offset-card")}
                  style={{ background: "var(--tag-fg)" }}
                />
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Delete tag ${t.name}`}
              className="ml-auto"
              onClick={() => confirm(`Delete the tag “${t.name}”? Tasks keep everything else.`) && run(deleteTagAction(t.id))}
            >
              <TrashIcon size={15} />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) run(createTagAction(name.trim())).then(() => setName(""));
        }}
      >
        <input aria-label="New tag name" placeholder="New tag" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} className={cx(inputClass, "w-56")} />
        <Button type="submit">Add tag</Button>
      </form>
      {error && <Message state={{ error }} />}
    </>
  );
}

type Person = { id: number; name: string; email: string; isAdmin: boolean; createdAt: string };

export function People({ users, meId }: { users: Person[]; meId: number }) {
  const [state, action, pending] = useActionState(createUserAction, undefined);
  const [result, setResult] = useState<FormState>(undefined);
  const [busy, start] = useTransition();
  const act = (p: () => Promise<FormState>) => start(async () => setResult(await p()));

  return (
    <>
      <ul className="overflow-hidden rounded-2xl border border-line">
        {users.map((u) => (
          <li key={u.id} className="flex flex-col gap-3 border-b border-line px-4 py-3.5 last:border-b-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold">
                  {u.name}
                  {u.isAdmin && <span className="rounded-full bg-info-chip px-2 py-0.5 text-[12px] font-semibold text-info-ink">Admin</span>}
                  {u.id === meId && <span className="text-[13px] font-normal text-muted">(you)</span>}
                </div>
                <div className="text-[13px] text-muted">{u.email}</div>
              </div>
              {u.id !== meId && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy} onClick={() => act(() => setAdminAction(u.id, !u.isAdmin))}>
                    {u.isAdmin ? "Remove admin" : "Make admin"}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={() => confirm(`Delete ${u.name}'s account and all their tasks? This can't be undone.`) && act(() => deleteUserAction(u.id))}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
            {u.id !== meId && <ResetPassword userId={u.id} />}
          </li>
        ))}
      </ul>
      <Message state={result} />

      <form action={action} className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
        <p className="text-sm font-semibold">Add a person</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Name">
            <input name="name" required maxLength={80} className={inputClass} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" required className={inputClass} />
          </Field>
          <Field label="Temporary password">
            <input name="password" type="password" autoComplete="new-password" required minLength={10} className={inputClass} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="admin" className="size-4 accent-[var(--ink)]" />
            Admin
          </label>
          <Button type="submit" variant="primary" disabled={pending}>
            Create account
          </Button>
        </div>
        <Message state={state} />
      </form>
    </>
  );
}

function ResetPassword({ userId }: { userId: number }) {
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);
  return (
    <details className="group">
      <summary className="w-fit cursor-pointer text-[13px] font-semibold text-muted hover:text-fg">Reset password</summary>
      <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="userId" value={userId} />
        <input name="password" type="password" autoComplete="new-password" required minLength={10} placeholder="New password" aria-label="New password" className={cx(inputSmClass, "w-56")} />
        <Button type="submit" size="sm" disabled={pending}>
          Set password
        </Button>
        <Message state={state} />
      </form>
    </details>
  );
}
