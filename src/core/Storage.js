/**
 * ============================================================================
 *  Storage.js — Lưu kỷ lục speedrun và thống kê vào localStorage
 * ============================================================================
 *  MỤC LỤC
 *    [1] KHOÁ LƯU TRỮ
 *    [2] ĐỌC / GHI AN TOÀN (bọc try-catch vì localStorage có thể bị chặn)
 *    [3] API KỶ LỤC       — bestTime, submitTime, độ cao cao nhất từng đạt
 *    [4] ĐỊNH DẠNG THỜI GIAN — mm:ss.mmm cho HUD
 *
 *  CHỈNH Ở ĐÂU?
 *    • Muốn xoá kỷ lục khi test → gọi Storage.reset() trong console trình duyệt.
 * ============================================================================
 */

// ============================================================================
// [1] KHOÁ LƯU TRỮ — đổi tiền tố nếu muốn tách dữ liệu giữa các phiên bản game
// ============================================================================
const PREFIX = 'clockwork_tower_v1';
const K_BEST = `${PREFIX}.best_time`;
const K_HIGH = `${PREFIX}.max_height`;
const K_RUNS = `${PREFIX}.runs`;
const K_MUTE = `${PREFIX}.muted`;

// ============================================================================
// [2] ĐỌC / GHI AN TOÀN
//     localStorage có thể ném lỗi ở chế độ ẩn danh hoặc khi hết dung lượng,
//     nên mọi truy cập đều được bọc lại. Hỏng lưu trữ không được làm sập game.
// ============================================================================
function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// [3] API KỶ LỤC
// ============================================================================
export const Storage = {
  /** Thời gian phá đảo tốt nhất (giây, số thực) — null nếu chưa từng thắng. */
  getBestTime() {
    const v = read(K_BEST, null);
    return typeof v === 'number' && isFinite(v) ? v : null;
  },

  /**
   * Nộp thành tích một lần chơi.
   * @returns {boolean} true nếu đây là kỷ lục mới.
   */
  submitTime(seconds) {
    const best = this.getBestTime();
    if (best === null || seconds < best) {
      write(K_BEST, seconds);
      return true;
    }
    return false;
  },

  /** Độ cao lớn nhất từng chạm tới (để khoe trên màn hình menu). */
  getMaxHeight() {
    const v = read(K_HIGH, 0);
    return typeof v === 'number' && isFinite(v) ? v : 0;
  },

  submitHeight(y) {
    if (y > this.getMaxHeight()) write(K_HIGH, Math.floor(y));
  },

  /** Đếm số lần thử — con số này chính là "huy chương kiên nhẫn" của người chơi. */
  getRuns() {
    const v = read(K_RUNS, 0);
    return typeof v === 'number' ? v : 0;
  },

  incrementRuns() {
    const n = this.getRuns() + 1;
    write(K_RUNS, n);
    return n;
  },

  /** Trạng thái tắt tiếng, nhớ qua các lần vào game. */
  isMuted() {
    return read(K_MUTE, false) === true;
  },

  setMuted(muted) {
    write(K_MUTE, !!muted);
  },

  /** Xoá sạch mọi dữ liệu đã lưu (gọi thủ công khi cần test lại từ đầu). */
  reset() {
    [K_BEST, K_HIGH, K_RUNS, K_MUTE].forEach((k) => {
      try { localStorage.removeItem(k); } catch { /* bỏ qua */ }
    });
  },
};

// ============================================================================
// [4] ĐỊNH DẠNG THỜI GIAN
// ============================================================================
/**
 * Đổi số giây thành chuỗi "mm:ss.mmm" — độ chính xác tới mili-giây cho speedrun.
 * @param {number|null} seconds
 * @returns {string} ví dụ "04:37.219", hoặc "--:--.---" nếu chưa có dữ liệu.
 */
export function formatTime(seconds) {
  if (seconds === null || seconds === undefined || !isFinite(seconds)) {
    return '--:--.---';
  }
  const total = Math.max(0, seconds);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const ms = Math.floor((total * 1000) % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}
