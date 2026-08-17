/**
 * ============================================================================
 *  Game.js — Nhạc trưởng: ghép mọi module lại và điều khiển vòng lặp
 * ============================================================================
 *  Đây là nơi DUY NHẤT các module biết tới nhau. Bản thân file này không chứa
 *  một công thức vật lý nào, cũng không vẽ một hình khối nào — nó chỉ ra lệnh
 *  đúng thứ tự, đúng nhịp.
 *
 *  MỤC LỤC
 *    [1] KHỞI TẠO — dựng đủ mọi hệ thống
 *    [2] MÁY TRẠNG THÁI — MENU → PLAYING → WON
 *    [3] VÒNG LẶP CHÍNH — nhịp render tự do + nhịp vật lý CỐ ĐỊNH
 *    [4] PHẢN ỨNG VA CHẠM — biến sự kiện vật lý thành âm thanh, hạt, rung màn
 *    [5] PHÍM TOÀN CỤC — R làm lại, M tắt tiếng
 *    [6] THẮNG CUỘC — chốt thời gian, lưu kỷ lục, bắn pháo hoa
 *
 *  THỨ TỰ MỘT FRAME (quan trọng, đừng đảo lộn)
 *    input → nhân vật quyết định → N bước vật lý → phản ứng va chạm →
 *    đồng bộ mesh → camera → hậu cảnh → hạt → HUD → render
 * ============================================================================
 */

import { WORLD, DEV } from './Config.js';
import { Input } from './Input.js';
import { Storage } from './Storage.js';
import { Stage } from '../render/Stage.js';
import { Parallax } from '../render/Parallax.js';
import { Particles } from '../render/Particles.js';
import { Level } from '../world/Level.js';
import { Player } from '../entities/Player.js';
import { PlayerView } from '../entities/PlayerView.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { HUD } from '../ui/HUD.js';
import { Screens } from '../ui/Screens.js';
import { step as physicsStep, createContacts } from '../physics/Physics.js';

/** Số bước vật lý tối đa được phép dồn trong một frame (chống "vòng xoáy tử thần"). */
const MAX_SUBSTEPS = 8;

export class Game {
  // ==========================================================================
  // [1] KHỞI TẠO
  // ==========================================================================
  constructor(appEl, uiEl) {
    // --- Phần nhìn ----------------------------------------------------------
    this.stage = new Stage(appEl);
    this.parallax = new Parallax(this.stage.scene);
    this.particles = new Particles(this.stage.scene);
    this.particles.setScale(this.stage.pixelsPerUnit);
    this.level = new Level(this.stage.scene);

    // --- Phần chơi ----------------------------------------------------------
    this.player = new Player();
    this.playerView = new PlayerView(this.stage.scene);
    this.input = new Input();
    this.audio = new AudioEngine();
    this.contacts = createContacts();

    // --- Phần giao diện ------------------------------------------------------
    this.hud = new HUD(uiEl);
    this.screens = new Screens(uiEl);
    this.hud.setMuted(this.audio.muted);

    // --- Trạng thái vòng chơi -------------------------------------------------
    this.state = 'MENU';
    this.elapsed = 0;          // đồng hồ speedrun (giây)
    this.accumulator = 0;      // bộ dồn thời gian cho bước vật lý cố định
    this.lastNow = 0;
    this.fireworkTimer = 0;

    // Cửa sổ đổi kích thước → hạt phải to lại cho đúng tỉ lệ.
    window.addEventListener('resize', () => this.particles.setScale(this.stage.pixelsPerUnit));

    this.screens.show('menu');
    this.hud.hide();
  }

  // ==========================================================================
  // [2] MÁY TRẠNG THÁI
  // ==========================================================================

  /** Bắt đầu một lượt leo mới từ chân tháp. */
  startRun() {
    this.player.reset();
    this.level.reset();
    this.particles.clear();
    this.elapsed = 0;
    this.accumulator = 0;
    this.stage.camY = this.player.y;
    this.stage.camX = 0;
    this.state = 'PLAYING';
    this.screens.hide();
    this.hud.show();
    this.hud.refreshBest();
    Storage.incrementRuns();
  }

  /** Về màn hình menu (không dùng trong luồng chơi thường, để dành cho debug). */
  toMenu() {
    this.state = 'MENU';
    this.screens.show('menu');
    this.hud.hide();
  }

  start() {
    this.lastNow = performance.now();
    requestAnimationFrame(this.frame);
  }

