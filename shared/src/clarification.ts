// The clarification gate (feature 012, T006).
//
// Decides ONE thing: does this message need a question before it can be planned?
//
// It is pure and deterministic, and it costs nothing. That is the entire point.
// A guide turn sends ~2,945 input tokens on average, of which the catalog
// allow-list is ~1,945 — and a clarifying turn names no place, so it needs
// neither the catalog nor a model call. Deciding here, in code, is what makes
// the extra exchange free instead of full price (FR-015, research.md R1).
//
// WHAT THIS IS NOT
//
// It resembles `server/src/services/placeMatcher.ts`, which feature 004 deleted
// with a standing instruction not to reintroduce prose scanning. The difference
// is load-bearing and worth stating rather than waving past:
//
//   placeMatcher scanned the MODEL'S OUTPUT for PLACE NAMES and decided what to
//   recommend. Being wrong meant showing a traveler a restaurant that does not
//   exist — the correctness failure feature 004 existed to stop.
//
//   This scans the TRAVELER'S OWN MESSAGE for INTENT SIGNALS and decides whether
//   to ask a question. It returns a dimension, never a place, so it cannot
//   produce a recommendation at all. Every plan still goes through the full
//   catalog and `validatePlan` before anything is streamed.
//
// It also fails toward today's behaviour: unrecognised input returns
// `{ ask: false }`, which is exactly what ships now. The worst case is that the
// feature does not fire — never that the guide misbehaves.
import type { ClarifyDimension } from './types.js';

export type ClarifyDecision = { ask: false } | { ask: true; dimension: ClarifyDimension };

/**
 * The vocabulary the gate matches against.
 *
 * Passed in rather than imported so the gate stays pure and so the mood terms
 * can come from the LIVE taxonomy — an admin-added mood must be recognised, and
 * a deactivated one must not be (feature 010, FR-007).
 */
export interface SignalLexicon {
  /** Place types and activities: "playa", "volcán", "comer", "surf"… */
  topic: readonly string[];
  /** Mood terms, including the localized labels of live mood keys. */
  mood: readonly string[];
  /** "con mi novia", "con amigos", "con los niños"… */
  companion: readonly string[];
  /** "de noche", "a almorzar", "al atardecer"… */
  time: readonly string[];
}

/**
 * The vocabulary the gate matches against, per language.
 *
 * This lives here rather than in the locale files, and the distinction is worth
 * naming: it is never DISPLAYED. It is matching data — words a traveler might
 * type — so Principle V's parity rule for user-facing strings does not reach it,
 * while the rule that the BFF must not import `core/` does. The question and
 * hint the traveler actually reads DO live in the locale files.
 *
 * `mood` is supplemented at runtime with the live taxonomy's labels, so an
 * admin-created mood is recognised with no code change (FR-007).
 *
 * Spanish terms are written WITHOUT accents on purpose — `normalize()` strips
 * them from the message before comparing, so "volcan" here matches both
 * "volcán" and how people actually type it on a phone.
 */
export const SIGNAL_LEXICON: Record<'es' | 'en', SignalLexicon> = {
  es: {
    // NOTE: no `costa`. It matched "Costa Rica", which made an out-of-scope
    // request trigger a question — the one thing FR-005 forbids. `playa`, `mar`
    // and `surf` already cover the coastline case. The corpus pins it.
    topic: [
      'playa', 'mar', 'surf', 'surfear', 'volcan', 'cerro', 'monte', 'lago',
      'laguna', 'rio', 'cascada', 'catarata', 'comer', 'comida', 'cena', 'cenar',
      'almuerzo', 'almorzar', 'desayuno', 'restaurante', 'bar', 'cafe', 'museo',
      'iglesia', 'ruinas', 'cultura', 'pueblo', 'puebliar', 'ciudad', 'caminar',
      'senderismo', 'hiking', 'aventura', 'tour', 'paseo', 'parque', 'mirador',
      'atardecer', 'plan', 'lugar', 'lugares', 'sitio', 'visitar', 'conocer',
      'hacer',
    ],
    mood: [
      'romantico', 'romantica', 'pareja', 'cita', 'tranquilo', 'tranquila',
      'relajado', 'relajada', 'calmado', 'aventura', 'aventurero', 'extremo',
      'adrenalina', 'fiesta', 'rumba', 'nocturna', 'cultural', 'historico',
      'familiar', 'divertido',
    ],
    companion: [
      'solo', 'sola', 'novio', 'novia', 'esposo', 'esposa', 'pareja', 'amigo',
      'amigos', 'amiga', 'amigas', 'hijo', 'hijos', 'hija', 'hijas', 'nino',
      'ninos', 'familia', 'grupo', 'compa', 'compas',
    ],
    time: [
      'noche', 'nocturno', 'nocturna', 'manana', 'tarde', 'mediodia', 'almorzar',
      'almuerzo', 'cenar', 'cena', 'desayunar', 'desayuno', 'amanecer',
      'atardecer', 'madrugada', 'temprano',
    ],
  },
  en: {
    topic: [
      'beach', 'sea', 'surf', 'surfing', 'volcano', 'hill', 'mountain', 'lake',
      'lagoon', 'river', 'waterfall', 'eat', 'food', 'dinner', 'dine', 'lunch',
      'breakfast', 'restaurant', 'bar', 'cafe', 'coffee', 'museum', 'church',
      'ruins', 'culture', 'town', 'city', 'walk', 'hike', 'hiking', 'adventure',
      'tour', 'park', 'viewpoint', 'sunset', 'plan', 'place', 'places', 'spot',
      'visit', 'see', 'do',
    ],
    mood: [
      'romantic', 'couple', 'date', 'quiet', 'calm', 'relaxed', 'chill',
      'adventurous', 'extreme', 'adrenaline', 'party', 'nightlife', 'cultural',
      'historic', 'family', 'fun',
    ],
    companion: [
      'alone', 'solo', 'boyfriend', 'girlfriend', 'husband', 'wife', 'partner',
      'friend', 'friends', 'kid', 'kids', 'child', 'children', 'family', 'group',
    ],
    time: [
      'night', 'morning', 'afternoon', 'evening', 'noon', 'midday', 'lunch',
      'dinner', 'breakfast', 'sunrise', 'sunset', 'late', 'early',
    ],
  },
};

