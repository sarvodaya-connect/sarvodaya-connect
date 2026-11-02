import { Icon } from "../icon";

/** V5 SP06–SP08 rule banner. */
export function ApprovalRuleNotice() {
  return (
    <p className="flex items-start gap-2.5 rounded-card border border-[#cfe2cf] bg-[#e8f2e6] px-4 py-2.5 text-[12px] text-ink-soft">
      <Icon className="mt-0.5 size-4 shrink-0 text-brand-forest" name="shield" />
      <span>
        Society Officers create activities. <strong className="text-ink">You choose the UN SDGs and approve them.</strong>{" "}
        Only approved activities count in the dashboards.
      </span>
    </p>
  );
}
