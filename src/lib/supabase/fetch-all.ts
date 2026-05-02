/**
 * PostgREST caps responses at 1000 rows server-side, so a `.limit(N)` above
 * that is silently clamped. Use this helper to paginate via `.range()` until
 * the source is drained.
 *
 * Usage:
 *   const rows = await fetchAll((from, to) =>
 *     supabase.from("members").select("*").range(from, to)
 *   );
 *
 * The builder receives a [from, to] range and returns the awaited Supabase
 * query. We fetch 1000 at a time and stop on the first short page.
 */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}
