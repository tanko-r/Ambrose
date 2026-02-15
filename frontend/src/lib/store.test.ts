import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './store';
import { Flag } from './types';

describe('Store: Multi-Flag Support', () => {
  beforeEach(() => {
    useAppStore.getState().resetSession();
  });

  it('should support adding multiple flags to the same paragraph', () => {
    const flag1: Flag = {
      id: 'f1',
      para_id: 'p1',
      section_ref: '1.1',
      text_excerpt: 'text 1',
      note: 'note 1',
      flag_type: 'client',
      timestamp: new Date().toISOString()
    };
    const flag2: Flag = {
      id: 'f2',
      para_id: 'p1',
      section_ref: '1.1',
      text_excerpt: 'text 2',
      note: 'note 2',
      flag_type: 'attorney',
      timestamp: new Date().toISOString()
    };

    useAppStore.getState().addFlag(flag1);
    useAppStore.getState().addFlag(flag2);

    const state = useAppStore.getState();
    expect(state.flags).toHaveLength(2);
    expect(state.flags.filter(f => f.para_id === 'p1')).toHaveLength(2);
  });

  it('should support removing a specific flag by its unique ID', () => {
    const flag1: Flag = {
      id: 'f1',
      para_id: 'p1',
      section_ref: '1.1',
      text_excerpt: 'text 1',
      note: 'note 1',
      flag_type: 'client',
      timestamp: new Date().toISOString()
    };
    const flag2: Flag = {
      id: 'f2',
      para_id: 'p1',
      section_ref: '1.1',
      text_excerpt: 'text 2',
      note: 'note 2',
      flag_type: 'attorney',
      timestamp: new Date().toISOString()
    };

    useAppStore.getState().addFlag(flag1);
    useAppStore.getState().addFlag(flag2);

    // This should only remove flag1
    useAppStore.getState().removeFlag('f1');

    const state = useAppStore.getState();
    expect(state.flags).toHaveLength(1);
    expect(state.flags[0].id).toBe('f2');
  });
});
