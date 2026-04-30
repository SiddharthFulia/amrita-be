import { logger } from '../helpers/logger.js';
import { OLLAMA_URL, GROQ_API_KEY } from '../helpers/constants.js';
import { chatGroq } from './groq.js';

const DIFFICULTIES = {
  easy: { paragraphs: 3, diffs: 3 },
  medium: { paragraphs: 4, diffs: 5 },
  hard: { paragraphs: 5, diffs: 6 },
};

// ─── HARD MODE: Confusable word pairs ───────────────────────────────────────
// Pairs of similar-spelling / commonly-confused words. Either direction is valid;
// we pick whichever variant appears in the source sentence.
const HARD_CONFUSABLES = [
  ['their', 'there'],
  ['affect', 'effect'],
  ['complement', 'compliment'],
  ['principal', 'principle'],
  ['stationary', 'stationery'],
  ['discreet', 'discrete'],
  ['loose', 'lose'],
  ['accept', 'except'],
  ['advice', 'advise'],
  ['allusion', 'illusion'],
  ['assure', 'ensure'],
  ['capital', 'capitol'],
  ['cite', 'site'],
  ['council', 'counsel'],
  ['device', 'devise'],
  ['elicit', 'illicit'],
  ['eminent', 'imminent'],
  ['ensure', 'insure'],
  ['farther', 'further'],
  ['precede', 'proceed'],
  ['practice', 'practise'],
  ['ingenious', 'ingenuous'],
  ['continuous', 'contiguous'],
  ['allude', 'elude'],
  ['adverse', 'averse'],
  ['conscience', 'conscious'],
  ['economic', 'economical'],
  ['historic', 'historical'],
  ['emigrate', 'immigrate'],
  ['comprise', 'compose'],
  ['imply', 'infer'],
  ['flaunt', 'flout'],
  ['perspective', 'prospective'],
  ['precedent', 'president'],
  ['biannual', 'biennial'],
  ['complementary', 'complimentary'],
  ['credible', 'creditable'],
  ['facetious', 'factitious'],
  ['ordinance', 'ordnance'],
  ['envelop', 'envelope'],
  ['breath', 'breathe'],
  ['desert', 'dessert'],
  ['altogether', 'all together'],
  ['everyday', 'every day'],
  ['anyway', 'any way'],
];

// ─── HARD MODE: Source sentence templates ───────────────────────────────────
// Long technical/scientific style passages. Words eligible for confusable
// substitution and subtle char-level swaps live deep inside these sentences.
const HARD_LONGER_WORDS = [
  {
    title: 'The Laboratory',
    sentences: [
      'The principal investigator examined the stationary specimens beneath the calibrated electron microscope.',
      'Continuous fluctuations in atmospheric pressure may adversely affect the precision of the experimental apparatus.',
      'Researchers must ensure that every reagent remains discreet from contamination throughout the procedure.',
      'The complementary findings allude to a previously undocumented thermodynamic phenomenon worth investigating.',
      'Their hypothesis proceeds from observations recorded during the preceding biannual evaluation period.',
    ],
  },
  {
    title: 'The Symposium',
    sentences: [
      'The eminent professor delivered a comprehensive lecture on contemporary economic principles last Thursday afternoon.',
      'Several prospective candidates submitted their dissertations to the historical archives department for consideration.',
      'The council unanimously accepted the proposal regarding sustainable development across metropolitan jurisdictions.',
      'Economic analysts cautioned that imminent regulatory changes could profoundly affect quarterly performance metrics.',
      'Conscientious scholars meticulously documented every observation throughout the unprecedented eighteen-month investigation.',
    ],
  },
  {
    title: 'Architectural Survey',
    sentences: [
      'The municipal capitol building features intricate neoclassical ornamentation along its eastern colonnade and entablature.',
      'Preservationists carefully assessed whether the foundation could withstand prolonged exposure to seasonal atmospheric humidity.',
      'Their investigation concluded that the principal structural elements remained remarkably stable despite considerable weathering.',
      'Subsequent renovations would necessarily complement the original architectural intent without compromising historical authenticity.',
      'The conservators proceeded cautiously, ensuring every restoration technique aligned with established preservation principles.',
    ],
  },
  {
    title: 'Astronomical Observation',
    sentences: [
      'The observatory documented continuous gravitational anomalies surrounding a previously uncharted celestial object beyond Neptune.',
      'Astronomers initially attributed the phenomenon to instrumental imprecision rather than genuine cosmological significance.',
      'Further measurements suggested that the disturbances were not illusions but discrete perturbations of considerable magnitude.',
      'Their analysis proceeded methodically through multiple independent observational datasets gathered across consecutive trimesters.',
      'The principal conclusion implies that contemporary models require substantial theoretical revision to accommodate these findings.',
    ],
  },
  {
    title: 'Pharmaceutical Trial',
    sentences: [
      'Investigators conducted a meticulously controlled clinical evaluation involving approximately twelve hundred consenting volunteer participants.',
      'The experimental compound demonstrated measurable therapeutic effects without producing significant adverse physiological reactions.',
      'Statisticians ensured that every participant remained appropriately stratified throughout the eighteen-month longitudinal observation period.',
      'Their preliminary findings allude to a promising therapeutic mechanism deserving immediate further pharmacological investigation.',
      'Regulatory authorities subsequently accepted the comprehensive submission and granted provisional approval pending additional verification.',
    ],
  },
];

