'use client';

import { PencilLine } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { Kind } from '@/lib/seo';
import { FeedbackDialog } from './FeedbackDialog';

/** 기관 상세의 [정보 수정 요청](D49). 누르면 틀린 항목을 고르는 창이 열린다. */
export function CorrectionButton({ kind, institutionId, name }: { kind: Kind; institutionId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname() ?? `/${kind}/${institutionId}`;
  return (
    <>
      <button type="button" className="btn btn-secondary correction-btn" onClick={() => setOpen(true)}>
        <PencilLine aria-hidden="true" size={16} /> 정보 수정 요청
      </button>
      {open ? <FeedbackDialog target={{ type: 'correction', kind, institutionId, name }} path={path} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
