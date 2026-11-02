import { ANCHOR_CAMERA, ANCHOR_QUAD, deriveQuad } from '@/lib/deck-framing';

describe('deck-framing', () => {
  it('returns the anchor quad at the anchor camera (identity)', () => {
    const q = deriveQuad(ANCHOR_CAMERA, 1280, 720);
    expect(q.x).toBeCloseTo(ANCHOR_QUAD.x, 6);
    expect(q.y).toBeCloseTo(ANCHOR_QUAD.y, 6);
    expect(q.w).toBeCloseTo(ANCHOR_QUAD.w, 6);
    expect(q.h).toBeCloseTo(ANCHOR_QUAD.h, 6);
  });

  it('scales the quad size proportionally with zoom', () => {
    const q = deriveQuad({ ...ANCHOR_CAMERA, zoom: ANCHOR_CAMERA.zoom * 2 }, 1280, 720);
    expect(q.w).toBeCloseTo(ANCHOR_QUAD.w * 2, 6);
    expect(q.h).toBeCloseTo(ANCHOR_QUAD.h * 2, 6);
  });

  it('shifts the quad by the pan delta', () => {
    const q = deriveQuad(
      { ...ANCHOR_CAMERA, panX: ANCHOR_CAMERA.panX + 100, panY: ANCHOR_CAMERA.panY + 50 },
      1000,
      500,
    );
    expect(q.x).toBeCloseTo(ANCHOR_QUAD.x + 100 / 1000, 6);
    expect(q.y).toBeCloseTo(ANCHOR_QUAD.y + 50 / 500, 6);
  });
});
