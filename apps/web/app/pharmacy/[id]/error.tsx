'use client';

import { DetailError } from '@/components/DetailError';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <DetailError reset={reset} />;
}
