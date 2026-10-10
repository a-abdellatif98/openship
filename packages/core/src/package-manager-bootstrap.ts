import { shellQuote } from "./shell-split";
import type { ManagedPackageManager } from "./package-manager-version";
import { PACKAGE_MANAGER_BOOTSTRAP_SOURCE } from "./package-manager-bootstrap.generated";

/** Bundle is generated from typed sources; build hosts need only Node or Bun. */
export function managedPackageManagerEnsureCommand(manager: ManagedPackageManager): string {
  const source = shellQuote(PACKAGE_MANAGER_BOOTSTRAP_SOURCE);
  const argument = shellQuote(manager);
  const runner =
    manager === "bun"
      ? `(if command -v node >/dev/null 2>&1; then node -e ${source} ${argument}; else bun -e ${source} ${argument}; fi)`
      : `node -e ${source} ${argument}`;
  return `export COREPACK_DEFAULT_TO_LATEST=0 COREPACK_ENABLE_AUTO_PIN=0 && ${runner}`;
}
