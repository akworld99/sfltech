import { getCloudflareContext } from "@opennextjs/cloudflare";

export const getEnv = () => getCloudflareContext().env;
export const getDb = () => getCloudflareContext().env.DB;

export async function all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  const res = await getDb()
    .prepare(sql)
    .bind(...params)
    .all<T>();
  return res.results ?? [];
}

export async function first<T>(sql: string, ...params: unknown[]): Promise<T | null> {
  return (await getDb()
    .prepare(sql)
    .bind(...params)
    .first<T>()) as T | null;
}

export async function run(sql: string, ...params: unknown[]) {
  return getDb()
    .prepare(sql)
    .bind(...params)
    .run();
}

export async function audit(actor: string, action: string, target: string, detail?: string) {
  await run(
    "INSERT INTO audit_log (actor, action, target, detail) VALUES (?, ?, ?, ?)",
    actor,
    action,
    target,
    detail ?? null,
  );
}
