import * as THREE from 'three';

// ==========================================
// 1. SETUP THREE.JS (2.5D)
// ==========================================
const app = document.getElementById('app');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#2b3036'); // Nền tối (bên trong tháp đồng hồ)

// Camera
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 60; // Giảm lại một chút (trước là 75, cũ là 50) để đạt tỷ lệ vàng
const camera = new THREE.OrthographicCamera(
  (frustumSize * aspect) / -2,
  (frustumSize * aspect) / 2,
  frustumSize / 2,
  frustumSize / -2,
  1,
  1000
);
camera.position.set(0, 5, 40);
camera.rotation.x = -15 * (Math.PI / 180);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

// Ánh sáng môi trường
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// Ánh sáng Định hướng (Ánh nắng chiều tà đổ bóng)
const dirLight = new THREE.DirectionalLight('#ffa366', 1.5);
dirLight.position.set(-30, 40, 40); 
dirLight.castShadow = true;
dirLight.shadow.camera.left = -60;
dirLight.shadow.camera.right = 60;
dirLight.shadow.camera.top = 40;
dirLight.shadow.camera.bottom = -40;
dirLight.shadow.mapSize.width = 512;
dirLight.shadow.mapSize.height = 512;
scene.add(dirLight);
scene.add(dirLight.target);

// ==========================================
// 2. 2D CUSTOM PHYSICS SYSTEM & WORLD
// ==========================================
const GRAVITY = -120; // Giảm bớt trọng lực để không bị rơi quá gắt
const MAX_FALL_SPEED = -110;

const player = {
  x: 0,
  y: 5, // Tăng độ cao ban đầu để không bị kẹt vào trong mặt sàn (sàn cao 4, top = 2, player nửa cao = 1.5 -> cần > 3.5)
  width: 3, // Phóng to nhân vật để tỷ lệ chuẩn với khung hình
  height: 3,
  vx: 0,
  vy: 0,
  isGrounded: false,
  dashCooldown: 0,
  hasUsedDrop: false,
  scaleX: 1,
  scaleY: 1,
  targetScaleX: 1,
  targetScaleY: 1,
};

let gameState = 'MENU'; // Trạng thái: 'MENU', 'PLAYING', 'WON'
let gameTime = 0;
let hasStartedMoving = false;
let wasGrounded = true;

const BEST_TIME_KEY = 'clockwork_tower_best_time';
let bestTime = localStorage.getItem(BEST_TIME_KEY);

const platforms = [];
const particles = [];
const bgElements = [];

// --- AUDIO SYSTEM ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playTone(freqStart, freqEnd, type = 'sine', duration = 0.2, vol = 0.1) {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = type;
  
  osc.frequency.setValueAtTime(freqStart, audioCtx.currentTime);
  if (freqEnd) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), audioCtx.currentTime + duration);
  }
  
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function createPlatform(x, y, w, h, type = 'static', fixedAngle = 0, moveRangeX = 0, moveSpeedX = 0, colorOverride = null) {
  const p = { 
    x, y, w, h, type,
    rotation: fixedAngle,
    isTriggered: false,
    fallTimer: 1.5,
    startX: x,
    moveRangeX,
    moveSpeedX,
    moveDir: 1,
    mesh: null
  };
  
  const geo = new THREE.BoxGeometry(w, h, 4);
  
  let color = '#7a8b99'; // static
  if (type === 'slope') color = '#b59e5e'; 
  if (type === 'falling') color = '#a65d53'; 
  if (type === 'bouncy') color = '#8cbfd9'; 
  if (type === 'sticky') color = '#5c4c3b'; 
  if (type === 'moving') color = '#9963a3'; // Tím cơ khí
  if (type === 'goal') color = '#f2e863'; // Vàng Đích đến
  
  if (colorOverride) color = colorOverride;
  
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, 0);
  if (fixedAngle !== 0) mesh.rotation.z = fixedAngle;
  
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  scene.add(mesh);
  
  p.mesh = mesh;
  platforms.push(p);
}

