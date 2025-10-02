import { runGepa } from "./gepa/gepa";
import { splitTrainTest } from "./gepa/task";
import { logger } from "./logger";
import {
  logicalEvaluationAgent,
  logicalThinkingTask,
} from "./mastra/agents/logical-evaluation-agent";
import {
  initialSystemPrompt,
  logicalThinkingAgent,
} from "./mastra/agents/logical-thinking-agent";

const task = logicalThinkingTask;
const { train, test } = splitTrainTest(task, {
  trainRatio: 0.25,
  shuffle: true,
  seed: 42,
});

logger.info("Running GEPA...");
logger.debug({ train, test }, "tasks");

const result = await runGepa({
  initialPrompt: initialSystemPrompt,
  budget: 20,
  agent: logicalThinkingAgent,
  trainTaskBatch: train,
  testTaskBatch: test,
  evaluationAgent: logicalEvaluationAgent,
});

logger.info({ result }, "GEPA run completed");
