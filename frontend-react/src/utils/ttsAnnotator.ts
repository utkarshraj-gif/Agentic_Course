// utils/ttsAnnotator.ts
// Annotates lesson HTML with distinct sentence spans (<span class="tts-sentence" data-tts-idx="...">)
// Enables 100% robust in-sentence highlighting and auto-scrolling synchronized with audio narration.

export interface TtsSentence {
  id: number;
  text: string;
}

// Sentence boundary regex that respects HTML tags and terminators (. ! ?)
const SENTENCE_REGEX = /((?:<[^>]+>|[^<])+?(?:[\.!\?](?:<\/[^>]+>)*)(?:\s+|$)|(?:<[^>]+>|[^<])+$)/g;

function cleanSpokenText(htmlFragment: string): string {
  // Strip inner HTML tags
  let text = htmlFragment.replace(/<[^>]+>/g, '').trim();

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rarr;|\u2192/g, ' to ')
    .replace(/\s+/g, ' ');

  return text;
}

export function annotateHtmlForTts(
  rawHtml: string,
  _classId?: number,
  _title?: string
): { annotatedHtml: string; sentences: TtsSentence[] } {
  if (!rawHtml) {
    return { annotatedHtml: '', sentences: [] };
  }

  const sentences: TtsSentence[] = [];
  let counter = 0;

  // Pattern matching block elements: <p>, <li>, <h2>, <h3>, <h4>, <blockquote>
  const blockRegex = /<(p|li|h2|h3|h4|blockquote)(\s+[^>]*)?>(.*?)<\/\1>/gis;

  const annotatedHtml = rawHtml.replace(blockRegex, (match, tag, attrs = '', inner) => {
    // Skip code blocks, preformatted text, and diagrams
    if (/<pre|<code|class="mmd"/i.test(inner)) {
      return match;
    }

    const parts = inner.match(SENTENCE_REGEX);
    if (!parts || parts.length === 0) {
      return match;
    }

    const wrappedParts: string[] = [];

    parts.forEach((part: string) => {
      const trimmed = part.trim();
      if (!trimmed) return;

      const spokenText = cleanSpokenText(trimmed);
      if (spokenText.length > 2) {
        wrappedParts.push(
          `<span class="tts-sentence" data-tts-idx="${counter}" title="Click to listen from this sentence">${trimmed}</span>`
        );
        sentences.push({
          id: counter,
          text: spokenText,
        });
        counter++;
      } else {
        wrappedParts.push(trimmed);
      }
    });

    if (wrappedParts.length === 0) {
      return match;
    }

    return `<${tag}${attrs}>${wrappedParts.join(' ')}</${tag}>`;
  });

  return { annotatedHtml, sentences };
}