/**
 * Normalise for comparison: lowercase, strip accents.
 *
 * Accent-stripping matters more than it looks. Real traveler input is typed on a
 * phone and arrives as "volcan", "romantico", "almorzar" as often as with the
 * accent, and a lexicon that only matched the correct spelling would quietly
 * stop firing for half the people it is meant to serve.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Whether a normalized haystack contains a term as a WORD, not a substring.
 *
 * Substring matching would make "playa" match "playas" (wanted) but also make
 * short terms match inside unrelated words — "cena" inside "escena", "mar"
 * inside "amargo". Anchoring on word boundaries and allowing a trailing plural
 * keeps the useful half without the noise.
 */
function hasTerm(haystack: string, term: string): boolean {
  const t = normalize(term).trim();
  if (!t) return false;
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}])${escaped}(s|es)?($|[^\\p{L}])`, 'u').test(haystack);
}

function matchesAny(haystack: string, terms: readonly string[]): boolean {
  return terms.some((t) => hasTerm(haystack, t));
}

/**
 * Should the guide ask before it plans?
 *
 * The rule, stated once so it can be tested as one thing:
 *
 *   Ask ONLY when the message carries a TOPIC term and NO mood, companion or
 *   time term. Otherwise, plan.
 *
 * Requiring a topic term is what keeps FR-005 true. An out-of-scope or
 * manipulative message carries no catalog topic, so it never reaches the clarify
 * path and continues to be redirected by the model exactly as it is today.
 *
 * The traveler's SAVED moods are deliberately not an input here. They bias the
 * ORDER of the options that get offered (FR-002b), never whether the question is
 * asked — and that reversal is what makes the feature fire at all, because
 * nearly every real account has saved moods and today's rule lets them suppress
 * the question entirely.
 */
export function decideClarification(message: string, lexicon: SignalLexicon): ClarifyDecision {
  const text = normalize(message);
  if (!text.trim()) return { ask: false };

  if (!matchesAny(text, lexicon.topic)) return { ask: false };

  const hasMood = matchesAny(text, lexicon.mood);
  const hasCompanion = matchesAny(text, lexicon.companion);
  const hasTime = matchesAny(text, lexicon.time);

  if (hasMood || hasCompanion || hasTime) return { ask: false };

  // Always `mood`, and that is not a placeholder — it is what the vocabulary
  // turned out to make true.
  //
  // The gate only fires when ALL THREE signals are absent, so "the most decisive
  // MISSING dimension" (research.md R2) can only ever resolve to the first one.
  // Separate `companion` and `time` QUESTIONS would be unreachable code.
  //
  // They would also be redundant. The live mood taxonomy already spans the three
  // axes: alongside `romantic-date` and `nightlife`, the super admin has added
  // "Noche con amigos", "Almuerzo con amigos" and "Con niños" (feature 010). One
  // question with those chips answers "romántico o con amigos, de noche o a
  // almorzar" — the request's own example — in a single turn.
  //
  // So `companion` and `time` remain in the LEXICON, where they do real work
  // detecting that a message already carries signal (FR-002), and they are not
  // question templates. If the taxonomy ever loses that coverage, this is where
  // a second dimension would earn its place.
  return { ask: true, dimension: 'mood' };
}
