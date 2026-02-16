export function calculateConnectorPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): string {
  const deltaX = endX - startX;
  const deltaY = Math.abs(endY - startY);

  // Minimum escape distance from text before curving
  const escapeX = Math.min(30, deltaX * 0.3);

  if (deltaY < 40) {
    // Nearly horizontal — add a subtle arc to avoid flat line through text
    const midX = startX + deltaX / 2;
    const arcY = startY - 25; // arc above
    return `M ${startX} ${startY} Q ${midX} ${arcY}, ${endX} ${endY}`;
  }

  // Standard S-curve for vertical displacement
  const horizontalOffset = Math.max(deltaX * 0.5, 40);
  const cp1x = startX + horizontalOffset;
  const cp1y = startY;
  const cp2x = endX - horizontalOffset;
  const cp2y = endY;
  return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
}
