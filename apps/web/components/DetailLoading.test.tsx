// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import HospitalLoading from '@/app/hospital/[id]/loading';
import PharmacyLoading from '@/app/pharmacy/[id]/loading';

afterEach(cleanup);

describe('detail loading', () => {
  test.each([['hospital', HospitalLoading], ['pharmacy', PharmacyLoading]])('%s shows a status line right away, no live status', (_, Loading) => {
    render(<Loading />);
    expect(screen.getByRole('status').textContent).toContain('정보를 불러오고 있어요');
    expect(document.body.textContent).not.toMatch(/영업 중|영업 종료|등록 기준/);
  });
});
