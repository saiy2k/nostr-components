// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";
import {
  canSpendFirestoreWrites,
  createFirestoreWriteBudget,
  remainingFirestoreWrites,
  spendFirestoreWrites,
} from "./write-budget.mjs";

describe("Firestore write budget", () => {
  it("reserves one write for an emergency cursor checkpoint", () => {
    const budget = createFirestoreWriteBudget(10);
    spendFirestoreWrites(budget, 8);

    expect(remainingFirestoreWrites(budget, { reserve: 1 })).toBe(1);
    expect(canSpendFirestoreWrites(budget, 2, { reserve: 1 })).toBe(false);
    expect(canSpendFirestoreWrites(budget, 1, { reserve: 1 })).toBe(true);
  });

  it("treats a zero limit as explicitly unlimited", () => {
    const budget = createFirestoreWriteBudget(0);
    expect(remainingFirestoreWrites(budget)).toBe(Infinity);
    expect(canSpendFirestoreWrites(budget, 100000)).toBe(true);
  });
});
