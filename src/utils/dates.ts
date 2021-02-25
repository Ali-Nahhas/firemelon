export function parseDate(raw: any): Date | null {
  if (!raw) {
    return null;
  }

  if (typeof raw === 'string') {
    return new Date(raw);
  }

  if (typeof raw === 'number') {
    return new Date(raw);
  }

  return raw.toDate?.();
}

export function isDateGreater(date: any, comparator: any) {
  const parsedDate = parseDate(date);
  const parsedCompartor = parseDate(comparator);
  if (parsedDate && parsedCompartor) {
    return parsedDate > parsedCompartor;
  }
  return false;
}
