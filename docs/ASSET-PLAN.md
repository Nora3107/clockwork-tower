# Kế hoạch bộ asset HD Steampunk — THE CLOCKWORK TOWER

> Soạn cho công cụ **Meowa Studio** (https://meowa.ai), project
> `proj-1787829193522-kdm8ciu4`. Mỗi mục dưới đây ghi rõ: chọn chế độ nào,
> cài đặt gì, và prompt dán thẳng vào ô nhập.

---

## 0. Trước khi bắt đầu — ba điều phải biết

### 0.1. Chon dung agent — cap nhat sau khi da chay thuc te

| Agent | Cho ra | Gia | Ket luan |
| --- | --- | --- | --- |
| **General Generation** | Anh HD tu do, 1K/2K, moi ty le khung | **10 credit** (model Detailed) | ✅ **Dung cai nay.** Khong bi mau ap phong cach, re nhat, chat luong tot nhat trong ba. |
| HD Art | 1024px, tach nen san | 15 credit | Chi hon o cho tach nen — ma viec do `scripts/cutout.py` lam mien phi tai may. |
| Map Editor (Side + HD) | Lop hau canh parallax HD | 20 credit/lop | Danh cho hau canh nhieu lop. Co san prefab "Steampunk Gear Factory" va "Clockwork Sky City". |
| Pixel Art | Sprite pixel 32–128px | 20–25 credit | ❌ Sai huong voi "HD style". La agent mac dinh — de chon nham. |

> Ke hoach ban dau dinh dung HD Art. Sau khi chay thu thi **General Generation**
> vua re hon vua tu do hon: cac mau 1024px cua HD Art deu ap san phong cach
> (watercolor / chibi / ink-wash), lan at tong steampunk.
> Nen tach nen bang `scripts/cutout.py` thay vi tra them credit cho HD Art.

### 0.2. Game hiện KHÔNG có đường ống ảnh

Toàn bộ tháp đang là hình học thuần three.js — không một tệp `.png` nào. Nhận
được asset rồi vẫn cần viết thêm code mới dùng được; xem phần [7].

### 0.3. Ngân sách

Trọn bộ dưới đây là **11 lần tạo ≈ 165 credit**. Nên chạy theo thứ tự ưu tiên
ở phần [6] chứ đừng chạy hết một lượt — asset đầu tiên sẽ cho biết prompt có
ra đúng tông không.

---

## 1. KHOÁ PHONG CÁCH — dán vào CUỐI mọi prompt

Đây là thứ giữ cho 11 lần tạo khác nhau trông như cùng một bộ. **Không được
sửa chuỗi này giữa chừng**, nếu không mỗi asset một kiểu.

```
STYLE: HD illustrated indie game asset, Victorian steampunk clockwork,
aged brass and copper, riveted metal plates, exposed gears and pistons,
warm amber sunset key light from upper left, cool cyan rim light,
clean readable silhouette, crisp edges, subtle painterly texture,
flat side-on orthographic view, transparent background,
no text, no watermark, no drop shadow on background
```

---

## 2. NHÂN VẬT — chú robot đồng hồ

**Agent** HD Art · **Mẫu** `Warm Healing Watercolor Character` (1024px)
**Model** GPT Image 2 · **Viewpoint** Side · **Background removal** Standard

### 2.1. Robot tư thế đứng (asset chính)

```
A tiny brass clockwork robot, the hero of a tower-climbing game.
Boxy riveted brass torso the size of its own head, dark copper helmet cap,
one large round glass lens eye glowing bright cyan, thin antenna with a
glowing cyan bulb on top, two short stubby feet, a visible steel gear
mounted on its back. Chunky toy-like proportions, roughly as wide as tall.
Standing idle, facing right, full body, centered.
```

### 2.2. Robot tư thế gồng lực (nén người)

```
The same tiny brass clockwork robot, compressed and crouching low to charge
a jump, body squashed down to two thirds height and bulging wider, legs bent,
cyan lens eye squinting with effort, sparks of amber energy gathering around
its feet. Facing right, full body, centered.
```

### 2.3. Robot tư thế bay (dãn người)

```
The same tiny brass clockwork robot stretched vertically in mid-flight,
body elongated and narrow, arms and feet trailing behind, cyan lens eye
wide open, a faint cyan motion streak behind it. Facing up-right,
full body, centered.
```

---

## 3. BỀ MẶT BỤC NHẢY — ba vùng sinh thái

**Agent** HD Art · **Mẫu** `Ancient Minimal Icons` (256px, bộ nhiều ô)
**Background removal** Standard

Mỗi lần tạo cho ra một BỘ nhiều mảnh — đúng thứ cần cho tileset.

### 3.1. Vùng 1 — Rừng Cơ Khí (Y 0→350, tông xanh lá + gỗ)

```
A set of 6 side-view platform tiles for a 2D climbing game: horizontal
mechanical tree branches made of green-patinated copper and dark wood,
brass bolts along the edges, small brass leaves and creeping vines,
mossy green top surface that reads clearly as a standable ledge.
Each tile is a separate horizontal slab, wider than tall.
```

### 3.2. Vùng 2 — Hầm Băng Giá (Y 350→650, tông xanh dương)

```
A set of 6 side-view platform tiles for a 2D climbing game: narrow frozen
ledges of pale blue glacier ice over dark riveted iron, glossy frost-white
top surface, small icicles hanging from the underside, faint cyan inner glow.
Each tile is a separate horizontal slab, wider than tall.
```

### 3.3. Vùng 3 — Lõi Tháp Đồng Hồ (Y 650→1000, tông đồng + cam)

```
A set of 6 side-view platform tiles for a 2D climbing game: industrial brass
machine ledges, riveted copper plates, exposed cogwheels at the ends,
glowing amber steam vents, orange warning stripes on the top surface.
Each tile is a separate horizontal slab, wider than tall.
```

---

## 4. BỤC ĐẶC BIỆT — một bộ gộp

**Agent** HD Art · **Mẫu** `Ancient Minimal Icons` (256px)

```
A set of 4 side-view special platform tiles for a steampunk climbing game,
all the same width:
1. a brass conveyor belt with visible rollers and a moving tread
2. a coiled steel spring pad, compressed and ready to launch
3. a cracked crumbling stone-and-brass slab breaking apart, pieces falling
4. a steep smooth polished brass slide ramp angled downward
Each tile is separate and clearly distinguishable from the others.
```

---

## 5. HẬU CẢNH & GIAO DIỆN

### 5.1. Bánh răng hậu cảnh (parallax)

**Mẫu** `Create` (tự định nghĩa) hoặc Character 1024px · **Background removal** Standard

```
A set of 4 giant ornate clockwork gears of different sizes, seen face-on,
dark aged brass with deep shadows, intricate spokes and engraved patterns,
heavy industrial teeth. Dim and desaturated, meant to sit far in the
background behind gameplay. Each gear separate and centered.
```

### 5.2. Cỗ Máy Thời Gian — đích đến trên đỉnh tháp

**Mẫu** Character 1024px · **Background removal** Standard

```
An ornate golden clockwork time machine at the summit of a tower: a large
vertical ring of polished gold engraved with zodiac symbols, a glowing
white-hot crystal core suspended at its center, three frozen clock hands
radiating outward, wisps of golden light and steam. Majestic, sacred,
the goal of a long climb. Front view, centered.
```

### 5.3. Bộ biểu tượng giao diện

**Mẫu** `Modern Minimal Icons` (256px) · **Background removal** Standard

```
A set of 6 steampunk UI icons for a game HUD, matching brass style:
1. a dash icon: a brass arrow wrapped in a green energy streak
2. an air-brake icon: a downward arrow hitting a brass stop plate
3. a stopwatch with a cracked glass face
4. a laurel medal stamped with a gear, for a personal best record
5. a brass speaker with sound waves
6. a small brass gear for settings
Flat, high contrast, readable at small size, each icon separate.
```

### 5.4. Ảnh nền màn hình chính

**Background removal** ❌ **TẮT** (ảnh này cần nền đầy)

```
Key art for an indie game title screen: an impossibly tall Victorian
clockwork tower disappearing into amber storm clouds, giant gears embedded
in its stone and brass walls, tiny glowing windows, a single speck of cyan
light near the base that is the hero robot. Dramatic sunset backlighting,
moody, vertical composition, cinematic, painterly.
```

---

## 6. THỨ TỰ ƯU TIÊN

| # | Asset | Credit | Vì sao ưu tiên |
| --- | --- | --- | --- |
| 1 | [2.1] Robot đứng | 15 | Chốt tông màu cho cả bộ. **Chạy cái này trước, xem ưng không rồi mới chạy tiếp.** |
| 2 | [5.4] Ảnh nền menu | 15 | Dùng được ngay, không cần sửa code |
| 3 | [5.3] Bộ icon UI | 15 | Dùng được ngay, chỉ cần CSS |
| 4 | [3.1–3.3] Ba bộ bục | 45 | Cần viết thêm code texture |
| 5 | [5.2] Cỗ Máy Thời Gian | 15 | Thay khối hình học hiện tại |
| 6 | [4] Bục đặc biệt | 15 | |
| 7 | [5.1] Bánh răng nền | 15 | |
| 8 | [2.2–2.3] Robot gồng/bay | 30 | Chỉ cần nếu chuyển hẳn sang sprite |
| | **Tổng** | **165** | |

---

## 7. LẮP VÀO GAME — việc phải làm sau khi có asset

Game đang là hình học thuần, nên mỗi nhóm asset kéo theo một lượng code khác nhau:

| Asset | Công sức | Đụng vào đâu |
| --- | --- | --- |
| Ảnh nền menu | **Rất nhẹ** — một dòng CSS | `src/style.css` |
| Icon UI | **Nhẹ** — thay chữ bằng `<img>` | `src/ui/HUD.js`, `style.css` |
| Bánh răng hậu cảnh | **Vừa** — đổi mesh thành sprite phẳng | `src/render/Parallax.js` |
| Cỗ Máy Thời Gian | **Vừa** — thay nhóm mesh bằng một sprite | `src/world/Level.js` phần [8] |
| Bề mặt bục | **Nặng** — thêm đường ống texture, toạ độ UV lặp theo bề rộng bục, giữ nguyên cách gộp hình học theo tầng để không phá hiệu năng | `src/world/Level.js`, `src/render/MergeUtils.js` |
| Robot sprite | **Nặng nhất** — bỏ mô hình 3D, chuyển sang sprite phẳng, làm lại squash & stretch và mắt liếc theo chuột bằng nhiều khung ảnh | `src/entities/PlayerView.js` |

⚠ **Cảnh báo hiệu năng:** ta vừa tốn công kéo số lệnh vẽ từ 190 xuống 18–35 bằng
cách gộp hình học. Mỗi texture mới là một vật liệu mới, và **mỗi vật liệu là một
lệnh vẽ**. Nếu ba vùng dùng ba ảnh riêng thì khối gộp theo tầng sẽ bị tách làm ba.
Cách đúng: ghép cả ba bộ bục vào **một tấm atlas duy nhất** rồi trỏ UV — giữ
nguyên một lệnh vẽ cho mỗi tầng. Đọc `docs/ARCHITECTURE.md` phần [6] trước khi
động vào.


---

## 8. TIEN DO — DA XONG TOAN BO 11 ASSET

Chay bang **General Generation · GPT Image 2 Detailed · 1K**, 10 credit/anh.
Anh goc nen trang nam trong `public/assets/_raw/` (khong commit, tai lai duoc);
ban da tach nen nam thang trong `public/assets/`.

| # | Tep | Noi dung |
| --- | --- | --- |
| 1 | `robot-idle.png` | Robot dung yen — than dong tan rivet, mat kinh cyan, banh rang sau lung |
| 2 | `robot-charge.png` | Robot gong luc — nen thap, chan gap, tia lua duoi chan |
| 3 | `robot-fly.png` | Robot bay — than keo dai, vet sang cyan, ang-ten bat nguoc gio |
| 4 | `menu-keyart.jpg` | Thap dong ho trong may hoang hon, chua san nua trai de dat logo |
| 5 | `tiles-zone1-forest.png` | 4 buc Rung Co Khi |
| 6 | `tiles-zone2-ice.png` | 4 buc Ham Bang Gia |
| 7 | `tiles-zone3-core.png` | 4 buc Loi Thap |
| 8 | `tiles-special.png` | Bang chuyen · lo xo · buc nut vo · doc truot |
| 9 | `goal-timemachine.png` | Co May Thoi Gian |
| 10 | `ui-icons.png` | 8 icon HUD (luoi 4x2, giu nguyen khung 1792x1008 de cat theo toa do) |
| 11 | `bg-gears.png` | 4 banh rang hau canh, toi va bac mau san cho lop parallax |

**Credit: dung 110 / 210. Con 100.**

---

## 9. LAM ANIMATION TU MOT TAM ANH — bon duong

Cau hoi "mot tam anh thi lam animation kieu gi" co bon cau tra loi, xep theo
thu tu nen dung cho game NAY:

### 9.1. Bien hinh bang code — game DANG lam vay roi, va van la duong tot nhat

`entities/PlayerView.js` khong he co animation theo khung hinh. Toan bo chuyen
dong sinh ra tu phep bien hinh chay moi frame:

| Hieu ung | Cach lam | O dau |
| --- | --- | --- |
| Nen nguoi khi gong luc | `scaleY` giam dan theo thanh luc, `scaleX = 1/scaleY` | PlayerView [5.2] |
| Dan dai khi bay | `scaleY` tang theo toc do | PlayerView [5.2] |
| Nghieng theo huong bay | `rotation.z = atan2(vy, vx)` | PlayerView [5.2] |
| Mat liec theo chuot | doi vi tri con nguoi | PlayerView [5.3] |
| Banh rang lung quay | `rotation.z += vx·dt` | PlayerView [5.4] |

Doi sang sprite thi **giu nguyen toan bo co che nay**, chi thay khoi 3D bang
mot tam anh phang. Squash & stretch chay tren sprite con da mat hon tren khoi
3D — day chinh la ky thuat kinh dien cua hoat hinh 2D.

### 9.2. Doi anh theo trang thai — 3 tam la du cho ca game

Game chi co ba trang thai nhin thay duoc: dung / gong luc / bay. Ba tam anh o
muc 1-3 phu kin. Doi tam theo `player.charging` va `player.grounded`, roi de
phep bien hinh o 9.1 lam phan con lai. **Khong ton them credit nao.**

### 9.3. Animation Agent cua Meowa — 40 credit / 8 khung hinh

Co that va dung duoc: che do **Frame Animation NEW → HD Style**, nap mot anh
tham chieu, chon san IDLE / WALK / RUN / JUMP / ATTACK / HIT / DEFEATED, do dai
8 khung. Cho ra sprite sheet.

Nhung voi game nay thi **khong dang**: 40 credit cho mot chuoi, ma nhan vat
chi dung yen chu khong di bo — chuoi WALK/RUN vo dung. Con JUMP thi 9.1 da lam
tot hon roi vi no bam sat van toc that thay vi phat lai mot chuoi co dinh.

Danh cho luc muon them chuoi rieng: nhan vat mung chien thang tren dinh thap,
hoac chuoi "tan ra" khi roi tu rat cao.

### 9.4. Cat roi tung bo phan roi ghep xuong khop bang code

Cat sprite thanh than / mu / chan / banh rang, moi manh mot mesh con, roi xoay
tung manh theo code. Mem deo nhat nhung cung ton cong nhat, va **pha vo thanh
qua toi uu draw call** (moi manh la mot lenh ve). Chi lam neu 9.1 + 9.2 khong du.

> **De xuat:** di duong 9.1 + 9.2 — dung ba tam da co, animation van do code
> sinh ra. Khong ton them credit, khong pha hieu nang, va bam sat vat ly hon
> bat ky sprite sheet nao.


---

## 10. DA LAP VAO GAME

| Asset | Trang thai | Cach lap |
| --- | --- | --- |
| `menu-keyart.jpg` | ✅ | Nen man hinh menu, dat `center right` de giu thap ben phai |
| 8 icon HUD | ✅ | Cat roi, thu ve 128px, gan vao o ky nang va bang goc trai |
| `bg-gears/gear-a` | ✅ | 16 banh rang parallax deu dung chung mot anh nay |
| `goal-timemachine` | ✅ | Sprite thay cho nhom mesh vong xuyen + loi + kim |
| 12 manh buc 3 vung | ✅ | Gop vao atlas, dan len MAT TRUOC hop |
| 4 buc dac biet | ✅ | Bang chuyen / lo xo / buc nut deu co anh rieng |
| 3 tu the robot | ⏳ | Chua lap — xem ghi chu duoi |

### Vi sao chua lap sprite robot

Doi robot sang sprite la thay doi nang nhat va **it loi nhat**:
- `PlayerView.js` hien sinh toan bo chuyen dong bang phep bien hinh (nen khi
  gong luc, dan khi bay, nghieng theo van toc, mat liec theo chuot). Doi sang
  sprite phai lam lai het tung thu do.
- Ba tam anh khong khop nhau tuyet doi (moi lan tao la model ve lai tu dau),
  nen doi qua lai giua chung se thay giat.
- Khoi robot 3D hien tai chi ton 4 mesh va an nhip rat tot voi anh sang canh.

De xuat: giu khoi 3D, dung ba tam anh lam anh minh hoa cho man hinh menu va
man hinh vinh danh. Neu van muon doi thi phai tao lai ba tu the bang
Universal Edit tu chinh `robot-idle` de chung khop nhau.

### Dung luong

| | Truoc don | Sau don |
| --- | --- | --- |
| Trong git | 22.8 MB | 5.0 MB |
| Game thuc su tai luc chay | — | ~2.9 MB |

Cach don: tam sheet lon va anh goc nen trang deu la buoc trung gian, tai tao
lai duoc bang `cutout.py` + `slice.py` nen day het vao `_raw/` (da gitignore).
Anh con lai thu ve dung co hien thi that — robot cao 3.2 don vi tren man hinh
chi khoang 58 diem anh, giu ban 905 diem anh la tra tien bang dung luong tai
trang ma mat khong thay khac gi.
