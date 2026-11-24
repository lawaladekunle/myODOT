"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as auth from "@/lib/auth";
import { UserError } from "@/lib/db";

export type FormState = { error?: string; ok?: string; token?: string; email?: string } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

async function form(fn: () => Promise<FormState> | FormState): Promise<FormState> {
  try {
    const out = await fn();
    revalidatePath("/settings");
    return out;
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    await auth.ensureAdmin();
    await auth.login(str(fd, "email"), str(fd, "password"));
  } catch (e) {
    // React resets the form after an action. Send the email back so the user only retypes the password.
    if (e instanceof UserError) return { error: e.message, email: str(fd, "email") };
    throw e;
  }
  redirect("/");
}

export async function logoutAction() {
  await auth.logout();
  redirect("/login");
}

export async function updateProfileAction(_: FormState, fd: FormData) {
  const u = await auth.requireUser();
  return form(() => {
    auth.renameUser(u.id, str(fd, "name"));
    return { ok: "Name saved." };
  });
}

export async function changePasswordAction(_: FormState, fd: FormData) {
  const u = await auth.requireUser();
  return form(async () => {
    if (!(await auth.checkPassword(u.id, str(fd, "current")))) throw new UserError("Your current password is wrong.");
    await auth.setPassword(u.id, str(fd, "password"));
    // setPassword signs out every session, including this one. Sign back in here.
    await auth.login(u.email, str(fd, "password"));
    return { ok: "Password changed. Other devices are signed out." };
  });
}

export async function createTokenAction(_: FormState, fd: FormData) {
  const u = await auth.requireUser();
  return form(() => ({ token: auth.createApiToken(u.id, str(fd, "name")) }));
}

export async function revokeTokenAction(tokenId: number) {
  const u = await auth.requireUser();
  auth.revokeApiToken(u.id, Number(tokenId));
  revalidatePath("/settings");
}

// ---- admin ----

export async function createUserAction(_: FormState, fd: FormData) {
  await auth.requireAdmin();
  return form(async () => {
    await auth.createUser({ name: str(fd, "name"), email: str(fd, "email"), password: str(fd, "password"), isAdmin: fd.get("admin") === "on" });
    return { ok: `Account created for ${str(fd, "email")}. Share the password with them privately.` };
  });
}

export async function resetPasswordAction(_: FormState, fd: FormData) {
  await auth.requireAdmin();
  return form(async () => {
    await auth.setPassword(Number(str(fd, "userId")), str(fd, "password"));
    return { ok: "Password reset. They are signed out everywhere." };
  });
}

export async function setAdminAction(userId: number, isAdmin: boolean) {
  await auth.requireAdmin();
  return form(() => {
    auth.setAdmin(Number(userId), isAdmin === true);
    return { ok: "Saved." };
  });
}

export async function deleteUserAction(userId: number) {
  const me = await auth.requireAdmin();
  return form(() => {
    if (Number(userId) === me.id) throw new UserError("You can't delete your own account here.");
    auth.deleteUser(Number(userId));
    return { ok: "Account and all its tasks deleted." };
  });
}
