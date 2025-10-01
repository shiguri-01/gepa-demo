export const sum = (numbers: readonly number[]): number => {
  return numbers.reduce((a, b) => a + b, 0);
};

export const average = (numbers: readonly number[]): number => {
  if (numbers.length === 0) return 0;
  return sum(numbers) / numbers.length;
};

export const shuffle = <T>(array: T[], seed?: number): T[] => {
  const shuffled = [...array];

  let random: () => number;
  if (seed !== undefined) {
    // 線形合同法
    let state = seed;
    random = () => {
      state = (state * 1664525 + 1013904223) % 2 ** 32;
      return state / 2 ** 32;
    };
  } else {
    random = Math.random;
  }

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};
