// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { StickyCall } from './StickyCall';

vi.mock('@/lib/track', () => ({ track: () => {} }));

let fire: (e: Partial<IntersectionObserverEntry>) => void = () => {};
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IntersectionObserverCallback) {
        fire = (e) => cb([e as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const page = () => (
  <main>
    <div className="actions detail-call">위쪽 전화</div>
    <StickyCall tel="02-777-0000" institutionId="C1" />
  </main>
);
const sticky = () => document.querySelector('.sticky-call') as HTMLElement;

describe('StickyCall (D52)', () => {
  test('hidden while the top call button is on screen', () => {
    render(page());
    expect(sticky().hidden).toBe(true);
    act(() => fire({ isIntersecting: true, boundingClientRect: { top: 200 } as DOMRect }));
    expect(sticky().hidden).toBe(true);
  });

  test('appears once the top call button scrolls up out of view, and hides again when it comes back', () => {
    render(page());
    act(() => fire({ isIntersecting: false, boundingClientRect: { top: -40 } as DOMRect }));
    expect(sticky().hidden).toBe(false);
    act(() => fire({ isIntersecting: true, boundingClientRect: { top: 120 } as DOMRect }));
    expect(sticky().hidden).toBe(true);
  });
});
