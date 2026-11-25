import type { AnswerReview } from "../lib/types";

interface QuestionPaletteSheetProps {
  isOpen: boolean;
  questionIds: string[];
  currentIndex: number;
  answersById: Record<string, AnswerReview>;
  onSelectIndex: (index: number) => void;
  onClose: () => void;
}

export function QuestionPaletteSheet({
  isOpen,
  questionIds,
  currentIndex,
  answersById,
  onSelectIndex,
  onClose,
}: QuestionPaletteSheetProps) {
  if (!isOpen) return null;

  return (
    <div
      className="sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Question palette"
      onClick={onClose}
    >
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <div>
            <h2 className="sheet-title">Question Palette</h2>
            <p className="sheet-subtitle">Tap a number to jump to that question</p>
          </div>
          <button
            type="button"
            className="sheet-close-btn"
            onClick={onClose}
            aria-label="Close palette"
          >
            Done
          </button>
        </div>

        <div className="palette-legend" aria-label="Status legend">
          <span className="legend-item">
            <span className="legend-dot is-unattempted" /> Not attempted
          </span>
          <span className="legend-item">
            <span className="legend-dot is-correct" /> Correct
          </span>
          <span className="legend-item">
            <span className="legend-dot is-wrong" /> Wrong
          </span>
        </div>

        <div className="palette-grid">
          {questionIds.map((qId, idx) => {
            const attempt = answersById[qId];
            const isCurrent = idx === currentIndex;
            const statusClass = !attempt
              ? "is-unattempted"
              : attempt.is_correct
                ? "is-correct"
                : "is-wrong";

            return (
              <button
                key={qId}
                type="button"
                className={`palette-cell ${statusClass} ${isCurrent ? "is-current" : ""}`}
                onClick={() => {
                  onSelectIndex(idx);
                  onClose();
                }}
                aria-label={`Question ${idx + 1}${isCurrent ? " (current)" : ""}`}
                aria-current={isCurrent ? "true" : undefined}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}