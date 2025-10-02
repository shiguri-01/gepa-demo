import type { Report } from "./eval";
import { isDominated, type ScoreVector } from "./score";

export type Candidate = {
  id: string;
  prompt: string;
  scores: ScoreVector;
  parentIds: string[]; // どの候補から生成されたか
  trainReport?: Report; // トレーニングバッチでの評価結果（キャッシュ用）
};

export type CandidatePool = Candidate[];

/**
 * 厳密に支配されている候補を除去する
 */
export const findParetoFront = (candidates: CandidatePool): CandidatePool => {
  return candidates.filter((target, tIdx) => {
    const isDominantedByAny = candidates.some(
      (baseline, bIdx) =>
        bIdx !== tIdx && // 自分自身とは比較しない
        isDominated({ baseline: baseline.scores, target: target.scores }),
    );
    return !isDominantedByAny;
  });
};
