// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { baseDictionary } from "@/i18n";
import BuildSettings from "./BuildSettings";

const h = vi.hoisted(() => ({
  config: {} as Record<string, any>,
  updateConfig: vi.fn(),
  updateOptions: vi.fn(),
}));
vi.mock("@/context/DeploymentContext", () => ({ useOptionalDeployment: () => h }));
vi.mock("@/context/PlatformContext", () => ({ usePlatform: () => ({ baseDomain: "opsh.io" }) }));
vi.mock("@/components/i18n-provider", () => ({
  useI18n: () => ({ t: baseDictionary }),
  interpolate: (copy: string) => copy,
}));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  h.config = {
    framework: "laravel",
    buildImage: "php:8.4-cli",
    options: { hasBuild: true, hasServer: true },
    publicEndpoints: [],
  };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function choose(version: string) {
  await act(async () =>
    host.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!.click(),
  );
  const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
    (row) => row.textContent === `PHP ${version}`,
  );
  expect(option).toBeDefined();
  await act(async () => option!.click());
}
it("offers a matched builder selection in the existing PHP configuration", async () => {
  await act(async () => root.render(<BuildSettings />));
  expect(host.textContent).toContain("Default (8.4)");
  await choose("8.3");
  expect(h.updateConfig).toHaveBeenCalledWith({
    runtimeVersion: "8.3",
    buildImage: "php:8.3-cli-bookworm",
  });
});
it("shows why a custom builder cannot be used with another version", async () => {
  h.config.runtimeVersion = "8.3";
  h.config.buildImage = "php:8.3.30-cli-bookworm";
  await act(async () => root.render(<BuildSettings />));
  await choose("8.4");
  expect(h.updateConfig).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("uses PHP 8.3");
});
it("does not show PHP controls for other stacks", async () => {
  h.config.framework = "node";
  await act(async () => root.render(<BuildSettings />));
  expect(host.textContent).not.toContain(
    baseDictionary.importProject.buildSettings.runtimeVersionLabel,
  );
});

it("keeps Composer enabled when a new version is selected without an asset build", async () => {
  h.config.options = {
    hasBuild: false,
    hasServer: true,
    installCommand: "composer install",
    buildCommand: "",
  };
  await act(async () => root.render(<BuildSettings />));
  await choose("8.3");
  expect(h.updateConfig).toHaveBeenCalledWith({
    runtimeVersion: "8.3",
    buildImage: "php:8.3-cli-bookworm",
    options: { ...h.config.options, hasBuild: true },
  });
});

it("offers the runtime base override only for Docker source builds, and clears it explicitly", async () => {
  h.config.runtimeMode = "docker";
  h.config.runtimeImage = "custom/runtime:83";
  await act(async () => root.render(<BuildSettings />));
  expect(
    Array.from(host.querySelectorAll<HTMLInputElement>("input")).filter(
      (input) => input.value === "custom/runtime:83",
    ),
  ).toHaveLength(0);
  const advanced = Array.from(host.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(baseDictionary.importProject.buildSettings.advanced),
  );
  if (advanced) await act(async () => advanced.click());
  expect(
    Array.from(host.querySelectorAll<HTMLInputElement>("input")).filter(
      (input) => input.value === "custom/runtime:83",
    ),
  ).toHaveLength(1);
  const input = Array.from(host.querySelectorAll<HTMLInputElement>("input")).find(
    (input) => input.value === "custom/runtime:83",
  );
  expect(input).toBeDefined();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, "");
    input!.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(h.updateConfig).toHaveBeenCalledWith({ runtimeImage: null });
});

it("hides the runtime image field for a bare app without an override", async () => {
  h.config.runtimeMode = "bare";
  await act(async () => root.render(<BuildSettings />));
  const advanced = Array.from(host.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(baseDictionary.importProject.buildSettings.advanced),
  );
  expect(advanced).toBeDefined();
  await act(async () => advanced!.click());
  expect(host.textContent).not.toContain(
    baseDictionary.importProject.buildSettings.runtimeImageLabel,
  );
});
