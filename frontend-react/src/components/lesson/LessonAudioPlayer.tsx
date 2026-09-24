// components/lesson/LessonAudioPlayer.tsx
// High-fidelity in-browser Text-to-Speech audio reader with synchronized sentence highlighting & auto-scroll

import { useState, useEffect, useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Headphones,
  Gauge,
  ChevronDown,
  Check,
  ArrowDownCircle,
  SkipForward,
  SkipBack,
} from 'lucide-react';
import type { TtsSentence } from '../../utils/ttsAnnotator';

interface LessonAudioPlayerProps {
  classId: number;
  title: string;
  htmlContent: string;
  preParsedSentences?: TtsSentence[];
  contentRef?: RefObject<HTMLElement | null>;
}

export function LessonAudioPlayer({
  classId,
  title,
  htmlContent,
  preParsedSentences,
}: LessonAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rate, setRate] = useState(1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [isSupported, setIsSupported] = useState(true);
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);

  const sentencesRef = useRef<TtsSentence[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isPlayingRef = useRef(false);
  const autoScrollRef = useRef(true);
  const heartbeatRef = useRef<number | null>(null);
  const voiceSelectRef = useRef<HTMLDivElement>(null);

  // Sync autoScroll ref with state
  useEffect(() => {
    autoScrollRef.current = autoScroll;
  }, [autoScroll]);

  // Clean all active highlights across the entire document
  const clearHighlights = useCallback(() => {
    document.querySelectorAll('.tts-active-sentence').forEach((el) => {
      el.classList.remove('tts-active-sentence');
    });
    document.querySelectorAll('.tts-active-block').forEach((el) => {
      el.classList.remove('tts-active-block');
    });
  }, []);

  // Close voice dropdown when clicking outside
  useEffect(() => {
    if (!showVoiceMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (voiceSelectRef.current && !voiceSelectRef.current.contains(e.target as Node)) {
        setShowVoiceMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVoiceMenu]);

  // Initialize browser speech synthesis voices
  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setIsSupported(false);
      return;
    }

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        const englishVoices = available.filter((v) => v.lang.startsWith('en'));
        const voiceList = englishVoices.length > 0 ? englishVoices : available;
        setVoices(voiceList);

        const preferred =
          voiceList.find(
            (v) =>
              v.name.includes('Natural') ||
              v.name.includes('Google') ||
              v.name.includes('Samantha') ||
              v.name.includes('Jenny')
          ) || voiceList[0];

        if (preferred && !selectedVoice) setSelectedVoice(preferred.name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
      clearHighlights();
      isPlayingRef.current = false;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [clearHighlights, selectedVoice]);

  // Sync sentences when class or preParsedSentences updates
  useEffect(() => {
    window.speechSynthesis.cancel();
    clearHighlights();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(0);
    isPlayingRef.current = false;
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);

    if (preParsedSentences && preParsedSentences.length > 0) {
      sentencesRef.current = preParsedSentences;
    } else {
      sentencesRef.current = [];
    }
  }, [classId, title, htmlContent, preParsedSentences, clearHighlights]);

  // Speak sentence at given index with synchronized highlight and auto-scroll
  const speakSentence = useCallback(
    (index: number) => {
      if (!isPlayingRef.current) return;

      if (index >= sentencesRef.current.length) {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentIndex(0);
        isPlayingRef.current = false;
        clearHighlights();
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        return;
      }

      const item = sentencesRef.current[index];
      if (!item) return;

      // 1. Remove previous highlights
      clearHighlights();

      // 2. Apply in-sentence highlight and auto-scroll immediately
      const span = document.querySelector(`[data-tts-idx="${index}"]`) as HTMLElement | null;
      if (span) {
        // Highlight the exact sentence with bright amber-gold
        span.classList.add('tts-active-sentence');

        // Highlight the parent block (paragraph, list item, or heading) with primary cyan border
        const parentBlock = span.closest('p, li, h2, h3, h4, blockquote') as HTMLElement | null;
        if (parentBlock) {
          parentBlock.classList.add('tts-active-block');
        }

        // Smoothly scroll down to keep the exact active sentence centered in view
        if (autoScrollRef.current) {
          span.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }

      // 3. Synthesize speech for this sentence
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.rate = rate;

      if (selectedVoice) {
        const v = voices.find((voice) => voice.name === selectedVoice);
        if (v) utterance.voice = v;
      }

      utterance.onend = () => {
        if (isPlayingRef.current) {
          const nextIdx = index + 1;
          setCurrentIndex(nextIdx);
          speakSentence(nextIdx);
        }
      };

      utterance.onerror = (e) => {
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.warn('[Audio Player] TTS Error:', e.error);
        }
        if (isPlayingRef.current) {
          const nextIdx = index + 1;
          setCurrentIndex(nextIdx);
          speakSentence(nextIdx);
        }
      };

      utteranceRef.current = utterance;
      // Global reference to prevent Chromium garbage collection bug
      (window as any).__currentTtsUtterance = utterance;

      // Small timeout ensures clean transition between consecutive utterances in Chromium
      setTimeout(() => {
        if (isPlayingRef.current) {
          window.speechSynthesis.speak(utterance);
        }
      }, 35);

      // Heartbeat timer to prevent Chromium 14-second cutoff bug
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = window.setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 8000);
    },
    [rate, selectedVoice, voices, clearHighlights]
  );

  // Jump to specific sentence when clicked in lesson text
  const jumpToSentence = useCallback(
    (index: number) => {
      if (index < 0 || index >= sentencesRef.current.length) return;
      setCurrentIndex(index);
      setIsPlaying(true);
      setIsPaused(false);
      isPlayingRef.current = true;
      speakSentence(index);
    },
    [speakSentence]
  );

  // Attach interactive click listener to ALL sentences in the document using event delegation
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.tts-sentence') as HTMLElement | null;
      if (target && target.dataset.ttsIdx !== undefined) {
        const idx = parseInt(target.dataset.ttsIdx, 10);
        if (!isNaN(idx) && idx >= 0 && idx < sentencesRef.current.length) {
          e.preventDefault();
          e.stopPropagation();
          jumpToSentence(idx);
        }
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [jumpToSentence]);

  const handlePlay = () => {
    if (!isSupported || sentencesRef.current.length === 0) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      isPlayingRef.current = true;
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);
    setIsPaused(false);
    speakSentence(currentIndex);
  };

  const handlePause = () => {
    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsPaused(true);
      isPlayingRef.current = false;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    }
  };

  const handleReset = () => {
    window.speechSynthesis.cancel();
    clearHighlights();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentIndex(0);
    isPlayingRef.current = false;
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
  };

  const handleNext = () => {
    if (currentIndex + 1 < sentencesRef.current.length) {
      jumpToSentence(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      jumpToSentence(currentIndex - 1);
    }
  };

  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    if (isPlaying) {
      speakSentence(currentIndex);
    }
  };

  if (!isSupported) {
    return null;
  }

  const totalSentences = sentencesRef.current.length;
  const progressPercent = totalSentences > 0 ? Math.round((currentIndex / totalSentences) * 100) : 0;
  const currentSentencePreview =
    sentencesRef.current[currentIndex]?.text ||
    (totalSentences > 0 ? 'Click any sentence or press Listen' : 'Loading lesson text...');

  return (
    <div
      className={`audio-player-bar ${isPlaying ? 'audio-player-active-mode' : ''}`}
      role="region"
      aria-label="Audio lesson player"
    >
      {/* Left: Icon & Title info */}
      <div className="audio-player-info">
        <div className={`audio-player-icon-wrap ${isPlaying ? 'audio-player-icon--playing' : ''}`}>
          <Headphones size={18} />
        </div>
        <div className="audio-player-meta">
          <div className="audio-player-badge">
            <span className="audio-player-badge-dot" />
            SYNCHRONIZED AUDIO READER • SENTENCE TRACKING
          </div>
          <p className="audio-player-preview" title={currentSentencePreview}>
            {isPlaying
              ? `"${currentSentencePreview}"`
              : totalSentences > 0
              ? `Ready (${totalSentences} sentences) • Click any sentence to jump`
              : 'Preparing audio narration...'}
          </p>
        </div>
      </div>

      {/* Middle: Equalizer Animation */}
      {isPlaying && (
        <div className="audio-equalizer" aria-hidden="true">
          <span className="audio-bar audio-bar--1" />
          <span className="audio-bar audio-bar--2" />
          <span className="audio-bar audio-bar--3" />
          <span className="audio-bar audio-bar--4" />
        </div>
      )}

      {/* Right: Controls & Speed */}
      <div className="audio-player-controls">
        {/* Auto-Scroll Toggle Button */}
        <button
          type="button"
          className={`audio-btn ${autoScroll ? 'audio-btn--active' : 'audio-btn--ghost'}`}
          onClick={() => setAutoScroll((prev) => !prev)}
          title={autoScroll ? 'Auto-scroll is active (page centers on spoken sentence)' : 'Auto-scroll is paused'}
          style={{
            fontSize: '0.72rem',
            gap: '4px',
            padding: '5px 9px',
            color: autoScroll ? '#07d2e0' : 'var(--text-muted)',
            border: autoScroll ? '1px solid rgba(7, 210, 224, 0.4)' : undefined,
          }}
        >
          <ArrowDownCircle size={13} />
          <span>Auto-Scroll {autoScroll ? 'ON' : 'OFF'}</span>
        </button>

        {/* Skip Previous Sentence */}
        <button
          className="audio-btn audio-btn--ghost"
          onClick={handlePrev}
          disabled={currentIndex <= 0}
          title="Previous Sentence"
          style={{ opacity: currentIndex <= 0 ? 0.4 : 1 }}
        >
          <SkipBack size={14} />
        </button>

        {/* Play/Pause Button */}
        {isPlaying ? (
          <button
            className="audio-btn audio-btn--primary"
            onClick={handlePause}
            title="Pause Audio"
            aria-label="Pause audio"
          >
            <Pause size={15} />
            <span>Pause</span>
          </button>
        ) : (
          <button
            className="audio-btn audio-btn--primary"
            onClick={handlePlay}
            title="Listen with in-sentence highlight"
            aria-label="Play audio reader"
          >
            <Play size={15} fill="currentColor" />
            <span>{isPaused ? 'Resume' : 'Listen'}</span>
          </button>
        )}

        {/* Skip Next Sentence */}
        <button
          className="audio-btn audio-btn--ghost"
          onClick={handleNext}
          disabled={currentIndex >= totalSentences - 1}
          title="Next Sentence"
          style={{ opacity: currentIndex >= totalSentences - 1 ? 0.4 : 1 }}
        >
          <SkipForward size={14} />
        </button>

        {/* Reset Button */}
        {(isPlaying || isPaused || currentIndex > 0) && (
          <button
            className="audio-btn audio-btn--ghost"
            onClick={handleReset}
            title="Reset from beginning"
            aria-label="Restart audio"
          >
            <RotateCcw size={14} />
          </button>
        )}

        {/* Speed Selector */}
        <div className="audio-speed-group">
          <Gauge size={13} className="audio-speed-icon" />
          {[1, 1.25, 1.5, 2].map((s) => (
            <button
              key={s}
              className={`audio-speed-btn ${rate === s ? 'audio-speed-btn--active' : ''}`}
              onClick={() => handleRateChange(s)}
              title={`${s}x Speed`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Voice Selector Dropdown */}
        {voices.length > 1 && (
          <div className="audio-voice-select-wrap" ref={voiceSelectRef}>
            <button
              type="button"
              className={`audio-voice-btn ${showVoiceMenu ? 'audio-voice-btn--active' : ''}`}
              onClick={() => setShowVoiceMenu((prev) => !prev)}
              title="Select Narration Voice"
              aria-expanded={showVoiceMenu}
            >
              <Volume2 size={14} />
              <ChevronDown
                size={12}
                style={{
                  transform: showVoiceMenu ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.18s ease',
                }}
              />
            </button>

            {showVoiceMenu && (
              <div className="audio-voice-menu" role="menu" aria-label="Narration Voices">
                <div className="audio-voice-menu-header">Narration Voice</div>
                {voices.slice(0, 8).map((v) => {
                  const isSelected = selectedVoice === v.name;
                  const cleanName = v.name.replace(/Microsoft |Google |Apple /, '');

                  return (
                    <button
                      key={v.name}
                      type="button"
                      role="menuitem"
                      className={`audio-voice-option ${isSelected ? 'audio-voice-option--active' : ''}`}
                      onClick={() => {
                        setSelectedVoice(v.name);
                        setShowVoiceMenu(false);
                        if (isPlaying) speakSentence(currentIndex);
                      }}
                    >
                      <span className="audio-voice-name">{cleanName}</span>
                      {isSelected && <Check size={13} className="audio-voice-check" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress Track */}
      {(isPlaying || isPaused || currentIndex > 0) && (
        <div className="audio-progress-track">
          <div className="audio-progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>
      )}
    </div>
  );
}
