import type { Category } from './classify.ts';

export interface BadgeInput {
  kind: 'hospital' | 'pharmacy';
  category: Category;
  divName: string | null;
  specialty: string | null;
}

/** 카드의 주 배지 1개: 일반 진료는 진료과, 없으면 종별. 한의원·치과는 종별만. */
export function primaryBadge(i: BadgeInput): string {
  if (i.kind === 'pharmacy') return '약국';
  if (i.category === 'oriental') return '한의원';
  if (i.category === 'dental') return '치과';
  if (i.specialty) return i.specialty;
  const div = i.divName ?? '';
  if (div.includes('종합병원')) return '종합병원';
  if (div === '의원') return '의원';
  if (div) return div;
  return '병원';
}
