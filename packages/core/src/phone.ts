/** dutyTel1 → `tel:` 링크. 여러 번호·범위(~)가 있으면 첫 번호만 쓴다. */
export function toTelHref(raw: string): string | null {
  const first = (raw ?? '').split(/[~,/]/)[0] ?? '';
  const digits = first.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 12) return null;
  return `tel:${digits}`;
}
