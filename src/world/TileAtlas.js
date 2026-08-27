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
    "v0": 0.958496,
    "u1": 0.517578,
    "v1": 1.0,
    "aspect": 6.0235,
    "top": 10844225
  },
  "special-2": {
    "u0": 0.0,
    "v0": 0.919434,
    "u1": 0.5,
    "v1": 0.95752,
    "aspect": 6.5641,
    "top": 12817995
  },
  "special-3": {
    "u0": 0.0,
    "v0": 0.891602,
    "u1": 0.5,
    "v1": 0.918457,
    "aspect": 9.3091,
    "top": 9730911
  },
  "special-4": {
    "u0": 0.0,
    "v0": 0.765137,
    "u1": 0.5,
    "v1": 0.890625,
    "aspect": 1.9922,
    "top": 11499054
  },
  "zone1-forest-1": {
    "u0": 0.0,
    "v0": 0.744141,
    "u1": 0.5,
    "v1": 0.76416,
    "aspect": 12.4878,
    "top": 14466607
  },
  "zone1-forest-2": {
    "u0": 0.0,
    "v0": 0.724121,
    "u1": 0.5,
    "v1": 0.743164,
    "aspect": 13.1282,
    "top": 14336303
  },
  "zone1-forest-3": {
    "u0": 0.0,
    "v0": 0.709473,
    "u1": 0.5,
    "v1": 0.723145,
    "aspect": 18.2857,
    "top": 13612327
  },
  "zone1-forest-4": {
    "u0": 0.0,
    "v0": 0.695801,
    "u1": 0.5,
    "v1": 0.708496,
    "aspect": 19.6923,
    "top": 13876269
  },
  "zone2-ice-1": {
    "u0": 0.0,
    "v0": 0.677734,
    "u1": 0.5,
    "v1": 0.694824,
    "aspect": 14.6286,
    "top": 16776439
  },
  "zone2-ice-2": {
    "u0": 0.0,
    "v0": 0.655762,
    "u1": 0.5,
    "v1": 0.676758,
    "aspect": 11.907,
    "top": 16710904
  },
  "zone2-ice-3": {
    "u0": 0.0,
    "v0": 0.624512,
    "u1": 0.5,
    "v1": 0.654785,
    "aspect": 8.2581,
    "top": 16645369
  },
  "zone2-ice-4": {
    "u0": 0.0,
    "v0": 0.583496,
    "u1": 0.5,
    "v1": 0.623535,
    "aspect": 6.2439,
    "top": 16711677
  },
  "zone3-core-1": {
    "u0": 0.0,
    "v0": 0.556641,
    "u1": 0.5,
    "v1": 0.58252,
    "aspect": 9.6604,
    "top": 10909255
  },
  "zone3-core-2": {
    "u0": 0.0,
    "v0": 0.536621,
    "u1": 0.5,
    "v1": 0.555664,
    "aspect": 13.1282,
    "top": 10581841
  },
  "zone3-core-3": {
    "u0": 0.0,
    "v0": 0.518555,
    "u1": 0.5,
    "v1": 0.535645,
    "aspect": 14.6286,
    "top": 10188889
  },
  "zone3-core-4": {
    "u0": 0.0,
    "v0": 0.491699,
    "u1": 0.5,
    "v1": 0.517578,
    "aspect": 9.6604,
    "top": 10647120
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
