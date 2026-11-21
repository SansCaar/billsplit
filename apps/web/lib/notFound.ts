import { notFound } from "next/navigation";
import { ServiceError } from "./services";

/** For pages: a missing group/expense (or one you're not part of) shows the not-found page instead of crashing. */
export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof ServiceError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }
}
