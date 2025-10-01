import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { PinoLogger } from "@mastra/loggers";
import { logicalEvaluationAgent } from "./agents/logical-evaluation-agent";
import { logicalThinkingAgent } from "./agents/logical-thinking-agent";
import { mergePromptsAgent } from "./agents/merge-prompt-agent";
import { mutatePromptAgent } from "./agents/mutate-prompt-agent";

export const mastra = new Mastra({
  agents: {
    mutatePromptAgent,
    mergePromptsAgent,
    logicalEvaluationAgent,
    logicalThinkingAgent,
  },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});
