# Kiến trúc mã nguồn — THE CLOCKWORK TOWER

> Đọc file này trước khi sửa bất cứ thứ gì. Mỗi module dưới đây đều có khối MỤC LỤC riêng ở đầu file.

## 1. Bản đồ thư mục

```
src/
├── main.js                  Điểm khởi động: dựng Game rồi start. Không chứa logic.
│
├── core/                    Hạ tầng, không biết gì về three.js
│   ├── Config.js            ★ TOÀN BỘ SỐ LIỆU CÂN BẰNG GAME nằm ở đây
│   ├── Input.js             Gom phím + chuột thành trạng thái đọc được mỗi frame
│   ├── Storage.js           Lưu/đọc kỷ lục thời gian (localStorage)
│   └── Game.js              Máy trạng thái MENU/PLAYING/WON + vòng lặp game
│
├── physics/                 Vật lý thuần 2D, không phụ thuộc render
│   ├── Platform.js          Định nghĩa các LOẠI bục + hành vi mỗi loại theo thời gian
│   └── Physics.js           Tích phân chuyển động + va chạm AABB + dốc + dội tường
│
├── world/
│   ├── LevelData.js         ★ DỮ LIỆU MAP: toàn bộ tháp Y:0→1050, 3 vùng, 2 phễu tử thần
│   └── Level.js             Biến dữ liệu thành đối tượng bục sống + dựng mesh 3D
│
├── entities/
│   ├── Player.js            Trạng thái + kỹ năng nhân vật (gồng lực, dash, phanh, god mode)
│   └── PlayerView.js        Mô hình 3D chú robot: thân, mắt liếc theo chuột, squash & stretch
│
├── render/
│   ├── Stage.js             Renderer, camera 2.5D, ánh sáng hoàng hôn, đổ bóng, rung màn hình
│   ├── Parallax.js          Hậu cảnh bánh răng khổng lồ quay chậm nhiều lớp chiều sâu
│   └── Particles.js         Hệ hạt: bụi tiếp đất, tia lửa va tường, vệt lướt, pháo hoa
│
├── audio/
│   └── AudioEngine.js       Tổng hợp âm thanh bằng WebAudio (không cần file .mp3)
│
├── ui/
│   ├── HUD.js               Thanh lực, đồng hồ mili-giây, kỷ lục, cooldown E/Q
│   └── Screens.js           Màn hình menu, hướng dẫn, màn hình vinh danh
│
└── style.css                Toàn bộ CSS của lớp UI
```

★ = hai file bạn sẽ sửa nhiều nhất khi tinh chỉnh game.

## 2. Luồng một frame

```
requestAnimationFrame
  │
  ├─ Input.beginFrame()            chốt lại phím vừa bấm trong frame này
  ├─ Level.update(dt)              bục di động chạy, bục rơi rung rồi sập
  ├─ Player.update(dt, input)      tích lực nhảy / dash / phanh gấp → sinh vận tốc
  ├─ Physics.step(player, level)   di chuyển + va chạm + sinh sự kiện (land/wall/ceiling)
  ├─ → sự kiện đẩy sang AudioEngine + Particles + Stage.shake()
  ├─ PlayerView.sync()             cập nhật mesh, mắt liếc, squash & stretch
  ├─ Stage.follow(player)          camera bám theo có giảm chấn
  ├─ Parallax.update(dt, camY)     bánh răng quay + trôi theo chiều sâu
  ├─ Particles.update(dt)
  ├─ HUD.update()                  đồng hồ, thanh lực, cooldown
  └─ Stage.render()
```

## 3. Hệ toạ độ

- Trục **X**: ngang, tâm tháp = 0. Lòng tháp rộng `TOWER_HALF_WIDTH * 2` (mặc định 68 đơn vị).
- Trục **Y**: cao, chân tháp = 0, đỉnh tháp (Cỗ Máy Thời Gian) = 1050.
- Trục **Z**: chỉ dùng cho chiều sâu thị giác 2.5D. Gameplay hoàn toàn 2D (z của người chơi = 0).
- Nhân vật cao 3 đơn vị → cả tháp cao tương đương 350 lần chiều cao nhân vật.

