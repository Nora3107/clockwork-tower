/**
 * ============================================================================
 *  AudioEngine.js — Toàn bộ âm thanh được TỔNG HỢP TRỰC TIẾP bằng WebAudio
 * ============================================================================
 *  Không có một file .mp3 nào trong dự án. Mọi tiếng động đều được nặn ra từ
 *  dao động ký và nhiễu trắng ngay lúc chạy. Đổi lại:
 *    • Dự án nhẹ tênh, tải tức thì
 *    • Âm thanh BIẾN ĐỔI LIÊN TỤC theo trạng thái vật lý — rơi càng cao tiếng
 *      "bịch" càng nặng, đập tường càng nhanh tiếng "cộc" càng đanh.
 *
 *  MỤC LỤC
 *    [1] KHỞI TẠO & GIẢI PHÓNG — trình duyệt bắt buộc phải có thao tác người dùng
 *    [2] KHỐI TẠO ÂM CƠ BẢN — tone() và noise()
 *    [3] BẢNG ÂM THANH SỰ KIỆN — nhảy, tiếp đất, va tường, cộc đầu, dash…
 *    [4] TIẾNG GỒNG LỰC LIÊN TỤC — cao độ tăng dần theo thanh lực
 *    [5] GIAI ĐIỆU CHIẾN THẮNG
 *
 *  CHỈNH Ở ĐÂU?
 *    • Âm lượng từng loại tiếng → core/Config.js phần [7] FX.AUDIO
 *    • Âm sắc (tần số, kiểu sóng, thời gian tắt) → ngay trong phần [3]
 * ============================================================================
 */

import { FX } from '../core/Config.js';
import { Storage } from '../core/Storage.js';

export class AudioEngine {
  // ==========================================================================
  // [1] KHỞI TẠO
  // ----------------------------------------------------------------------------
  //  AudioContext KHÔNG được tạo trong constructor: trình duyệt chặn phát âm
  //  thanh trước khi người dùng chạm vào trang. Gọi unlock() ở lần bấm phím
  //  hoặc click đầu tiên.
  // ==========================================================================
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = Storage.isMuted();
    this.chargeVoice = null;
    this.noiseBuffer = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;                       // trình duyệt quá cũ: game vẫn chạy, chỉ im lặng

    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : FX.AUDIO.MASTER;
    this.master.connect(this.ctx.destination);

    // Nhiễu trắng dựng sẵn 1 giây, tái sử dụng cho mọi tiếng va đập.
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  toggleMute() {
    this.muted = !this.muted;
    Storage.setMuted(this.muted);
    if (this.master) this.master.gain.value = this.muted ? 0 : FX.AUDIO.MASTER;
    return this.muted;
  }

  get ready() { return !!this.ctx && !this.muted; }
  get now() { return this.ctx.currentTime; }

  // ==========================================================================
  // [2] KHỐI TẠO ÂM CƠ BẢN
  // ==========================================================================