// ─── HARD MODE: Subtle character-level swaps ────────────────────────────────
// Each rule rewrites a substring inside a word so the result still LOOKS like
// the original at a glance (e.g. "rn" mimics "m"). Returns a list of candidate
// transformed words for a given source word.
const CHAR_SWAP_RULES = [
  // visual ligatures
  { from: 'm', to: 'rn' },          // "modern" → "rnodern" looks similar in narrow fonts
  { from: 'rn', to: 'm' },          // "modern" → "modem"
  { from: 'cl', to: 'd' },          // "clarity" → "darity"
  { from: 'd', to: 'cl' },          // "modeled" → "modelecl"
  { from: 'O', to: '0' },
  { from: 'l', to: 'I' },           // lowercase L → uppercase I (visually close)
  // single-letter mid-word vowel swaps
  { from: 'a', to: 'e', midOnly: true },
  { from: 'e', to: 'a', midOnly: true },
  { from: 'i', to: 'l', midOnly: true },
  // doubled-consonant tweaks
  { from: 'tt', to: 't' },
  { from: 'ss', to: 's' },
  { from: 'nn', to: 'n' },
  { from: 'll', to: 'l' },
];

// Strip leading/trailing punctuation; return [prefix, core, suffix].
function splitWord(token) {
  const match = token.match(/^([^A-Za-z0-9]*)([A-Za-z0-9'-]*)([^A-Za-z0-9]*)$/);
  if (!match) return ['', token, ''];
  return [match[1], match[2], match[3]];
}

// Return all (index, replacement) candidates for a single character-swap rule
// applied to a given core word. midOnly rules exclude positions 0 and last.
function findSwapPositions(core, rule) {
  const positions = [];
  if (!core) return positions;
  const lower = core.toLowerCase();
  const fromLower = rule.from.toLowerCase();
  let searchFrom = 0;
  while (searchFrom <= lower.length - fromLower.length) {
    const found = lower.indexOf(fromLower, searchFrom);
    if (found === -1) break;
    if (rule.midOnly) {
      if (found > 0 && found + fromLower.length < core.length) positions.push(found);
    } else {
      positions.push(found);
    }
    searchFrom = found + 1;
  }
  return positions;
}

// Apply one character-swap rule to one position; preserve original casing.
function applySwap(core, position, rule) {
  const before = core.slice(0, position);
  const target = core.slice(position, position + rule.from.length);
  const after = core.slice(position + rule.from.length);
  // crude case preservation: if first matched char is uppercase, capitalize replacement
  const replacement = target[0] === target[0].toUpperCase() && /[A-Z]/.test(target[0])
    ? rule.to.charAt(0).toUpperCase() + rule.to.slice(1)
    : rule.to;
  return before + replacement + after;
}

// Try to substitute one occurrence of any confusable in the sentence's tokens.
// Returns { tokenIndex, newToken } or null. Mutates nothing.
function findConfusableSwap(tokens, alreadyUsedIndices) {
  for (const [a, b] of HARD_CONFUSABLES) {
    for (let i = 0; i < tokens.length; i++) {
      if (alreadyUsedIndices.has(i)) continue;
      const [pre, core, suf] = splitWord(tokens[i]);
      const lower = core.toLowerCase();
      let target = null;
      if (lower === a) target = b;
      else if (lower === b) target = a;
      if (target) {
        // preserve capitalization of first letter
        const cased = core[0] === core[0].toUpperCase() && /[A-Z]/.test(core[0])
          ? target.charAt(0).toUpperCase() + target.slice(1)
          : target;
        return { tokenIndex: i, newToken: pre + cased + suf };
      }
    }
  }
  return null;
}

// Try to find a subtle char-swap deep in a long word. Prefers core length >= 7
// and a swap position past the third character.
function findCharSwap(tokens, alreadyUsedIndices, requireDeep = true) {
  const candidates = [];
  for (let i = 0; i < tokens.length; i++) {
    if (alreadyUsedIndices.has(i)) continue;
    const [pre, core, suf] = splitWord(tokens[i]);
    if (core.length < (requireDeep ? 7 : 5)) continue;
    for (const rule of CHAR_SWAP_RULES) {
      const positions = findSwapPositions(core, rule);
      for (const pos of positions) {
        if (requireDeep && pos < 3) continue;
        const newCore = applySwap(core, pos, rule);
        if (newCore === core) continue;
        candidates.push({ tokenIndex: i, newToken: pre + newCore + suf, depth: pos });
      }
    }
  }
  if (!candidates.length) return null;
  // prefer deepest swap inside longest core
  candidates.sort((x, y) => y.depth - x.depth);
  return candidates[0];
}

// Build a hard-mode glitched array deterministically from a source passage.
function buildHardGlitched(originalSentences, targetDiffs) {
  const glitched = [...originalSentences];
  let totalChanges = 0;
  const perSentenceTarget = Math.ceil(targetDiffs / originalSentences.length);

  for (let s = 0; s < glitched.length; s++) {
    const tokens = glitched[s].split(/\s+/);
    const used = new Set();
    let changesHere = 0;

    // 1) confusable substitutions first (most plausible)
    while (changesHere < perSentenceTarget && totalChanges < targetDiffs + 2) {
      const swap = findConfusableSwap(tokens, used);
      if (!swap) break;
      tokens[swap.tokenIndex] = swap.newToken;
      used.add(swap.tokenIndex);
      changesHere++;
      totalChanges++;
    }

    // 2) at least one deep char-swap if room remains
    if (changesHere < perSentenceTarget) {
      const deep = findCharSwap(tokens, used, true);
      if (deep) {
        tokens[deep.tokenIndex] = deep.newToken;
        used.add(deep.tokenIndex);
        changesHere++;
        totalChanges++;
      }
    }

    // 3) fill remaining slots with shallower char-swaps
    while (changesHere < perSentenceTarget) {
      const any = findCharSwap(tokens, used, false);
      if (!any) break;
      tokens[any.tokenIndex] = any.newToken;
      used.add(any.tokenIndex);
      changesHere++;
      totalChanges++;
    }

    glitched[s] = tokens.join(' ');
  }

  return { glitched, diffCount: totalChanges };
}

// Build the full hard-mode pair without invoking any LLM.
function generateHardPair() {
  const config = DIFFICULTIES.hard;
  const passage = HARD_LONGER_WORDS[Math.floor(Math.random() * HARD_LONGER_WORDS.length)];
  const sentences = passage.sentences.slice(0, config.paragraphs);
  const { glitched, diffCount } = buildHardGlitched(sentences, config.diffs);
  return {
    title: passage.title,
    difficulty: 'hard',
    diffCount,
    original: sentences,
    glitched,
  };
}

export async function generateTextPair(difficulty = 'easy') {
  // HARD mode is built deterministically from curated passages so we can
  // guarantee multi-letter confusables + subtle character swaps. This makes
  // the difficulty actually meaningful instead of relying on the LLM.
  if (difficulty === 'hard') {
    const pair = generateHardPair();
    logger.info(`Memory glitch HARD generated locally | title="${pair.title}" | diffs=${pair.diffCount}`);
    return pair;
  }

  const config = DIFFICULTIES[difficulty] || DIFFICULTIES.easy;

  const prompt = `Generate JSON with EXACTLY these 4 keys: "title", "original", "glitched", "diffCount".

RULES:
- "original" is an array of ${config.paragraphs} sentences about a sweet everyday moment. Each sentence ends with a period.
- "glitched" is the EXACT same array but with exactly ${config.diffs} WORDS replaced with DIFFERENT words. NOT punctuation changes. Swap nouns, adjectives, colors, numbers, or names. Every other word and ALL punctuation must stay identical.
- "title" is a short 2-3 word title.
- "diffCount" is ${config.diffs}.
- Do NOT swap pronouns (he/she/his/her). Swap meaningful words like colors (blue→red), animals (cat→dog), foods (coffee→tea), numbers (three→five), places (park→beach), adjectives (old→new).
- Do NOT introduce typos or made-up words. Every word must be a real English word.
- Keep sentences simple and warm.

EXAMPLE:
{"title":"Morning Walk","original":["I walked to the park with my blue umbrella.","The birds were singing in the tall oak trees.","We sat on the old wooden bench together."],"glitched":["I walked to the garden with my blue umbrella.","The birds were singing in the tall oak trees.","We sat on the old metal bench together."],"diffCount":2}

Notice: "park" changed to "garden" and "wooden" changed to "metal". Those are real word swaps. Do NOT just add or remove periods.

Now generate a completely NEW one with a different topic. Output ONLY the JSON object.`;

  let lastError = null;

  // Try Groq first (sub-1s response)
  if (GROQ_API_KEY) {
    try {
      logger.info('Memory glitch trying Groq (llama-3.1-8b)');
      const groqResult = await chatGroq(prompt, [], 'llama-3.1-8b', { system: 'Output ONLY valid JSON. No markdown. No code fences. No explanation. Just the JSON object.', maxTokens: 600, temperature: 0.9 });
      const rawContent = groqResult.reply;
      if (rawContent) {
        logger.info(`Memory glitch Groq raw: ${rawContent.substring(0, 100)}...`);
        const cleanedContent = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedPair = JSON.parse(jsonMatch[0]);
          const unwrapped = parsedPair.original ? parsedPair : parsedPair.diaryEntry || parsedPair.data || parsedPair.entry || parsedPair;
          const originalData = unwrapped.original || unwrapped.paragraphs || unwrapped.sentences;
          const glitchedData = unwrapped.glitched || unwrapped.modified || unwrapped.changed;
          if (originalData && glitchedData) {
            const originalArray = Array.isArray(originalData) ? originalData : [originalData];
            const glitchedArray = Array.isArray(glitchedData) ? glitchedData : [glitchedData];
            const minLength = Math.min(originalArray.length, glitchedArray.length);
            logger.info('Generated memory glitch pair via Groq', { difficulty, title: unwrapped.title || parsedPair.title });
            return {
              title: unwrapped.title || parsedPair.title || 'A Sweet Memory',
              difficulty,
              diffCount: parsedPair.diffCount || config.diffs,
              original: originalArray.slice(0, minLength),
              glitched: glitchedArray.slice(0, minLength),
            };
          }
        }
      }
    } catch (groqError) {
      lastError = groqError;
      logger.warn(`Memory glitch Groq failed: ${groqError.message}, falling back to Ollama...`);
    }
  }

  // Fallback to Ollama models
  const modelsToTry = ['llama3.2:3b', 'qwen2.5:3b', 'gemma2:2b'];

  for (let attempt = 0; attempt < modelsToTry.length; attempt++) {
    const currentModel = modelsToTry[attempt];
    try {
      logger.info(`Memory glitch trying ${currentModel} (attempt ${attempt + 1})`);
      const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: currentModel,
          messages: [
            { role: 'system', content: 'Output ONLY valid JSON. No markdown. No code fences. No explanation. Just the JSON object.' },
            { role: 'user', content: prompt },
          ],
          stream: false,
          options: { num_predict: 600, temperature: 0.9 },
          format: 'json',
        }),
      });

      if (!ollamaResponse.ok) throw new Error(`Ollama returned ${ollamaResponse.status}`);

      const responseData = await ollamaResponse.json();
      const rawContent = responseData.message?.content;
      if (!rawContent) throw new Error('Empty response');

      logger.info(`Memory glitch raw (attempt ${attempt + 1}): ${rawContent.substring(0, 100)}...`);

      const cleanedContent = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      const parsedPair = JSON.parse(jsonMatch[0]);

      // Handle models that wrap in a parent key like "diaryEntry"
      const unwrapped = parsedPair.original ? parsedPair
        : parsedPair.diaryEntry ? parsedPair.diaryEntry
        : parsedPair.data ? parsedPair.data
        : parsedPair.entry ? parsedPair.entry
        : parsedPair;

      // Also handle "paragraphs" instead of "original"
      const originalData = unwrapped.original || unwrapped.paragraphs || unwrapped.sentences;
      const glitchedData = unwrapped.glitched || unwrapped.modified || unwrapped.changed;

      if (!originalData || !glitchedData) {
        throw new Error(`Missing original or glitched. Keys found: ${Object.keys(parsedPair).join(', ')}`);
      }

      unwrapped.original = originalData;
      unwrapped.glitched = glitchedData;

      const originalArray = Array.isArray(unwrapped.original) ? unwrapped.original : [unwrapped.original];
      const glitchedArray = Array.isArray(unwrapped.glitched) ? unwrapped.glitched : [unwrapped.glitched];

      if (originalArray.length === 0 || glitchedArray.length === 0) {
        throw new Error('Empty arrays');
      }

      const minLength = Math.min(originalArray.length, glitchedArray.length);

      logger.info('Generated memory glitch pair', { difficulty, title: unwrapped.title || parsedPair.title, model: currentModel });

      return {
        title: unwrapped.title || parsedPair.title || 'A Sweet Memory',
        difficulty,
        diffCount: parsedPair.diffCount || config.diffs,
        original: originalArray.slice(0, minLength),
        glitched: glitchedArray.slice(0, minLength),
      };
    } catch (attemptError) {
      lastError = attemptError;
      logger.warn(`Memory glitch ${currentModel} failed: ${attemptError.message}, trying next model...`);
    }
  }

  throw new Error(`Failed all models: ${lastError?.message}`);
}