## 4. Quy ước gọi hàm giữa các module

| Module    | Xuất ra                       | Không được phép                     |
| --------- | ----------------------------- | ----------------------------------- |
| `core/*`  | class/hằng số thuần JS        | import three.js                     |
| `physics/*` | hàm thuần + object dữ liệu  | import three.js, đọc DOM            |
| `render/*` | class bọc three.js           | sửa trạng thái gameplay             |
| `ui/*`     | class thao tác DOM           | sửa trạng thái gameplay             |
| `Game.js`  | keo dán tất cả               | chứa công thức vật lý               |

## 5. Bảng tra "muốn chỉnh X thì mở file nào"

| Muốn chỉnh                             | Mở file                    | Phần   |
| -------------------------------------- | -------------------------- | ------ |
| Lực nhảy, trọng lực, tốc độ rơi tối đa | `core/Config.js`           | [2]    |
| Bố cục tháp giãn rộng/thu hẹp          | `core/Config.js`           | [2b]   |
| Ngưỡng FPS, các mức đồ hoạ             | `core/Config.js`           | [7b]   |
| Hồi chiêu dash, lực dash               | `core/Config.js`           | [3]    |
| Độ nảy tường, ma sát, ma sát băng      | `core/Config.js`           | [4]    |
| Vị trí từng bục nhảy                   | `world/LevelData.js`       | [3–6]  |
| Vị trí / độ dốc phễu tử thần           | `world/LevelData.js`       | [4],[6]|
| Màu sắc 3 vùng sinh thái               | `core/Config.js`           | [6]    |
| Góc camera, độ nghiêng 2.5D            | `render/Stage.js`          | [2]    |
| Âm lượng / âm sắc từng tiếng động      | `audio/AudioEngine.js`     | [3]    |
| Bố cục HUD                             | `ui/HUD.js` + `style.css`  | —      |
| Hình dáng chú robot                    | `entities/PlayerView.js`   | [2]    |

## 6. Luật hiệu năng: ĐẾM LỆNH VẼ, KHÔNG ĐẾM TAM GIÁC

Cả toà tháp chỉ có ~5300 tam giác — con số mà mọi card đồ hoạ đều coi là không có gì.
Thứ giết hiệu năng ở đây là **số lệnh vẽ**: mỗi mesh trong cảnh là một lần CPU phải
nói chuyện với GPU. Bản dựng đầu tiên có 529 mesh → ~190 lệnh vẽ → 16 fps.

Ba cái bẫy đã gặp, và cách tránh:

| Bẫy | Hậu quả | Cách đúng |
| --- | --- | --- |
| Mỗi chi tiết một mesh (răng cưa bánh răng, tay chân robot) | 370 mesh chỉ riêng hậu cảnh | Gộp thành 1 khối lúc khởi tạo — `render/MergeUtils.js` |
| Truyền **mảng 6 vật liệu** cho `BoxGeometry` để mặt trên khác màu | three.js vẽ mỗi nhóm vật liệu bằng một lệnh riêng → **6 lệnh cho một cái bục** | Nhét màu vào từng đỉnh (`coloredBox`), dùng chung một vật liệu |
| Gộp tất cả thành **một** khối khổng lồ | Không bao giờ bị loại khỏi khung hình → GPU xử lý cả tháp ở mọi khung hình | Gộp theo **tầng cao 150 đơn vị** (`Level.js`, hằng số `CHUNK_H`) |

Kết quả: 50 mesh, 18–35 lệnh vẽ tuỳ độ cao.

**Quy tắc khi thêm thứ mới vào cảnh:** nếu nó không tự cử động → gộp vào khối tĩnh
của tầng. Nếu nó cử động → mesh riêng, nhưng phải dùng **một** vật liệu duy nhất.

### Dán ảnh mà vẫn giữ được một lệnh vẽ

Ảnh làm mọi thứ khó lên một bậc, vì **mỗi tấm ảnh là một vật liệu, và mỗi vật liệu
là một lệnh vẽ**. Ba vùng sinh thái dùng ba tấm ảnh riêng là khối gộp theo tầng bị
xé làm ba ngay.

