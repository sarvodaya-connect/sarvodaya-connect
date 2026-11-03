/** V5 ST01: a loading line, never a progress bar. */
export default function DisasterResponseLoading() {
  return (
    <div className="rounded-card border border-line bg-surface p-8 text-[12.5px] text-ink-soft" role="status">
      Loading disaster response…
    </div>
  );
}
