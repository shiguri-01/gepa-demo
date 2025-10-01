import { average } from "../utils";

export type ScoreVector = readonly number[];

/**
 * 厳密に支配されている（すべてのスコアが劣っている）か否か
 */
export const isDominated = ({
  baseline,
  target,
}: {
  baseline: ScoreVector;
  target: ScoreVector;
}) => {
  if (baseline.length !== target.length) {
    throw new Error(
      `isDominated: score length mismatch (${baseline.length} vs ${target.length})`,
    );
  }

  return !target.some((value, i) => value > baseline[i]);
};

/**
 * スコアの平均を計算する
 */
export const getAverageScore = (scoreVector: ScoreVector): number => {
  return average(scoreVector);
};

/**
 * 代表のスコアを計算する（各指標の平均）
 */
export const aggregateScores = (scoreMatrix: ScoreVector[]): ScoreVector => {
  if (scoreMatrix.length === 0) {
    return [];
  }

  const length = scoreMatrix[0].length;
  if (!scoreMatrix.every((vec) => vec.length === length)) {
    throw new Error(`aggregateScores: all entries must have length ${length}`);
  }

  const aggregated: number[] = new Array(length)
    .fill(0)
    .map((_, i) => average(scoreMatrix.map((vec) => vec[i])));
  return aggregated;
};
