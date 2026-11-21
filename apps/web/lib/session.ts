import { auth } from "@/auth";
import type { Actor } from "./model";
import { ServiceError } from "./services";

export async function currentActor(): Promise<Actor | null> {
  const s = await auth();
  const id = (s?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  return { userId: id, name: s!.user!.name ?? s!.user!.email ?? "Someone" };
}

export async function requireActor(): Promise<Actor> {
  const a = await currentActor();
  if (!a) throw new ServiceError("Please sign in", 401);
  return a;
}
