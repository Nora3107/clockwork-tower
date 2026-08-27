"""
============================================================================
 atlas.py — Dong 16 manh buc nhay vao MOT tam anh duy nhat
============================================================================
 VI SAO BAT BUOC PHAI LAM ATLAS?
   Moi tam anh la mot vat lieu, va MOI VAT LIEU LA MOT LENH VE.
   Neu 3 vung sinh thai dung 3 tam anh rieng thi khoi hinh hoc da gop theo
   tang trong Level.js se bi tach lam 3 — pha vo dung thanh qua da ton cong
   keo tu 190 xuong 18-35 lenh ve.
   Don het vao mot tam anh thi ca toa thap van chi can MOT vat lieu.

 THU CO TEN "O TRANG"
   Khong phai mat nao cua buc cung co anh: mat sau, mat day va hai mat ben
   chi can mot mau tron. Nhung neu chung dung vat lieu khac thi lai them mot
   lenh ve nua.
   Cach lach: nhet vao atlas mot o TRANG TINH. Nhung mat khong co anh se tro
   UV vao o trang do, roi mau that lay tu MAU TUNG DINH (vertexColors). Vat
   lieu co ca `map` lan `vertexColors` se nhan hai thu voi nhau:
       trang (1,1,1) x mau dinh = dung mau dinh
   Ket qua: mot vat lieu duy nhat lo duoc ca mat co anh lan mat mau tron.

 MUC LUC
   [1] thu nho manh ve do phan giai thuc su can
   [2] xep manh theo kieu "ke sach" (shelf packing)
   [3] xuat atlas.png + bang toa do UV ra tep JS

 CACH DUNG
   python scripts/atlas.py
============================================================================
"""

import io
import json
import os
import glob

from PIL import Image

# ============================================================================
# [1] THAM SO
# ============================================================================
SRC_DIR = "public/assets/tiles"
OUT_PNG = "public/assets/tiles-atlas.png"
OUT_JS = "src/world/TileAtlas.js"

# Be ngang toi da cua mot manh sau khi thu nho.
# Buc rong nhat trong game la 48 don vi, hien thi khoang 18 diem anh moi don
# vi -> ~870 diem anh. Lay 512 la du net ma nhe han mot nua.
MAX_TILE_W = 512

PAD = 2          # vien chen giua cac manh, chong ri mau khi GPU lam mo (mipmap)
ATLAS_W = 1024   # be ngang atlas, luon la luy thua cua 2


def solid_band(im, need=0.92):
    """
    Cat lay DAI NGANG DAC NHAT cua manh anh.

    VI SAO PHAI CAT?
      Anh buc nhay co nen trong suot va nhung phan tho ra ngoai: tru bang rui
      xuong, day leo, ong hoi. Nhung hop VA CHAM lai la mot hinh chu nhat dac.
      Dan thang anh co lo thung len mat truoc cua hop thi nhin xuyen qua lo do
      se thay... mat sau cua chinh cai hop. Rat vo ly.

      Nen ta chi lay phan than buc — dai cac hang ngang ma gan nhu MOI diem anh
      deu duc. Dai nay dan khit vao mat truoc hop, khong con lo nao.
      Doi lai la mat may cai tru bang thong xuong duoi, chap nhan duoc.
    """
    a = im.split()[-1]
    w, h = im.size
    rows = []
    for y in range(h):
        opaque = sum(1 for x in range(0, w, 4) if a.getpixel((x, y)) > 200)
        rows.append(opaque / max(1, len(range(0, w, 4))))

    best = (0, 0, 0)          # (do dai, dau, cuoi)
    run_start = None
    for y, cov in enumerate(rows + [0.0]):
        if cov >= need:
            if run_start is None:
                run_start = y
        elif run_start is not None:
            if y - run_start > best[0]:
                best = (y - run_start, run_start, y)
            run_start = None

    if best[0] < 4:
        return im               # khong tim duoc dai dac nao, giu nguyen
    return im.crop((0, best[1], w, best[2]))


def load_tiles():
    """Nap moi manh, cat lay dai dac, thu nho, dat ten theo vung."""
    tiles = []
    for path in sorted(glob.glob(os.path.join(SRC_DIR, "*.png"))):
        name = os.path.splitext(os.path.basename(path))[0]
        name = name.replace("tiles-", "")
        im = Image.open(path).convert("RGBA")

        before = im.size
        im = solid_band(im)
        # Bo hoan toan kenh alpha: den day manh da dac 100%, giu alpha chi ton
        # dung luong va lam GPU phai bat che do pha tron khong can thiet.
        flat = Image.new("RGB", im.size)
        flat.paste(im.convert("RGB"))
        im = flat.convert("RGBA")

        if im.width > MAX_TILE_W:
            h = round(im.height * MAX_TILE_W / im.width)
            im = im.resize((MAX_TILE_W, h), Image.LANCZOS)
        tiles.append({
            "name": name, "img": im, "crop": (before, im.size),
            "top": top_color(im),
        })
    return tiles


