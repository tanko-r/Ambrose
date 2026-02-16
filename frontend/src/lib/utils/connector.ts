/**
 * Rounded-elbow connector: horizontal out from highlight,
 * rounded 90° turn, vertical to bubble Y, rounded 90° turn,
 * horizontal into bubble.
 */
export function calculateConnectorPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): string {
  const r = 6; // corner radius
  const midX = startX + (endX - startX) * 0.4; // elbow X position

  // Straight across if nearly same Y
  if (Math.abs(endY - startY) < r * 2) {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }

  const goingDown = endY > startY;
  const sweepFirst = goingDown ? 1 : 0; // clockwise when going down
  const sweepSecond = goingDown ? 0 : 1;

  // Path: horizontal → rounded corner → vertical → rounded corner → horizontal
  return [
    `M ${startX} ${startY}`,
    // horizontal leg to just before first corner
    `L ${midX - r} ${startY}`,
    // first rounded corner (turn down/up)
    `A ${r} ${r} 0 0 ${sweepFirst} ${midX} ${startY + (goingDown ? r : -r)}`,
    // vertical leg to just before second corner
    `L ${midX} ${endY + (goingDown ? -r : r)}`,
    // second rounded corner (turn toward bubble)
    `A ${r} ${r} 0 0 ${sweepSecond} ${midX + r} ${endY}`,
    // horizontal leg to bubble
    `L ${endX} ${endY}`,
  ].join(' ');
}
