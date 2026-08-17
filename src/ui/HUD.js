/**
 * ============================================================================
 *  HUD.js — Bảng thông tin trong lúc chơi (đồng hồ, thanh lực, hồi chiêu)
 * ============================================================================
 *  HUD tự dựng lấy DOM của mình để mỗi module là một khối độc lập: muốn bỏ
 *  HUD chỉ cần không khởi tạo lớp này, không phải đụng vào index.html.
 *
 *  MỤC LỤC
 *    [1] DỰNG DOM
 *    [2] ĐỒNG HỒ SPEEDRUN & KỶ LỤC
 *    [3] THANH LỰC NHẢY
 *    [4] BẢNG KỸ NĂNG E / Q
 *    [5] CỘT TIẾN ĐỘ LEO THÁP (bên phải màn hình)
 *    [6] TOAST — thông báo ngắn giữa màn hình
 *    [7] update() — gọi mỗi frame
 *    [8] BẢNG ĐO HIỆU NĂNG — bật bằng phím F khi cần truy tìm nguyên nhân giật
 *
 *  CHỈNH Ở ĐÂU?
 *    • Bố cục, màu sắc, kích thước → src/style.css (các lớp bắt đầu bằng .hud-)
 * ============================================================================
 */

import { formatTime, Storage } from '../core/Storage.js';
import { WORLD, ZONES } from '../core/Config.js';

export class HUD {
  // ==========================================================================
  // [1] DỰNG DOM
  // ==========================================================================
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <!-- Góc trên trái: đồng hồ speedrun + kỷ lục + độ cao -->
      <div class="hud-panel hud-topleft">
        <div class="hud-timer" id="hud-timer">00:00.000</div>
        <div class="hud-row"><span class="hud-label">KỶ LỤC</span><span id="hud-best">--:--.---</span></div>
        <div class="hud-row"><span class="hud-label">ĐỘ CAO</span><span id="hud-height">0 m</span></div>
        <div class="hud-row"><span class="hud-label">FPS</span><span id="hud-fps">--</span></div>
      </div>

      <!-- Góc trên phải: tên vùng sinh thái đang ở -->
      <div class="hud-panel hud-topright">
        <div class="hud-zone" id="hud-zone">RỪNG CƠ KHÍ</div>
        <div class="hud-flags" id="hud-flags"></div>
      </div>

      <!-- Đáy màn hình: thanh lực + hai ô kỹ năng -->
      <div class="hud-bottom">
        <div class="hud-skills">
          <div class="hud-skill" id="hud-skill-dash">
            <div class="hud-skill-cd" id="hud-skill-dash-cd"></div>
            <span class="hud-skill-key">E</span>
            <span class="hud-skill-name">LƯỚT</span>
          </div>
          <div class="hud-skill" id="hud-skill-brake">
            <div class="hud-skill-cd" id="hud-skill-brake-cd"></div>
            <span class="hud-skill-key">Q</span>
            <span class="hud-skill-name">PHANH</span>
          </div>
        </div>
        <div class="hud-power">
          <div class="hud-power-fill" id="hud-power-fill"></div>
          <div class="hud-power-marks"></div>
        </div>
      </div>

      <!-- Cạnh phải: cột tiến độ leo tháp -->
      <div class="hud-tower">
        <div class="hud-tower-track" id="hud-tower-track"></div>
        <div class="hud-tower-dot" id="hud-tower-dot"></div>
      </div>

