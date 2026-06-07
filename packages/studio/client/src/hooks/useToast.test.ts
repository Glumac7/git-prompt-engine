// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from './useToast';

describe('useToast Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with null toast', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeNull();
  });

  it('should set toast when showToast is called', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test Message', 'info');
    });

    expect(result.current.toast).toEqual({
      message: 'Test Message',
      type: 'info'
    });
  });

  it('should clear toast after 4000ms timeout', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Autoclear Message', 'success');
    });

    expect(result.current.toast).not.toBeNull();

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(result.current.toast).toBeNull();
  });

  it('should clear existing timer and start a new one if a new toast is shown before the old one expires', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Toast 1', 'success');
    });

    // Advance halfway
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    act(() => {
      result.current.showToast('Toast 2', 'error');
    });

    expect(result.current.toast?.message).toBe('Toast 2');

    // Advance another 2500ms (total of 4500ms since Toast 1, but only 2500ms since Toast 2)
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    // Toast 2 should still be visible because its timer was reset to 4000ms
    expect(result.current.toast?.message).toBe('Toast 2');

    // Advance remaining 1500ms to clear Toast 2
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.toast).toBeNull();
  });
});
