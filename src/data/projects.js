// Projects in the order the path visits them. Everything in the scene and UI
// is generated from this list.

const colors = ['#ff9a62', '#7fd4ff', '#c79bff', '#ffd36e', '#6ff0c0', '#ff7fa6', '#93a4ff', '#ffc39a'];

const written = [
  {
    id: 'aloud',
    title: 'Aloud',
    tagline: 'Eye blinks are turned into speech for people with ALS and paralysis, using only a webcam.',
    year: '2026',
    role: 'Solo designer & engineer',
    tags: ['Computer vision', 'Assistive tech', 'Next.js'],
    image: {
      src: '/projects/aloud.webp',
      alt: 'The Aloud title screen: “A voice for anyone who can speak only with their eyes,” with a Begin with eye control button',
    },
    description: [
      'Aloud is designed for people with ALS, cerebral palsy or severe paralysis who can no longer speak or type. Speech is produced from eye blinks alone, using only a laptop’s built-in webcam in a browser tab.',
      'Two distinct modes are offered. The first is organised into four categories, I feel, I need, People and Answers, each holding the phrases needed most often, from “I’m in pain” and “too cold” to “hold my hand” and a simple yes or no. A highlight travels across the screen on its own, so no pointing or aiming is ever required. Any blink held for longer than 0.5 seconds is registered as a click, and a soft tone confirms every selection. Once a phrase is chosen, it is spoken aloud instantly. A caretaker’s Telegram account can also be linked, so every message spoken through the app is delivered to the caretaker as a text, wherever they are.',
      'The second mode is reserved for custom phrases. The keyboard is navigated in a two-step process: a row is selected first, then the letter within it, which keeps every letter within three blinks. Controls for deleting a letter or word, undoing and clearing sit on the same board. Above the letters, a line of AI suggestions helps complete words and full sentences from just the first few letters, and the words a user relies on most are surfaced first over time.',
      'Blinks are detected on the device with MediaPipe face tracking. Deliberate blinks are separated from natural ones by a custom state machine, with thresholds calibrated to each user in ten seconds. The scan is paused while the eyes are closing, so slower users are never rushed. No video leaves the browser, and the core is kept fully functional offline.',
      'Won Best Overall Hack at HackJPS 2026 and runner-up at Build the Future with AI. A pilot is being discussed with Apollo Hospitals and a senior neurologist.',
    ],
    links: {
      live: 'https://aloud-pink.vercel.app',
      code: 'https://github.com/devadit1515/aloud',
      video: 'https://youtu.be/5cw96FgeBis',
    },
  },
  {
    id: 'typing-sanctuary',
    title: 'Typing Sanctuary',
    tagline: 'Users are verified by how they type, not just what they type.',
    year: '2026',
    role: 'Solo designer & engineer',
    tags: ['Deep learning', 'Cybersecurity', 'Biometrics'],
    image: {
      src: '/projects/typing-sanctuary.webp',
      alt: 'The Typing Sanctuary home page, “You type like no one else,” with a keystroke rhythm chart drawn from a typed phrase',
    },
    description: [
      'Typing Sanctuary is a behavioural-biometric second factor. Identity is verified from typing rhythm alone: how long each key is held and the gaps between keys. That rhythm is turned into a personal fingerprint that cannot be faked with a stolen password.',
      'Identity is checked at two points. At login, the password is judged by how it is typed as well as what is typed. During the session, typing is re-verified continuously, so a change of hands at the keyboard is caught mid-session. If a check fails, another factor is requested, and access is never granted by default. The keystroke data is gathered through a real-time multiplayer typing game, complete with races, leaderboards and friends.',
      'Each burst of typing is condensed into a 128-number fingerprint by a compact CNN and BiGRU network, trained with triplet loss, the technique behind face recognition. A new user is enrolled from about a dozen samples, with no retraining. Matches are scored by a blend of distance measures inside that learned space, and only the derived fingerprint is stored, never the raw keystrokes.',
      'Won the CREST Gold Award from the British Science Association for the accompanying research paper.',
    ],
    links: { live: 'https://typing-sanctuary.onrender.com', code: 'https://github.com/devadit1515/typing-sanctuary' },
  },
  {
    id: 'mango-farm',
    title: 'Mango Farm Management',
    tagline: 'Yield, variety and disease decisions are made for mango farmers by machine learning.',
    year: '2025',
    role: 'Designer & engineer',
    tags: ['Machine learning', 'Computer vision', 'Agritech'],
    description: [
      'A machine-learning toolkit is built for mango farmers, covering the three decisions that shape a harvest: how much fruit the trees will yield, which variety suits the land, and whether disease is setting in.',
      'Yield is estimated directly from photos of the trees, replacing manual counts in the orchard. The best-suited mango variety is recommended for each plot from its soil and climate data. Early signs of disease are detected and flagged before they can spread across the orchard.',
      'Built at the TIS AI Fellowship for Global Young Leaders at MIT, and pitched to investors in the fellowship’s Market Readiness challenge. Won the CREST Gold Award from the British Science Association for the accompanying research paper.',
    ],
    links: {},
  },
  {
    id: 'cloakroom',
    title: 'Cloakroom',
    tagline: 'Confidential data is masked before it reaches an LLM, and restored in the answer.',
    year: '2026',
    role: 'Engineering intern, EXL',
    tags: ['AI security', 'Data privacy', 'Python'],
    image: {
      src: '/projects/cloakroom.webp',
      alt: 'The Cloakroom home page, “Your data never meets the model,” with a record whose name, account, amount and condition are replaced by tokens',
    },
    description: [
      'Cloakroom is a privacy layer placed in front of any LLM call. Names, account numbers, Aadhaar and PAN numbers, card numbers, amounts and medical conditions are swapped for placeholder tokens such as [PFI_ACCOUNT_1] before the model sees them, and the real values are restored in the response shown to the user.',
      'Every request is run through four stages: detect, mask, reason and unmask. Sensitive data is tagged as personal, health or financial, and field names are read for context, so a 12-digit account number is never mistaken for an Aadhaar number. The same value is always given the same token, so relationships in the data are preserved and the model can still reason over them. The model’s output is re-scanned for leaked values, the originals are held in an encrypted vault, and only counts are written to the audit log.',
      'Detectors, vaults and models are swapped through configuration alone, from a free local stack to AWS Comprehend, DynamoDB and Bedrock, with no paid API keys required. A browser extension brings the same masking to ChatGPT and Claude, with replies unmasked locally in the page. Developed during an internship at EXL.',
    ],
    links: { live: 'https://cloakroom-mu.vercel.app', code: 'https://github.com/devadit1515/cloakroom' },
  },
  {
    id: 'rubriq',
    title: 'Rubriq',
    tagline: 'AI outputs are scored against published research, and the prompt that fixes them is written.',
    year: '2026',
    role: 'Engineering intern, EXL',
    tags: ['LLM evaluation', 'NLP', 'Python'],
    image: {
      src: '/projects/rubriq.webp',
      alt: 'The Rubriq home page, “Read the answer before you trust it,” with sample cases and boxes for a prompt and its output',
    },
    description: [
      'Rubriq diagnoses the quality of an LLM’s output. The original prompt and the response are pasted in, every weakness is identified, and the evidence for each finding is quoted from the output itself.',
      'The task is classified first, as summarisation, code generation, extraction, Q&A, reasoning, rewriting or creative writing. Each type is then scored on the parameters published research assigns to it, including faithfulness to the source, instruction following, relevance, readability, hallucination risk and code quality. Anything that cannot be judged reliably is labelled as such rather than guessed.',
      'For every failure found, a complete replacement prompt is generated in the conventions of the named model family: XML tags and quote-first grounding for Claude, delimiters and literal phrasing for GPT, few-shot examples for Gemini. Everything is run locally, with no API calls and no data leaving the machine. Developed during an internship at EXL.',
    ],
    links: { live: 'https://rubriq-liard.vercel.app', code: 'https://github.com/devadit1515/rubriq' },
  },
];

// Stand-ins for the stops that haven't been written up yet.
const placeholders = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta']
  .slice(written.length)
  .map((name) => ({
    id: `placeholder-${name.toLowerCase()}`,
    title: `Project ${name}`,
    tagline: 'One-line description of what this project does and who it is for.',
    year: '2026',
    role: 'Role placeholder',
    tags: ['Tag one', 'Tag two', 'Tag three'],
    description: [
      'Placeholder paragraph. Describe the problem this project solves and why it mattered enough to build.',
      'Second placeholder paragraph. Explain how it works, what was hard, and what the result was.',
    ],
    links: { live: '#', code: '#' },
  }));

export const projects = [...written, ...placeholders].map((project, i) => ({ ...project, color: colors[i] }));

export const profile = {
  name: 'Devadit',
  // Contact links on the final screen, in display order. A link with no url is
  // left out, so the resume appears as soon as its file is added.
  links: [
    { label: 'GitHub', url: 'https://github.com/devadit1515' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/devadit-jain-562080257' },
    { label: 'Resume', url: '/Devadit-Jain-Resume.pdf' },
  ],
};
