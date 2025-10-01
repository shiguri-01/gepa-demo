import { shuffle } from "../utils";

export interface TaskItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  explanation: string;
}

export interface SplitOptions {
  trainRatio?: number;
  shuffle?: boolean;
  seed?: number;
}

export const splitTrainTest = (
  tasks: TaskItem[],
  options: SplitOptions = {},
): { train: TaskItem[]; test: TaskItem[] } => {
  if (tasks.length === 0) {
    return { train: [], test: [] };
  }

  const { trainRatio = 0.2, shuffle: shouldShuffle = true } = options;

  if (trainRatio < 0 || trainRatio > 1) {
    throw new Error("Train ratio must be between 0 and 1");
  }

  let items = [...tasks];
  if (shouldShuffle) {
    items = shuffle(items, options.seed);
  }

  const trainSize = Math.round(items.length * trainRatio);
  const trainItems = items.slice(0, trainSize);
  const testItems = items.slice(trainSize);

  return {
    train: trainItems,
    test: testItems,
  };
};
