export type OptionKey = "A" | "B" | "C" | "D";
export type DifficultyLevel = "easy" | "moderate" | "hard";
export type DifficultyFilter = "all" | DifficultyLevel;

export interface TopicSummary {
  id: string;
  name: string;
  order: number;
  easy_count: number;
  moderate_count: number;
  hard_count: number;
  total_count: number;
}

export interface PracticeQuestion {
  id: string;
  question: string;
  options: Record<OptionKey, string>;
  difficulty: DifficultyLevel;
}

export interface AnswerReview {
  selected: OptionKey;
  is_correct: boolean;
  correct: OptionKey;
  explanation: string;
  option_notes: Partial<Record<OptionKey, string>>;
}