/**
 * Deck framing: the calibrated "anchor" between the 3D cyberdeck's camera and
 * the DOM screen overlay.
 *
 * The live Roam-OS UI is a viewport-fraction rect (the screen quad) drawn over
 * the Spline scene. The deck camera (zoom + pan) and that rect used to be
 * independent, so zooming/panning the deck would desync the overlay. To keep
 * them glued we anchor them once: at the reference framing below, the overlay
 * sits exactly on the 3D screen. Every other camera framing derives its quad
 * from that anchor, so the two always move together.
 */

/** The device screen quad as fractions of the `.cyberdeck-3d` viewport. */
export interface ScreenQuad {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A minimal camera framing shape (mirrors `CameraFraming` without the cycle). */
export interface CameraFramingLike {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Bump this whenever the Spline scene is re-exported / re-framed. Persisted
 * camera/pan/fit/deck state (and any baked anchor) from a previous scene
 * does not apply to a new export, so the OS discards it on version change.
 */
export const DECK_VERSION = '6';

/**
 * The calibrated anchor camera: the framing at which the anchor quad lines up
 * with the 3D screen in the locked front view. This is the shipped default.
 */
export const ANCHOR_CAMERA: CameraFramingLike = { zoom: 1.156757, panX: -24, panY: 0 };

/**
 * The locked aspect ratio of the deck stage. The Spline camera's projection
 * follows the canvas aspect, so to keep the fraction-based DOM overlay glued to
 * the 3D screen the canvas must never change aspect. We render the scene inside
 * a fixed-aspect, centered stage at this ratio and measure *that* box — not the
 * window — for `deriveQuad`. Must equal the aspect the `ANCHOR_QUAD` was
 * calibrated at (and the poster's aspect, so the crossfade is seamless).
 */
export const ANCHOR_ASPECT = 16 / 9;

/**
 * The screen quad at the anchor camera, measured with the in-app calibrate tool
 * (drag the handles over the 3D screen, press "Copy quad", bake here).
 */
export const ANCHOR_QUAD: ScreenQuad = {
  x: 0.10934704922418408,
  y: 0.2175859757820383,
  w: 0.6421644970572499,
  h: 0.46522406256306764,
};

/**
 * Derive the screen quad from a camera framing so the DOM overlay stays glued to
 * the 3D screen when the deck is zoomed or panned.
 *
 * Model: `setZoom` scales the scene about the viewport centre, and `pan` is an
 * accumulated screen-pixel offset (both true for Spline's OrbitControls in the
 * locked front view). So a zoom multiplies the anchor quad's size and moves its
 * centre proportionally away from the viewport centre; a pan adds a plain
 * screen-pixel translation. This is affine and exact for the front view.
 */
export function deriveQuad(camera: CameraFramingLike, vw: number, vh: number): ScreenQuad {
  const k = camera.zoom / ANCHOR_CAMERA.zoom;
  const dx = (camera.panX - ANCHOR_CAMERA.panX) / (vw || 1);
  const dy = (camera.panY - ANCHOR_CAMERA.panY) / (vh || 1);
  // Anchor centre, relative to the viewport centre.
  const cx = ANCHOR_QUAD.x + ANCHOR_QUAD.w / 2 - 0.5;
  const cy = ANCHOR_QUAD.y + ANCHOR_QUAD.h / 2 - 0.5;
  const w = ANCHOR_QUAD.w * k;
  const h = ANCHOR_QUAD.h * k;
  return {
    x: 0.5 + cx * k + dx - w / 2,
    y: 0.5 + cy * k + dy - h / 2,
    w,
    h,
  };
}
