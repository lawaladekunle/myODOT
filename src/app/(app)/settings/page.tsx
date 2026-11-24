import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DownloadIcon } from "@/components/icons";
import { getColours, listApiTokens, listUsers, requireUser } from "@/lib/auth";
import { listAreas, listTags } from "@/lib/tasks";
import { AgentAccess, AreaManager, ColoursForm, PasswordForm, People, ProfileForm, TagManager } from "./forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-4 pb-20 pt-8 sm:px-6">
      <header>
        <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[44px]">Settings</h1>
        <p className="mt-2 text-[17px] text-muted">Signed in as {user.email}.</p>
      </header>

      <Section title="Profile">
        <ProfileForm name={user.name} />
        <PasswordForm />
      </Section>

      <Section
        title="AI agent access"
        description="Give an AI agent its own token. It connects over MCP, can read and change your tasks, and every change it makes shows up in the task's activity under the token's name."
      >
        <AgentAccess tokens={listApiTokens(user.id)} />
      </Section>

      <Section title="Areas" description="The tabs at the top of the planner. Each task belongs to one area, and All shows every area together.">
        <AreaManager initialAreas={listAreas(user.id)} />
      </Section>

      <Section title="Colours" description="Pick a colour for each quadrant and how strong the tint is. Only you see your colours.">
        <ColoursForm initial={getColours(user.id)} />
      </Section>

      <Section title="Tags" description="Rename, recolour or delete tags. Deleting a tag removes it from its tasks but keeps the tasks.">
        <TagManager initialTags={listTags(user.id)} />
      </Section>

      {user.isAdmin && (
        <Section title="People" description="Everyone gets their own private planner. Admins can add people and reset passwords.">
          <People users={listUsers()} meId={user.id} />
        </Section>
      )}

      <Section title="Your data" description="Download every task, tag and activity entry as JSON.">
        <a
          href="/api/export"
          className="inline-flex h-11 w-fit items-center gap-2 rounded-xl border border-line-strong bg-card px-4 text-sm font-semibold hover:bg-surface-2"
        >
          <DownloadIcon size={16} />
          Export JSON
        </a>
      </Section>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-[20px] border border-line bg-card p-5 sm:p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="mt-1 max-w-[62ch] text-[15px] text-muted">{description}</p>}
      <div className="mt-5 flex flex-col gap-6">{children}</div>
    </section>
  );
}
