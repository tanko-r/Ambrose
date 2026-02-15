export function calculateConnectorPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): string {
  // Cubic Bezier curve for "org-chart like" curvature
  // We use horizontal control points to create a smooth 'S' curve
  const deltaX = Math.abs(endX - startX);
  const horizontalOffset = Math.max(deltaX * 0.5, 40);
  
  const cp1x = startX + horizontalOffset;
  const cp1y = startY;
  const cp2x = endX - horizontalOffset;
  const cp2y = endY;

  return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
}
