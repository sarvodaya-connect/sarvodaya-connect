import type { MapPhase } from "./use-mapbox";

/** Loading text (never a bar) and the D02e error with "Try again", laid over a map. */
export function MapStatus({ phase, retry }: { phase: MapPhase; retry: () => void }) {
  if (phase === "loading")
    return (
      <p className="absolute inset-0 grid place-items-center text-[12px] text-muted" role="status">
        Loading the map…
      </p>
    );
  if (phase === "error")
    return (
      <div className="absolute inset-0 grid place-items-center bg-[#eef1ee] p-4 text-center" role="alert">
        <div>
          <p className="text-[13px] font-semibold text-ink">The map could not load</p>
          <p className="mt-1 text-[11px] text-muted">Check the connection and try again.</p>
          <button
            className="mt-3 rounded-button border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink hover:bg-brand-mint-soft"
            onClick={retry}
            type="button"
          >
            Try again
          </button>
        </div>
      </div>
    );
  return null;
}