  /**
   * Một nốt dao động có bao hình tắt dần.
   * @param {object} o
   *  @param {number} o.freq   tần số bắt đầu (Hz)
   *  @param {number} [o.to]   tần số kết thúc — tạo hiệu ứng vuốt lên/xuống
   *  @param {string} [o.type] 'sine' | 'square' | 'sawtooth' | 'triangle'
   *  @param {number} o.gain   biên độ đỉnh
   *  @param {number} o.dur    độ dài (giây)
   *  @param {number} [o.delay] hoãn bao lâu mới phát
   */
  tone(o) {
    if (!this.ready) return;
    const t = this.now + (o.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + o.dur);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);

    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
  }

  /**
   * Một cú nhiễu trắng qua bộ lọc — nền tảng của mọi tiếng va đập.
   * @param {object} o
   *  @param {number} o.gain
   *  @param {number} o.dur
   *  @param {number} o.cut     tần số cắt bắt đầu
   *  @param {number} [o.cutTo] tần số cắt kết thúc (vuốt bộ lọc)
   *  @param {'lowpass'|'highpass'|'bandpass'} [o.filter]
   */
  noise(o) {
    if (!this.ready) return;
    const t = this.now + (o.delay ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const f = this.ctx.createBiquadFilter();
    f.type = o.filter ?? 'lowpass';
    f.frequency.setValueAtTime(o.cut, t);
    if (o.cutTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.cutTo), t + o.dur);
    f.Q.value = o.q ?? 1;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(o.gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);

    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + o.dur + 0.02);
  }

  // ==========================================================================
  // [3] BẢNG ÂM THANH SỰ KIỆN
  // ==========================================================================

  /** Cú phóng người: tiếng lò xo cơ khí bung ra, cao độ theo lực đã gồng. */
  jump(power) {
    const A = FX.AUDIO.JUMP;
    this.tone({ freq: 180 + power * 260, to: 90 + power * 120, type: 'square', gain: A * 0.5, dur: 0.16 });
    this.noise({ gain: A * 0.35, dur: 0.14, cut: 900 + power * 2600, cutTo: 300, filter: 'bandpass', q: 1.4 });
  }

  /**
   * Tiếng tiếp đất "bịch": rơi càng cao thì càng nặng và càng trầm.
   * @param {number} speed tốc độ rơi lúc chạm đất
   */
  land(speed) {
    const t = Math.min(1, speed / 110);
    const A = FX.AUDIO.LAND * (0.28 + t * 0.72);
    this.tone({ freq: 120 - t * 45, to: 42, type: 'sine', gain: A, dur: 0.14 + t * 0.14 });
    this.noise({ gain: A * 0.7, dur: 0.1 + t * 0.14, cut: 1400, cutTo: 160 });
  }

  /** Tiếng đập người vào tường "cộc" — đanh gọn, cao độ theo tốc độ lao vào. */
  wall(speed) {
    const t = Math.min(1, speed / 80);
    const A = FX.AUDIO.WALL * (0.3 + t * 0.7);
    this.tone({ freq: 320 + t * 380, to: 140, type: 'square', gain: A * 0.45, dur: 0.07 });
    this.noise({ gain: A, dur: 0.07 + t * 0.05, cut: 2200 + t * 3000, cutTo: 500, filter: 'bandpass', q: 2.2 });
  }

  /** Cộc đầu vào trần — chát hơn tiếng va tường, có tiếng kim loại ngân. */
  ceiling(speed) {
    const t = Math.min(1, speed / 70);
    const A = FX.AUDIO.CEILING * (0.4 + t * 0.6);
    this.tone({ freq: 640, to: 380, type: 'triangle', gain: A * 0.6, dur: 0.16 });
    this.noise({ gain: A * 0.8, dur: 0.07, cut: 4200, cutTo: 900, filter: 'bandpass', q: 3 });
  }

  /** Lướt Không Gian: tiếng xé gió tốc độ cao. */
  dash() {
    const A = FX.AUDIO.DASH;
    this.noise({ gain: A, dur: 0.3, cut: 340, cutTo: 5200, filter: 'bandpass', q: 1.1 });
    this.tone({ freq: 420, to: 1500, type: 'sawtooth', gain: A * 0.28, dur: 0.2 });
  }

  /** Phanh gấp: tiếng khựng lại đanh gọn, như cắt đứt luồng khí. */
  brake() {
    const A = FX.AUDIO.BRAKE;
    this.tone({ freq: 900, to: 120, type: 'square', gain: A * 0.5, dur: 0.09 });
    this.noise({ gain: A * 0.9, dur: 0.06, cut: 5000, cutTo: 400, filter: 'highpass' });
  }

  /** Bục lò xo bật lên: tiếng "boing" vuốt cao. */
  bounce(speed) {
    const t = Math.min(1, speed / 100);
    const A = FX.AUDIO.BOUNCE;
    this.tone({ freq: 170, to: 700 + t * 500, type: 'triangle', gain: A, dur: 0.24 });
  }

  /** Bục nứt bắt đầu rung — tiếng rào rạo cảnh báo. */
  crack() {
    this.noise({ gain: 0.25, dur: 0.4, cut: 1800, cutTo: 380, filter: 'bandpass', q: 1.6 });
  }

  // ==========================================================================
  // [4] TIẾNG GỒNG LỰC LIÊN TỤC
  // ----------------------------------------------------------------------------
  //  Một dao động ký được giữ sống suốt lúc giữ Space; cao độ bám sát giá trị
  //  thanh lực nên tai người chơi cũng "đọc" được lực nhảy mà không cần nhìn.
  // ==========================================================================
  startCharge() {
    if (!this.ready || this.chargeVoice) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 110;
    g.gain.value = 0.0001;
    osc.connect(g).connect(this.master);
    osc.start();
    this.chargeVoice = { osc, gain: g };
  }

  updateCharge(power) {
    if (!this.chargeVoice) return;
    const t = this.now;
    // Cao độ đi từ 110 Hz lên 430 Hz theo thanh lực.
    this.chargeVoice.osc.frequency.setTargetAtTime(110 + power * 320, t, 0.02);
    this.chargeVoice.gain.gain.setTargetAtTime(FX.AUDIO.CHARGE * (0.35 + power * 0.65), t, 0.03);
  }

  stopCharge() {
    if (!this.chargeVoice) return;
    const { osc, gain } = this.chargeVoice;
    const t = this.now;
    gain.gain.setTargetAtTime(0.0001, t, 0.02);
    osc.stop(t + 0.15);
    this.chargeVoice = null;
  }

  // ==========================================================================
  // [5] GIAI ĐIỆU CHIẾN THẮNG — arpeggio hân hoan khi Cỗ Máy Thời Gian sống lại
  // ==========================================================================
  win() {
    const A = FX.AUDIO.WIN;
    // Hợp âm trưởng rải lên rồi kết bằng quãng tám: Do–Mi–Sol–Do–Mi–Sol–Do
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568.0, 2093.0];
    notes.forEach((f, i) => {
      this.tone({ freq: f, type: 'triangle', gain: A * (1 - i * 0.07), dur: 0.5, delay: i * 0.11 });
      this.tone({ freq: f / 2, type: 'sine', gain: A * 0.4, dur: 0.6, delay: i * 0.11 });
    });
    // Tiếng bánh răng khổng lồ khởi động lại phía dưới.
    this.noise({ gain: 0.2, dur: 1.6, cut: 200, cutTo: 1800, filter: 'lowpass', delay: 0.3 });
  }

  /** Tiếng chuông nhỏ khi phá kỷ lục cá nhân. */
  newRecord() {
    [1046.5, 1318.5, 1568.0, 2093.0].forEach((f, i) => {
      this.tone({ freq: f, type: 'sine', gain: 0.3, dur: 0.35, delay: 1.0 + i * 0.09 });
    });
  }
}
