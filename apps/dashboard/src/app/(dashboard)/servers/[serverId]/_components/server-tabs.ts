import type { IconName } from "@repo/ui/icons";

export type ServerTab =
  | "overview"
  | "activity"
  | "migrations"
  | "components"
  | "github"
  | "security"
  | "networking"
  | "ports"
  | "terminal"
  | "ssh"
  | "runtimeApi"
  | "settings"
  | "workloads";
export interface ServerTabDef {
  key: ServerTab;
  icon: IconName;
  desktopOnly?: boolean;
  managedOrder?: number;
  managedParent?: ServerTab;
}

// Connected servers keep their existing sections. Managed servers prioritize
// everyday access and group inspection/automation under their owning section.
export const SERVER_TABS: ServerTabDef[] = [
  { key: "overview", icon: "grid", managedOrder: 0 },
  { key: "activity", icon: "history", managedOrder: 5 },
  { key: "migrations", icon: "migration" },
  { key: "components", icon: "server-settings", managedParent: "settings" },
  { key: "github", icon: "git-branch" },
  { key: "security", icon: "shield", managedParent: "networking" },
  { key: "networking", icon: "network", managedOrder: 3 },
  { key: "workloads", icon: "layers", managedOrder: 4 },
  { key: "ssh", icon: "key", managedOrder: 2 },
  { key: "runtimeApi", icon: "code", managedParent: "settings" },
  { key: "settings", icon: "sliders", managedOrder: 6 },
  { key: "ports", icon: "port-forwarding", desktopOnly: true },
  { key: "terminal", icon: "terminal", managedOrder: 1 },
];

/** Preserve existing deep links and never make a capability-hidden tab reachable. */
export function serverTabNavigation(visible: ServerTabDef[], active: ServerTab, managed: boolean) {
  if (!managed) return { primary: visible, selected: active, secondary: [] };
  const parent = (tab: ServerTabDef) =>
    tab.managedParent && visible.some((item) => item.key === tab.managedParent)
      ? tab.managedParent
      : tab.key;
  const selected = parent(visible.find((tab) => tab.key === active) ?? SERVER_TABS[0]!);
  return {
    selected,
    primary: visible
      .filter((tab) => parent(tab) === tab.key)
      .sort((a, b) => (a.managedOrder ?? 99) - (b.managedOrder ?? 99)),
    secondary: visible
      .filter((tab) => parent(tab) === selected)
      .sort((a, b) => Number(b.key === selected) - Number(a.key === selected)),
  };
}
