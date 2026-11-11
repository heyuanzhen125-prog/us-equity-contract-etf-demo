// Adapted from Manifold Markets' CPMM math in common/src/calculate-cpmm.ts.
// Copyright (c) 2022 Manifold Markets, Inc. See THIRD_PARTY_NOTICES.md.
// This fee-free subset is used only to calculate simulated event probabilities.
const DEFAULT_P = 0.5

export function getCpmmProbability(pool, p = DEFAULT_P) {
  const { YES, NO } = pool
  return (p * NO) / ((1 - p) * YES + p * NO)
}

export function calculateCpmmShares(pool, p, betAmount, outcome) {
  if (betAmount === 0) return 0
  const { YES: yes, NO: no } = pool
  const invariant = yes ** p * no ** (1 - p)
  return outcome === 'YES'
    ? yes + betAmount - (invariant * (betAmount + no) ** (p - 1)) ** (1 / p)
    : no + betAmount - (invariant * (betAmount + yes) ** -p) ** (1 / (1 - p))
}

export function calculateCpmmPurchase(pool, p, betAmount, outcome) {
  const shares = calculateCpmmShares(pool, p, betAmount, outcome)
  const { YES: yes, NO: no } = pool
  // At p = 0.5 the invariant is YES × NO. This equivalent form avoids
  // subtracting nearly equal floating-point values as a pool gets thin.
  const nextPool = outcome === 'YES'
    ? { YES: (yes * no) / (no + betAmount), NO: no + betAmount }
    : { YES: yes + betAmount, NO: (yes * no) / (yes + betAmount) }
  if (!Number.isFinite(shares) || shares <= 0 || Object.values(nextPool).some(value => !Number.isFinite(value) || value <= 0)) {
    throw new Error('预测市场流动性不足，请减小虚拟积分投入')
  }
  return { shares, newPool: nextPool }
}
