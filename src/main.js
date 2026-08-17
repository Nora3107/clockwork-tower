/**
 * ============================================================================
 *  main.js — Điểm khởi động duy nhất của game
 * ============================================================================
 *  File này cố ý ngắn: mọi logic đều nằm trong các module ở core/, physics/,
 *  world/, entities/, render/, audio/, ui/. Xem bản đồ đầy đủ ở
 *  docs/ARCHITECTURE.md.
 *
 *  MỤC LỤC
 *    [1] TÌM HAI LỚP DOM GỐC
 *    [2] DỰNG GAME VÀ CHẠY
 *    [3] BÁO LỖI THÂN THIỆN NẾU MÁY KHÔNG CHẠY ĐƯỢC WEBGL
 * ============================================================================
 */

import { Game } from './core/Game.js';

// ============================================================================
// [1] TÌM HAI LỚP DOM GỐC
// ============================================================================
const appEl = document.getElementById('app');   // canvas WebGL sẽ được gắn vào đây
const uiEl = document.getElementById('ui');     // HUD và các màn hình phủ lên trên

// ============================================================================
// [2] DỰNG GAME VÀ CHẠY
// ============================================================================
try {
  const game = new Game(appEl, uiEl);
  game.start();

  // Mở cửa hậu cho việc gỡ lỗi trong console trình duyệt:
  //   game.player.y = 900   → dịch chuyển tức thì lên gần đỉnh
  //   game.startRun()       → làm lại từ đầu
  window.game = game;
} catch (err) {
  // ==========================================================================
  // [3] BÁO LỖI THÂN THIỆN
  // ==========================================================================
  console.error(err);
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                font-family:system-ui;color:#f2e9d8;background:#0b0e13;text-align:center;padding:24px">
      <div>
        <h1 style="color:#d9a441">Không khởi động được Tháp Đồng Hồ</h1>
        <p>Trình duyệt của bạn có thể chưa bật WebGL, hoặc card đồ hoạ đang bị chặn.</p>
        <pre style="color:#ff5a3c;font-size:12px;white-space:pre-wrap">${String(err && err.message)}</pre>
      </div>
    </div>`;
}
