/** Presentation-only helpers shared by the model and the UI. No logic here. */

/** Format USD with cents under $100 and whole dollars above. */
export function money(value: number): string {
  if (!Number.isFinite(value)) return 'n/a';
  const rounded = Math.round(value * 100) / 100;
  return `$${rounded >= 100 ? rounded.toFixed(0) : rounded.toFixed(2)}`;
}

function decimalPlaces(value: number): number {
  const text = String(value);
  return text.includes('.') ? text.length - text.indexOf('.') - 1 : 0;
}

/** Round to a fixed step without serializing binary floating-point noise. */
export function roundTo(value: number, step: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value;
  const places = Math.min(12, decimalPlaces(step));
  return Number((Math.round(value / step) * step).toFixed(places));
}
