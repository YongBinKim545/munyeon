'use client';

import { MessageSquare } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { FeedbackDialog } from './FeedbackDialog';

/** [개선의견](D49·D69): 모든 페이지 맨 아래, 푸터 바로 위. 창은 D49 그대로 */
export function FeedbackFooter() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className="feedback-footer">
      <button type="button" className="btn btn-secondary header-btn" onClick={() => setOpen(true)}>
        <MessageSquare aria-hidden="true" size={16} /> 개선의견
      </button>
      {open ? <FeedbackDialog target={{ type: 'opinion' }} path={pathname} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
