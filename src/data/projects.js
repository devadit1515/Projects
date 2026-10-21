// Projects in the order the path visits them. Everything in the scene and UI
// is generated from this list.

const colors = ['#ff9a62', '#7fd4ff', '#c79bff', '#ffd36e', '#6ff0c0', '#ff7fa6', '#93a4ff', '#ffc39a'];

const written = [
  {
    id: 'aloud',
    title: 'Aloud',
    tagline: 'Lets people with ALS or paralysis speak using only their blinks and a webcam.',
    year: '2026',
    role: 'Solo designer & engineer',
    tags: ['Computer vision', 'Assistive tech', 'Next.js'],
    image: {
      src: '/projects/aloud.webp',
      alt: 'The Aloud home board, with the highlight resting on “I feel” above the I need, People, Answers and Spell it out options',
    },
    description: [
      'My grandfather has ALS, and watching him lose his voice is why I built Aloud. Eye-controlled communication devices already exist, but they cost thousands of dollars and need a specialist to set up. Aloud does the same job in a browser tab, using the webcam already built into the laptop.',
      'A highlight moves through the options on its own, and the person holds a blink to choose. They only decide when, never where, so it works even with very weak muscle control. Everyday needs like pain, water, medicine or “I love you” are at most two blinks away. Anything else can be spelled out, any letter in three blinks, and an AI model usually guesses the full sentence by the second or third letter. Aloud then speaks the message, and urgent ones like “I can’t breathe” keep repeating until someone responds.',
      'The hardest part was telling a deliberate blink from a natural one. I built a state machine on MediaPipe’s face tracking that times how long each eye stays shut, with thresholds tuned to the person in a ten-second setup. When their eyes start to close, the scan pauses and waits, so a slower user is never rushed past the option they want. Face detection runs entirely on the device, no video leaves the browser, and the core works offline.',
      'Aloud won Best Overall Hack at HackJPS 2026, out of 142 contestants, and was runner-up at Build the Future with AI. I’m now in discussions with Apollo Hospitals and a senior neurologist about a pilot and the next version.',
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
