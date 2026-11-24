"use server";

import { requireUser, userActor, type User } from "@/lib/auth";
import { UserError } from "@/lib/db";
import * as tasks from "@/lib/tasks";
import type { TagColor, TaskPatch } from "@/lib/model";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: (user: User) => T): Promise<Result<T>> {
  const user = await requireUser();
  try {
    return { ok: true, data: fn(user) };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    throw e;
  }
}

const id = (n: unknown) => {
  if (!Number.isInteger(n)) throw new UserError("Invalid id.");
  return n as number;
};

export async function activeTasksAction() {
  return run((u) => ({ tasks: tasks.listActiveTasks(u.id), tags: tasks.listTags(u.id) }));
}

export async function createTaskAction(input: TaskPatch) {
  return run((u) => ({ task: tasks.createTask(userActor(u), input), tags: tasks.listTags(u.id) }));
}

export async function updateTaskAction(taskId: number, patch: TaskPatch) {
  return run((u) => ({ ...tasks.updateTask(userActor(u), id(taskId), patch), tags: tasks.listTags(u.id) }));
}

export async function deleteTaskAction(taskId: number) {
  return run((u) => tasks.deleteTask(userActor(u), id(taskId)));
}

export async function restoreTaskAction(taskId: number) {
  return run((u) => tasks.restoreTask(userActor(u), id(taskId)));
}

export async function purgeTrashAction(taskId?: number) {
  return run((u) => tasks.purgeTrash(u.id, taskId === undefined ? undefined : id(taskId)));
}

export async function activityAction(taskId: number) {
  return run((u) => tasks.listActivity(u.id, id(taskId)));
}

export async function updateTagAction(tagId: number, input: { name?: string; color?: TagColor }) {
  return run((u) => {
    tasks.updateTag(u.id, id(tagId), input);
    return tasks.listTags(u.id);
  });
}

export async function createTagAction(name: string) {
  return run((u) => {
    if (typeof name !== "string" || !name.trim() || name.length > 40) throw new UserError("Tag names are 1 to 40 characters.");
    tasks.ensureTags(u.id, [name]);
    return tasks.listTags(u.id);
  });
}

export async function deleteTagAction(tagId: number) {
  return run((u) => {
    tasks.deleteTag(u.id, id(tagId));
    return tasks.listTags(u.id);
  });
}

// Area actions return the full list so Settings can redraw from it.
export async function createAreaAction(name: string) {
  return run((u) => {
    tasks.createArea(u.id, name);
    return tasks.listAreas(u.id);
  });
}

export async function renameAreaAction(areaId: number, name: string) {
  return run((u) => {
    tasks.renameArea(u.id, id(areaId), name);
    return tasks.listAreas(u.id);
  });
}

export async function moveAreaAction(areaId: number, dir: number) {
  return run((u) => {
    if (dir !== -1 && dir !== 1) throw new UserError("Invalid direction.");
    tasks.moveArea(u.id, id(areaId), dir);
    return tasks.listAreas(u.id);
  });
}

export async function deleteAreaAction(areaId: number, moveTo?: number) {
  return run((u) => {
    tasks.deleteArea(u.id, id(areaId), moveTo === undefined ? undefined : id(moveTo));
    return tasks.listAreas(u.id);
  });
}
