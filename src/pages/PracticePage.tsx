import { useCallback, useEffect, useState } from "react";
import { QuestionPaletteSheet } from "../components/QuestionPaletteSheet";
import {
  checkIsPaid,
  fetchQuestionById,
  fetchQuestionIds,
  fetchTopics,
  submitPracticeAnswer,
} from "../lib/practiceApi";
import {
  QuotaReachedError,
  type AnswerReview,
  type DifficultyFilter,
  type OptionKey,
  type PracticeQuestion,
  type TopicSummary,
} from "../lib/types";

interface PracticePageProps {
  onOpenUpgrade: () => void;
}

const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];

const DIFFICULTY_FILTERS: Array<{ id: DifficultyFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "easy", label: "Easy" },
  { id: "moderate", label: "Moderate" },
  { id: "hard", label: "Hard" },
];

export function PracticePage({ onOpenUpgrade }: PracticePageProps) {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [isPaid, setIsPaid] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [topicsError, setTopicsError] = useState<string | null>(null);

  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [showUpgradeNote, setShowUpgradeNote] = useState(false);

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

  const refreshTopicsAndPaid = useCallback(async (selectInitialIfEmpty = false) => {
    const [paidStatus, topicList] = await Promise.all([checkIsPaid(), fetchTopics()]);
    setIsPaid(paidStatus);
    setTopics(topicList);
    if (selectInitialIfEmpty && topicList.length > 0) {
      const firstWithQuestions = topicList.find((t) => t.total_count > 0) ?? topicList[0];
      setSelectedTopicId((prev) => prev || firstWithQuestions.id);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingTopics(true);
    setTopicsError(null);

    refreshTopicsAndPaid(true)
      .catch((err) => {
        if (!cancelled) setTopicsError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingTopics(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshTopicsAndPaid]);

  const selectedTopic = topics.find((t) => t.id === selectedTopicId) ?? null;

  const isFilterLocked = (filterId: DifficultyFilter): boolean => {
    if (isPaid || !selectedTopic || filterId === "all") return false;
    if (filterId === "easy") return selectedTopic.easy_count === 0;
    if (filterId === "moderate") return selectedTopic.moderate_count === 0;
    return selectedTopic.hard_count === 0;
  };

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
        if (!cancelled) setQuestionIds(ids);
      })
      .catch((err) => {
        if (!cancelled) setListError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTopicId, difficulty, isPaid]);

  const currentQuestionId = questionIds[currentIndex] ?? null;
  const currentQuestion = currentQuestionId ? questionCache[currentQuestionId] ?? null : null;
  const currentReview = currentQuestionId ? answersById[currentQuestionId] ?? null : null;

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
        if (!cancelled) setQuestionCache((prev) => ({ ...prev, [q.id]: q }));
      })
      .catch((err) => {
        if (!cancelled) setQuestionError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingQuestion(false);
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
    setShowUpgradeNote(isFilterLocked(filterId));
  };

  const handleChooseOption = async (optionKey: OptionKey) => {
    if (!currentQuestionId || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const review = await submitPracticeAnswer(currentQuestionId, optionKey);
      setAnswersById((prev) => ({
        ...prev,
        [currentQuestionId]: review,
      }));
      // Refresh topic free-quota usage counter on the topic screen
      await refreshTopicsAndPaid(false);
    } catch (err) {
      if (err instanceof QuotaReachedError) {
        onOpenUpgrade();
        return;
      }
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryCurrentQuestion = () => {
    if (!currentQuestionId) return;
    setAnswersById((prev) => {
      const next = { ...prev };
      delete next[currentQuestionId];
      return next;
    });
    setSubmitError(null);
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

  const usedCount = selectedTopic ? Math.min(selectedTopic.free_used_count, 10) : 0;

  return (
    <main className="page-container">
      <section className="controls-card" aria-label="Topic and difficulty selection">
        <div className="topic-header-row">
          <label htmlFor="topic-select" className="field-label" style={{ marginBottom: 0 }}>
            Practice by Topic
          </label>
          {!isPaid && selectedTopic && (
            <span className="quota-badge" aria-label="Free quota usage">
              {usedCount} of {selectedTopic.free_quota_limit || 10} free questions used
            </span>
          )}
        </div>

        <select
          id="topic-select"
          className="topic-select"
          style={{ marginTop: 6 }}
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
              topic.
            </p>
            <button
              type="button"
              className="step-btn primary-step"
              style={{ width: "100%", marginTop: 10, minHeight: 42 }}
              onClick={onOpenUpgrade}
            >
              See Upgrade Options
            </button>
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
                  <button
                    type="button"
                    className="retry-btn"
                    onClick={handleRetryCurrentQuestion}
                  >
                    Try Question Again
                  </button>
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