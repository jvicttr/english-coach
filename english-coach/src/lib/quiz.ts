type QuizQuestion = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

type Quiz = {
  title: string;
  questions: QuizQuestion[];
};

/** Shuffle options of every question and remap the `correct` index. */
export function shuffleQuizOptions(quiz: Quiz): Quiz {
  return {
    ...quiz,
    questions: quiz.questions.map((q) => {
      const indexed = q.options.map((opt, i) => ({ opt, i }));
      // Fisher-Yates shuffle
      for (let j = indexed.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [indexed[j], indexed[k]] = [indexed[k], indexed[j]];
      }
      const newCorrect = indexed.findIndex((x) => x.i === q.correct);
      return { ...q, options: indexed.map((x) => x.opt), correct: newCorrect };
    }),
  };
}
