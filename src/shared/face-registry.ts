import type { FaceDescriptor } from './types';

// One entry per face component in src/apps/clock/.
// v1: all faces ship as no-config stubs (configSchemaId: undefined, slots: []).
// Each face gets a real schema + slots as it's individually retrofitted.
// Preview paths are content-hashed PNGs in public/ (referenced by absolute
// path). The first 4 reuse the Figma-exported thumbnails also wired up in
// AppGrid.tsx; the remaining 4 are 1000×1000 captures of the real face
// components rendered at a fixed time (see PR "admin face previews").
export const FACES: FaceDescriptor[] = [
  {
    id: 'analog',
    name: 'Analog',
    preview: '/0c1961af226ba211646b2b33306bc15147b1b2b6.png',
    category: 'classic',
    configSchemaId: 'face.analog',
    slots: [],
  },
  {
    id: 'productivity',
    name: 'Productivity',
    preview: '/943f75df27e1332321d3108a522e892298894540.png',
    category: 'data-rich',
    configSchemaId: 'face.productivity',
    slots: [],
  },
  {
    id: 'square',
    name: 'Square',
    preview: '/8e5d0338383404692c1d0484623940d0d4399f2d.png',
    category: 'modern',
    configSchemaId: 'face.square',
    slots: [],
  },
  {
    id: 'floral',
    name: 'Floral',
    preview: '/cee377e32880ba501c02f449690367b8028ab4cf.png',
    category: 'artistic',
    configSchemaId: 'face.floral',
    slots: [],
  },
  {
    id: 'complications-light',
    name: 'Complications Light',
    preview: '/23a70b5c03a1dad0739fc0dfc3b856a3e10ca67d.png',
    category: 'data-rich',
    configSchemaId: 'face.complications-light',
    slots: [],
  },
  {
    id: 'complications-dark',
    name: 'Complications Dark',
    preview: '/9235345f65e513b5e7aceabbd085eab5540c6aba.png',
    category: 'data-rich',
    configSchemaId: 'face.complications-dark',
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
    preview: '/7063457ea5ac3dba5a7ac7d5d5fa34b61150e8d0.png',
    category: 'utility',
    configSchemaId: 'face.world',
    slots: [],
  },
  {
    id: 'flip',
    name: 'Flip',
    preview: '/81f827aa0fce6e3d8f7e16f44d368fa05531b8a1.png',
    category: 'classic',
    configSchemaId: 'face.flip',
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
