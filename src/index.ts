import { runGepa } from "./gepa/gepa";
import { splitTrainTest } from "./gepa/task";
import { logicalThinkingTask } from "./mastra/agents/logical-evaluation-agent";
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

console.info("Running GEPA...");

const result = await runGepa({
  initialPrompt: initialSystemPrompt,
  budget: 20,
  agent: logicalThinkingAgent,
  trainTaskBatch: train,
  testTaskBatch: test,
});

console.info("GEPA run completed:", result);
