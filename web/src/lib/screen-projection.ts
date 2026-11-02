/**
 * Screen-quad projection: derive the DOM overlay rect from the 3D deck's actual
 * screen mesh, so the OS overlay and the deck stay glued regardless of scene
 * re-exports, camera zoom/pan, or viewport size — no hand-tuned anchor needed.
 *
 * Spline's runtime does not document a projection API, but it *does* expose the
 * live three.js objects we need:
 *   - the camera: `app._controls.orbitControls.object` (a three.js Camera), and
 *   - the scene graph: `app._scene` (a three.js Object3D subclass with
 *     `getObjectByName`), where the screen mesh lives under one of the candidate
 *   names in `SCREEN_OBJECT_NAMES` (the scene has shipped as both `screen` and
 *   `main-screen`).
 *
 * Everything here is defensive: if any undocumented surface is missing or the
 * geometry can't be read, `measureScreenQuad` returns `null` and the caller
 * falls back to the calibrated `deriveQuad`.
 */

import type { Application } from '@splinetool/runtime';

import type { ScreenQuad } from '@/lib/deck-framing';

/**
 * Candidate names the Spline scene may give the deck's main screen. The scene
 * has been re-exported under different names (`screen` → `main-screen`), so we
 * try them in order. Bump this list if a future export renames the screen.
 */
export const SCREEN_OBJECT_NAMES = ['main-screen', 'screen', 'screen-panel', 'display-screen'];

// ── Minimal structural types for the undocumented three.js surface ──────────

interface Vec3 {
  x: number;
  y: number;
  z: number;
  clone?: () => Vec3;
  set?: (x: number, y: number, z: number) => Vec3;
  project?: (camera: unknown) => Vec3;
}

interface Matrix4 {
  elements?: ArrayLike<number>;
  copy?: (m: unknown) => unknown;
  invert?: () => unknown;
}

interface BufferAttribute {
  count?: number;
  array?: ArrayLike<number>;
  getX?: (i: number) => number;
  getY?: (i: number) => number;
  getZ?: (i: number) => number;
}

interface Geometry {
  attributes?: Record<string, BufferAttribute | undefined>;
  getAttribute?: (name: string) => BufferAttribute | undefined;
}

interface Object3D {
  position?: Vec3;
  geometry?: Geometry;
  matrixWorld?: Matrix4;
  children?: Object3D[];
  updateWorldMatrix?: (updateParents: boolean, updateChildren: boolean) => void;
}

interface Camera3D extends Object3D {
  updateMatrixWorld?: (force?: boolean) => void;
  matrixWorldInverse?: Matrix4;
  projectionMatrix?: Matrix4;
}

interface RuntimeInternals {
  _scene?: {
    activeCamera?: Camera3D;
    getObjectByName?: (name: string) => Object3D | undefined;
  };
}

// ── Accessors ───────────────────────────────────────────────────────────────

function getCamera(app: Application): Camera3D | undefined {
  // `_controls` is part of the runtime's public (if under-documented) surface.
  const orbit = (app._controls?.orbitControls?.object ?? undefined) as Camera3D | undefined;
  if (orbit && orbit.projectionMatrix) return orbit;

  const scene = (app as unknown as RuntimeInternals)._scene;
  const cam = scene?.activeCamera;
  if (cam && cam.projectionMatrix) return cam;

  return orbit;
}

function getObjectByNameAny(app: Application, names: readonly string[]): Object3D | undefined {
  const scene = (app as unknown as RuntimeInternals)._scene;
  if (!scene?.getObjectByName) return undefined;

  for (const name of names) {
    const found = scene.getObjectByName(name);
    if (found) return found;
  }
  return undefined;
}

function readPositionAttribute(geometry: Geometry | undefined): BufferAttribute | undefined {
  if (!geometry) return undefined;
  if (geometry.getAttribute) return geometry.getAttribute('position') ?? geometry.attributes?.position;
  return geometry.attributes?.position;
}

// ── Math ─────────────────────────────────────────────────────────────────────

