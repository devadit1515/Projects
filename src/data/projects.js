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
      'Aloud is designed for people with ALS, cerebral palsy or severe paralysis who can no longer speak or type. Speech is produced from eye blinks alone. Everything is run in a browser tab with a laptop’s built-in webcam, so eye-tracking hardware costing thousands of dollars is not needed.',
      'Options are highlighted one at a time by an automatic scan, and a choice is made with a single held blink. Only timing is required from the user, never aim or precision. Any preset message is reached in two blinks and any letter in three. Full sentences are predicted by AI from the first few letters, every message is spoken aloud, and urgent messages are repeated until help is confirmed.',
      'Blinks are detected on the device with MediaPipe face tracking. Deliberate blinks are separated from natural ones by a custom state machine, with thresholds calibrated to each user in ten seconds. The scan is paused while the eyes are closing, so slower users are never rushed. No video leaves the browser, and the core is kept fully functional offline.',
      'Won Best Overall Hack at HackJPS 2026 and runner-up at Build the Future with AI. A pilot is being discussed with Apollo Hospitals and a senior neurologist.',
    ],
    links: {
      live: 'https://aloud-pink.vercel.app',
      code: 'https://github.com/devadit1515/aloud',
      video: 'https://youtu.be/5cw96FgeBis',
    },
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
