/**
 * Convert rem to pixels
 * @param remValue - Value in rem units (can be string or number)
 * @returns Value in pixels
 */
export function remToPx(remValue: string | number): number {
  const rootFontSize =
    typeof window === "undefined"
      ? 16
      : parseFloat(window.getComputedStyle(document.documentElement).fontSize);

  return parseFloat(String(remValue)) * rootFontSize;
}
