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
| Hồi chiêu dash, lực dash               | `core/Config.js`           | [3]    |
| Độ nảy tường, ma sát, ma sát băng      | `core/Config.js`           | [4]    |
| Vị trí từng bục nhảy                   | `world/LevelData.js`       | [3–6]  |
| Vị trí / độ dốc phễu tử thần           | `world/LevelData.js`       | [4],[6]|
| Màu sắc 3 vùng sinh thái               | `core/Config.js`           | [6]    |
| Góc camera, độ nghiêng 2.5D            | `render/Stage.js`          | [2]    |
| Âm lượng / âm sắc từng tiếng động      | `audio/AudioEngine.js`     | [3]    |
| Bố cục HUD                             | `ui/HUD.js` + `style.css`  | —      |
| Hình dáng chú robot                    | `entities/PlayerView.js`   | [2]    |
