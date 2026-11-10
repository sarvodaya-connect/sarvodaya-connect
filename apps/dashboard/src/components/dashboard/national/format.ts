/** Plain helpers, safe to call from server and client code alike. */
export const count = (value: number) => value.toLocaleString("en-GB");

/** "LKR 312.4 m" for totals of a million or more, "LKR 412,500" below. */
export function lkrShort(value: string | number | null, notAdded = "Not added") {
  if (value === null) return notAdded;
  const amount = Number(value);
  if (Math.abs(amount) >= 1_000_000) return `LKR ${(amount / 1_000_000).toLocaleString("en-GB", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} m`;
  return `LKR ${amount.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export function share(part: number, whole: number) {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

export const GRADE_STYLE = {
  A: { colour: "#3f7d4f", text: "text-[#2f6b3e]" },
  B: { colour: "#e1b84a", text: "text-[#8a6100]" },
  C: { colour: "#de7c3a", text: "text-[#a2470f]" },
} as const;

export function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
