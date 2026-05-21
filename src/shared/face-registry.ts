import type { FaceDescriptor } from './types';

// One entry per face component in src/apps/clock/.
// v1: all faces ship as no-config stubs (configSchemaId: undefined, slots: []).
// Each face gets a real schema + slots as it's individually retrofitted.
// Preview paths point to public/face-previews/<id>.png — placeholder PNGs to
// be added; for now the 4 PNGs referenced in AppGrid.tsx are reused for the
// 4 most prominent faces.
export const FACES: FaceDescriptor[] = [
  {
    id: 'minimalismo',
    name: 'Minimalismo',
    preview: '/face-previews/minimalismo.png',
    category: 'classic',
    slots: [],
  },
  {
    id: 'analog',
    name: 'Analog',
    preview: '/0c1961af226ba211646b2b33306bc15147b1b2b6.png',
    category: 'classic',
    slots: [],
  },
  {
    id: 'productivity',
    name: 'Productivity',
    preview: '/943f75df27e1332321d3108a522e892298894540.png',
    category: 'data-rich',
    slots: [],
  },
  {
    id: 'square',
    name: 'Square',
    preview: '/8e5d0338383404692c1d0484623940d0d4399f2d.png',
    category: 'modern',
    slots: [],
  },
  {
    id: 'floral',
    name: 'Floral',
    preview: '/cee377e32880ba501c02f449690367b8028ab4cf.png',
    category: 'artistic',
    slots: [],
  },
  {
    id: 'complications-light',
    name: 'Complications Light',
    preview: '/face-previews/complications-light.png',
    category: 'data-rich',
    slots: [],
  },
  {
    id: 'complications-dark',
    name: 'Complications Dark',
    preview: '/face-previews/complications-dark.png',
    category: 'data-rich',
    // Demo slots so the admin slot grid has something real to render
    // before each face's component is retrofitted to consume them.
    slots: [
      { id: 'top-left', shape: 'small' },
      { id: 'top-right', shape: 'small' },
      { id: 'bottom-left', shape: 'small' },
      { id: 'bottom-right', shape: 'small' },
    ],
  },
  {
    id: 'world',
    name: 'World Clock',
    preview: '/face-previews/world.png',
    category: 'utility',
    slots: [],
  },
  {
    id: 'flip',
    name: 'Flip',
    preview: '/face-previews/flip.png',
    category: 'classic',
    slots: [],
  },
];

const FACES_BY_ID = new Map(FACES.map((f) => [f.id, f]));

export function getFace(id: string): FaceDescriptor | undefined {
  return FACES_BY_ID.get(id);
}

export function listFaces(): FaceDescriptor[] {
  return FACES;
}
