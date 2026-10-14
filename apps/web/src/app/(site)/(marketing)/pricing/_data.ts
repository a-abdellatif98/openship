import { UI, paidLadder, type CloudPricing } from "@/lib/pricing";
import { cloudPlanHref } from "@/lib/cloud-links";

export interface FaqItem {
  q: string;
  a: string;
}

export function faq(pricing: CloudPricing): FaqItem[] {
  const ladder = paidLadder(pricing);

  return [
    {
      q: "How much does Openship Cloud cost?",
      a: [
        ladder
          ? `Plans are ${ladder}, ${UI.billedMonthly}.`
          : "See your dashboard for current Cloud plans and availability.",
        "Each subscription includes one managed server for your projects, with no per-seat fees. Choose a plan and deploy; Openship handles server setup.",
        pricing.customTiers.length > 0
          ? "Enterprise limits and pricing are agreed with sales."
          : null,
      ]
        .filter((text): text is string => text !== null)
        .join(" "),
    },
    {
      q: "What does a monthly server include?",
      a: "A monthly server covers its purchased CPU, RAM and disk for the entire paid period. Your apps and builds share those resources, with no second compute-credit allowance. Managed proxy transfer and backups are separate. Existing subscriptions keep their saved terms, shown in Billing.",
    },
    {
      q: "How is capacity shared?",
      a: "Your projects and builds share the managed server’s CPU, RAM and disk. Container limits do not allocate another machine or disk. Your dashboard shows actual usage separately from purchased capacity; add another subscribed server when you need a separate pool.",
    },
    {
      q: "Can I change or cancel my plan?",
      a: "Cancel renewal from Billing and keep access until the end of your paid period. Upgrades use the provider’s prorated price and apply after payment. Resource reductions and billing-mode changes start at renewal. Review the amount due, effective date and any server restarts before confirming. Retained disks can incur storage charges after coverage ends until they are deleted.",
    },
    {
      q: "Is self-hosting really free?",
      a: "Yes. Run the full Openship platform on your own servers, free under Apache 2.0, with no Openship subscription or per-seat fees. You pay your infrastructure provider directly.",
    },
    {
      q: "Can I move between Cloud and my own servers?",
      a: "Yes. Openship uses standard containers and supports migration between Cloud and your own infrastructure. Your apps are portable, so you can choose where they run as your needs change.",
    },
  ];
}

export const CLOUD_CTA_HREF = cloudPlanHref();
export const SELF_HOST_CTA_HREF = "/docs/getting-started/quickstart";