      <!-- Bảng đo hiệu năng chi tiết (phím F) -->
      <div class="hud-debug" id="hud-debug"></div>
    `;
    root.appendChild(this.el);

    // --- Ghi nhớ tham chiếu để khỏi truy vấn DOM mỗi frame -------------------
    this.timerEl = this.el.querySelector('#hud-timer');
    this.bestEl = this.el.querySelector('#hud-best');
    this.heightEl = this.el.querySelector('#hud-height');
    this.zoneEl = this.el.querySelector('#hud-zone');
    this.fpsEl = this.el.querySelector('#hud-fps');
    this.flagsEl = this.el.querySelector('#hud-flags');
    this.powerFill = this.el.querySelector('#hud-power-fill');
    this.dashCd = this.el.querySelector('#hud-skill-dash-cd');
    this.brakeCd = this.el.querySelector('#hud-skill-brake-cd');
    this.dashBox = this.el.querySelector('#hud-skill-dash');
    this.brakeBox = this.el.querySelector('#hud-skill-brake');
    this.towerDot = this.el.querySelector('#hud-tower-dot');
    this.debugEl = this.el.querySelector('#hud-debug');
    this.showDebug = false;

    this.buildTowerTrack();
    this.refreshBest();

    // --- Bộ nhớ đệm để chỉ ghi vào DOM khi giá trị thực sự đổi -------------
    this._lastTimer = '';
    this._lastHeight = -1;
    this._lastZone = '';
    this._toastTimer = 0;
  }

  // ==========================================================================
  // [5] CỘT TIẾN ĐỘ — vẽ sẵn các vạch phân vùng và hai phễu tử thần
  // ==========================================================================
  buildTowerTrack() {
    const track = this.el.querySelector('#hud-tower-track');
    for (const z of ZONES) {
      if (z.yMin <= 0) continue;
      const line = document.createElement('div');
      line.className = 'hud-tower-zone';
      line.style.bottom = `${(z.yMin / WORLD.GOAL_Y) * 100}%`;
      line.style.background = z.accent;
      track.appendChild(line);
    }
    // Hai phễu tử thần được đánh dấu đỏ — người chơi nhớ mặt chúng rất nhanh.
    for (const y of [214, 880]) {
      const mark = document.createElement('div');
      mark.className = 'hud-tower-funnel';
      mark.style.bottom = `${(y / WORLD.GOAL_Y) * 100}%`;
      mark.title = 'Phễu Tử Thần';
      track.appendChild(mark);
    }
  }

  // ==========================================================================
  // [2] ĐỒNG HỒ & KỶ LỤC
  // ==========================================================================
  refreshBest() {
    this.bestEl.textContent = formatTime(Storage.getBestTime());
  }

  // ==========================================================================
  // [7] update() — gọi mỗi frame render
  // ==========================================================================
  /**
   * @param {Player} p
   * @param {number} elapsed thời gian đã trôi của lần chơi này (giây)
   * @param {number} dt
   * @param {{fps:number, quality:string}} perf số liệu hiệu năng từ Stage
   */
  update(p, elapsed, dt, perf) {
    // --- Đồng hồ ------------------------------------------------------------
    const txt = formatTime(elapsed);
    if (txt !== this._lastTimer) { this.timerEl.textContent = txt; this._lastTimer = txt; }

    // --- Độ cao (làm tròn để không nhảy số loạn xạ) ------------------------
    const h = Math.max(0, Math.round(p.y));
    if (h !== this._lastHeight) { this.heightEl.textContent = `${h} m`; this._lastHeight = h; }

    // --- Vùng sinh thái -----------------------------------------------------
    const zone = zoneNameAt(p.y);
    if (zone !== this._lastZone) { this.zoneEl.textContent = zone; this._lastZone = zone; }

    // --- FPS + mức đồ hoạ ---------------------------------------------------
    //  Hiển thị thẳng ra màn hình để người chơi (và người sửa code) biết ngay
    //  máy có tải nổi không, thay vì phải mở công cụ đo của trình duyệt.
    if (perf) {
      const fpsTxt = `${Math.round(perf.fps)} · ${perf.quality}`;
      if (fpsTxt !== this._lastFps) {
        this.fpsEl.textContent = fpsTxt;
        this.fpsEl.style.color = perf.fps < 40 ? '#ff5a3c' : perf.fps < 55 ? '#ffd85e' : '#5cff8f';
        this._lastFps = fpsTxt;
      }
    }

    // --- [3] Thanh lực ------------------------------------------------------
    this.powerFill.style.width = `${p.power * 100}%`;
    this.powerFill.classList.toggle('is-charging', p.charging);

    // --- [4] Hồi chiêu kỹ năng ---------------------------------------------
    //  Lớp phủ tối cao dần từ dưới lên = phần thời gian còn phải chờ.
    const dashRatio = p.dashCooldownRatio;
    this.dashCd.style.height = `${dashRatio * 100}%`;
    this.dashBox.classList.toggle('is-ready', dashRatio <= 0);

    const brakeReady = p.hasAirBrake;
    this.brakeCd.style.height = brakeReady ? '0%' : '100%';
    this.brakeBox.classList.toggle('is-ready', brakeReady);

    // --- [5] Chấm tiến độ trên cột tháp ------------------------------------
    const prog = Math.max(0, Math.min(1, p.y / WORLD.GOAL_Y));
    this.towerDot.style.bottom = `${prog * 100}%`;

    // --- Cờ trạng thái: God Mode / tắt tiếng -------------------------------
    const flags = [];
    if (p.godMode) flags.push('<span class="hud-flag is-god">GOD MODE</span>');
    if (this.muted) flags.push('<span class="hud-flag">🔇</span>');
    const html = flags.join('');
    if (html !== this._lastFlags) { this.flagsEl.innerHTML = html; this._lastFlags = html; }

    // --- [6] Toast tự tắt ---------------------------------------------------
    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0 && this._toastEl) {
        this._toastEl.classList.remove('is-show');
      }
    }
  }

  // ==========================================================================
  // [8] BẢNG ĐO HIỆU NĂNG (phím F)
  // ----------------------------------------------------------------------------
  //  Bảng này tồn tại để trả lời đúng MỘT câu hỏi khi game bị giật:
  //  "thời gian trôi đi đâu mất?"
  //
  //    • JS ms  — tổng thời gian code của game chạy trong một khung hình
  //    • GPU ms — thời gian CPU nộp lệnh vẽ cho card đồ hoạ
  //    • Khung  — khoảng cách thật giữa hai khung hình liên tiếp
  //
  //  CÁCH ĐỌC:
  //    JS ms ≈ Khung  → chính code game chậm, phải tối ưu game.
  //    JS ms ≪ Khung  → game đã xong việc từ lâu rồi ngồi CHỜ. Thủ phạm nằm
  //                     ngoài game: trình duyệt, trình quản lý cửa sổ, tần số
  //                     quét màn hình, hoặc lớp hiển thị đang chép khung vẽ.
  // ==========================================================================
  toggleDebug() {
    this.showDebug = !this.showDebug;
    this.debugEl.classList.toggle('is-show', this.showDebug);
    return this.showDebug;
  }

  updateDebug(perf, stats) {
    if (!this.showDebug) return;
    const frameMs = 1000 / Math.max(1, perf.fps);
    const idle = frameMs - perf.jsMs;
    const verdict = perf.jsMs > frameMs * 0.7
      ? '⚠ CODE GAME đang là nút thắt'
      : 'Game xong sớm rồi CHỜ → nút thắt nằm NGOÀI game';

    this.debugEl.innerHTML = `
      <b>ĐO HIỆU NĂNG</b> <span class="dim">(F để tắt)</span>
      <div><span>FPS</span><b>${perf.fps.toFixed(1)}</b></div>
      <div><span>Khung hình</span><b>${frameMs.toFixed(2)} ms</b></div>
      <div><span>JS của game</span><b>${perf.jsMs.toFixed(2)} ms</b></div>
      <div><span>&nbsp;└ nộp lệnh vẽ</span><b>${stats.renderMs.toFixed(2)} ms</b></div>
      <div><span>Thời gian rảnh</span><b>${idle.toFixed(2)} ms</b></div>
      <hr>
      <div><span>Lệnh vẽ</span><b>${stats.calls}</b></div>
      <div><span>Tam giác</span><b>${stats.triangles}</b></div>
      <div><span>Khung vẽ</span><b>${stats.canvas}</b></div>
      <div><span>Số điểm ảnh</span><b>${stats.pixels} tr</b></div>
      <div><span>Tỉ lệ điểm ảnh</span><b>${stats.ratio}</b></div>
      <div><span>Mức đồ hoạ</span><b>${stats.quality}</b></div>
      <div class="verdict">${verdict}</div>
    `;
  }

  // ==========================================================================
  // [6] TOAST — thông báo ngắn giữa màn hình
  // ==========================================================================
  toast(text, seconds = 1.6) {
    if (!this._toastEl) {
      this._toastEl = document.createElement('div');
      this._toastEl.className = 'hud-toast';
      this.el.appendChild(this._toastEl);
    }
    this._toastEl.textContent = text;
    this._toastEl.classList.add('is-show');
    this._toastTimer = seconds;
  }

  setMuted(muted) { this.muted = muted; }

  show() { this.el.classList.remove('is-hidden'); }
  hide() { this.el.classList.add('is-hidden'); }
}

// ============================================================================
//  TIỆN ÍCH — tên vùng theo độ cao (dùng riêng cho HUD, không đụng gameplay)
// ============================================================================
function zoneNameAt(y) {
  for (const z of ZONES) if (y < z.yMax) return z.name;
  return ZONES[ZONES.length - 1].name;
}
