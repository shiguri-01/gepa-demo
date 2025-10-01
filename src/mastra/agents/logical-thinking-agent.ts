import { Agent } from "@mastra/core/agent";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { ollama } from "ollama-ai-provider-v2";

export const logicalThinkingAgent = new Agent({
  name: "Logical Thinking Agent",
  instructions: "",
  model: ollama("gemma3:1b"),
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:../mastra.db", // path is relative to the .mastra/output directory
    }),
  }),
});

export const initialSystemPrompt =
  "次の問題を解き、`思考プロセス`と`回答`を出力して下さい。";
