import { describe, it, expect } from 'vitest';
import { calculateConnectorPath } from './connector';

describe('calculateConnectorPath', () => {
  it('should generate a curved path string', () => {
    const startX = 100;
    const startY = 100;
    const endX = 300;
    const endY = 200;

    const path = calculateConnectorPath(startX, startY, endX, endY);

    // Expect a Bezier curve (starts with M, contains C or Q)
    expect(path).toMatch(/^M/);
    expect(path).toContain('C'); // We want cubic bezier for org-chart feel
  });
});
