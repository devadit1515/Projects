// Projects in the order the path visits them. Everything in the scene and UI
// is generated from this list.

const colors = ['#ff9a62', '#7fd4ff', '#c79bff', '#ffd36e', '#6ff0c0', '#ff7fa6', '#93a4ff', '#ffc39a'];

const written = [
  {
    id: 'aloud',
    title: 'Aloud',
    tagline: 'Turns eye blinks into speech for people with ALS or paralysis, using just a webcam.',
    year: '2026',
    role: 'Designer & developer',
    tags: ['Computer vision', 'Accessibility', 'Next.js'],
    description: [
      'Eye-tracking communication hardware costs hundreds to thousands of dollars and usually needs a technician to set it up. Aloud does the same job in a browser tab with the laptop’s own webcam. A caregiver runs a ten-second setup that learns how the person’s eyes look open and closed. After that, one held blink drives everything.',
      'Options light up one at a time, so the person only decides when to blink, never where to look. Any preset message is two blinks away and any letter is three. A few spelled letters can be expanded into full sentences. Word prediction runs offline underneath, so the app still works without a connection. Urgent messages like “I can’t breathe” repeat out loud until someone responds. Face detection runs on the device, and no video leaves the browser.',
      'I’m now in discussions with Apollo Hospitals and a senior neurologist about a pilot.',
    ],
    links: { live: 'https://aloud-pink.vercel.app', code: 'https://github.com/devadit1515/aloud' },
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
