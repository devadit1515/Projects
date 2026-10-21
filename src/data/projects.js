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
      'Options such as “I feel,” “I need” and a spelling board are shown on screen and lit up one after another. When the wanted option is lit, it is selected by holding the eyes closed for a moment. Ready-made messages like “I’m in pain” are reached in two blinks. Anything else is spelled letter by letter, and the full sentence is suggested by AI after the first few letters. The finished message is read out loud, and urgent messages are repeated until someone responds.',
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
