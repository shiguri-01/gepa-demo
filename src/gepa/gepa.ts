import type { Agent } from "@mastra/core/agent";
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
}: {
  initialPrompt: string;
  agent: Agent;
  testTaskBatch: TaskItem[];
}): Promise<CandidatePool> => {
  const result = await evaluateTaskBatch({
    systemPrompt: initialPrompt,
    taskBatch: testTaskBatch,
    agent,
  });
  const scoreList = extractScoresFromReport(result);

  const initialCandidate: Candidate = {
    id: crypto.randomUUID(),
    prompt: initialPrompt,
    scores: scoreList,
    parentIds: [],
  };
  console.info("Initial candidate:", initialCandidate);

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

export const gepaCycle = async ({
  candidatePool,
  budget,
  agent,
  trainTaskBatch,
  testTaskBatch,
}: {
  candidatePool: CandidatePool;
  budget: number;
  agent: Agent;
  trainTaskBatch: TaskItem[];
  testTaskBatch: TaskItem[];
}): Promise<{ candidatePool: CandidatePool; budget: number }> => {
  if (budget <= 0) {
    return { candidatePool, budget: 0 };
  }
  console.info("Start cycle");
  console.info("Remaining budget:", budget);

  const parent = pickCandidate(candidatePool);
  console.debug("Selected parent candidate:", parent);

  const feedbackReport = await evaluateTaskBatch({
    systemPrompt: parent.prompt,
    taskBatch: trainTaskBatch,
    agent,
  });
  console.debug("Created feedback from parent:", feedbackReport);

  const proposalPrompt = await mutatePrompt(feedbackReport);
  console.info("Generated proposal prompt:", proposalPrompt);

  const proposalReport = await evaluateTaskBatch({
    systemPrompt: proposalPrompt,
    taskBatch: trainTaskBatch,
    agent,
  });

  const parentScores = extractScoresFromReport(feedbackReport);
  const proposalScores = extractScoresFromReport(proposalReport);
  console.debug("Train evaluation results:", { parentScores, proposalScores });
  if (isDominated({ baseline: parentScores, target: proposalScores })) {
    // 提案が支配されている場合は採用しない
    console.info("Proposal dominated by parent on training batch");
    return { candidatePool, budget: budget - 1 };
  }

  const testReport = await evaluateTaskBatch({
    systemPrompt: proposalPrompt,
    taskBatch: testTaskBatch,
    agent,
  });
  const testScores = extractScoresFromReport(testReport);
  console.debug("Test evaluation results:", {
    parentScores: parent.scores,
    proposalScores: testScores,
  });

  if (isDominated({ baseline: parent.scores, target: testScores })) {
    // 提案が親に支配されている場合は採用しない
    console.info("Proposal dominated by parent on test batch");
    return { candidatePool, budget: budget - 1 };
  }

  const newCandidate: Candidate = {
    id: crypto.randomUUID(),
    prompt: proposalPrompt,
    scores: testScores,
    parentIds: [parent.id],
  };
  console.info("New candidate accepted:", newCandidate);

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
}: {
  initialPrompt: string;
  budget: number;
  agent: Agent;
  trainTaskBatch: TaskItem[];
  testTaskBatch: TaskItem[];
}): Promise<Candidate> => {
  let candidatePool = await initPool({
    initialPrompt,
    agent,
    testTaskBatch,
  });
  let remainingBudget = budget;

  while (remainingBudget > 0) {
    const result = await gepaCycle({
      candidatePool,
      budget: remainingBudget,
      agent,
      trainTaskBatch,
      testTaskBatch,
    });
    candidatePool = result.candidatePool;
    remainingBudget = result.budget;

    const best = bestCandidate(candidatePool);
    console.info("Current best candidate:", best);
    console.info("Current number of candidates in pool:", candidatePool.length);
  }

  const best = bestCandidate(candidatePool);
  return best;
};