/** Apply a column-major three.js matrix to a local-space point → world space. */
function transformPoint(mw: ArrayLike<number>, x: number, y: number, z: number): [number, number, number] {
  const wx = mw[0] * x + mw[4] * y + mw[8] * z + mw[12];
  const wy = mw[1] * x + mw[5] * y + mw[9] * z + mw[13];
  const wz = mw[2] * x + mw[6] * y + mw[10] * z + mw[14];
  return [wx, wy, wz];
}

/**
 * Project a world-space point to viewport fractions using three.js's own
 * `Vector3.project` (world → NDC), then map NDC → [0,1] with y flipped.
 */
function projectPoint(
  scratch: Vec3,
  camera: Camera3D,
  x: number,
  y: number,
  z: number,
): [number, number] | null {
  if (!scratch.set || !scratch.project) return null;
  scratch.set(x, y, z);
  const ndc = scratch.project(camera);
  const sx = (ndc.x + 1) / 2;
  const sy = (1 - ndc.y) / 2;
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return null;
  return [sx, sy];
}

// ── Measurement ──────────────────────────────────────────────────────────────

/**
 * Project a named 3D object's mesh vertices to the viewport and return the 2D
 * bounding box as viewport fractions ({x,y,w,h}). `names` are tried in order
 * (the scene has shipped the screen as both `screen` and `main-screen`, and the
 * deck controls likewise). Returns `null` when the projection isn't available.
 *
 * If the object is an empty transform (no geometry — e.g. a paint-on anchor),
 * it falls back to projecting the object's origin as a small centered quad.
 */
export function measureObjectQuad(app: Application, names: readonly string[]): ScreenQuad | null {
  const camera = getCamera(app);
  const screenObject = getObjectByNameAny(app, names);
  if (!camera || !screenObject) return null;

  try {
    screenObject.updateWorldMatrix?.(true, true);
    camera.updateMatrixWorld?.(true);
    const inverse = camera.matrixWorldInverse;
    if (inverse?.copy && inverse?.invert && camera.matrixWorld) {
      inverse.copy(camera.matrixWorld);
      inverse.invert();
    }
  } catch {
    /* matrices may still be current from the render loop */
  }

  const scratch = screenObject.position?.clone?.();
  if (!scratch) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  const visit = (obj: Object3D | undefined) => {
    if (!obj) return;
    const position = readPositionAttribute(obj.geometry);
    const mw = obj.matrixWorld?.elements;
    if (position?.count && mw && mw.length >= 16) {
      for (let i = 0; i < position.count; i++) {
        const x = position.getX ? position.getX(i) : (position.array?.[i * 3] ?? NaN);
        const y = position.getY ? position.getY(i) : (position.array?.[i * 3 + 1] ?? NaN);
        const z = position.getZ ? position.getZ(i) : (position.array?.[i * 3 + 2] ?? NaN);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;

        const [wx, wy, wz] = transformPoint(mw, x, y, z);
        const point = projectPoint(scratch, camera, wx, wy, wz);
        if (!point) continue;

        const [sx, sy] = point;
        if (sx < minX) minX = sx;
        if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy;
        if (sy > maxY) maxY = sy;
        found = true;
      }
    }
    if (Array.isArray(obj.children)) {
      for (const child of obj.children) visit(child);
    }
  };
  visit(screenObject);

  // Empty transform fallback: project the object's world origin as a small quad.
  if (!found) {
    const mw = screenObject.matrixWorld?.elements;
    if (mw && mw.length >= 16) {
      const point = projectPoint(scratch, camera, mw[12], mw[13], mw[14]);
      if (point) {
        const size = 0.02;
        return { x: point[0] - size / 2, y: point[1] - size / 2, w: size, h: size };
      }
    }
    return null;
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || maxX <= minX || maxY <= minY) {
    return null;
  }

  const quad: ScreenQuad = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  // Reject nonsensical results (degenerate, or wildly off-viewport).
  if (quad.w <= 0.001 || quad.h <= 0.001 || quad.w > 4 || quad.h > 4) return null;
  return quad;
}

/** Back-compat alias for projecting the deck's main screen mesh. */
export function measureScreenQuad(app: Application): ScreenQuad | null {
  return measureObjectQuad(app, SCREEN_OBJECT_NAMES);
}

