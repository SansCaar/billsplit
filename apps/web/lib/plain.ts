/** Make Mongo docs safe to pass to client components (Dates -> ISO strings). */
export const plain = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
export const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
export const fmtWhen = (d: string | Date) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
