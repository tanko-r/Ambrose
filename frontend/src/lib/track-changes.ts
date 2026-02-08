// =============================================================================
// Track Changes DOM Utilities
// Pure DOM manipulation for contentEditable track-changes editing.
// Ported from app/static/js/revision.js (lines 388-601, 861-880)
// =============================================================================

/**
 * Extract final text from edited content.
 * Keeps user additions and original insertions, removes all deletions.
 * Used to compute the "revised" text after user inline edits.
 */
export function extractFinalText(element: HTMLElement): string {
  let text = '';
  element.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      // Skip user-deletion spans (struck through by user)
      if (el.classList?.contains('user-deletion')) return;
      // Skip original AI deletions (diff-del)
      if (el.classList?.contains('diff-del')) return;
      // Include everything else (including user-addition spans and diff-ins)
      text += el.textContent;
    }
  });
  return text;
}

/**
 * Wrap a selected range as deleted (strikethrough, keeps text visible).
 * If the selection is entirely within a user-addition span, actually delete it
 * (since user-added text can be truly removed, not just struck through).
 */
export function wrapRangeAsDeleted(range: Range): void {
  const container = range.commonAncestorContainer;
  const parent =
    container.nodeType === Node.TEXT_NODE
      ? (container as Text).parentElement
      : (container as HTMLElement);

  // If selection is inside a user-addition span, actually delete it
  if (parent?.classList?.contains('user-addition')) {
    range.deleteContents();
    // Clean up empty spans
    if (parent.textContent === '') {
      parent.remove();
    }
    return;
  }

  // Extract and wrap as deleted
  const contents = range.extractContents();

  // Don't wrap if it's already empty
  if (!contents.textContent?.trim() && contents.childNodes.length === 0) {
    return;
  }

  const span = document.createElement('span');
  span.className = 'user-deletion';
  span.appendChild(contents);

  range.insertNode(span);

  // Move cursor after the deletion span
  const selection = window.getSelection();
  const newRange = document.createRange();
  newRange.setStartAfter(span);
  newRange.setEndAfter(span);
  selection?.removeAllRanges();
  selection?.addRange(newRange);
}

/**
 * Insert user-typed text with track-changes formatting (blue underline + yellow background).
 * If cursor is inside a user-addition span, splices text into the existing text node.
 * If the previous sibling is a user-addition span, appends to it.
 * Otherwise creates a new user-addition span.
 */
export function insertUserText(text: string): void {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;

  const range = selection.getRangeAt(0);
  const container = range.startContainer;

  // Check if cursor is inside a user-addition span — append to it
  if (
    container.nodeType === Node.TEXT_NODE &&
    (container as Text).parentElement?.classList?.contains('user-addition')
  ) {
    // Insert at cursor position within the span
    const textNode = container as Text;
    const offset = range.startOffset;
    const currentText = textNode.textContent || '';
    textNode.textContent =
      currentText.slice(0, offset) + text + currentText.slice(offset);

    // Move cursor after inserted text
    const newRange = document.createRange();
    newRange.setStart(textNode, offset + text.length);
    newRange.setEnd(textNode, offset + text.length);
    selection.removeAllRanges();
    selection.addRange(newRange);
  } else {
    // Check if previous sibling is a user-addition span
    const prevNode = getPreviousNode(range);
    if (
      prevNode &&
      (prevNode as HTMLElement).classList?.contains('user-addition')
    ) {
      // Append to existing user-addition span
      const additionSpan = prevNode as HTMLElement;
      additionSpan.textContent += text;
      const childText = additionSpan.firstChild as Text;
      const newRange = document.createRange();
      newRange.setStart(childText, childText.length);
      newRange.setEnd(childText, childText.length);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } else {
      // Create new user-addition span
      const span = document.createElement('span');
      span.className = 'user-addition';
      span.textContent = text;

      range.insertNode(span);

      // Move cursor to end of span
      const textChild = span.firstChild as Text;
      const newRange = document.createRange();
      newRange.setStart(textChild, textChild.length);
      newRange.setEnd(textChild, textChild.length);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  }
}

/**
 * Select the character before the cursor position.
 * Skips over user-deletion spans (they are already "deleted").
 * Used by backspace handler to select what to strike through.
 */
export function selectCharacterBefore(range: Range): void {
  const selection = window.getSelection();
  if (!selection) return;

  let node: Node | null = range.startContainer;
  let offset = range.startOffset;

  // Skip over user-deletion spans (they're already "deleted")
  while (node) {
    const parentEl: HTMLElement | null =
      node.nodeType === Node.TEXT_NODE
        ? (node as Text).parentElement
        : (node as HTMLElement);
    if (parentEl?.classList?.contains('user-deletion')) {
      // Move before this deletion span
      if (parentEl.previousSibling) {
        if (parentEl.previousSibling.nodeType === Node.TEXT_NODE) {
          node = parentEl.previousSibling;
          offset = (node as Text).length;
        } else {
          node = parentEl.previousSibling;
          offset = (node as Element).childNodes?.length || 0;
        }
      } else {
        // At start, nothing to delete
        return;
      }
    } else {
      break;
    }
  }

  if (!node) return;

  if (node.nodeType === Node.TEXT_NODE && offset > 0) {
    range.setStart(node, offset - 1);
    range.setEnd(node, offset);
    selection.removeAllRanges();
    selection.addRange(range);
  } else if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
    const prevNode = (node as Element).childNodes[offset - 1];
    if (prevNode) {
      range.selectNode(prevNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}

/**
 * Select the character after the cursor position.
 * Skips over user-deletion spans (they are already "deleted").
 * Used by delete key handler to select what to strike through.
 */
export function selectCharacterAfter(range: Range): void {
  const selection = window.getSelection();
  if (!selection) return;

  let node: Node | null = range.startContainer;
  let offset = range.startOffset;

  // Skip over user-deletion spans
  while (node) {
    const parentEl: HTMLElement | null =
      node.nodeType === Node.TEXT_NODE
        ? (node as Text).parentElement
        : (node as HTMLElement);
    if (parentEl?.classList?.contains('user-deletion')) {
      if (parentEl.nextSibling) {
        node = parentEl.nextSibling;
        offset = 0;
      } else {
        return;
      }
    } else {
      break;
    }
  }

  if (!node) return;

  if (node.nodeType === Node.TEXT_NODE && offset < (node as Text).length) {
    range.setStart(node, offset);
    range.setEnd(node, offset + 1);
    selection.removeAllRanges();
    selection.addRange(range);
  } else if (
    node.nodeType === Node.ELEMENT_NODE &&
    offset < (node as Element).childNodes.length
  ) {
    const nextNode = (node as Element).childNodes[offset];
    if (nextNode) {
      range.selectNode(nextNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}

/**
 * Get the previous node relative to a range position.
 * Used by insertUserText to check if the previous sibling is a user-addition span.
 */
export function getPreviousNode(range: Range): Node | null {
  const container = range.startContainer;
  const offset = range.startOffset;

  if (container.nodeType === Node.TEXT_NODE) {
    if (offset === 0 && container.previousSibling) {
      return container.previousSibling;
    }
  } else if (container.nodeType === Node.ELEMENT_NODE && offset > 0) {
    return (container as Element).childNodes[offset - 1];
  }
  return null;
}
