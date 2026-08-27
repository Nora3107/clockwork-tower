"""
============================================================================
 cutout.py — Tach nen trang khoi anh asset, xuat PNG co kenh trong suot
============================================================================
 VI SAO CAN?
   Meowa Studio o che do "General Generation" (1-10 credit) tra ve PNG RGB
   nen trang dac, KHONG co kenh alpha. Che do "HD Art" co tach nen san nhung
   dat gap nhieu lan (15 credit/lan). Script nay lam mien phi ngay tai may.

 CACH LAM — vi sao khong xoa thang moi diem anh mau trang?
   Vi ban than nhan vat cung co diem sang trang (anh phan chieu tren dong,
   dom sang trong mat kinh). Xoa mu la thung nguoi.
   Thay vao do dung LOANG TU MEP: chi nhung vung trang NOI LIEN voi vien
   anh moi bi coi la nen. Diem trang nam lot giua nhan vat duoc giu nguyen.

 MUC LUC
   [1] doc tham so dong lenh
   [2] loang tu mep de danh dau vung nen
   [3] lam mem vien (chong rang cua)
   [4] cat sat noi dung + luu

 CACH DUNG
   python scripts/cutout.py public/assets/robot-idle.png
   python scripts/cutout.py public/assets/*.png --tol 40 --no-trim
============================================================================
"""

import sys
import os
from collections import deque

from PIL import Image

# ============================================================================
# [1] THAM SO
# ============================================================================
# Nguong coi la "trang": khoang cach toi da tren tung kenh mau so voi mau nen
# lay o goc anh. Tang len neu nen bi am hoac co chuyen sac nhe.
DEFAULT_TOL = 32

# Do rong vien lam mem, tinh bang diem anh.
FEATHER = 1


def parse_args(argv):
    files, tol, trim = [], DEFAULT_TOL, True
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--tol":
            i += 1
            tol = int(argv[i])
        elif a == "--no-trim":
            trim = False
        else:
            files.append(a)
        i += 1
    return files, tol, trim


# ============================================================================
# [2] LOANG TU MEP — danh dau vung nen
# ----------------------------------------------------------------------------
#  Bat dau tu toan bo vien anh, lan vao trong theo 4 huong, chi di qua nhung
#  diem anh du gan mau nen. Ket qua la mot mat na dung bang kich thuoc anh:
#  True = nen (se trong suot), False = nhan vat (giu lai).
# ============================================================================
def flood_background(px, w, h, bg, tol):
    seen = bytearray(w * h)
    q = deque()

    def close_to_bg(x, y):
        r, g, b = px[x, y][:3]
        return (abs(r - bg[0]) <= tol
                and abs(g - bg[1]) <= tol
                and abs(b - bg[2]) <= tol)

    # Gieo mam tu 4 canh anh
    for x in range(w):
        for y in (0, h - 1):
            if not seen[y * w + x] and close_to_bg(x, y):
                seen[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x] and close_to_bg(x, y):
                seen[y * w + x] = 1
                q.append((x, y))

    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                idx = ny * w + nx
                if not seen[idx] and close_to_bg(nx, ny):
                    seen[idx] = 1
                    q.append((nx, ny))
    return seen


# ============================================================================
# [3] LAM MEM VIEN
# ----------------------------------------------------------------------------
#  Cat thang tay se de lai vien rang cua trang. Nhung diem anh NAM SAT vung
#  nen duoc ha do duc theo muc do gan mau trang cua chinh no, nho vay vien
#  chuyen muot thay vi gay khuc.
# ============================================================================
def feather_edges(img, seen, w, h, bg, tol):
    px = img.load()
    soft = []
    for y in range(h):
        row = y * w
        for x in range(w):
            if seen[row + x]:
                continue
            # Co hang xom nao la nen khong?
            touching = False
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and seen[ny * w + nx]:
                    touching = True
                    break
            if not touching:
                continue
            r, g, b = px[x, y][:3]
            # Cang gan mau nen thi cang trong
            dist = max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2]))
            ratio = min(1.0, dist / max(1, tol * 2))
            soft.append((x, y, int(255 * ratio)))
    for x, y, a in soft:
        r, g, b = px[x, y][:3]
        px[x, y] = (r, g, b, a)


# ============================================================================
# [4] XU LY MOT TEP
# ============================================================================
def cutout(path, tol=DEFAULT_TOL, trim=True):
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    px = img.load()

    # Mau nen lay ngay goc tren trai — cho ket qua on dinh hon la gia dinh trang tinh
    bg = px[0, 0][:3]

    seen = flood_background(px, w, h, bg, tol)
    removed = sum(seen)
    if removed == 0:
        print(f"  ! {os.path.basename(path)}: khong tim thay nen lien mep, bo qua")
        return None

    for y in range(h):
        row = y * w
        for x in range(w):
            if seen[row + x]:
                px[x, y] = (0, 0, 0, 0)

    if FEATHER:
        feather_edges(img, seen, w, h, bg, tol)

    if trim:
        box = img.getbbox()
        if box:
            img = img.crop(box)

    out = os.path.splitext(path)[0] + ".cutout.png"
    img.save(out)
    pct = 100.0 * removed / (w * h)
    print(f"  OK {os.path.basename(path)} -> {os.path.basename(out)}"
          f" | {img.size[0]}x{img.size[1]} | xoa {pct:.1f}% dien tich lam nen")
    return out


if __name__ == "__main__":
    files, tol, trim = parse_args(sys.argv[1:])
    if not files:
        print(__doc__)
        sys.exit(1)
    print(f"Tach nen (nguong {tol}):")
    for f in files:
        cutout(f, tol, trim)
