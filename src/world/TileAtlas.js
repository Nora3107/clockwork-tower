/**
 * ============================================================================
 *  TileAtlas.js — TEP NAY SINH TU DONG, DUNG SUA BANG TAY
 * ============================================================================
 *  Sinh boi: python scripts/atlas.py
 *  Nguon:    public/assets/tiles/*.png
 *  Ket qua:  public/assets/tiles-atlas.png (1024x2048)
 *
 *  Moi o la mot hinh chu nhat UV trong atlas:
 *    u0, v0 = goc duoi-trai   ·   u1, v1 = goc tren-phai
 *    aspect = ti le rong/cao that cua manh, dung de chon manh khop nhat
 *             voi be ngang cua tung buc nhay.
 *    top    = mau cua mat tren buc, lay trung binh tu mep tren chinh manh anh
 *             nay roi lam sang len. Tu khop voi anh, khong phai chinh tay.
 *
 *  O dac biet `_white`: mot o trang tinh. Nhung mat buc khong can anh (mat
 *  sau, mat day, hai mat ben) tro UV vao day, roi lay mau tu mau tung dinh.
 *  Nho vay ca toa thap chi can MOT vat lieu duy nhat.
 * ============================================================================
 */

export const ATLAS_URL = '/assets/tiles-atlas.png';

export const TILES = {
  "_white": {
    "u0": 0.0,
    "v0": 0.992188,
    "u1": 0.015625,
    "v1": 1.0,
    "aspect": 1.0,
    "top": 16777215
  },
  "special-1": {
    "u0": 0.017578,
    "v0": 0.959473,
    "u1": 0.517578,
    "v1": 1.0,
    "aspect": 6.1687,
    "top": 10843969
  },
  "special-2": {
    "u0": 0.0,
    "v0": 0.919922,
    "u1": 0.5,
    "v1": 0.958496,
    "aspect": 6.481,
    "top": 12949582
  },
  "special-3": {
    "u0": 0.0,
    "v0": 0.892578,
    "u1": 0.5,
    "v1": 0.918945,
    "aspect": 9.4815,
    "top": 9796704
  },
  "special-4": {
    "u0": 0.0,
    "v0": 0.766113,
    "u1": 0.5,
    "v1": 0.891602,
    "aspect": 1.9922,
    "top": 11367985
  },
  "zone1-forest-1": {
    "u0": 0.0,
    "v0": 0.745117,
    "u1": 0.5,
    "v1": 0.765137,
    "aspect": 12.4878,
    "top": 14598192
  },
  "zone1-forest-2": {
    "u0": 0.0,
    "v0": 0.724121,
    "u1": 0.5,
    "v1": 0.744141,
    "aspect": 12.4878,
    "top": 14467632
  },
  "zone1-forest-3": {
    "u0": 0.0,
    "v0": 0.709473,
    "u1": 0.5,
    "v1": 0.723145,
    "aspect": 18.2857,
    "top": 13809705
  },
  "zone1-forest-4": {
    "u0": 0.0,
    "v0": 0.696289,
    "u1": 0.5,
    "v1": 0.708496,
    "aspect": 20.48,
    "top": 14073390
  },
  "zone2-ice-1": {
    "u0": 0.0,
    "v0": 0.678711,
    "u1": 0.5,
    "v1": 0.695312,
    "aspect": 15.0588,
    "top": 16777212
  },
  "zone2-ice-2": {
    "u0": 0.0,
    "v0": 0.657227,
    "u1": 0.5,
    "v1": 0.677734,
    "aspect": 12.1905,
    "top": 16777212
  },
  "zone2-ice-3": {
    "u0": 0.0,
    "v0": 0.626465,
    "u1": 0.5,
    "v1": 0.65625,
    "aspect": 8.3934,
    "top": 16776955
  },
  "zone2-ice-4": {
    "u0": 0.0,
    "v0": 0.584961,
    "u1": 0.5,
    "v1": 0.625488,
    "aspect": 6.1687,
    "top": 16777215
  },
  "zone3-core-1": {
    "u0": 0.0,
    "v0": 0.558105,
    "u1": 0.5,
    "v1": 0.583984,
    "aspect": 9.6604,
    "top": 10843721
  },
  "zone3-core-2": {
    "u0": 0.0,
    "v0": 0.538086,
    "u1": 0.5,
    "v1": 0.557129,
    "aspect": 13.1282,
    "top": 10581841
  },
  "zone3-core-3": {
    "u0": 0.0,
    "v0": 0.520508,
    "u1": 0.5,
    "v1": 0.537109,
    "aspect": 15.0588,
    "top": 10188890
  },
  "zone3-core-4": {
    "u0": 0.0,
    "v0": 0.494141,
    "u1": 0.5,
    "v1": 0.519531,
    "aspect": 9.8462,
    "top": 10581842
  }
};

/** O trang cho cac mat khong dan anh. */
export const WHITE = TILES._white;

/**
 * Chon manh khop nhat voi mot buc nhay.
 * @param {string} prefix ten vung, vd 'zone1-forest'
 * @param {number} ratio  ti le rong/cao that cua buc
 */
export function pickTile(prefix, ratio) {
  let best = null;
  let bestErr = Infinity;
  for (const name in TILES) {
    if (!name.startsWith(prefix)) continue;
    const err = Math.abs(Math.log(TILES[name].aspect / ratio));
    if (err < bestErr) { bestErr = err; best = TILES[name]; }
  }
  return best || WHITE;
}
