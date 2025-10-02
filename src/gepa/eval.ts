import type { Agent } from "@mastra/core/agent";
import z from "zod";
import { logger } from "@/logger";
import type { ScoreVector } from "./score";
import type { TaskItem } from "./task";

export const evaluationSchema = z.object({
  score: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "システムプロンプト内の【評価基準】に従って決定した0.0から1.0までのスコア",
    ),
  feedback: z
    .string()
    .describe(
      "スコアの根拠となる具体的かつ建設的なフィードバック。AIの解答の良い点、具体的な誤りの箇所、そしてその修正案を簡潔に記述する。",
    ),
});

const generateEvaluationPrompt = (taskItem: TaskItem, answer: string) =>
  `
### question:
${taskItem.question}

### expectedAnswer:
${taskItem.answer}

### questionExplanation:
${taskItem.explanation}

### aiAnswer:
\`\`\`\`
${answer}
\`\`\`\`
    `.trim();

export type EvaluationItem = z.infer<typeof evaluationSchema>;

export type ReportItem = {
  task: TaskItem;
  aiResponse: {
    text: string;
  };
  eval: EvaluationItem;
};

export type Report = {
  systemPrompt: string;
  taskResults: ReportItem[];
};

const evaluateTaskItem = async ({
  systemPrompt,
  taskItem,
  agent,
  evaluationAgent,
}: {
  systemPrompt: string;
  taskItem: TaskItem;
  agent: Agent;
  evaluationAgent: Agent;
}): Promise<ReportItem> => {
  const answerRes = await agent.generateVNext(taskItem.question, {
    instructions: systemPrompt,
  });
  const answer = answerRes?.text?.trim() ?? "";

  const evaluationRes = await evaluationAgent.generateVNext(
    generateEvaluationPrompt(taskItem, answer),
    {
      output: evaluationSchema,
    },
  );
  const evaluation: EvaluationItem = evaluationRes?.object ?? {
    score: 0,
    feedback: "評価中にエラーが発生しました。",
  };

  return {
    task: taskItem,
    aiResponse: {
      text: answer,
    },
    eval: evaluation,
  } as const;
};

/**
 * タスクのバッチを評価し、レポートを生成する
 */
export const evaluateTaskBatch = async ({
  systemPrompt,
  taskBatch,
  agent,
  evaluationAgent,
}: {
  systemPrompt: string;
  taskBatch: TaskItem[];
  agent: Agent;
  evaluationAgent: Agent;
}): Promise<Report> => {
  // Ollamaがタイムアウトしたり、APIのレートリミットに引っかかったりするため、逐次処理とする
  const results: ReportItem[] = [];
  for (const [i, item] of taskBatch.entries()) {
    logger.info(`Evaluating task ${i + 1} / ${taskBatch.length}`);

    const result = await evaluateTaskItem({
      systemPrompt,
      taskItem: item,
      agent,
      evaluationAgent,
    });
    results.push(result);
  }
  return { systemPrompt, taskResults: results };
};

export const extractScoresFromReport = (report: Report): ScoreVector => {
  return report.taskResults.map((item) => item.eval.score);
};
