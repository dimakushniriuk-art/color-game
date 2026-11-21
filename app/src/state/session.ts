import type { Reward } from './rewards';

/** Result of the last completed drawing, shown on the completion screen. */
export const lastCompletion: { id: string | null; reward: Reward | null; levelBefore: number } = { id: null, reward: null, levelBefore: 1 };
