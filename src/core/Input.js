/**
 * ============================================================================
 *  Input.js — Gom bàn phím + chuột thành một "ảnh chụp trạng thái" mỗi frame
 * ============================================================================
 *  Vì sao cần lớp này?
 *    Logic game cần phân biệt rõ 3 câu hỏi khác nhau:
 *      • "Phím đang được giữ?"          → isDown()      (dùng cho gồng lực, đi bộ)
 *      • "Phím VỪA được bấm frame này?" → wasPressed()  (dùng cho dash, phanh, toggle)
 *      • "Phím VỪA được nhả frame này?" → wasReleased() (dùng cho nhả nhảy)
 *    Nếu đọc thẳng sự kiện DOM thì rất dễ bỏ sót hoặc xử lý 2 lần.
 *
 *  MỤC LỤC
 *    [1] KHỞI TẠO & GẮN SỰ KIỆN
 *    [2] TRUY VẤN PHÍM (isDown / wasPressed / wasReleased)
 *    [3] CHUỘT — vị trí màn hình và hướng ngắm trong thế giới
 *    [4] VÒNG ĐỜI FRAME (endFrame) — xoá bộ đệm "vừa bấm/vừa nhả"
 *
 *  CHỈNH Ở ĐÂU?
 *    • Muốn đổi phím → sửa bảng KEYS trong core/Config.js, KHÔNG sửa file này.
 * ============================================================================
 */

import { KEYS } from './Config.js';

export class Input {
  // ==========================================================================
  // [1] KHỞI TẠO & GẮN SỰ KIỆN
  // ==========================================================================
  constructor(target = window) {
    /** Tập các mã phím (event.code) đang được giữ. */
    this.down = new Set();
    /** Các phím vừa được bấm trong frame hiện tại (xoá ở cuối frame). */
    this.pressed = new Set();
    /** Các phím vừa được nhả trong frame hiện tại (xoá ở cuối frame). */
    this.released = new Set();

    /** Toạ độ chuột theo pixel màn hình. */
    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;
    /** Toạ độ chuột quy về khoảng [-1, 1] (chuẩn NDC của WebGL). */
    this.ndcX = 0;
    this.ndcY = 0;
    /** Hướng ngắm trong thế giới, do Game tính lại mỗi frame và ghi vào đây. */
    this.aim = { x: 0.707, y: 0.707 };

    this._onKeyDown = (e) => {
      // Chặn Space cuộn trang và các phím mũi tên cuộn màn hình.
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;           // bỏ qua auto-repeat của hệ điều hành
      this.down.add(e.code);
      this.pressed.add(e.code);
    };
    this._onKeyUp = (e) => {
      this.down.delete(e.code);
      this.released.add(e.code);
    };
    this._onMouseMove = (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
      this.ndcY = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    /** Nhấn giữ chuột trái cũng gồng lực được (thuận tay cho người chơi laptop). */
    this._onMouseDown = (e) => {
      if (e.button === 0) { this.down.add('Space'); this.pressed.add('Space'); }
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) { this.down.delete('Space'); this.released.add('Space'); }
    };
    /** Mất focus (alt-tab) → nhả hết phím, tránh kẹt trạng thái đang gồng lực. */
    this._onBlur = () => {
      for (const code of this.down) this.released.add(code);
      this.down.clear();
    };

    target.addEventListener('keydown', this._onKeyDown);
    target.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('mousemove', this._onMouseMove);
    target.addEventListener('mousedown', this._onMouseDown);
    target.addEventListener('mouseup', this._onMouseUp);
    target.addEventListener('blur', this._onBlur);
    this._target = target;
  }

  // ==========================================================================
  // [2] TRUY VẤN PHÍM
  //     Nhận vào TÊN HÀNH ĐỘNG ('DASH', 'CHARGE'...) chứ không phải mã phím,
  //     nhờ vậy đổi phím chỉ cần sửa Config.KEYS.
  // ==========================================================================
  isDown(action) {
    const codes = KEYS[action];
    for (let i = 0; i < codes.length; i++) if (this.down.has(codes[i])) return true;
    return false;
  }

  wasPressed(action) {
    const codes = KEYS[action];
    for (let i = 0; i < codes.length; i++) if (this.pressed.has(codes[i])) return true;
    return false;
  }

  wasReleased(action) {
    const codes = KEYS[action];
    for (let i = 0; i < codes.length; i++) if (this.released.has(codes[i])) return true;
    return false;
  }

  /** Trục ngang gộp: -1 (trái) · 0 · +1 (phải). */
  get axisX() {
    return (this.isDown('RIGHT') ? 1 : 0) - (this.isDown('LEFT') ? 1 : 0);
  }

  /** Trục dọc gộp (chỉ dùng cho God Mode). */
  get axisY() {
    return (this.isDown('UP') ? 1 : 0) - (this.isDown('DOWN') ? 1 : 0);
  }

  /** Có phím nào đó vừa được bấm không — dùng để "bấm phím bất kỳ để bắt đầu". */
  anyPressed() {
    return this.pressed.size > 0;
  }

  // ==========================================================================
  // [3] CHUỘT — hướng ngắm
  // ==========================================================================
  /**
   * Ghi lại hướng ngắm đã chuẩn hoá (do Game tính từ vị trí chuột trong thế giới).
   * @param {number} dx - thành phần ngang chưa chuẩn hoá
   * @param {number} dy - thành phần dọc chưa chuẩn hoá
   */
  setAim(dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    this.aim.x = dx / len;
    this.aim.y = dy / len;
  }

  // ==========================================================================
  // [4] VÒNG ĐỜI FRAME
  //     Game PHẢI gọi endFrame() ở cuối mỗi frame, nếu không wasPressed()
  //     sẽ trả về true mãi mãi.
  // ==========================================================================
  endFrame() {
    this.pressed.clear();
    this.released.clear();
  }

  dispose() {
    const t = this._target;
    t.removeEventListener('keydown', this._onKeyDown);
    t.removeEventListener('keyup', this._onKeyUp);
    t.removeEventListener('mousemove', this._onMouseMove);
    t.removeEventListener('mousedown', this._onMouseDown);
    t.removeEventListener('mouseup', this._onMouseUp);
    t.removeEventListener('blur', this._onBlur);
  }
}
