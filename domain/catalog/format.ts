export function formatYear(y: number) {
  return y < 0 ? `${-y} BC` : `${y}`;
}
