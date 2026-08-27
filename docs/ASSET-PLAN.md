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

## 8. TIEN DO — da chay xong

Toan bo chay bang **General Generation · GPT Image 2 Detailed · 1K**, 10 credit/anh.
Anh goc nen trang nam trong `public/assets/_raw/` (khong commit, tai lai duoc);
ban da tach nen nam thang trong `public/assets/`.

| # | Tep | Noi dung | Credit |
| --- | --- | --- | --- |
| 1 | `robot-idle.png` | Robot dong ho, than dong tan rivet, mat kinh cyan, banh rang sau lung | 10 |
| 2 | `menu-keyart.jpg` | Thap dong ho khong lo trong may hoang hon, chua san cho o trai de dat logo | 10 |
| 3 | `tiles-zone1-forest.png` | 4 buc Rung Co Khi: canh cay dong am xanh, bu long, reu, day leo | 10 |
| 4 | `tiles-zone2-ice.png` | 4 buc Ham Bang Gia: bang xanh nhat, tru bang, may moc sat tan rivet | 10 |
| 5 | `tiles-zone3-core.png` | 4 buc Loi Thap: catwalk dong, ong hoi, soc canh bao cam den | 10 |
| 6 | `tiles-special.png` | Bang chuyen · lo xo · buc nut vo · doc truot | 10 |
| 7 | `goal-timemachine.png` | Co May Thoi Gian: vong vang khac cung hoang dao, loi pha le phat sang | 10 |
| | | **Da dung** | **70** |

Con lai trong ke hoach: bo icon UI, banh rang hau canh, robot tu the gong luc va bay.

### Ghi chu ky thuat

- `menu-keyart` xuat JPEG chat luong 86 (2.3 MB → 254 KB) vi la anh nen day khung,
  khong can kenh trong suot.
- Cac tep con lai giu PNG vi **bat buoc** phai co kenh alpha.
- Tong `public/assets/` hien ~9 MB. Truoc khi phat hanh phai nen lai va cat nho
  tung manh buc ra khoi tam sheet — xem canh bao ve draw call o phan [7].
