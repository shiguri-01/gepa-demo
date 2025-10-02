import { Agent } from "@mastra/core/agent";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { ollama } from "ollama-ai-provider-v2";

export const logicalThinkingAgent = new Agent({
  name: "Logical Thinking Agent",
  instructions: "",
  model: ollama("gemma3:4b"),
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:../mastra.db", // path is relative to the .mastra/output directory
    }),
  }),
});

export const initialSystemPrompt = "与えられた問題を解いてください";