  // ==========================================================================
  // [3] VÒNG LẶP CHÍNH
  // ----------------------------------------------------------------------------
  //  Nhịp RENDER chạy tự do theo màn hình (60/120/144 Hz).
  //  Nhịp VẬT LÝ luôn là 1/120 giây — nhờ đó cùng một cú nhảy trên mọi máy đều
  //  cho ra cùng một quỹ đạo, điều kiện sống còn của một game speedrun.
  // ==========================================================================
  frame = (now) => {
    requestAnimationFrame(this.frame);

    const dt = Math.min((now - this.lastNow) / 1000, 0.1);   // chặn dt khi alt-tab về
    this.lastNow = now;

    this.updateAim();
    this.handleGlobalKeys();

    if (this.state === 'MENU') this.updateMenu();
    else if (this.state === 'PLAYING') this.updatePlaying(dt);
    else if (this.state === 'WON') this.updateWon(dt);

    // --- Đồng bộ phần nhìn (chạy ở mọi trạng thái) --------------------------
    this.playerView.sync(this.player, dt);
    this.level.syncMeshes();
    this.stage.follow(this.player, dt);
    this.stage.setZoneMood(this.player.y);
    this.parallax.update(dt, this.stage.camY);
    this.particles.update(dt);

    // Đo hiệu năng và tự hạ chất lượng nếu máy đuối (xem Stage.js phần [9]).
    if (this.stage.measurePerformance(dt)) {
      this.hud.toast(`ĐỒ HOẠ: ${this.stage.qualityName.toUpperCase()} (tự hạ cho mượt)`, 2.4);
      this.particles.setScale(this.stage.pixelsPerUnit);
    }
    this.hud.update(this.player, this.elapsed, dt, {
      fps: this.stage.fps,
      quality: this.stage.qualityName,
    });

    this.stage.render();
    this.input.endFrame();
  };

  /** Đổi vị trí chuột trên màn hình thành hướng ngắm trong thế giới. */
  updateAim() {
    const world = this.stage.worldFromMouse(this.input.ndcX, this.input.ndcY);
    this.player.setAim(world.x - this.player.x, world.y - this.player.y);
  }

  // --- 3.1 MENU -------------------------------------------------------------
  updateMenu() {
    if (this.input.anyPressed()) {
      this.audio.unlock();      // trình duyệt chỉ cho mở âm thanh sau thao tác người dùng
      this.startRun();
    }
  }

  // --- 3.2 PLAYING ----------------------------------------------------------
  updatePlaying(dt) {
    const p = this.player;

    // (a) Người chơi quyết định — một lần mỗi frame
    p.handleInput(this.input, dt);
    this.syncChargeSound(p);

    // (b) Thế giới chuyển động — nhiều bước vật lý cố định
    resetContacts(this.contacts);
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= WORLD.FIXED_STEP && steps < MAX_SUBSTEPS) {
      const h = WORLD.FIXED_STEP;
      this.level.update(h);
      p.preStep(h);
      if (!p.godMode) physicsStep(p, this.level.platforms, h, this.contacts);
      p.postStep();
      this.accumulator -= h;
      steps++;
    }
    if (steps === MAX_SUBSTEPS) this.accumulator = 0;   // máy quá chậm: bỏ phần nợ

    // (c) Biến sự kiện vật lý thành cảm giác
    this.reactToContacts(p, dt);

    // (d) Đồng hồ speedrun — chỉ chạy từ cú nhảy đầu tiên
    if (p.hasJumpedOnce) this.elapsed += dt;

