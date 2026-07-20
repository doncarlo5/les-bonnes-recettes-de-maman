type PaginationResult<T> = {
  page: T[];
  continueCursor: string;
  isDone: boolean;
};

export async function collectPaginated<T>(
  fetchPage: (cursor: string | null) => Promise<PaginationResult<T>>,
) {
  const items: T[] = [];
  let cursor: string | null = null;
  let isDone = false;

  while (!isDone) {
    const result = await fetchPage(cursor);
    items.push(...result.page);
    cursor = result.continueCursor;
    isDone = result.isDone;
  }

  return items;
}
