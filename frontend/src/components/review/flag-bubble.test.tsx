import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FlagBubble } from './flag-bubble';
import { useFlags } from '@/hooks/use-flags';
import React from 'react';

// Mock the useFlags hook
vi.mock('@/hooks/use-flags', () => ({
  useFlags: vi.fn(),
}));

// Mock createPortal to just render children
vi.mock('react-dom', () => ({
  createPortal: (children: any) => children,
}));

describe('FlagBubble: Auto-Save and Delete', () => {
  const mockCreate = vi.fn();
  const mockUpdate = vi.fn();
  const mockRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useFlags as any).mockReturnValue({
      create: mockCreate,
      update: mockUpdate,
      remove: mockRemove,
    });
  });

  it('should auto-save (create) when note is typed for a new flag', async () => {
    render(
      <FlagBubble
        paraId="p1"
        textExcerpt="some text"
        anchorRect={{ top: 100, right: 100 }}
        onClose={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/Note for client/i);
    fireEvent.change(textarea, { target: { value: 'auto-save note' } });

    // Wait for debounce (assuming 500ms)
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        'p1',
        'client',
        'for-discussion',
        'auto-save note',
        'some text'
      );
    }, { timeout: 2000 });
  });

  it('should auto-save (update) when note is typed for an existing flag', async () => {
    const initialFlag = {
      id: 'f1',
      para_id: 'p1',
      section_ref: '1.1',
      text_excerpt: 'some text',
      note: 'initial note',
      flag_type: 'client' as const,
      category: 'for-discussion' as const,
      timestamp: new Date().toISOString(),
    };

    render(
      <FlagBubble
        paraId="p1"
        textExcerpt="some text"
        anchorRect={{ top: 100, right: 100 }}
        onClose={vi.fn()}
        initialFlag={initialFlag}
      />
    );

    const textarea = screen.getByPlaceholderText(/Note for client/i);
    fireEvent.change(textarea, { target: { value: 'updated note' } });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        'f1',
        expect.objectContaining({ note: 'updated note' })
      );
    }, { timeout: 2000 });
  });

  it('should call remove when trash icon is clicked', () => {
    const initialFlag = {
      id: 'f1',
      para_id: 'p1',
      section_ref: '1.1',
      text_excerpt: 'some text',
      note: 'note',
      flag_type: 'client' as const,
      category: 'for-discussion' as const,
      timestamp: new Date().toISOString(),
    };

    render(
      <FlagBubble
        paraId="p1"
        textExcerpt="some text"
        anchorRect={{ top: 100, right: 100 }}
        onClose={vi.fn()}
        initialFlag={initialFlag}
      />
    );

    const trashButton = screen.getByTitle(/Remove flag/i);
    fireEvent.click(trashButton);

    expect(mockRemove).toHaveBeenCalledWith('f1');
  });
});
