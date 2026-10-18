import { primaryBadge, type Category } from '@munyeon/core';

interface Props {
  kind: 'hospital' | 'pharmacy';
  category: Category;
  divName: string | null;
  specialty: string | null;
  pediatricName: boolean;
}

/** 주 진료과(또는 종별) 배지 1개 + 소아 전문 배지(D26) */
export function Badges({ kind, category, divName, specialty, pediatricName }: Props) {
  return (
    <span className="badges">
      <span className="badge">{primaryBadge({ kind, category, divName, specialty })}</span>
      {kind === 'hospital' && category === 'general' && pediatricName ? <span className="badge">소아 전문</span> : null}
    </span>
  );
}
