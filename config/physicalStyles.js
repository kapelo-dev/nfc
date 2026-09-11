const physicalStyles = [
  {
    id: 'mat-noir-or',
    name: 'Noir mat & or',
    bg: '#0d0a07',
    fg: '#f2ece1',
    sub: '#c9a24d',
    chip: '#c9a24d'
  },
  {
    id: 'blanc-minimal',
    name: 'Blanc minimal',
    bg: '#fbfbfa',
    fg: '#141414',
    sub: '#6b6b66',
    chip: '#141414'
  },
  {
    id: 'couleur-reseau',
    name: 'Couleur réseau',
    bg: 'linear-gradient(160deg, #2fd480, #0f9d58)',
    fg: '#ffffff',
    sub: 'rgba(255,255,255,0.9)',
    chip: '#ffffff'
  },
  {
    id: 'pop-createur',
    name: 'Pop créateur',
    bg: 'radial-gradient(120px 90px at 12% 0%, #ff8a3d, transparent 60%), radial-gradient(150px 120px at 105% 35%, #7c3aed, transparent 55%), radial-gradient(150px 120px at 25% 115%, #2dd4bf, transparent 55%), linear-gradient(160deg, #23124a, #3b0d63 45%, #5b1a8c 100%)',
    fg: '#ffffff',
    sub: '#ffe8a3',
    chip: '#ffffff'
  },
  {
    id: 'geometrique-sombre',
    name: 'Géométrique sombre',
    bg: '#0a0a0a',
    fg: '#ffffff',
    sub: '#c9a24d',
    chip: '#c9a24d'
  },
  {
    id: 'dore-elegant',
    name: 'Doré élégant',
    bg: '#f7f2ea',
    wave: '#d9bf8c',
    fg: '#3a2f22',
    sub: '#a1793f',
    chip: '#a1793f'
  },
  {
    id: 'eco-nature',
    name: 'Éco nature',
    bg: 'linear-gradient(160deg, #eef2e4, #d7e6c4)',
    fg: '#22391c',
    sub: '#4d7a3f',
    chip: '#4d7a3f',
    caption: 'Carte éco-responsable'
  },
  {
    id: 'metal-brosse',
    name: 'Métal brossé',
    bg: 'linear-gradient(120deg, #52565e, #24262b)',
    fg: '#f2f3f5',
    sub: '#b7bac0',
    chip: '#f2f3f5',
    caption: 'PARTAGEZ EN UN TAP'
  },
  {
    id: 'perle-nacre',
    name: 'Perle nacrée',
    bg: 'linear-gradient(135deg, #fdfcf9 0%, #f1eee6 45%, #fdfcf9 100%)',
    fg: '#4a453c',
    sub: '#9a9484',
    chip: '#9a9484'
  },
  {
    id: 'bicolore-pro',
    name: 'Bicolore pro',
    bg: '#ffffff',
    stripe: '#4f46e5',
    fg: '#111111',
    sub: '#6b6b76',
    chip: '#4f46e5'
  }
];

const ids = new Set([...physicalStyles.map((s) => s.id), 'custom']);

function resolvePhysicalStyle(id) {
  return ids.has(id) ? id : physicalStyles[0].id;
}

module.exports = { physicalStyles, resolvePhysicalStyle };