    // (e) Chạm Cỗ Máy Thời Gian
    if (this.contacts.goal) this.winRun();
  }

  // --- 3.3 WON --------------------------------------------------------------
  updateWon(dt) {
    // Pháo hoa nổ liên tục quanh đỉnh tháp.
    this.fireworkTimer -= dt;
    if (this.fireworkTimer <= 0) {
      this.fireworkTimer = 0.35 + Math.random() * 0.4;
      this.particles.firework(
        (Math.random() - 0.5) * 40,
        WORLD.GOAL_Y + 6 + Math.random() * 26,
      );
    }
  }

  // ==========================================================================
  // [4] PHẢN ỨNG VA CHẠM — nơi vật lý biến thành CẢM GIÁC
  // ==========================================================================
  reactToContacts(p, dt) {
    const c = this.contacts;

    // --- Nhảy / Dash / Phanh gấp -------------------------------------------
    if (p.justJumped) this.audio.jump(p.jumpPower ?? 0);
    if (p.justDashed) this.audio.dash();
    if (p.justBraked) {
      this.audio.brake();
      this.particles.sparks(p.x, p.y - 1.6, 26, 1);
      this.stage.addShake(0.25);
    }
    if (p.dashTimer > 0) this.particles.dashTrail(p.x, p.y, dt);

    // --- Tiếp đất: bụi bung ra, tiếng bịch nặng dần theo độ cao rơi --------
    if (c.land) {
      this.audio.land(c.land.speed);
      this.particles.landDust(p.x, p.y, c.land.speed);
      this.stage.addShake(Math.min(0.9, c.land.speed / 130));
    }

    // --- Đập vào tường: tia lửa bắn ra --------------------------------------
    if (c.wall) {
      this.audio.wall(c.wall.speed);
      this.particles.sparks(c.wall.x, c.wall.y, c.wall.speed, c.wall.dir);
      this.stage.addShake(Math.min(0.7, c.wall.speed / 120));
    }

    // --- Cộc đầu vào trần ----------------------------------------------------
    if (c.ceiling) {
      this.audio.ceiling(c.ceiling.speed);
      this.particles.sparks(c.ceiling.x, c.ceiling.y + 1.6, c.ceiling.speed, 0);
      this.stage.addShake(Math.min(0.6, c.ceiling.speed / 110));
    }

    // --- Bục lò xo -----------------------------------------------------------
    if (c.bounce) {
      this.audio.bounce(c.bounce.speed);
      this.particles.landDust(p.x, p.y, c.bounce.speed * 0.6);
    }

    // --- Bục nứt bắt đầu rung ------------------------------------------------
    if (c.crack) {
      this.audio.crack();
      this.particles.crackDust(c.crack.x, c.crack.y);
    }
  }

  /** Giữ tiếng gồng lực khớp với trạng thái tích lực của nhân vật. */
  syncChargeSound(p) {
    if (p.charging) {
      this.audio.startCharge();
      this.audio.updateCharge(p.power);
    } else {
      this.audio.stopCharge();
    }
  }

  // ==========================================================================
  // [5] PHÍM TOÀN CỤC — hoạt động ở mọi trạng thái
  // ==========================================================================
  handleGlobalKeys() {
    if (this.input.wasPressed('MUTE')) {
      this.audio.unlock();
      const muted = this.audio.toggleMute();
      this.hud.setMuted(muted);
      this.hud.toast(muted ? '🔇 ĐÃ TẮT TIẾNG' : '🔊 ĐÃ BẬT TIẾNG');
    }

    if (this.input.wasPressed('RESET') && this.state !== 'MENU') {
      Storage.submitHeight(this.player.maxHeight);
      this.audio.stopCharge();
      this.startRun();
      this.hud.toast('LÀM LẠI TỪ CHÂN THÁP');
    }

    if (this.input.wasPressed('QUALITY')) {
      const name = this.stage.cycleQuality();
      this.particles.setScale(this.stage.pixelsPerUnit);
      this.hud.toast(`ĐỒ HOẠ: ${name.toUpperCase()}`);
    }

    if (this.state === 'PLAYING' && this.input.wasPressed('GOD_MODE')) {
      // Player.js đã tự đảo cờ; ở đây chỉ báo cho người chơi biết.
      this.hud.toast(this.player.godMode ? 'GOD MODE: BẬT' : 'GOD MODE: TẮT');
    }
  }

  // ==========================================================================
  // [6] THẮNG CUỘC
  // ==========================================================================
  winRun() {
    this.state = 'WON';
    this.audio.stopCharge();

    const time = this.elapsed;
    const isRecord = Storage.submitTime(time);
    Storage.submitHeight(this.player.maxHeight);

    this.audio.win();
    if (isRecord) this.audio.newRecord();

    // Loạt pháo hoa mở màn.
    for (let i = 0; i < 5; i++) {
      this.particles.firework((Math.random() - 0.5) * 34, WORLD.GOAL_Y + 8 + Math.random() * 22);
    }
    this.stage.addShake(0.8);

    this.hud.refreshBest();
    this.screens.showWin(time, isRecord);

    if (DEV) console.log(`[Game] Pha dao trong ${time.toFixed(3)}s | ky luc moi: ${isRecord}`);
  }
}

// ============================================================================
//  TIỆN ÍCH — dọn túi sự kiện va chạm đầu mỗi frame
//  (tái sử dụng object thay vì tạo mới, tránh sinh rác 60 lần mỗi giây)
// ============================================================================
function resetContacts(c) {
  c.land = null;
  c.wall = null;
  c.ceiling = null;
  c.bounce = null;
  c.crack = null;
  c.goal = false;
}
