// Placeholder content. Swap these for real projects later; everything in the
// scene and UI is generated from this list.

const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
const colors = ['#ff9a62', '#7fd4ff', '#c79bff', '#ffd36e', '#6ff0c0', '#ff7fa6', '#93a4ff', '#ffc39a'];

export const projects = names.map((name, i) => ({
  id: `project-${i + 1}`,
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
  color: colors[i],
}));

export const profile = {
  name: 'Devadit',
  // Contact links on the final screen, in display order. A link with no url is
  // left out, so the resume appears as soon as its file is added.
  links: [
    { label: 'GitHub', url: 'https://github.com/devadit1515' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/devadit-jain-562080257' },
    { label: 'Resume', url: '/Devadit-Jain-Resume.pdf' },
    { label: 'Instagram', url: 'https://www.instagram.com/devadit15/' },
  ],
};
