import type { Agent } from "@mastra/core/agent";
import { logger } from "../logger";
import { mutatePromptAgent } from "../mastra/agents/mutate-prompt-agent";
import {
  type Candidate,
  type CandidatePool,
  findParetoFront,
} from "./candidate";
import {
  evaluateTaskBatch,
  extractScoresFromReport,
  type Report,
} from "./eval";
import { getAverageScore, isDominated } from "./score";
import type { TaskItem } from "./task";

const initPool = async ({
  initialPrompt,
  agent,
  testTaskBatch,
  evaluationAgent,
}: {
  initialPrompt: string;
  agent: Agent;
  testTaskBatch: TaskItem[];
  evaluationAgent: Agent;
}): Promise<CandidatePool> => {
  const result = await evaluateTaskBatch({
    systemPrompt: initialPrompt,
    taskBatch: testTaskBatch,
    agent,
    evaluationAgent,
  });
  const scoreList = extractScoresFromReport(result);

  const initialCandidate: Candidate = {
    id: crypto.randomUUID(),
    prompt: initialPrompt,
    scores: scoreList,
    parentIds: [],
  };
  logger.info({ candidate: initialCandidate }, "Initial candidate");

  return [initialCandidate];
};
const pickCandidate = (pool: CandidatePool): Candidate => {
  if (pool.length === 0) {
    throw new Error("Candidate pool is empty");
  }
  const winners: Candidate[] = [];
  const numScore = pool[0].scores.length;

  // 各スコアで最も高い候補を収集
  // 複数のスコアがトップの候補がいる場合、重複して収集する（選ばれやすくする）
  for (let i = 0; i < numScore; i++) {
    const maxScore = Math.max(...pool.map((c) => c.scores[i]));
    const bestCandidates = pool.filter((c) => c.scores[i] === maxScore);
    winners.push(...bestCandidates);
  }

  // ランダムに1つ選ぶ
  const idx = Math.floor(Math.random() * winners.length);
  return winners[idx];
};

const bestCandidate = (pool: CandidatePool): Candidate => {
  if (pool.length === 0) {
    throw new Error("Candidate pool is empty");
  }

  // 全てのスコアの平均値が最も高い候補を選ぶ
  const averageScores = pool.map((c) => getAverageScore(c.scores));
  const maxAverageScore = Math.max(...averageScores);
  const bestCandidates = pool.find(
    (c) => getAverageScore(c.scores) === maxAverageScore,
  );

  if (!bestCandidates) {
    throw new Error("Best candidate not found");
  }
  return bestCandidates;
};

const mutatePrompt = async (feedbackReport: Report): Promise<string> => {
  const mutationAgent = mutatePromptAgent;
  const response = await mutationAgent.generateVNext(
    JSON.stringify(feedbackReport, null, 2),
  );
  return response?.text?.trim() ?? "";
};

/**
 * 候補のトレーニング評価結果をキャッシュから取得するか、新規に評価する
 */
const getOrEvaluateOnTrain = async ({
  candidate,
  trainTaskBatch,
  agent,
  evaluationAgent,
}: {
  candidate: Candidate;
  trainTaskBatch: TaskItem[];
  agent: Agent;
  evaluationAgent: Agent;
}): Promise<Report> => {
  if (candidate.trainReport) {
    return candidate.trainReport;
  }

  const report = await evaluateTaskBatch({
    systemPrompt: candidate.prompt,
    taskBatch: trainTaskBatch,
    agent,
    evaluationAgent,
  });

  // キャッシュに保存
  candidate.trainReport = report;
  return report;
};

export const gepaCycle = async ({
  candidatePool,
  budget,
  agent,
  trainTaskBatch,
  testTaskBatch,
  evaluationAgent,
}: {
  candidatePool: CandidatePool;
  budget: number;
  agent: Agent;
  trainTaskBatch: TaskItem[];
  testTaskBatch: TaskItem[];
  evaluationAgent: Agent;
}): Promise<{ candidatePool: CandidatePool; budget: number }> => {
  if (budget <= 0) {
    return { candidatePool, budget: 0 };
  }
  logger.info("Start cycle");
  logger.info({ budget }, "Remaining budget");

  const parent = pickCandidate(candidatePool);
  logger.debug({ parent }, "Selected parent candidate");

  const feedbackReport = await getOrEvaluateOnTrain({
    candidate: parent,
    trainTaskBatch,
    agent,
    evaluationAgent,
  });
  logger.debug({ feedbackReport }, "Created feedback from parent");

  const proposalPrompt = await mutatePrompt(feedbackReport);
  logger.info({ proposalPrompt }, "Generated proposal prompt");

  const proposalReport = await evaluateTaskBatch({
    systemPrompt: proposalPrompt,
    taskBatch: trainTaskBatch,
    agent,
    evaluationAgent,
  });

  const parentScores = extractScoresFromReport(feedbackReport);
  const proposalScores = extractScoresFromReport(proposalReport);
  logger.debug({ parentScores, proposalScores }, "Train evaluation results");
  if (isDominated({ baseline: parentScores, target: proposalScores })) {
    // 提案が支配されている場合は採用しない
    logger.info("Proposal dominated by parent on training batch");
    return { candidatePool, budget: budget - 1 };
  }

  const testReport = await evaluateTaskBatch({
    systemPrompt: proposalPrompt,
    taskBatch: testTaskBatch,
    agent,
    evaluationAgent,
  });
  const testScores = extractScoresFromReport(testReport);
  logger.debug(
    {
      parentScores: parent.scores,
      proposalScores: testScores,
    },
    "Test evaluation results",
  );

  if (isDominated({ baseline: parent.scores, target: testScores })) {
    // 提案が親に支配されている場合は採用しない
    logger.info("Proposal dominated by parent on test batch");
    return { candidatePool, budget: budget - 1 };
  }

  const newCandidate: Candidate = {
    id: crypto.randomUUID(),
    prompt: proposalPrompt,
    scores: testScores,
    parentIds: [parent.id],
    trainReport: proposalReport,
  };
  logger.info({ newCandidate }, "New candidate accepted");

  // 新しい候補を追加し、パレート最適な候補のみ残す
  const newPool = findParetoFront([...candidatePool, newCandidate]);
  return { candidatePool: newPool, budget: budget - 1 };
};

export const runGepa = async ({
  initialPrompt,
  budget,
  agent,
  trainTaskBatch,
  testTaskBatch,
  evaluationAgent,
}: {
  initialPrompt: string;
  budget: number;
  agent: Agent;
  trainTaskBatch: TaskItem[];
  testTaskBatch: TaskItem[];
  evaluationAgent: Agent;
}): Promise<Candidate> => {
  let candidatePool = await initPool({
    initialPrompt,
    agent,
    testTaskBatch,
    evaluationAgent,
  });
  let remainingBudget = budget;

  while (remainingBudget > 0) {
    const result = await gepaCycle({
      candidatePool,
      budget: remainingBudget,
      agent,
      trainTaskBatch,
      testTaskBatch,
      evaluationAgent,
    });
    candidatePool = result.candidatePool;
    remainingBudget = result.budget;

    const best = bestCandidate(candidatePool);
    logger.info({ candidatePool }, "Current candidate pool");
    logger.info({ best }, "Current best candidate");
  }

  const best = bestCandidate(candidatePool);
  return best;
};