Cách giải quyết gồm ba mảnh ghép:

1. **Một atlas duy nhất** (`scripts/atlas.py` → `public/assets/tiles-atlas.png`).
   Cả 16 mảnh bục của 3 vùng + 4 bục đặc biệt nằm chung một tấm 1024×2048.
   Bảng toạ độ UV được sinh ra thành `src/world/TileAtlas.js`.

2. **Ô trắng trong atlas.** Mặt sau, mặt đáy, hai mặt bên và mặt trên của bục chỉ
   cần màu trơn. Chúng trỏ UV vào một ô trắng tinh, còn màu thật lấy từ *màu từng
   đỉnh*. Vật liệu bật cả `map` lẫn `vertexColors`, three.js nhân hai thứ:
   `trắng × màu đỉnh = màu đỉnh`, `màu trắng × ảnh = ảnh`. Một vật liệu lo cả hai.

3. **Cắt lấy dải đặc của ảnh.** Ảnh bục có nền trong suốt và những phần thò ra
   (trụ băng, dây leo). Hộp va chạm thì là chữ nhật đặc. Dán ảnh có lỗ thủng lên
   mặt trước hộp thì nhìn xuyên qua lỗ sẽ thấy mặt sau của chính cái hộp. Nên
   `atlas.py` chỉ lấy dải các hàng ngang gần như đục hoàn toàn.

**Hai điều đã thử và phải bỏ:**

- *Dán ảnh lên mặt trên bục.* Mặt trên có tỉ lệ rộng/sâu ~1.3:1 còn dải ảnh bề mặt
  thì ~20:1 — nhét vào là kéo dãn thành vệt dọc nhoè. Quan trọng hơn: mặt trên là
  thứ người chơi liếc để biết chỗ đứng được, **màu trơn sắc nét đọc nhanh hơn ảnh
  chi tiết**. Màu đó nay lấy tự động từ mép trên của chính tấm ảnh (`atlas.py` tính
  sẵn), kèm sàn độ sáng tối thiểu 0.5 để mặt bục kim loại tối màu ở Vùng 3 không
  chìm vào nền.
- *Trải ảnh khít mọi bề rộng bục.* Bục rộng từ 4.5 tới 48 đơn vị. Thay vì cắt 9 mảnh
  (9-slice), mỗi vùng có sẵn 4 mảnh dài ngắn khác nhau và `pickTile()` chọn mảnh có
  tỉ lệ gần nhất — rẻ hơn nhiều mà méo không đáng kể.

## 7. Ba cái bẫy hình học của Phễu Tử Thần (đọc trước khi sửa map quanh phễu)

Phễu chỉ hoạt động khi ba điều kiện dưới đây cùng đúng. `validateLevel()` kiểm
tra tự động cả ba, nhưng hiểu nguyên nhân vẫn tốt hơn là chờ nó báo lỗi.

1. **Không được có bục nào chắn ngang khe hở.** Bục đặt ngay trên khe sẽ hứng
   luôn người rơi — cái bẫy trở thành cái đệm. Đường sống phải đi vòng qua bên
   cạnh khe chứ không được bắc cầu qua khe.
2. **Bục nằm trên mặt dốc phải cao hơn đầu người đang trượt.** Người trượt dốc
   chiếm một khối cao 3.2 đơn vị tính từ mặt dốc; bất kỳ bục nào thò vào khối
   đó sẽ chặn đứng cú trượt — kể cả khi nó chỉ chạm vào MẶT BÊN.
3. **Phải có "ống tụt" (`throat`) ngay dưới khe.** Người trượt hết mặt dốc lao
   ra với vận tốc ngang hơn 40 đơn vị/giây, đủ để bay vọt sang bờ bên kia
   giếng và bám được vào bậc thang đối diện. Hai vách ống nhốt họ lại, cho họ
   dội tường vài nhịp rồi rơi thẳng xuống đáy. Ống phải **rộng hơn khe** và
   phải **kết thúc cách bệ hứng một quãng**, nếu không người chơi bị nhốt luôn
   trong ống.
