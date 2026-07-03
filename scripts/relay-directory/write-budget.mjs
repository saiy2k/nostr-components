// SPDX-License-Identifier: MIT

export function createFirestoreWriteBudget(limit) {
  const normalizedLimit = Number(limit || 0);
  if (!Number.isFinite(normalizedLimit) || normalizedLimit < 0) {
    throw new Error("Firestore write budget must be a non-negative number.");
  }

  return {
    limit: normalizedLimit,
    used: 0,
  };
}

export function estimateFirestoreWrites(writesOrCount) {
  if (Array.isArray(writesOrCount)) return writesOrCount.length;
  const count = Number(writesOrCount || 0);
  if (!Number.isFinite(count) || count < 0) {
    throw new Error("Estimated Firestore writes must be non-negative.");
  }
  return count;
}

export function remainingFirestoreWrites(budget, { reserve = 0 } = {}) {
  if (!budget || budget.limit === 0) return Infinity;
  return Math.max(0, budget.limit - budget.used - reserve);
}

export function canSpendFirestoreWrites(
  budget,
  writesOrCount,
  { reserve = 0 } = {},
) {
  return (
    estimateFirestoreWrites(writesOrCount) <=
    remainingFirestoreWrites(budget, { reserve })
  );
}

export function spendFirestoreWrites(budget, writesOrCount) {
  const count = estimateFirestoreWrites(writesOrCount);
  if (budget) budget.used += count;
  return count;
}
