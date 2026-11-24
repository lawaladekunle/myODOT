"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/account";
import { Button, Field, inputClass } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <Field label="Email">
        <input name="email" type="email" autoComplete="username" required autoFocus defaultValue={state?.email} className={inputClass} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      {state?.error && (
        <p role="alert" className="rounded-xl bg-hot-soft px-3.5 py-2.5 text-sm font-medium text-hot-ink">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending} className="mt-1 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