def top_color(im, frac=0.18, lift=1.25):
    """
    Mau trung binh cua DAI TREN CUNG manh anh, sang len mot chut.

    VI SAO CAN?
      Mat tren cua buc khong dan anh (xem chu thich trong MergeUtils phan [4])
      ma to mau tron. Neu mau do chon bang tay thi moi lan doi anh lai phai
      chinh lai cho khop. Lay thang tu chinh tam anh thi no TU KHOP mai mai.

      Nhan them `lift` cho sang hon phan than buc: mat tren la thu nguoi choi
      liec mot cai de biet cho nao dat chan duoc, no phai noi bat len.
    """
    w, h = im.size
    band = max(1, int(h * frac))
    r = g = b = n = 0
    for y in range(band):
        for x in range(0, w, 3):
            px = im.getpixel((x, y))
            if px[3] < 200:
                continue
            r += px[0]; g += px[1]; b += px[2]; n += 1
    if not n:
        return 0x888888
    r, g, b = r / n * lift, g / n * lift, b / n * lift

    # San do sang toi thieu. Vung 3 co mat buc bang kim loai toi mau, de nguyen
    # thi mat tren chim vao nen va nguoi choi khong doc duoc dau la cho dat chan
    # — trong mot game doi can tung ly, do la loi thiet ke chu khong phai phong cach.
    lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    FLOOR = 0.5
    if lum < FLOOR and lum > 0.01:
        k = FLOOR / lum
        r, g, b = r * k, g * k, b * k

    clamp = lambda v: max(0, min(255, int(v)))
    return (clamp(r) << 16) | (clamp(g) << 8) | clamp(b)


# ============================================================================
# [2] XEP MANH THEO KIEU "KE SACH"
# ----------------------------------------------------------------------------
#  Xep tu trai sang phai tren mot ke; het cho thi xuong ke moi. Cac manh o day
#  deu la thanh ngang dai va det nen kieu xep don gian nay da gan nhu toi uu.
# ============================================================================
def pack(tiles, atlas_w):
    x = y = shelf_h = 0
    for t in tiles:
        w, h = t["img"].size
        if x + w + PAD > atlas_w:
            x = 0
            y += shelf_h + PAD
            shelf_h = 0
        t["x"], t["y"] = x, y
        x += w + PAD
        shelf_h = max(shelf_h, h)
    return atlas_w, y + shelf_h + PAD


# ============================================================================
# [3] XUAT
# ============================================================================
def build():
    tiles = load_tiles()
    if not tiles:
        raise SystemExit(f"Khong tim thay manh nao trong {SRC_DIR}")

    # O trang tinh dung cho cac mat khong co anh (xem chu thich dau file).
    white = Image.new("RGBA", (16, 16), (255, 255, 255, 255))
    tiles.insert(0, {"name": "_white", "img": white})

    w, h = pack(tiles, ATLAS_W)
    # Lam tron chieu cao len luy thua cua 2 cho GPU de chiu
    p2 = 1
    while p2 < h:
        p2 *= 2
    h = p2

    atlas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rects = {}
    for t in tiles:
        atlas.paste(t["img"], (t["x"], t["y"]))
        tw, th = t["img"].size
        # UV trong three.js: goc toa do o DUOI-TRAI, con anh thi tren-trai.
        # Nen truc V phai lat nguoc lai.
        rects[t["name"]] = {
            "u0": round(t["x"] / w, 6),
            "v0": round(1 - (t["y"] + th) / h, 6),
            "u1": round((t["x"] + tw) / w, 6),
            "v1": round(1 - t["y"] / h, 6),
            "aspect": round(tw / th, 4),
            # Mau mat tren, lay tu chinh mep tren cua manh anh nay
            "top": t.get("top", 0xffffff),
        }

    os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True)
    atlas.save(OUT_PNG, optimize=True)

    write_js(rects, w, h)

    size = os.path.getsize(OUT_PNG) / 1024
    print(f"atlas: {w}x{h}, {len(tiles)} o, {size:.0f}K -> {OUT_PNG}")
    for t in tiles:
        r = rects[t["name"]]
        note = ""
        if "crop" in t:
            (bw, bh), (aw, ah) = t["crop"]
            note = f"  (cat dai dac tu {bw}x{bh})"
        print(f"  {t['name']:26} ti le {r['aspect']:6.2f}"
              f"  mat tren #{r['top']:06x}{note}")


def write_js(rects, w, h):
    body = json.dumps(rects, indent=2, ensure_ascii=False)
    js = f'''/**
 * ============================================================================
 *  TileAtlas.js — TEP NAY SINH TU DONG, DUNG SUA BANG TAY
 * ============================================================================
 *  Sinh boi: python scripts/atlas.py
 *  Nguon:    public/assets/tiles/*.png
 *  Ket qua:  public/assets/tiles-atlas.png ({w}x{h})
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

export const TILES = {body};

/** O trang cho cac mat khong dan anh. */
export const WHITE = TILES._white;

/**
 * Chon manh khop nhat voi mot buc nhay.
 * @param {{string}} prefix ten vung, vd 'zone1-forest'
 * @param {{number}} ratio  ti le rong/cao that cua buc
 */
export function pickTile(prefix, ratio) {{
  let best = null;
  let bestErr = Infinity;
  for (const name in TILES) {{
    if (!name.startsWith(prefix)) continue;
    const err = Math.abs(Math.log(TILES[name].aspect / ratio));
    if (err < bestErr) {{ bestErr = err; best = TILES[name]; }}
  }}
  return best || WHITE;
}}
'''
    io.open(OUT_JS, "w", encoding="utf-8", newline="\n").write(js)


if __name__ == "__main__":
    build()
