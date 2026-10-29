// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { FilterBar } from './FilterBar';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('FilterBar (D78)', () => {
  test('pharmacy: two buttons, no department select', () => {
    render(<FilterBar filter="pharmacy" onFilter={vi.fn()} />);
    const group = screen.getByRole('group', { name: '유형' });
    expect([...group.querySelectorAll('button')].map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([['병원', 'false'], ['약국', 'true']]);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  test('hospital: department select 전체 / 소아과 / 산부인과 / 응급실', () => {
    const onFilter = vi.fn();
    render(<FilterBar filter="hospital" onFilter={onFilter} />);
    const select = screen.getByRole('combobox', { name: '진료과' });
    expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['전체', '소아과', '산부인과', '응급실']);
    fireEvent.change(select, { target: { value: 'emergency' } });
    expect(onFilter).toHaveBeenCalledWith('emergency');
    fireEvent.click(screen.getByRole('button', { name: '약국' }));
    expect(onFilter).toHaveBeenLastCalledWith('pharmacy');
  });

  test('[병원] opens the last department (first time 전체)', () => {
    const onFilter = vi.fn();
    render(<FilterBar filter="pharmacy" onFilter={onFilter} />);
    fireEvent.click(screen.getByRole('button', { name: '병원' }));
    expect(onFilter).toHaveBeenLastCalledWith('hospital');
    localStorage.setItem('munyeon:dept', 'obgyn');
    fireEvent.click(screen.getByRole('button', { name: '병원' }));
    expect(onFilter).toHaveBeenLastCalledWith('obgyn');
    fireEvent.click(screen.getByRole('button', { name: '약국' }));
    expect(onFilter).toHaveBeenCalledTimes(2); // 이미 약국이면 아무 일도 없다
  });
});
