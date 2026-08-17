/**
 * ============================================================================
 *  Screens.js — Màn hình MENU và màn hình VINH DANH
 * ============================================================================
 *  MỤC LỤC
 *    [1] DỰNG DOM CHUNG
 *    [2] MÀN HÌNH MENU — tiêu đề, bảng phím, kỷ lục, số lần thử
 *    [3] MÀN HÌNH VINH DANH — thời gian phá đảo, kỷ lục mới, thống kê
 *    [4] ĐIỀU KHIỂN HIỂN THỊ
 *
 *  CHỈNH Ở ĐÂU?
 *    • Nội dung chữ → ngay trong hai khối HTML dưới đây
 *    • Giao diện    → src/style.css (các lớp .screen-)
 * ============================================================================
 */

import { formatTime, Storage } from '../core/Storage.js';

export class Screens {
  // ==========================================================================
  // [1] DỰNG DOM CHUNG
  // ==========================================================================
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'screens';
    root.appendChild(this.el);

    this.buildMenu();
    this.buildWin();
    this.current = null;
  }

  // ==========================================================================
  // [2] MÀN HÌNH MENU
  // ==========================================================================
  buildMenu() {
    this.menu = document.createElement('div');
    this.menu.className = 'screen screen-menu';
    this.menu.innerHTML = `
      <div class="screen-box">
        <div class="screen-kicker">⚙ MỘT CHÚ ROBOT · MỘT TOÀ THÁP · KHÔNG CHECKPOINT</div>
        <h1 class="screen-title">THE CLOCKWORK TOWER</h1>
        <div class="screen-sub">THÁP ĐỒNG HỒ</div>

        <p class="screen-story">
          Thời gian của thế giới đã đóng băng. Trên đỉnh toà tháp cơ khí cao 1050 mét,
          <b>Cỗ Máy Thời Gian</b> đang chờ được khởi động lại.<br>
          Sai một ly — rơi một dặm.
        </p>

        <div class="screen-keys">
          <div class="key-row"><kbd>Rê chuột</kbd><span>Ngắm hướng nhảy</span></div>
          <div class="key-row"><kbd>Giữ Space</kbd><span>Gồng lực — nhả ra để phóng</span></div>
          <div class="key-row"><kbd>E</kbd><span>Lướt Không Gian (hồi chiêu 3 giây)</span></div>
          <div class="key-row"><kbd>Q</kbd><span>Đáp Khẩn Cấp — 1 lần mỗi cú nhảy</span></div>
          <div class="key-row"><kbd>A</kbd><kbd>D</kbd><span>Nhích chân trái / phải</span></div>
          <div class="key-row"><kbd>G</kbd><span>Chế độ bay tự do (khảo sát địa hình)</span></div>
          <div class="key-row"><kbd>R</kbd><span>Làm lại từ chân tháp</span></div>
          <div class="key-row"><kbd>M</kbd><span>Bật / tắt âm thanh</span></div>
        </div>

        <div class="screen-stats">
          <div><span class="screen-label">KỶ LỤC</span><b id="menu-best">--:--.---</b></div>
          <div><span class="screen-label">CAO NHẤT</span><b id="menu-height">0 m</b></div>
          <div><span class="screen-label">SỐ LẦN THỬ</span><b id="menu-runs">0</b></div>
        </div>

        <div class="screen-cta">BẤM PHÍM BẤT KỲ ĐỂ BẮT ĐẦU LEO</div>
      </div>
    `;
    this.el.appendChild(this.menu);
  }

  /** Nạp lại các con số thống kê từ localStorage. */
  refreshMenuStats() {
    this.menu.querySelector('#menu-best').textContent = formatTime(Storage.getBestTime());
    this.menu.querySelector('#menu-height').textContent = `${Storage.getMaxHeight()} m`;
    this.menu.querySelector('#menu-runs').textContent = String(Storage.getRuns());
  }

  // ==========================================================================
  // [3] MÀN HÌNH VINH DANH
  // ==========================================================================
  buildWin() {
    this.win = document.createElement('div');
    this.win.className = 'screen screen-win';
    this.win.innerHTML = `
      <div class="screen-box">
        <div class="screen-kicker">⏳ THỜI GIAN ĐÃ CHẢY TRỞ LẠI</div>
        <h1 class="screen-title screen-title-win">CHINH PHỤC ĐỈNH THÁP</h1>

        <div class="win-time" id="win-time">00:00.000</div>
        <div class="win-record" id="win-record">KỶ LỤC MỚI!</div>

        <div class="screen-stats">
          <div><span class="screen-label">KỶ LỤC</span><b id="win-best">--:--.---</b></div>
          <div><span class="screen-label">SỐ LẦN THỬ</span><b id="win-runs">0</b></div>
        </div>

        <div class="screen-cta">Bấm <kbd>R</kbd> để thử phá kỷ lục của chính mình</div>
      </div>
    `;
    this.el.appendChild(this.win);
  }

  /**
   * @param {number} seconds thời gian phá đảo
   * @param {boolean} isRecord có phải kỷ lục mới không
   */
  showWin(seconds, isRecord) {
    this.win.querySelector('#win-time').textContent = formatTime(seconds);
    this.win.querySelector('#win-best').textContent = formatTime(Storage.getBestTime());
    this.win.querySelector('#win-runs').textContent = String(Storage.getRuns());
    this.win.querySelector('#win-record').style.display = isRecord ? 'block' : 'none';
    this.show('win');
  }

  // ==========================================================================
  // [4] ĐIỀU KHIỂN HIỂN THỊ
  // ==========================================================================
  /** @param {'menu'|'win'|null} which */
  show(which) {
    this.menu.classList.toggle('is-show', which === 'menu');
    this.win.classList.toggle('is-show', which === 'win');
    if (which === 'menu') this.refreshMenuStats();
    this.current = which;
  }

  hide() { this.show(null); }
}
