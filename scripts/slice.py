"""
============================================================================
 slice.py — Cat mot tam sheet nhieu manh thanh tung tep PNG rieng
============================================================================
 VI SAO KHONG CHIA LUOI CUNG?
   Meowa tra ve mot tam anh lon chua nhieu manh (4 buc nhay, 8 icon, 4 banh
   rang...) nhung chung KHONG nam deu nhau tren mot luoi. Chia cung theo
   toa do se cat cut mat manh nay va chua nua manh kia.
   Thay vao do: tim VUNG LIEN THONG cua nhung diem anh khong trong suot.

 BAY PHAI TRANH
   Mot manh thuong bi vo thanh NHIEU vung roi nhau: cai loa va song am tach
   roi, tru bang tach khoi than buc, tia lua tach khoi chan robot. Neu chi
   lay tung vung mot thi mot icon se ra thanh ba tep.
   Cach xu ly: sau khi tim vung, GOP nhung hop bao nam gan nhau (trong khoang
   --gap) lai lam mot.

 MUC LUC
   [1] tham so dong lenh
   [2] tim vung lien thong (chay tren anh thu nho cho nhanh)
   [3] gop cac hop bao nam gan nhau
   [4] sap xep theo hang roi cat va luu

 CACH DUNG
   python scripts/slice.py public/assets/ui-icons.png --out public/assets/icons
   python scripts/slice.py public/assets/bg-gears.png --out public/assets/gears --names gear-a,gear-b
============================================================================
"""

import sys
import os
from collections import deque

from PIL import Image

# ============================================================================
# [1] THAM SO
# ============================================================================
SCALE = 4        # thu nho bao nhieu lan truoc khi do vung (chi de tim, khong de cat)
MIN_AREA = 300   # vung nho hon nay (tinh tren anh da thu nho) coi la bui, bo di
GAP = 26         # hai hop bao cach nhau duoi bay nhieu diem anh thi gop lam mot
PAD = 6          # chua them vien quanh manh khi cat

# Diem anh phai duc hon nguong nay moi duoc tinh la "co noi dung".
# Nang len khi cac manh bi DINH NHAU oan: thu pham thuong la mot lop suong mo
# rat nhat con sot quanh mep sau khi tach nen, du de noi hai manh lam mot.
ALPHA = 24


def parse_args(argv):
    o = {"file": None, "out": None, "names": None,
         "gap": GAP, "min_area": MIN_AREA, "pad": PAD, "alpha": ALPHA}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--out":
            i += 1; o["out"] = argv[i]
        elif a == "--names":
            i += 1; o["names"] = argv[i].split(",")
        elif a == "--gap":
            i += 1; o["gap"] = int(argv[i])
        elif a == "--min-area":
            i += 1; o["min_area"] = int(argv[i])
        elif a == "--pad":
            i += 1; o["pad"] = int(argv[i])
        elif a == "--alpha":
            i += 1; o["alpha"] = int(argv[i])
        else:
            o["file"] = a
        i += 1
    return o


# ============================================================================
# [2] TIM VUNG LIEN THONG
# ----------------------------------------------------------------------------
#  Do tren anh da thu nho SCALE lan: nhanh hon SCALE^2 lan ma van du chinh xac
#  vi ta chi can HOP BAO chu khong can duong vien tung diem anh.
# ============================================================================
def find_regions(alpha_small, w, h, min_area, alpha_min):
    px = alpha_small.load()
    seen = bytearray(w * h)
    boxes = []

    for sy in range(h):
        for sx in range(w):
            idx = sy * w + sx
            if seen[idx] or px[sx, sy] < alpha_min:
                continue
            # Loang ra toan bo vung dinh lien nhau
            q = deque([(sx, sy)])
            seen[idx] = 1
            x0 = x1 = sx
            y0 = y1 = sy
            area = 0
            while q:
                x, y = q.popleft()
                area += 1
                if x < x0: x0 = x
                if x > x1: x1 = x
                if y < y0: y0 = y
                if y > y1: y1 = y
                for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1),
                               (x+1, y+1), (x-1, y-1), (x+1, y-1), (x-1, y+1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not seen[j] and px[nx, ny] >= alpha_min:
                            seen[j] = 1
                            q.append((nx, ny))
            if area >= min_area:
                boxes.append([x0, y0, x1, y1])
    return boxes


# ============================================================================
# [3] GOP CAC HOP BAO NAM GAN NHAU
# ----------------------------------------------------------------------------
#  Lap di lap lai cho toi khi khong con cap nao du gan de gop nua.
# ============================================================================
def merge_boxes(boxes, gap):
    changed = True
    while changed:
        changed = False
        out = []
        while boxes:
            b = boxes.pop()
            merged = True
            while merged:
                merged = False
                for i, c in enumerate(boxes):
                    if near(b, c, gap):
                        b = [min(b[0], c[0]), min(b[1], c[1]),
                             max(b[2], c[2]), max(b[3], c[3])]
                        boxes.pop(i)
                        merged = True
                        changed = True
                        break
            out.append(b)
        boxes = out
    return boxes


def near(a, b, gap):
    """Hai hop bao co chong nhau, hoac cach nhau duoi `gap` theo ca hai truc?"""
    dx = max(0, max(a[0], b[0]) - min(a[2], b[2]))
    dy = max(0, max(a[1], b[1]) - min(a[3], b[3]))
    return dx <= gap and dy <= gap


# ============================================================================
# [4] CAT VA LUU
# ============================================================================
def slice_sheet(o):
    img = Image.open(o["file"]).convert("RGBA")
    W, H = img.size

    small = img.split()[-1].resize((W // SCALE, H // SCALE))
    sw, sh = small.size

    boxes = find_regions(small, sw, sh, o["min_area"], o["alpha"])
    boxes = merge_boxes(boxes, o["gap"] // SCALE)

    # Doi ve toa do that + chua vien, roi cat khit vao noi dung
    real = []
    for x0, y0, x1, y1 in boxes:
        real.append((
            max(0, x0 * SCALE - o["pad"]),
            max(0, y0 * SCALE - o["pad"]),
            min(W, (x1 + 1) * SCALE + o["pad"]),
            min(H, (y1 + 1) * SCALE + o["pad"]),
        ))

    # Sap xep theo HANG roi tu trai sang phai, giong thu tu doc chu
    row_h = max((b[3] - b[1]) for b in real) if real else 1
    real.sort(key=lambda b: (round(b[1] / (row_h * 0.6)), b[0]))

    out_dir = o["out"] or os.path.splitext(o["file"])[0]
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.splitext(os.path.basename(o["file"]))[0]

    print(f"{os.path.basename(o['file'])}: tim thay {len(real)} manh")
    saved = []
    for i, b in enumerate(real):
        piece = img.crop(b)
        bb = piece.getbbox()          # cat khit lan cuoi, bo vien trong suot thua
        if bb:
            piece = piece.crop(bb)
        name = (o["names"][i] if o["names"] and i < len(o["names"])
                else f"{base}-{i + 1}")
        path = os.path.join(out_dir, name + ".png")
        piece.save(path)
        saved.append(path)
        print(f"  {name + '.png':26} {piece.size[0]:5} x {piece.size[1]:<5}")
    return saved


if __name__ == "__main__":
    opts = parse_args(sys.argv[1:])
    if not opts["file"]:
        print(__doc__)
        sys.exit(1)
    slice_sheet(opts)
