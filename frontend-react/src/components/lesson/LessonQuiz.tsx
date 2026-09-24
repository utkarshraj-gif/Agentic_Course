// components/lesson/LessonQuiz.tsx
import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, BarChart2, Lock } from 'lucide-react';
import type { ClassQuiz, QuizQuestion } from '../../data/quizData';
import { ProgressService } from '../../services/progress/ProgressService';

interface LessonQuizProps {
  quiz: ClassQuiz;
  classTitle: string;
  onQuizCompleted?: () => void;
}

interface Answer {
  questionId: string;
  selectedIndex: number;
  correct: boolean;
}

export function LessonQuiz({ quiz, classTitle, onQuizCompleted }: LessonQuizProps) {
  const existingResult = ProgressService.getQuizResult(quiz.classId);
  const [submitted, setSubmitted] = useState<boolean>(Boolean(existingResult));
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => {
    if (existingResult?.userAnswers) {
      const restored: Record<string, Answer> = {};
      for (const [qid, sIndex] of Object.entries(existingResult.userAnswers)) {
        const question = quiz.questions.find(q => q.id === qid);
        if (question) {
          restored[qid] = {
            questionId: qid,
            selectedIndex: sIndex,
            correct: sIndex === question.correctIndex,
          };
        }
      }
      return restored;
    }
    return {};
  });

  const isLocked = submitted || Boolean(existingResult);

  // If user previously completed quiz, ensure lesson is marked complete as well
  useEffect(() => {
    if (existingResult && !ProgressService.isLessonComplete(quiz.classId)) {
      ProgressService.markLessonComplete(quiz.classId, classTitle);
      window.dispatchEvent(new Event('progress_updated'));
      onQuizCompleted?.();
    }
  }, [existingResult, quiz.classId, classTitle, onQuizCompleted]);

  const handleSelect = (q: QuizQuestion, index: number) => {
    if (isLocked) return;
    setAnswers(prev => ({
      ...prev,
      [q.id]: {
        questionId: q.id,
        selectedIndex: index,
        correct: index === q.correctIndex,
      },
    }));
  };

  const handleSubmit = () => {
    if (isLocked || Object.keys(answers).length < quiz.questions.length) return;
    setSubmitted(true);
    const calculatedScore = Object.values(answers).filter(a => a.correct).length;
    const selectedMap: Record<string, number> = {};
    for (const [qid, a] of Object.entries(answers)) {
      selectedMap[qid] = a.selectedIndex;
    }

    ProgressService.saveQuizResult(
      quiz.classId,
      calculatedScore,
      quiz.questions.length,
      classTitle,
      selectedMap
    );

    // Automatically mark the lesson as completed once quiz is submitted (regardless of score)
    ProgressService.markLessonComplete(quiz.classId, classTitle);
    window.dispatchEvent(new Event('progress_updated'));
    onQuizCompleted?.();
  };

  const score = Object.keys(answers).length > 0
    ? Object.values(answers).filter(a => a.correct).length
    : (existingResult ? existingResult.score : 0);

  const allAnswered = Object.keys(answers).length === quiz.questions.length;

  return (
    <div className="quiz-section" id="knowledge-check" role="region" aria-label="Knowledge Check">
      <div className="quiz-header">
        <div className="quiz-header-title-wrap">
          <BarChart2 size={16} />
          <h3 className="quiz-title">Knowledge Check</h3>
        </div>
        {isLocked ? (
          <span className="quiz-locked-badge">
            <Lock size={12} /> Attempt Submitted
          </span>
        ) : (
          <span className="quiz-single-badge">
            Single Attempt
          </span>
        )}
      </div>

      <div className="quiz-questions">
        {quiz.questions.map((q, qi) => {
          const userAnswer = answers[q.id];

          return (
            <div key={q.id} className="quiz-question">
              <p className="quiz-question-text">
                <span className="quiz-q-num">Q{qi + 1}.</span> {q.question}
              </p>
              <div className="quiz-options">
                {q.options.map((opt, oi) => {
                  const selected = userAnswer?.selectedIndex === oi;
                  const isCorrect = oi === q.correctIndex;
                  let cls = 'quiz-option';
                  if (isLocked) {
                    if (selected && isCorrect) cls += ' quiz-option--correct';
                    else if (selected && !isCorrect) cls += ' quiz-option--wrong';
                    else if (isCorrect) cls += ' quiz-option--reveal';
                  } else if (selected) {
                    cls += ' quiz-option--selected';
                  }

                  return (
                    <button
                      key={oi}
                      type="button"
                      className={cls}
                      onClick={() => handleSelect(q, oi)}
                      disabled={isLocked}
                      aria-pressed={selected}
                    >
                      <span className="quiz-option-letter">{String.fromCharCode(65 + oi)}</span>
                      <span className="quiz-option-text">{opt}</span>
                      {isLocked && selected && isCorrect && <CheckCircle size={14} className="quiz-icon" />}
                      {isLocked && selected && !isCorrect && <XCircle size={14} className="quiz-icon" />}
                    </button>
                  );
                })}
              </div>

              {isLocked && (
                <div className="quiz-explanation">
                  <strong>
                    {userAnswer
                      ? userAnswer.correct
                        ? '✓ Correct.'
                        : '✗ Review this.'
                      : 'Key Explanation:'}
                  </strong>{' '}
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="quiz-actions">
        {!isLocked ? (
          <div className="quiz-submit-row">
            <span className="quiz-attempt-hint">
              <Lock size={12} /> Single attempt only · Answers are final once submitted
            </span>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSubmit}
              disabled={!allAnswered}
            >
              Check Answers
            </button>
          </div>
        ) : (
          <div className="quiz-result">
            <div className={`quiz-score ${score === quiz.questions.length ? 'quiz-score--perfect' : score >= quiz.questions.length / 2 ? 'quiz-score--pass' : 'quiz-score--retry'}`}>
              {score === quiz.questions.length
                ? `✓ ${score}/${quiz.questions.length} — Perfect!`
                : score >= quiz.questions.length / 2
                  ? `${score}/${quiz.questions.length} — Good work`
                  : `${score}/${quiz.questions.length} — Review the lesson`}
            </div>
            <div className="quiz-locked-notice">
              <Lock size={12} /> Attempt recorded
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
