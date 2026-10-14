import { expect, it } from "vitest";
import { SERVER_TABS, serverTabNavigation } from "./server-tabs";

const managed = SERVER_TABS.filter((tab) => !["migrations", "github", "ports"].includes(tab.key));

it("keeps terminal and SSH visible first while preserving direct links to grouped tools", () => {
  const settings = serverTabNavigation(managed, "runtimeApi", true);
  expect(settings.primary.map((tab) => tab.key)).toEqual([
    "overview",
    "terminal",
    "ssh",
    "networking",
    "workloads",
    "activity",
    "settings",
  ]);
  expect(settings.selected).toBe("settings");
  expect(settings.secondary.map((tab) => tab.key)).toEqual([
    "settings",
    "components",
    "runtimeApi",
  ]);
  const network = serverTabNavigation(managed, "security", true);
  expect(network.selected).toBe("networking");
  expect(network.secondary.map((tab) => tab.key)).toEqual(["networking", "security"]);
});

it("respects capability filtering and preserves connected-server navigation", () => {
  const limited = managed.filter((tab) => ["overview", "activity", "components"].includes(tab.key));
  const result = serverTabNavigation(limited, "components", true);
  expect(result.primary.map((tab) => tab.key)).toEqual(["overview", "activity", "components"]);
  expect(result.selected).toBe("components");
  const connected = SERVER_TABS.filter((tab) =>
    ["overview", "components", "security", "terminal"].includes(tab.key),
  );
  expect(serverTabNavigation(connected, "security", false)).toEqual({
    primary: connected,
    secondary: [],
    selected: "security",
  });
});
