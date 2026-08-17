# 🕰️ THE CLOCKWORK TOWER — Tháp Đồng Hồ

> Một chú robot đồng hồ tí hon thức tỉnh dưới chân toà tháp cơ khí khổng lồ bị đóng băng thời gian.
> Trên đỉnh tháp là **Cỗ Máy Thời Gian**. Không có checkpoint. Không có màn chơi. Chỉ có một cú nhảy tiếp theo.

**Thể loại:** Hardcore Precision Platformer (Jump King / Getting Over It-like) · 2.5D · Three.js

---

## 🎮 Điều khiển

| Phím / Chuột      | Tác dụng                                                                       |
| ----------------- | ------------------------------------------------------------------------------ |
| **Rê chuột**      | Ngắm hướng nhảy tự do. Mắt robot luôn liếc theo con trỏ.                        |
| **Giữ `Space`**   | Gồng lực — thanh lực dao động tăng giảm liên tục. Nhả ra để phóng.              |
| **`E`**           | **Lướt Không Gian (Dash)** — phóng vút theo hướng ngắm. Hồi chiêu 3 giây.       |
| **`Q`**           | **Đáp Khẩn Cấp** — triệt tiêu quán tính, rơi thẳng đứng. 1 lần mỗi cú nhảy.     |
| **`G`**           | **God Mode** — bay tự do khảo sát địa hình (dùng `WASD` / phím mũi tên).        |
| **`R`**           | Về chân tháp làm lại (đồng hồ reset).                                          |
| **`M`**           | Bật/tắt âm thanh.                                                              |

## 🗼 Bản đồ tháp

Một màn chơi duy nhất, liền mạch từ **Y: 0** lên **Y: 1050**.

| Vùng | Độ cao        | Tên                    | Đặc trưng                                                     |
| ---- | ------------- | ---------------------- | ------------------------------------------------------------- |
| 1    | 0 → 350       | 🌿 Rừng Cơ Khí         | Nhánh cây kim loại, zic-zac cơ bản. **Phễu Tử Thần #1 @ Y220** |
| 2    | 350 → 650     | ❄️ Hầm Băng Giá        | Mỏm băng li ti, dội tường góc hẹp, trạm nghỉ giữa vùng         |
| 3    | 650 → 1000    | ⚙️ Lõi Tháp Đồng Hồ    | Băng chuyền, lò xo, bục sập. **Siêu Phễu Tử Thần #2 @ Y880**   |
| 🏆   | 1050          | ✨ Đỉnh Tháp           | Cỗ Máy Thời Gian                                               |

**Phễu Tử Thần:** vách dốc chụm vào một khe hở, bên dưới khe là một **ống tụt** kín.
Trượt chân ở tầng trên là bị hút vào khe, dội qua dội lại trong ống rồi rơi thẳng
xuống mấy tầng dưới — xoá sạch thành quả leo trèo. Phễu #1 ném bạn về Y118,
Siêu Phễu #2 ném bạn từ Y880 về tận Y630.

## 🧱 Các loại bục

| Loại       | Hành vi                                                          |
| ---------- | ---------------------------------------------------------------- |
| `static`   | Bám vững, ma sát ổn định                                          |
| `ice`      | Trơn trượt, gần như không ma sát                                  |
| `moving`   | Băng chuyền qua lại, kéo theo nhân vật đứng trên                  |
| `bouncy`   | Lò xo, bật nhân vật lên cao gấp nhiều lần                         |
| `falling`  | Rung lắc khi chạm chân, sập sau 1.5 giây, mọc lại sau vài giây    |
| `slope`    | Mặt nghiêng, nhân vật trượt dốc theo quán tính                    |

## ⏱️ Speedrun

Đồng hồ bấm giờ chính xác tới mili-giây, bắt đầu từ cú nhảy đầu tiên.
Kỷ lục cá nhân được lưu tự động vào trình duyệt.

---

## 🚀 Chạy dự án

```bash
npm install
npm run dev
```

Mở địa chỉ Vite in ra (thường là http://localhost:5173).

```bash
npm run build     # build production vào dist/
npm run preview   # xem thử bản build
```

## 🛠️ Cho người sửa code

- **[CLAUDE.md](CLAUDE.md)** — luật của dự án (auto-push, quy ước chú thích).
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — bản đồ module + bảng tra "muốn chỉnh X thì mở file nào".
- Toàn bộ số liệu cân bằng game nằm gọn trong **`src/core/Config.js`**.
- Toàn bộ vị trí bục nhảy nằm gọn trong **`src/world/LevelData.js`**.
