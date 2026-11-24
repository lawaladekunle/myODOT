"use client";

import { useActionState, useState, useSyncExternalStore, useTransition } from "react";
import {
  changePasswordAction,
  createTokenAction,
  createUserAction,
  deleteUserAction,
  resetPasswordAction,
  revokeTokenAction,
  saveColoursAction,
  setAdminAction,
  updateProfileAction,
  type FormState,
} from "@/app/actions/account";
import { createTagAction, deleteTagAction, updateTagAction } from "@/app/actions/tasks";
import { CopyIcon, TrashIcon } from "@/components/icons";
import { ago } from "@/components/planner/TaskDrawer";
import { Button, Field, QuadIcon, TagChip, cx, inputClass, inputSmClass } from "@/components/ui";
import { COLOUR_KEYS, DEFAULT_COLOURS, DEPTH_MAX, DEPTH_MIN, PALETTE, coloursStyle, type ColourKey, type Colours } from "@/lib/colours";
import { QUADRANTS, TAG_COLORS, type Quadrant, type Tag, type TagColor } from "@/lib/model";

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

const COLOUR_ROWS: { key: ColourKey; q: Quadrant; label: string }[] = [
  ...QUADRANTS.map((m) => ({ key: `q${m.id}` as ColourKey, q: m.id, label: `${m.name} · ${m.title}` })),
  { key: "inbox", q: null, label: "Inbox" },
];
const PALETTE_HEX = new Set<string>(PALETTE.map(([, hex]) => hex));
const selectedRing = "ring-2 ring-fg ring-offset-2 ring-offset-card";

export function ColoursForm({ initial }: { initial: Colours }) {
  const [c, setC] = useState(initial);
  const [state, action, pending] = useActionState(saveColoursAction, undefined);
  const pick = (k: ColourKey, hex: string) => setC((v) => ({ ...v, [k]: hex }));
  const depthLabel = c.depth === 0 ? "Default" : c.depth < 0 ? `Lighter ${-c.depth}` : `Deeper ${c.depth}`;

  return (
    <form action={action} className="flex flex-col gap-5">
      {COLOUR_KEYS.map((k) => (
        <input key={k} type="hidden" name={k} value={c[k]} />
      ))}
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          {COLOUR_ROWS.map((r) => {
            const custom = !PALETTE_HEX.has(c[r.key].toLowerCase());
            return (
              <div key={r.key} role="group" aria-label={`${r.label} colour`} className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-muted">{r.label}</span>
                <div className="flex flex-wrap items-center gap-2">
                  {PALETTE.map(([name, hex]) => (
                    <button
                      key={hex}
                      type="button"
                      title={name}
                      aria-label={name}
                      aria-pressed={c[r.key].toLowerCase() === hex}
                      onClick={() => pick(r.key, hex)}
                      className={cx("size-6 rounded-full", c[r.key].toLowerCase() === hex && selectedRing)}
                      style={{ background: hex }}
                    />
                  ))}
                  <label
                    title="Custom colour"
                    className={cx("relative size-6 cursor-pointer rounded-full", custom && selectedRing)}
                    style={{ background: custom ? c[r.key] : "conic-gradient(#e44, #ec4, #4c6, #4ae, #a4e, #e44)" }}
                  >
                    <input
                      type="color"
                      aria-label={`Custom colour for ${r.label}`}
                      value={c[r.key]}
                      onChange={(e) => pick(r.key, e.target.value)}
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
              </div>
            );
          })}

          <label className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between text-[13px] font-semibold text-muted">
              Depth <span className="text-fg">{depthLabel}</span>
            </span>
            <input
              type="range"
              name="depth"
              min={DEPTH_MIN}
              max={DEPTH_MAX}
              step={1}
              value={c.depth}
              onChange={(e) => setC((v) => ({ ...v, depth: Number(e.target.value) }))}
              className="accent-fg"
            />
            <span aria-hidden="true" className="flex justify-between text-[12.5px] text-muted">
              <span>Lighter</span>
              <span>Default</span>
              <span>Deeper</span>
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-2 md:self-start">
          <span className="text-[13px] font-semibold text-muted">Preview</span>
          <div style={coloursStyle(c)} className="grid grid-cols-2 gap-2 rounded-2xl border border-line p-2">
            <div className="q-inbox col-span-2 flex items-center gap-2 rounded-xl bg-q px-3 py-2.5">
              <QuadIcon q={null} size={16} />
              <span className="text-sm font-semibold">Inbox</span>
              <span className="ml-auto rounded-md bg-q-chip px-2 py-0.5 text-xs font-bold">2 to sort</span>
            </div>
            {QUADRANTS.map((m) => (
              <div key={m.id} className={cx(`q-q${m.id}`, "rounded-xl bg-q p-3")}>
                <div className="flex items-center gap-1.5">
                  <QuadIcon q={m.id} size={16} />
                  <span className="text-sm font-bold">{m.name}</span>
                </div>
                <div className="mt-0.5 text-[12.5px] text-muted">{m.title}</div>
                <span className="mt-2 inline-block rounded-md bg-q-chip px-2 py-0.5 text-xs font-bold">
                  {m.name} · {m.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          Save colours
        </Button>
        <Button onClick={() => setC(DEFAULT_COLOURS)}>Reset to default</Button>
      </div>
      <Message state={state} />
    </form>
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
