# CLAUDE.md — Quy ước làm việc cho dự án THE CLOCKWORK TOWER

Tài liệu này là **luật của dự án**. Mọi phiên làm việc của Claude Code trong repo này đều phải tuân thủ.

---

## 🔴 RULE #1 — TỰ ĐỘNG PUSH LÊN GITHUB SAU MỖI PHẦN HOÀN THÀNH

> **Cứ hoàn thành xong MỘT phần việc có ý nghĩa (một module, một tính năng, một bản sửa lỗi) là
> phải commit và push ngay lên GitHub. Không gom nhiều phần rồi push một lượt.**

Remote: `origin` → https://github.com/Nora3107/clockwork-tower (nhánh `main`)

### Quy trình bắt buộc sau mỗi phần

```bash
git add -A && git commit -m "<type>: <mô tả ngắn>" && git push
```

Hoặc dùng script rút gọn có sẵn:

```bash
pwsh -File scripts/push.ps1 "feat: them bucnhay lo xo"
```

### Định nghĩa "một phần đã xong"

Một phần được coi là XONG (và do đó được push) khi thoả **tất cả**:

1. Code đã viết đủ cho mục tiêu của phần đó (không để hàm rỗng, không để `TODO` chặn đường).
2. `npm run build` chạy không lỗi.
3. Nếu phần đó ảnh hưởng gameplay → đã mở dev server xem console không có lỗi đỏ.
4. Đã có **khối chú thích đầu file** và các **mốc `// ===== [N] ... =====`** theo RULE #2.

Nếu chưa thoả → **không push**, tiếp tục làm cho xong. Tuyệt đối không push code đang hỏng lên `main`.

### Quy ước message commit

| Prefix     | Dùng khi                                   |
| ---------- | ------------------------------------------ |
| `feat:`    | Thêm tính năng / module mới                |
| `fix:`     | Sửa lỗi                                    |
| `tune:`    | Cân bằng số liệu gameplay (lực nhảy, map…) |
| `refactor:`| Đổi cấu trúc, không đổi hành vi            |
| `docs:`    | Tài liệu, chú thích                        |
| `chore:`   | Cấu hình, dọn dẹp, phụ trợ                 |

Message viết **không dấu** (tránh lỗi encoding trên Windows PowerShell), ngắn gọn, thì mệnh lệnh.
Mọi commit kết thúc bằng dòng:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## 🔵 RULE #2 — MỌI ĐOẠN CODE PHẢI ĐƯỢC "NOTE LẠI TỪNG PHẦN"

Mục tiêu: sau này mở bất kỳ file nào ra là **biết ngay chỉnh chỗ nào**, không cần đọc hết.

### 2.1. Mỗi file bắt đầu bằng khối tiêu đề

```js
/**
 * ============================================================================
 *  <TÊN FILE> — <Vai trò một câu>
 * ============================================================================
 *  MỤC LỤC
 *    [1] ...
 *    [2] ...
 *
 *  CHỈNH Ở ĐÂU?
 *    • Muốn đổi X → sửa hằng số Y ở phần [1]
 *    • Muốn đổi Z → sửa hàm W ở phần [3]
 * ============================================================================
 */
```

### 2.2. Mỗi phần trong file có mốc phân cách

```js
// ============================================================================
// [2] TÊN PHẦN — mô tả ngắn phần này làm gì
// ============================================================================
```

Số `[N]` phải khớp với MỤC LỤC ở đầu file.

### 2.3. Mỗi hằng số gameplay phải có chú thích đơn vị + ý nghĩa

```js
MAX_JUMP_SPEED: 55,   // đơn vị/giây — lực nhảy tối đa. Tăng = nhảy cao hơn (nhảy thẳng đứng cao ~12.6 đơn vị)
```

### 2.4. Ngôn ngữ chú thích: **tiếng Việt**. Tên biến/hàm: **tiếng Anh**.

---

## 🟢 RULE #3 — KIẾN TRÚC: KHÔNG BAO GIỜ QUAY LẠI FILE ĐƠN KHỐI

Mỗi module một trách nhiệm, không quá ~400 dòng. Bản đồ module xem [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Nguyên tắc phụ thuộc (chỉ chảy một chiều, không vòng lặp):

```
main.js
  └── core/Game.js
        ├── core/Input.js, core/Storage.js
        ├── entities/Player.js ──> physics/Physics.js
        ├── world/Level.js     ──> world/LevelData.js, physics/Platform.js
        ├── render/*           ──> three.js
        ├── audio/AudioEngine.js
        └── ui/*
  (mọi module đều đọc core/Config.js)
```

**Tất cả con số cân bằng game nằm ở `src/core/Config.js`.** Không hard-code số ma thuật rải rác.

---

## 🟡 RULE #4 — CÂN BẰNG GAMEPLAY

Game này là *hardcore precision platformer*. Khi chỉnh số, giữ đúng tinh thần:

- Sai một ly là rơi một dặm — **không checkpoint, không màn chơi riêng**.
- Người chơi phải kiểm soát lực ở mức 40% / 60% / 80%, không phải lúc nào cũng full lực.
- Mọi thay đổi trong `LevelData.js` phải chạy qua `validateLevel()` (bật ở chế độ dev) để đảm bảo
  không tạo ra khoảng cách vượt quá tầm nhảy tối đa.

---

## Lệnh thường dùng

```bash
npm install        # cài phụ thuộc
npm run dev        # dev server (Vite)
npm run build      # build production vào dist/
npm run preview    # xem thử bản build
```
