export const PER_PAGE_OPTIONS = [10, 15, 25, 50] as const;

export const DEFAULT_PER_PAGE = 15;

export function parsePerPage(value: string | undefined): number {
  const n = Number(value);
  return (PER_PAGE_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_PER_PAGE;
}
