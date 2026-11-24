import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ensureAdmin, getUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  const ready = await ensureAdmin();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="flex justify-center">
          <Logo />
        </div>
        <div className="mt-8 rounded-3xl border border-line bg-card p-7 shadow-card sm:p-8">
          <h1 className="text-2xl font-bold tracking-[-0.01em]">Sign in</h1>
          <p className="mt-1.5 text-[15px] text-muted">Organise your priorities. Focus on what matters.</p>
          {ready ? (
            <LoginForm />
          ) : (
            <div className="mt-6 rounded-2xl bg-info-soft p-4 text-sm leading-relaxed text-fg">
              <p className="font-semibold">No accounts yet.</p>
              <p className="mt-1 text-muted">
                Set <code className="font-mono text-fg">ODOT_ADMIN_EMAIL</code> and <code className="font-mono text-fg">ODOT_ADMIN_PASSWORD</code> in your{" "}
                <code className="font-mono text-fg">.env</code> file, restart ODOT, then reload this page. That creates the first admin account.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
