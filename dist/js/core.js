import { QUESTION_BANK, QUESTION_GROUPS } from "./questions.js";

export const TOTAL_QUESTIONS = 20;
export const QUESTION_SECONDS = 15;
export const MAX_POINTS_PER_QUESTION = 1000;

export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function buildQuiz(random = Math.random) {
  const selected = QUESTION_GROUPS.map((group) => {
    const candidates = QUESTION_BANK.filter((question) => question.group === group);
    return candidates[Math.floor(random() * candidates.length)];
  });

  return shuffle(selected, random).map((question) => ({
    ...question,
    options: shuffle(question.options, random)
  }));
}

export function calculatePoints(isCorrect, remainingSeconds) {
  if (!isCorrect) return 0;
  const safeRemaining = Math.max(0, Math.min(QUESTION_SECONDS, Number(remainingSeconds) || 0));
  return 500 + Math.round((safeRemaining / QUESTION_SECONDS) * 500);
}

export function percentage(correct, total = TOTAL_QUESTIONS) {
  return total ? Math.round((correct / total) * 100) : 0;
}

export function createRoomCode(random = Math.random) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(random() * alphabet.length)]).join("");
}
