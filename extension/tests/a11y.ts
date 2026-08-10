import axe from "axe-core";
import { expect } from "vitest";

export async function expectNoA11yViolations(context: Element = document.body): Promise<void> {
  const results = await axe.run(context, {
    rules: {
      // jsdom has no layout or canvas implementation, so contrast results are not reliable here.
      "color-contrast": { enabled: false }
    }
  });

  const violations = results.violations.map(({ id, impact, help, nodes }) => ({
    id,
    impact,
    help,
    targets: nodes.map((node) => node.target)
  }));

  expect(violations).toEqual([]);
}
