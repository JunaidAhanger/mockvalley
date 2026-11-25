import { useEffect, useState } from "react";
import { QuestionPaletteSheet } from "../components/QuestionPaletteSheet";
import {
  checkIsPaid,
  fetchQuestionById,
  fetchQuestionIds,
  fetchTopics,
  submitPracticeAnswer,
} from "../lib/practiceApi";
import type {
  AnswerReview,
  DifficultyFilter,
  OptionKey,
  PracticeQuestion,
  TopicSummary,
} from "../lib/types";

const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];

const DIFFICULTY_FILTERS: Array<{ id: DifficultyFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "easy", label: "Easy" },
  { id: "moderate", label: "Moderate" },
  { id: "hard", label: "Hard" },
];

export function PracticePage() {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [isPaid, setIsPaid] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [topicsError, setTopicsError] = useState<string | null>(null);

  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [showUpgradeNote, setShowUpgradeNote] = useState(false);

  // Session state for the chosen topic + difficulty
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionCache, setQuestionCache] = useState<Record<string, PracticeQuestion>>({});
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);

  const [answersById, setAnswersById] = useState<Record<string, AnswerReview>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // 1. Load active topics and caller pass status on mount
  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      setLoadingTopics(true);
      setTopicsError(null);
      try {
        const [paidStatus, topicList] = await Promise.all([checkIsPaid(), fetchTopics()]);
        if (cancelled) return;
        setIsPaid(paidStatus);
        setTopics(topicList);
        if (topicList.length > 0) {
          // Default to first topic that has questions if available, else first active topic
          const firstWithQuestions = topicList.find((t) => t.total_count > 0) ?? topicList[0];
          setSelectedTopicId(firstWithQuestions.id);
        }
      } catch (err) {
        if (!cancelled) {
          setTopicsError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoadingTopics(false);
        }
      }
    }

    loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTopic = topics.find((t) => t.id === selectedTopicId) ?? null;

  // Helper to check if a difficulty filter has 0 free questions for an unpaid user
  const isFilterLocked = (filterId: DifficultyFilter): boolean => {
    if (isPaid || !selectedTopic || filterId === "all") return false;
    if (filterId === "easy") return selectedTopic.easy_count === 0;
    if (filterId === "moderate") return selectedTopic.moderate_count === 0;
    return selectedTopic.hard_count === 0;
  };

  // 2. Whenever topic or difficulty changes, rebuild the ordered question list and reset palette index
  useEffect(() => {
    if (!selectedTopicId) return;

    if (isFilterLocked(difficulty)) {
      setQuestionIds([]);
      setCurrentIndex(0);
      setListError(null);
      setShowUpgradeNote(true);
      return;
    }

    let cancelled = false;
    setShowUpgradeNote(false);
    setLoadingList(true);
    setListError(null);
    setQuestionIds([]);
    setCurrentIndex(0);
    setSubmitError(null);

    fetchQuestionIds(selectedTopicId, difficulty)
      .then((ids) => {
        if (!cancelled) {
          setQuestionIds(ids);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setListError((err as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingList(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTopicId, difficulty, isPaid]);

  const currentQuestionId = questionIds[currentIndex] ?? null;
  const currentQuestion = currentQuestionId ? questionCache[currentQuestionId] ?? null : null;
  const currentReview = currentQuestionId ? answersById[currentQuestionId] ?? null : null;

  // 3. Fetch the active question's safe text/options/difficulty when currentQuestionId changes
  useEffect(() => {
    if (!currentQuestionId || questionCache[currentQuestionId]) {
      setQuestionError(null);
      return;
    }

    let cancelled = false;
    setLoadingQuestion(true);
    setQuestionError(null);

    fetchQuestionById(currentQuestionId)
      .then((q) => {
        if (!cancelled) {
          setQuestionCache((prev) => ({ ...prev, [q.id]: q }));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setQuestionError((err as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingQuestion(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentQuestionId, questionCache]);

  const handleSelectTopic = (newTopicId: string) => {
    setSelectedTopicId(newTopicId);
    setDifficulty("all");
    setShowUpgradeNote(false);
  };

  const handleSelectDifficulty = (filterId: DifficultyFilter) => {
    setDifficulty(filterId);
    if (isFilterLocked(filterId)) {
      setShowUpgradeNote(true);
    } else {
      setShowUpgradeNote(false);
    }
  };

  const handleChooseOption = async (optionKey: OptionKey) => {
    if (!currentQuestionId || currentReview || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const review = await submitPracticeAnswer(currentQuestionId, optionKey);
      setAnswersById((prev) => ({
        ...prev,
        [currentQuestionId]: review,
      }));
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const getOptionNote = (optKey: OptionKey): string => {
    if (!currentReview) return "";
    if (optKey === currentReview.correct) {
      return `Correct answer. ${currentReview.explanation}`;
    }
    return currentReview.option_notes?.[optKey] || "Incorrect option.";
  };

  if (loadingTopics) {
    return (
      <main className="page-container">
        <div className="state-card" role="status">
          Loading syllabus topics...
        </div>
      </main>
    );
  }

  if (topicsError) {
    return (
      <main className="page-container">
        <div className="error-card" role="alert">
          <strong>Could not load topics</strong>
          <p>{topicsError}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-container">
      <section className="controls-card" aria-label="Topic and difficulty selection">
        <label htmlFor="topic-select" className="field-label">
          Practice by Topic
        </label>
        <select
          id="topic-select"
          className="topic-select"
          value={selectedTopicId}
          onChange={(e) => handleSelectTopic(e.target.value)}
        >
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.name} ({topic.total_count})
            </option>
          ))}
        </select>

        <div className="segmented-group" role="group" aria-label="Difficulty filter">
          {DIFFICULTY_FILTERS.map((item) => {
            const locked = isFilterLocked(item.id);
            const isSelected = difficulty === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`segment-btn ${isSelected ? "is-selected" : ""} ${
                  locked ? "is-locked" : ""
                }`}
                onClick={() => handleSelectDifficulty(item.id)}
                aria-pressed={isSelected}
              >
                <span>{item.label}</span>
                {locked && (
                  <span className="lock-tag" aria-label="Locked">
                    🔒
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {showUpgradeNote && (
          <div className="upgrade-card" role="region" aria-label="Upgrade prompt">
            <p className="upgrade-title">🔒 Paid Pass Required for This Level</p>
            <p className="upgrade-desc">
              Free preview has no questions at the <strong>{difficulty}</strong> level for this
              topic. Upgrade to the 3-month All-Access Pass in the next update to unlock every
              difficulty, Current Affairs, and Exam Mode.
            </p>
          </div>
        )}
      </section>

      {!showUpgradeNote && loadingList && (
        <div className="state-card" role="status">
          Building question set...
        </div>
      )}

      {!showUpgradeNote && listError && (
        <div className="error-card" role="alert">
          <strong>Could not load questions</strong>
          <p>{listError}</p>
        </div>
      )}

      {!showUpgradeNote && !loadingList && !listError && questionIds.length === 0 && (
        <div className="state-card">
          <strong>No questions available here yet</strong>
          <p>
            There are no active {isPaid ? "" : "free "}questions in this topic for the selected
            filter. Try another difficulty or pick another topic above.
          </p>
        </div>
      )}

      {!showUpgradeNote && !loadingList && questionIds.length > 0 && (
        <>
          <div className="progress-bar-row">
            <span className="progress-text">
              Question <strong>{currentIndex + 1}</strong> of <strong>{questionIds.length}</strong>
            </span>
            <button
              type="button"
              className="palette-trigger-btn"
              onClick={() => setPaletteOpen(true)}
            >
              Palette ({Object.keys(answersById).filter((id) => questionIds.includes(id)).length}/
              {questionIds.length})
            </button>
          </div>

          {loadingQuestion && (
            <div className="state-card" role="status">
              Loading question...
            </div>
          )}

          {questionError && (
            <div className="error-card" role="alert">
              <strong>Could not open question</strong>
              <p>{questionError}</p>
            </div>
          )}

          {!loadingQuestion && currentQuestion && (
            <article className="question-card">
              <div className="question-meta">
                <span className={`diff-badge diff-${currentQuestion.difficulty}`}>
                  {currentQuestion.difficulty}
                </span>
                <span className="qid-label">{currentQuestion.id}</span>
              </div>

              <p className="question-text">{currentQuestion.question}</p>

              <div className="options-list" role="radiogroup" aria-label="Answer options">
                {OPTION_KEYS.map((key) => {
                  const isAnswered = Boolean(currentReview);
                  const isChosen = currentReview?.selected === key;
                  const isCorrectOption = currentReview?.correct === key;

                  let stateClass = "";
                  if (isAnswered) {
                    if (isCorrectOption) stateClass = "is-correct";
                    else if (isChosen) stateClass = "is-wrong";
                  }

                  return (
                    <div key={key} className={`option-block ${stateClass}`}>
                      <button
                        type="button"
                        className="option-btn"
                        disabled={isAnswered || submitting}
                        onClick={() => handleChooseOption(key)}
                      >
                        <span className="option-letter">{key}</span>
                        <span className="option-text">{currentQuestion.options[key]}</span>
                      </button>

                      {isAnswered && (
                        <p className="option-note">
                          <strong>{isCorrectOption ? "Why it's right:" : "Why it's wrong:"}</strong>{" "}
                          {getOptionNote(key)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {submitting && (
                <p className="submitting-note" role="status">
                  Checking answer...
                </p>
              )}

              {submitError && (
                <div className="error-card" role="alert">
                  <p>{submitError}</p>
                </div>
              )}

              {currentReview && (
                <div
                  className={`feedback-banner ${
                    currentReview.is_correct ? "is-correct" : "is-wrong"
                  }`}
                  role="status"
                >
                  <p className="feedback-heading">
                    {currentReview.is_correct
                      ? `Correct! Answer: ${currentReview.correct}`
                      : `Wrong — Correct Answer: ${currentReview.correct}`}
                  </p>
                  <p className="feedback-explanation">{currentReview.explanation}</p>
                </div>
              )}
            </article>
          )}

          <div className="nav-actions-row">
            <button
              type="button"
              className="step-btn"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="step-btn primary-step"
              disabled={currentIndex >= questionIds.length - 1}
              onClick={() =>
                setCurrentIndex((prev) => Math.min(questionIds.length - 1, prev + 1))
              }
            >
              Next →
            </button>
          </div>
        </>
      )}

      <QuestionPaletteSheet
        isOpen={paletteOpen}
        questionIds={questionIds}
        currentIndex={currentIndex}
        answersById={answersById}
        onSelectIndex={setCurrentIndex}
        onClose={() => setPaletteOpen(false)}
      />
    </main>
  );
}