// --- PARALLAX BACKGROUND GEARS ---
function createBgGear(x, y, radius, color, zOffset = -30, speed = 1) {
  const geo = new THREE.TorusGeometry(radius, 2, 8, 24);
  const mat = new THREE.MeshStandardMaterial({ color, opacity: 0.3, transparent: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, zOffset);
  scene.add(mesh);
  bgElements.push({ mesh, baseY: y, speed });
}

// Rải Bánh răng lên tận Y = 1000
for (let i = 0; i < 40; i++) {
  const x = (Math.random() - 0.5) * 120;
  const y = 30 + i * 30;
  const radius = 15 + Math.random() * 30;
  const color = i % 2 === 0 ? '#3a424a' : '#4f555c';
  const speed = (Math.random() - 0.5) * 0.8;
  const zOffset = -30 - Math.random() * 30;
  createBgGear(x, y, radius, color, zOffset, speed);
}

// ---------------------------------------------------------
// BUILD LEVEL: THE CLOCKWORK TOWER (CHUNKY MAP - Y: 0 to 1050)
// Tọa độ X màn hình dao động từ khoảng -53 đến 53
// Thiết kế khối lớn (Chunky/Organic), Cây cối, Hầm hẹp, Môi trường đa dạng
// ---------------------------------------------------------

const C_FOREST = '#27ae60'; // Xanh lá
const C_WOOD = '#5c4033'; // Nâu đất
const C_ICE = '#2980b9'; // Xanh băng giá
const C_ICE_LIGHT = '#1abc9c'; // Cyan
const C_STEEL = '#7f8c8d'; // Xám công nghiệp
const C_COPPER = '#d35400'; // Đồng cam

// Biên trái phải tổng (chặn rơi ra khỏi map)
createPlatform(-55, 500, 10, 1200, 'static', 0, 0, 0, '#111111');
platforms[platforms.length-1].mesh.castShadow = false;
platforms[platforms.length-1].mesh.receiveShadow = false;
createPlatform(55, 500, 10, 1200, 'static', 0, 0, 0, '#111111');
platforms[platforms.length-1].mesh.castShadow = false;
platforms[platforms.length-1].mesh.receiveShadow = false;

// === VÙNG 1: RỪNG THÉP (Y: 0 -> 350) ===
createPlatform(0, -10, 150, 20, 'static', 0, 0, 0, C_WOOD); // Đáy
createPlatform(-20, 10, 11, 4, 'static', 0, 0, 0, C_FOREST);
createPlatform(19, 23, 8, 4, 'static', 0, 0, 0, C_FOREST);
createPlatform(-19, 35, 9, 4, 'static', 0, 0, 0, C_FOREST);
createPlatform(16, 48, 11, 4, 'static', 0, 0, 0, C_FOREST);
createPlatform(-19, 61, 11, 4, 'static', 0, 0, 0, C_FOREST);
createPlatform(15, 74, 10, 4, 'static', 0, 0, 0, C_FOREST);
createPlatform(-18, 89, 10, 4, 'static', 0, 0, 0, C_FOREST);
createPlatform(19, 102, 9, 4, 'static', 0, 0, 0, C_FOREST);
createPlatform(-17, 115, 10, 4, 'static', 0, 0, 0, C_FOREST);
createPlatform(15, 129, 11, 4, 'static', 0, 0, 0, C_FOREST);
createPlatform(-20, 144, 10, 4, 'static', 0, 0, 0, C_FOREST);
createPlatform(17, 157, 8, 4, 'static', 0, 0, 0, C_FOREST);
createPlatform(-16, 171, 9, 4, 'static', 0, 0, 0, C_FOREST);
createPlatform(19, 185, 8, 4, 'static', 0, 0, 0, C_FOREST);
createPlatform(-18, 198, 9, 4, 'static', 0, 0, 0, C_FOREST);
// Phễu Tử Thần 1
createPlatform(-28, 220, 40, 5, 'slope', -Math.PI / 6, 0, 0, C_WOOD);
createPlatform(28, 220, 40, 5, 'slope', Math.PI / 6, 0, 0, C_WOOD);
createPlatform(-45, 240, 8, 4, 'static', 0, 0, 0, C_FOREST);
createPlatform(45, 260, 8, 4, 'static', 0, 0, 0, C_FOREST);
createPlatform(0, 275, 6, 4, 'static', 0, 0, 0, C_FOREST);
// === VÙNG 2: HẦM BĂNG GIÁ (Y: 300 -> 650) ===
createPlatform(17, 300, 8, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(-19, 315, 7, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(21, 330, 7, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(-19, 344, 6, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(19, 357, 7, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(-20, 373, 6, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(19, 389, 9, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(-20, 402, 9, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(21, 416, 6, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(-19, 429, 7, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(22, 443, 6, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(-22, 458, 9, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(20, 473, 9, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(-22, 488, 6, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(22, 502, 8, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(-23, 516, 9, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(22, 530, 6, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(-20, 544, 8, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(21, 558, 7, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(-23, 572, 8, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(20, 588, 6, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(-19, 604, 6, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
createPlatform(18, 617, 7, 4, 'static', 0, 0, 0, C_ICE_LIGHT);
// Trạm nghỉ
createPlatform(0, 640, 20, 6, 'static', 0, 0, 0, C_ICE);
// === VÙNG 3: NÓC THÁP CƠ KHÍ (Y: 650 -> 1000) ===
createPlatform(-19, 660, 6, 4, 'bouncy', 0, 0, 0, '#8cbfd9');
createPlatform(22, 675, 5, 4, 'moving', 0, 0, 0, C_COPPER, 0, 23, 20);
createPlatform(-22, 691, 6, 4, 'static', 0, 0, 0, C_STEEL);
createPlatform(21, 707, 7, 4, 'static', 0, 0, 0, C_STEEL);
createPlatform(-21, 721, 7, 4, 'static', 0, 0, 0, C_STEEL);
createPlatform(20, 735, 7, 4, 'bouncy', 0, 0, 0, '#8cbfd9');
createPlatform(-24, 751, 6, 4, 'static', 0, 0, 0, C_STEEL);
createPlatform(23, 766, 5, 4, 'static', 0, 0, 0, C_STEEL);
createPlatform(-25, 781, 7, 4, 'static', 0, 0, 0, C_STEEL);
createPlatform(24, 797, 7, 4, 'static', 0, 0, 0, C_STEEL);
createPlatform(-21, 811, 6, 4, 'static', 0, 0, 0, C_STEEL);
createPlatform(22, 827, 5, 4, 'static', 0, 0, 0, C_STEEL);
createPlatform(-24, 842, 7, 4, 'static', 0, 0, 0, C_STEEL);
// SIÊU PHỄU TỬ THẦN 2
createPlatform(-28, 880, 50, 6, 'slope', -Math.PI / 8, 0, 0, C_STEEL);
createPlatform(28, 880, 50, 6, 'slope', Math.PI / 8, 0, 0, C_STEEL);
createPlatform(-45, 910, 6, 4, 'moving', 0, 5, 20, C_COPPER);
createPlatform(45, 940, 6, 4, 'moving', 0, 5, -20, C_COPPER);
createPlatform(0, 970, 4, 4, 'static', 0, 0, 0, C_STEEL);

// === ĐỈNH CAO NHẤT (Y: 1050) ===
createPlatform(0, 1050, 80, 20, 'goal'); // Cỗ Máy Thời Gian - Bục Đích

// Player 3D Mesh (Chú robot tí hon)
const playerMesh = new THREE.Group();

const bodyGeo = new THREE.BoxGeometry(player.width, player.height, 2);
const bodyMat = new THREE.MeshStandardMaterial({ color: '#e6e6e6' });
const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
playerMesh.add(bodyMesh);

// Visor (Kính mắt robot phát sáng)
const visorGeo = new THREE.BoxGeometry(player.width * 0.8, player.height * 0.25, 2.1);
const visorMat = new THREE.MeshStandardMaterial({ color: '#4ade80', emissive: '#4ade80', emissiveIntensity: 0.8 });
const visorMesh = new THREE.Mesh(visorGeo, visorMat);
visorMesh.position.set(0, player.height * 0.2, 0); 
playerMesh.add(visorMesh);

playerMesh.castShadow = true;
playerMesh.receiveShadow = true;
scene.add(playerMesh);


// ==========================================
// 3. INPUT & UI
// ==========================================
let isCharging = false;
let chargePower = 0; // 0-100
let chargeDir = 1;
const CHARGE_SPEED = 120; // Units per sec

const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const zPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const targetPoint = new THREE.Vector3();
const aimDir2D = new THREE.Vector2(0, 1);

const uiContainer = document.getElementById('power-container');
const uiBar = document.getElementById('power-bar');

const arrowHelper = new THREE.ArrowHelper(
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, 0, 0),
  3, // Mũi tên to hơn
  0xff0000,
  1,
  1
);
scene.add(arrowHelper);

// Skills UI (HUD)
const skillsUi = document.createElement('div');
skillsUi.style.position = 'absolute';
skillsUi.style.top = '20px';
skillsUi.style.left = '20px';
skillsUi.style.fontFamily = 'monospace';
skillsUi.style.fontSize = '24px';
skillsUi.style.fontWeight = 'bold';
skillsUi.style.textShadow = '1px 1px 2px #000';
skillsUi.style.lineHeight = '1.5';
skillsUi.style.zIndex = '100';
skillsUi.id = 'skills-ui'; // Thêm id để dễ debug
document.body.appendChild(skillsUi);

// --- TIMER UI ---
const timerUi = document.createElement('div');
timerUi.style.position = 'absolute';
timerUi.style.top = '20px';
timerUi.style.right = '20px';
timerUi.style.color = '#fff';
timerUi.style.fontFamily = 'monospace';
timerUi.style.fontSize = '30px';
timerUi.style.fontWeight = 'bold';
timerUi.style.textShadow = '2px 2px 4px #000';
timerUi.style.zIndex = '100';
timerUi.innerText = '00:00:00';
document.body.appendChild(timerUi);

// --- MENU UI ---
const menuUi = document.createElement('div');
menuUi.style.position = 'absolute';
menuUi.style.inset = '0';
menuUi.style.backgroundColor = 'rgba(43, 48, 54, 0.9)'; // Trùng màu nền
menuUi.style.display = 'flex';
menuUi.style.flexDirection = 'column';
menuUi.style.justifyContent = 'center';
menuUi.style.alignItems = 'center';
menuUi.style.zIndex = '200';

const title = document.createElement('h1');
title.innerText = 'THE CLOCKWORK TOWER';
title.style.color = '#f2e863';
title.style.fontSize = '80px';
title.style.fontFamily = 'sans-serif';
title.style.textShadow = '0 0 20px #f2e863';
title.style.marginBottom = '20px';
menuUi.appendChild(title);

const menuBestTime = document.createElement('div');
menuBestTime.style.color = '#fff';
menuBestTime.style.fontSize = '30px';
menuBestTime.style.marginBottom = '40px';
menuBestTime.style.fontFamily = 'monospace';
if (bestTime) {
  menuBestTime.innerText = `BEST TIME: ${formatTime(parseFloat(bestTime))}`;
}
menuUi.appendChild(menuBestTime);

const startBtn = document.createElement('button');
startBtn.innerText = 'START GAME';
startBtn.style.padding = '15px 40px';
startBtn.style.fontSize = '30px';
startBtn.style.fontWeight = 'bold';
startBtn.style.backgroundColor = '#4ade80';
startBtn.style.color = '#111';
startBtn.style.border = 'none';
startBtn.style.borderRadius = '10px';
startBtn.style.cursor = 'pointer';
startBtn.onclick = startGame;
menuUi.appendChild(startBtn);
document.body.appendChild(menuUi);

// --- WIN UI ---
const winUi = document.createElement('div');
winUi.style.position = 'absolute';
winUi.style.inset = '0';
winUi.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
winUi.style.display = 'none'; // Ẩn mặc định
winUi.style.flexDirection = 'column';
winUi.style.justifyContent = 'center';
winUi.style.alignItems = 'center';
winUi.style.zIndex = '200';

const winTitle = document.createElement('h1');
winTitle.innerHTML = 'CHÚC MỪNG!<br>BẠN ĐÃ KHỞI ĐỘNG LẠI THỜI GIAN!';
winTitle.style.color = '#f2e863';
winTitle.style.fontSize = '60px';
winTitle.style.textAlign = 'center';
winTitle.style.textShadow = '2px 2px 10px #000';
winUi.appendChild(winTitle);

const finalTimeDisplay = document.createElement('div');
finalTimeDisplay.style.color = '#fff';
finalTimeDisplay.style.fontSize = '40px';
finalTimeDisplay.style.margin = '30px 0';
finalTimeDisplay.style.textAlign = 'center';
finalTimeDisplay.style.fontFamily = 'monospace';
winUi.appendChild(finalTimeDisplay);

const replayBtn = document.createElement('button');
replayBtn.innerText = 'PLAY AGAIN';
replayBtn.style.padding = '15px 40px';
replayBtn.style.fontSize = '30px';
replayBtn.style.backgroundColor = '#4ade80';
replayBtn.style.color = '#111';
replayBtn.style.border = 'none';
replayBtn.style.borderRadius = '10px';
replayBtn.style.cursor = 'pointer';
replayBtn.onclick = startGame;
winUi.appendChild(replayBtn);
document.body.appendChild(winUi);

// --- HÀM START GAME ---
function startGame() {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  gameState = 'PLAYING';
  gameTime = 0;
  hasStartedMoving = false;
  timerUi.innerText = '00:00:00';
  
  player.x = 0;
  player.y = 5;
  player.vx = 0;
  player.vy = 0;
  player.dashCooldown = 0;
  player.hasUsedDrop = false;
  
  bestTime = localStorage.getItem(BEST_TIME_KEY);
  if (bestTime) {
    menuBestTime.innerText = `BEST TIME: ${formatTime(parseFloat(bestTime))}`;
  }
  
  menuUi.style.display = 'none';
  winUi.style.display = 'none';
  skillsUi.style.display = 'block';
  
  camera.position.y = player.y + 28;
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds * 100) % 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
}

window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

let isSpaceDown = false;
let groundedPlat = null;
let isGodMode = false;
window.addEventListener('click', () => {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
});

const keys = {};

window.addEventListener('keydown', (e) => {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  keys[e.code] = true;
  
  if (gameState !== 'PLAYING') return; // Chặn input nếu không ở trong game

  if (e.code === 'KeyG') {
    isGodMode = !isGodMode;
    if (isGodMode) {
      player.vx = 0;
      player.vy = 0;
      isCharging = false;
      uiContainer.style.display = 'none';
    }
  }
  
  if (e.code === 'Space') {
    isSpaceDown = true;
    hasStartedMoving = true; // Bắt đầu tính giờ ngay khi lấy đà cú nhảy đầu tiên
  }
  if (e.code === 'KeyE') {
    if (player.dashCooldown <= 0) {
      player.dashCooldown = 3.0;
      
      const DASH_FORCE = 75; // Tăng lực ném lên một chút theo yêu cầu
      player.vx = aimDir2D.x * DASH_FORCE;
      player.vy = aimDir2D.y * DASH_FORCE;
      player.isGrounded = false;
      groundedPlat = null;
      spawnParticles(player.x, player.y, 20, '#4ade80', 1.5); // Bắn tia sáng lướt xanh lá
      playTone(600, 100, 'sawtooth', 0.3, 0.05); // Tiếng lướt
    }
  }
  if (e.code === 'KeyQ') {
    if (!player.isGrounded && !player.hasUsedDrop) {
      player.hasUsedDrop = true;
      player.isDashing = false; 
      player.vx = 0; 
      player.vy = 0; // Đứng khựng lại trên không và rớt tự nhiên
      playTone(800, 800, 'square', 0.1, 0.05); // Tiếng phanh gấp
      
      // Hoạt ảnh phanh gấp bẹp người theo chiều dọc
      player.scaleX = 1.3;
      player.scaleY = 0.7;
    }
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'Space') {
    isSpaceDown = false;
    if (isCharging) {
      isCharging = false;
      uiContainer.style.display = 'none';
      playerMesh.scale.set(1, 1, 1);
      
      let maxForce = 85; // Lực nhảy được giảm tương ứng để giữ nguyên độ cao nhảy 30 units
      let minForce = 25; 
      
      if (groundedPlat) {
        if (groundedPlat.type === 'bouncy') {
          maxForce *= 1.3; // Đã giảm từ 1.6 xuống 1.3 cho bớt nảy quá xa
          minForce *= 1.3;
        } else if (groundedPlat.type === 'sticky') {
          maxForce *= 0.6;
          minForce *= 0.6;
        }
      }

      const force = minForce + (chargePower / 100) * maxForce;
      player.vx += aimDir2D.x * force;
      player.vy = aimDir2D.y * force; 
      player.isGrounded = false;
      groundedPlat = null;
      
      spawnParticles(player.x, player.y - player.height/2, 15, '#e6e6e6', force/50); // Bụi khi nhảy
      playTone(200, 400 + force * 2, 'sine', 0.2 + force/200, 0.1); // Tiếng nhảy tỉ lệ với lực
    }
  }
});

window.addEventListener('resize', () => {
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = (frustumSize * aspect) / -2;
  camera.right = (frustumSize * aspect) / 2;
  camera.top = frustumSize / 2;
  camera.bottom = frustumSize / -2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==========================================
// 4. GAME LOOP
// ==========================================
const clock = new THREE.Clock();

function spawnParticles(x, y, count, color, forceScale) {
  for (let i = 0; i < count; i++) {
    const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, 0);
    scene.add(mesh);
    particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 15 * forceScale,
      vy: (Math.random() - 0.5) * 15 * forceScale,
      life: 1.0,
      decay: 1.5 + Math.random() * 2
    });
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (gameState === 'PLAYING' && hasStartedMoving) {
    gameTime += dt;
    timerUi.innerText = formatTime(gameTime);
  }

  if (gameState === 'WON') {
    playerMesh.rotation.y += dt;
  }

  if (gameState !== 'PLAYING') {
    skillsUi.style.display = 'none';
  }

  // --- 0. Dash Logic & UI ---
  let eText = '';
  if (player.dashCooldown > 0) {
    player.dashCooldown -= dt;
    eText = `<span style="color:#aaa">LƯỚT (E): ${Math.ceil(player.dashCooldown)}s</span>`;
  } else {
    eText = `<span style="color:#4ade80">LƯỚT (E): SẴN SÀNG</span>`;
  }

  let qText = '';
  // Kỹ năng Q sẵn sàng nếu chưa dùng trong lần nhảy này (hoặc đang đứng trên đất)
  if (!player.hasUsedDrop || player.isGrounded) {
    qText = `<span style="color:#4ade80">ĐÁP (Q): SẴN SÀNG</span>`;
  } else {
    qText = `<span style="color:#ef4444">ĐÁP (Q): CHỜ CHẠM ĐẤT</span>`;
  }
  
  if (isGodMode) {
    skillsUi.innerHTML = `<span style="color:#f2e863">GOD MODE ON (WASD)</span><br>${eText}<br>${qText}`;
  } else {
    skillsUi.innerHTML = `${eText}<br>${qText}`;
  }

  let nextY = player.y;

  if (gameState === 'PLAYING') {
    wasGrounded = player.isGrounded;
    const fallSpeed = Math.abs(player.vy);
    
    // --- 1. Gravity ---
    if (!isGodMode && !player.isGrounded) {
      player.vy += GRAVITY * dt;
      if (player.vy < MAX_FALL_SPEED) player.vy = MAX_FALL_SPEED;
    }

    // --- 2. Y Collision ---
    nextY = player.y + player.vy * dt;
    if (!isGodMode) {
      player.isGrounded = false;
      groundedPlat = null;

      for (const plat of platforms) {
    if (plat.isFalling && plat.fallTimer <= 0) continue;
    
    if (player.x + player.width/2 > plat.x - plat.w/2 && player.x - player.width/2 < plat.x + plat.w/2) {
       const surfaceY = plat.y + plat.h/2 + ((plat.type === 'slope') ? Math.tan(plat.rotation) * (player.x - plat.x) : 0);
       
       if (player.vy <= 0 && (player.y - player.height/2 >= surfaceY - Math.abs(player.vy * dt) - 0.2)) {
          if (nextY - player.height/2 <= surfaceY) {
             nextY = surfaceY + player.height/2;
             player.isGrounded = true;
             player.hasUsedDrop = false; 
             player.vy = 0;
             groundedPlat = plat;
             
             if (plat.type === 'goal') {
               if (gameState !== 'WON') {
                 gameState = 'WON';
                 
                 let isNewRecord = false;
                 if (!bestTime || gameTime < parseFloat(bestTime)) {
                   bestTime = gameTime;
                   localStorage.setItem(BEST_TIME_KEY, gameTime);
                   isNewRecord = true;
                 }
                 
                 if (isNewRecord) {
                   finalTimeDisplay.innerHTML = `Thành tích: ${formatTime(gameTime)}<br><span style="color:#4ade80; font-size:50px;">KỶ LỤC MỚI!</span>`;
                 } else {
                   finalTimeDisplay.innerHTML = `Thành tích: ${formatTime(gameTime)}<br><span style="color:#aaa; font-size:30px;">Kỷ lục: ${formatTime(parseFloat(bestTime))}</span>`;
                 }
                 
                 winUi.style.display = 'flex';
                 
                 // Nhạc chiến thắng (Arpeggio)
                 setTimeout(() => playTone(440, 440, 'square', 0.2, 0.1), 0);
                 setTimeout(() => playTone(554, 554, 'square', 0.2, 0.1), 200);
                 setTimeout(() => playTone(659, 659, 'square', 0.2, 0.1), 400);
                 setTimeout(() => playTone(880, 880, 'square', 0.4, 0.15), 600);
               }
             }
          }
       }
       else if (player.vy > 0 && player.y + player.height/2 <= plat.y - plat.h/2) {
          if (nextY + player.height/2 >= plat.y - plat.h/2) {
             nextY = plat.y - plat.h/2 - player.height/2;
             if (player.vy > 10) {
               playTone(300, 150, 'square', 0.1, Math.min(player.vy / 300, 0.2));
               spawnParticles(player.x, nextY + player.height/2, 10, '#ffffff', player.vy / 50);
             }
             player.vy = -1;
          }
       }
    }
  }
  }
  player.y = nextY;
  
  if (!wasGrounded && player.isGrounded && !isGodMode) {
     spawnParticles(player.x, player.y - player.height/2, 15, '#a3a3a3', fallSpeed/30); // Bụi khi chạm đất
     playTone(150, 50, 'sawtooth', 0.1, Math.min(fallSpeed/200, 0.2)); // Tiếng chạm đất nặng
     
     // Ép bẹp cơ thể khi va đập mạnh (Squash Impact)
     const impact = Math.min(fallSpeed / 120, 0.6); // Bẹp tối đa 60%
     player.scaleX = 1 + impact;
     player.scaleY = 1 - impact;
  }
  
  } // <-- End if (gameState === 'PLAYING') for Y logic

  // --- 3. Update Platforms ---
  for (const plat of platforms) {
    if (plat.type === 'moving') {
      const prevX = plat.x;
      plat.x += plat.moveDir * plat.moveSpeedX * dt;
      if (Math.abs(plat.x - plat.startX) >= plat.moveRangeX) {
        plat.x = plat.startX + Math.sign(plat.x - plat.startX) * plat.moveRangeX;
        plat.moveDir *= -1;
      }
      plat.mesh.position.x = plat.x;
      
      // Kéo player đi theo bục nếu đang đứng trên đó
      if (groundedPlat === plat && player.isGrounded) {
        player.x += (plat.x - prevX);
      }
    }
    else if (plat.type === 'slope') {
      if (groundedPlat === plat) {
        const slideAccel = Math.sin(plat.rotation) * -100; 
        player.vx += slideAccel * dt;
      }
    }
    else if (plat.type === 'falling') {
      if (groundedPlat === plat && !plat.isTriggered) {
         plat.isTriggered = true;
      }
      
      if (plat.isTriggered && plat.fallTimer > 0) {
         plat.fallTimer -= dt;
         plat.mesh.position.x = plat.x + (Math.random() - 0.5) * 0.1;
         plat.mesh.position.y = plat.y + (Math.random() - 0.5) * 0.1;
      } 
      else if (plat.isTriggered && plat.fallTimer <= 0) {
         plat.isFalling = true;
         plat.y -= 15 * dt; 
         plat.mesh.position.y = plat.y;
         plat.mesh.position.x = plat.x; 
         plat.mesh.rotation.z += dt; 
      }
    }
  }

  let nextX = player.x;

  if (gameState === 'PLAYING') {
    // --- 4. Friction ---
    if (!isGodMode) {
      if (!player.isGrounded) {
        player.vx *= 0.99; // Lực cản không khí nhẹ
      } else {
        if (groundedPlat && groundedPlat.type === 'slope') {
          player.vx *= 0.96;
        } else {
          player.vx *= 0.8;
        }
        if (Math.abs(player.vx) < 0.1 && (!groundedPlat || groundedPlat.type !== 'slope')) {
          player.vx = 0;
        }
      }
    }

    // --- 5. X Collision ---
    nextX = player.x + player.vx * dt;
    if (!isGodMode) {
      for (const plat of platforms) {
    if (plat === groundedPlat) continue; 
    if (plat.isFalling && plat.fallTimer <= 0) continue;
    
    if (player.y - player.height/2 + 0.2 < plat.y + plat.h/2 && player.y + player.height/2 - 0.2 > plat.y - plat.h/2) {
       if (player.vx > 0 && player.x + player.width/2 <= plat.x - plat.w/2 && nextX + player.width/2 >= plat.x - plat.w/2) {
         nextX = plat.x - plat.w/2 - player.width/2;
         if (Math.abs(player.vx) > 10) {
           playTone(300, 150, 'square', 0.1, Math.min(Math.abs(player.vx) / 300, 0.2));
           spawnParticles(nextX + player.width/2, player.y, 10, '#ffffff', Math.abs(player.vx) / 50);
         }
         player.vx *= -0.5;
       } else if (player.vx < 0 && player.x - player.width/2 >= plat.x + plat.w/2 && nextX - player.width/2 <= plat.x + plat.w/2) {
         nextX = plat.x + plat.w/2 + player.width/2;
         if (Math.abs(player.vx) > 10) {
           playTone(300, 150, 'square', 0.1, Math.min(Math.abs(player.vx) / 300, 0.2));
           spawnParticles(nextX - player.width/2, player.y, 10, '#ffffff', Math.abs(player.vx) / 50);
         }
         player.vx *= -0.5;
       }
    }
  }
  }
  player.x = nextX;
  
  if (isGodMode) {
    const godSpeed = 80 * dt; // Giảm tốc độ God Mode cho dễ nhìn
    if (keys['KeyW']) player.y += godSpeed;
    if (keys['KeyS']) player.y -= godSpeed;
    if (keys['KeyA']) player.x -= godSpeed;
    if (keys['KeyD']) player.x += godSpeed;
  }
  
  } // <-- End if (gameState === 'PLAYING') for X logic

  playerMesh.position.set(player.x, player.y, 0);

  // --- UPDATE PARTICLES ---
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= p.decay * dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    } else {
      p.vy -= 80 * dt; // Trọng lực nhẹ cho hạt
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.scale.setScalar(Math.max(p.life, 0));
    }
  }

  // --- UPDATE BACKGROUND PARALLAX ---
  for (const bg of bgElements) {
    bg.mesh.rotation.z += bg.speed * dt;
    bg.mesh.position.y = bg.baseY + (camera.position.y * 0.6); // Parallax theo chiều dọc
  }

  // --- 6. CAMERA FOLLOW VERTICAL ONLY ---
  // Camera luôn đi theo nhân vật nhưng chỉ theo trục Y.
  // Đẩy camera hếch lên trên sát mép tuyệt đối (+28) để chân người chơi dính liền với viền dưới màn hình.
  const targetCamY = player.y + 28; 
  camera.position.y += (targetCamY - camera.position.y) * 10 * dt;
  
  // Ánh sáng đổ bóng di chuyển theo camera
  dirLight.position.y = camera.position.y + 40;
  dirLight.target.position.set(camera.position.x, camera.position.y, 0);
  camera.position.x = 0; // Khóa chết trục X ở giữa màn hình

  // --- 7. AIMING & CHARGING ---
  raycaster.setFromCamera(mouse, camera);
  raycaster.ray.intersectPlane(zPlane, targetPoint);
  
  let dx = targetPoint.x - player.x;
  let dy = Math.max(targetPoint.y - player.y, 0.1); 
  
  const length = Math.sqrt(dx*dx + dy*dy);
  aimDir2D.set(dx/length, dy/length);

  arrowHelper.position.set(player.x, player.y, 1); 
  arrowHelper.setDirection(new THREE.Vector3(aimDir2D.x, aimDir2D.y, 0));

  // --- EYE TRACKING ---
  // Mắt trượt theo hướng chuột
  visorMesh.position.x = aimDir2D.x * 0.5;
  visorMesh.position.y = (player.height * 0.2) + aimDir2D.y * 0.5;

  if (isSpaceDown && player.isGrounded && !isCharging) {
    isCharging = true;
    chargePower = 0;
    chargeDir = 1;
    uiContainer.style.display = 'block';
    uiBar.style.width = '0%';
  }

  if (isCharging) {
    chargePower += chargeDir * CHARGE_SPEED * dt;
    if (chargePower >= 100) {
      chargePower = 100;
      chargeDir = -1;
    } else if (chargePower <= 0) {
      chargePower = 0;
      chargeDir = 1;
    }
    uiBar.style.width = `${chargePower}%`;
    arrowHelper.setLength(2 + (chargePower/100)*4, 1, 1);
  } else {
    arrowHelper.setLength(3, 1, 1);
  }
  
  // --- SQUASH & STRETCH LERP ---
  if (isCharging) {
    const chargeSquash = (chargePower/100) * 0.3;
    player.targetScaleX = 1 + chargeSquash;
    player.targetScaleY = 1 - chargeSquash;
  } else if (!player.isGrounded) {
    // Dãn dài theo vận tốc rơi/bay (Càng nhanh càng dài)
    const stretch = Math.min(Math.abs(player.vy) / 150, 0.5); 
    player.targetScaleX = 1 - stretch * 0.5;
    player.targetScaleY = 1 + stretch;
  } else {
    // Trở về bình thường khi đứng yên
    player.targetScaleX = 1;
    player.targetScaleY = 1;
  }

  // Nội suy mượt mà (Spring physics) để scale di chuyển dần về targetScale
  player.scaleX += (player.targetScaleX - player.scaleX) * 15 * dt;
  player.scaleY += (player.targetScaleY - player.scaleY) * 15 * dt;
  
  playerMesh.scale.set(player.scaleX, player.scaleY, 1);

  renderer.render(scene, camera);
}

animate();
