const DIRS = {
  up: { dr: -1, dc: 0, rot: "0deg", exitX: "0", exitY: "-145%" },
  right: { dr: 0, dc: 1, rot: "90deg", exitX: "145%", exitY: "0" },
  down: { dr: 1, dc: 0, rot: "180deg", exitX: "0", exitY: "145%" },
  left: { dr: 0, dc: -1, rot: "270deg", exitX: "-145%", exitY: "0" }
};

const DIRECTIONS = Object.keys(DIRS);
const COLORS = {
  up: "#2f765f",
  right: "#4b6f9f",
  down: "#d36b4b",
  left: "#b9872d"
};

const LEVEL_TITLES = [
  "고요한 출구",
  "얽힌 산책",
  "교차하는 호흡",
  "좁은 회랑",
  "마지막 정렬",
  "유리 정원",
  "느린 파동",
  "선명한 미로"
];

const LEVEL_FLAVORS = [
  "가장자리로 바로 빠지는 길부터 읽어 보세요.",
  "중앙의 화살표는 주변이 비워질 때까지 기다립니다.",
  "같은 줄과 열에 있는 화살표가 서로의 문을 잠급니다.",
  "한쪽을 비우면 반대쪽의 긴 길이 열립니다.",
  "막힘을 풀어내는 순서가 퍼즐 전체의 리듬을 만듭니다.",
  "지금 보이는 답보다 한 수 뒤의 빈 공간이 더 중요합니다.",
  "짧은 길을 먼저 정리하면 긴 길이 조용히 열립니다.",
  "방향보다 경로를 먼저 보고, 충돌을 거꾸로 상상하세요."
];

const board = document.querySelector("#board");
const levelLabel = document.querySelector("#levelLabel");
const remainingLabel = document.querySelector("#remainingLabel");
const movesLabel = document.querySelector("#movesLabel");
const levelName = document.querySelector("#levelName");
const levelFlavor = document.querySelector("#levelFlavor");
const levelStrip = document.querySelector("#levelStrip");
const completePanel = document.querySelector("#completePanel");
const completeText = document.querySelector("#completeText");
const hintBtn = document.querySelector("#hintBtn");
const resetBtn = document.querySelector("#resetBtn");
const undoBtn = document.querySelector("#undoBtn");
const nextBtn = document.querySelector("#nextBtn");
const prevLevelBtn = document.querySelector("#prevLevelBtn");
const nextLevelBtn = document.querySelector("#nextLevelBtn");
const soundBtn = document.querySelector("#soundBtn");
const bgm = document.querySelector("#bgm");
const accountTitle = document.querySelector("#accountTitle");
const accountStatus = document.querySelector("#accountStatus");
const authForm = document.querySelector("#authForm");
const emailInput = document.querySelector("#emailInput");
const passwordInput = document.querySelector("#passwordInput");
const signupBtn = document.querySelector("#signupBtn");
const guestBtn = document.querySelector("#guestBtn");
const logoutBtn = document.querySelector("#logoutBtn");
const resetDialog = document.querySelector("#resetDialog");
const restartStageBtn = document.querySelector("#restartStageBtn");
const resetAllBtn = document.querySelector("#resetAllBtn");
const BGM_SOURCES = [
  "https://jihoo125.it.kr/audio/001.mp3",
  "http://jihoo125.it.kr/audio/001.mp3",
  "/api/bgm"
];
const MAX_REASONABLE_LEVEL = 9999;
const MAX_STORED_CLEARS = 500;
const MAX_GRID_SIZE = 15;
const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

let cleared = new Set(readClearedLevels());
let maxUnlocked = getContiguousUnlocked(cleared);
maxUnlocked = Math.min(maxUnlocked, MAX_REASONABLE_LEVEL);
let currentLevel = Math.min(readStoredNumber("arrows-level"), maxUnlocked);
let level = createLevel(currentLevel);
let active = [];
let history = [];
let moves = 0;
let soundOn = false;
let audioContext;
let bgmSourceIndex = 0;
let bgmRetrying = false;
let supabase = null;
let activeUser = null;
let cloudReady = false;

bgm.volume = 0.42;
bgm.addEventListener("error", () => {
  soundBtn.title = "배경음 연결 실패";
  if (soundOn) tryNextBgmSource();
});
bgm.addEventListener("canplay", () => {
  soundBtn.title = "사운드";
});

function readStoredNumber(key) {
  const value = Number(localStorage.getItem(key) || 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function readClearedLevels() {
  try {
    const levels = JSON.parse(localStorage.getItem("arrows-cleared") || "[]");
    if (!Array.isArray(levels)) return [];
    return levels
      .filter((item) => Number.isInteger(item) && item >= 0 && item <= MAX_REASONABLE_LEVEL)
      .slice(-MAX_STORED_CLEARS);
  } catch {
    localStorage.removeItem("arrows-cleared");
    return [];
  }
}

function getContiguousUnlocked(levels) {
  let levelIndex = 0;
  while (levels.has(levelIndex) && levelIndex < MAX_REASONABLE_LEVEL) {
    levelIndex += 1;
  }
  return levelIndex;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function createLevel(index) {
  const random = seededRandom(12043 + index * 7919);
  const size = Math.min(MAX_GRID_SIZE, 4 + Math.floor(index / 50));
  const density = Math.min(0.62, 0.42 + index * 0.012);
  const targetCount = Math.min(size * size - 2, Math.round(size * size * density));
  const arrows = [];
  const maxAttempts = targetCount * 80;

  for (let attempt = 0; arrows.length < targetCount && attempt < maxAttempts; attempt += 1) {
    const row = Math.floor(random() * size);
    const col = Math.floor(random() * size);
    if (arrows.some((arrow) => arrow.row === row && arrow.col === col)) continue;

    const validDirections = shuffle(DIRECTIONS, random).filter((dir) =>
      pathIsClear({ row, col, dir }, arrows, size)
    );

    if (validDirections.length === 0) continue;
    arrows.push({ id: arrows.length, row, col, dir: validDirections[0] });
  }

  return {
    number: index + 1,
    name: LEVEL_TITLES[index % LEVEL_TITLES.length],
    flavor: LEVEL_FLAVORS[index % LEVEL_FLAVORS.length],
    size,
    arrows: arrows.map((arrow, id) => ({ ...arrow, id }))
  };
}

function pathIsClear(arrow, arrows, size) {
  const dir = DIRS[arrow.dir];
  let row = arrow.row + dir.dr;
  let col = arrow.col + dir.dc;

  while (row >= 0 && row < size && col >= 0 && col < size) {
    if (arrows.some((item) => item.row === row && item.col === col)) {
      return false;
    }
    row += dir.dr;
    col += dir.dc;
  }

  return true;
}

function cloneArrows(arrows) {
  return arrows.map((arrow) => ({ ...arrow }));
}

function startLevel(index) {
  currentLevel = Math.min(Math.max(0, index), maxUnlocked);
  level = createLevel(currentLevel);
  active = cloneArrows(level.arrows);
  history = [];
  moves = 0;
  completePanel.hidden = true;
  localStorage.setItem("arrows-level", String(currentLevel));
  render();
}

function render() {
  board.innerHTML = "";
  board.style.gridTemplateColumns = `repeat(${level.size}, minmax(0, 1fr))`;
  board.style.gridTemplateRows = `repeat(${level.size}, minmax(0, 1fr))`;

  for (let row = 0; row < level.size; row += 1) {
    for (let col = 0; col < level.size; col += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      const arrow = active.find((item) => item.row === row && item.col === col);

      if (arrow) {
        const button = document.createElement("button");
        button.className = "arrow";
        button.type = "button";
        button.dataset.id = String(arrow.id);
        button.style.setProperty("--rotate", DIRS[arrow.dir].rot);
        button.style.setProperty("--arrow-color", COLORS[arrow.dir]);
        button.style.setProperty("--exit-x", DIRS[arrow.dir].exitX);
        button.style.setProperty("--exit-y", DIRS[arrow.dir].exitY);
        button.setAttribute("aria-label", `${row + 1}행 ${col + 1}열 ${directionLabel(arrow.dir)} 화살표`);
        button.addEventListener("click", () => tryRemove(arrow.id));
        cell.append(button);
      }

      board.append(cell);
    }
  }

  levelLabel.textContent = String(level.number);
  remainingLabel.textContent = String(active.length);
  movesLabel.textContent = String(moves);
  levelName.textContent = level.name;
  levelFlavor.textContent = level.flavor;
  undoBtn.disabled = history.length === 0;
  prevLevelBtn.disabled = currentLevel === 0;
  nextLevelBtn.disabled = currentLevel >= maxUnlocked;
  renderLevelStrip();
}

function renderLevelStrip() {
  levelStrip.innerHTML = "";
  const start = Math.max(0, currentLevel - 2);
  const end = start + 10;

  for (let index = start; index < end; index += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "level-dot";
    button.textContent = String(index + 1);
    button.setAttribute("aria-label", `${index + 1}번 스테이지`);
    button.disabled = index > maxUnlocked;
    if (index > maxUnlocked) button.title = "이전 스테이지를 해결하면 열립니다";
    if (index === currentLevel) button.classList.add("is-active");
    if (index > maxUnlocked) button.classList.add("is-locked");
    if (cleared.has(index)) button.classList.add("is-cleared");
    button.addEventListener("click", () => startLevel(index));
    levelStrip.append(button);
  }
}

function directionLabel(dir) {
  return { up: "위쪽", right: "오른쪽", down: "아래쪽", left: "왼쪽" }[dir];
}

function tryRemove(id) {
  const arrow = active.find((item) => item.id === id);
  if (!arrow) return;

  const button = board.querySelector(`[data-id="${id}"]`);
  if (!canEscape(arrow)) {
    bump(button);
    tone(150, 0.09, "triangle");
    return;
  }

  history.push({ active: cloneArrows(active), moves });
  moves += 1;
  button?.classList.add("is-leaving");
  tone(420 + moves * 14, 0.08, "sine");

  window.setTimeout(() => {
    active = active.filter((item) => item.id !== id);
    if (active.length === 0) {
      completeLevel();
    }
    render();
  }, 160);
}

function canEscape(arrow) {
  return pathIsClear(arrow, active, level.size);
}

function bump(button) {
  if (!button) return;
  button.classList.remove("is-blocked");
  void button.offsetWidth;
  button.classList.add("is-blocked");
}

function showHint() {
  board.querySelectorAll(".arrow").forEach((button) => button.classList.remove("is-hint"));
  const candidate = active.find((arrow) => canEscape(arrow));
  if (!candidate) return;

  const button = board.querySelector(`[data-id="${candidate.id}"]`);
  button?.classList.add("is-hint");
  tone(620, 0.07, "sine");
  window.setTimeout(() => button?.classList.remove("is-hint"), 1200);
}

function undo() {
  const previous = history.pop();
  if (!previous) return;
  active = cloneArrows(previous.active);
  moves = previous.moves;
  completePanel.hidden = true;
  tone(260, 0.08, "sine");
  render();
}

function completeLevel() {
  cleared.add(currentLevel);
  maxUnlocked = getContiguousUnlocked(cleared);
  saveProgress();
  completeText.textContent = `${moves}번의 이동으로 ${level.number}번 스테이지를 해결했습니다.`;
  completePanel.hidden = false;
  tone(720, 0.12, "sine");
  window.setTimeout(() => tone(920, 0.12, "sine"), 120);
}

function saveProgress() {
  const clearedLevels = [...cleared].sort((a, b) => a - b).slice(-MAX_STORED_CLEARS);
  localStorage.setItem("arrows-cleared", JSON.stringify(clearedLevels));
  localStorage.setItem("arrows-level", String(currentLevel));
  localStorage.removeItem("arrows-unlocked");
  syncCloudProgress();
}

function openResetDialog() {
  resetDialog.showModal();
}

function restartCurrentStage() {
  resetDialog.close();
  startLevel(currentLevel);
}

function resetAllProgress() {
  const confirmed = window.confirm("정말 전체 진행을 초기화할까요? 클리어 기록과 언락 상태가 모두 삭제됩니다.");
  if (!confirmed) return;
  resetDialog.close();
  cleared = new Set();
  maxUnlocked = 0;
  currentLevel = 0;
  localStorage.removeItem("arrows-cleared");
  localStorage.removeItem("arrows-level");
  localStorage.removeItem("arrows-unlocked");
  syncCloudProgress();
  startLevel(0);
}

function tone(frequency, duration, type) {
  if (!soundOn || !audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration + 0.02);
}

async function toggleSound() {
  soundOn = !soundOn;
  soundBtn.classList.toggle("is-on", soundOn);
  soundBtn.setAttribute("aria-label", soundOn ? "배경음 끄기" : "배경음 켜기");

  if (!soundOn) {
    bgm.pause();
    soundBtn.title = "사운드";
    return;
  }

  audioContext ||= new AudioContext();
  await audioContext.resume();

  try {
    bgm.muted = false;
    if (!bgm.src) {
      bgm.src = BGM_SOURCES[bgmSourceIndex];
    }
    await bgm.play();
    soundBtn.title = "사운드";
  } catch {
    soundBtn.title = "배경음 연결 실패";
    tryNextBgmSource();
  }

  tone(520, 0.08, "sine");
}

function tryNextBgmSource() {
  if (bgmRetrying) return;
  if (bgmSourceIndex >= BGM_SOURCES.length - 1) return;
  bgmRetrying = true;
  bgmSourceIndex += 1;
  bgm.src = BGM_SOURCES[bgmSourceIndex];
  bgm.load();
  bgm.play().catch(() => {
    soundBtn.title = "배경음 연결 실패";
  });
  window.setTimeout(() => {
    bgmRetrying = false;
  }, 500);
}

async function initAccount() {
  setAccountState("게스트", "로컬 저장으로 플레이 중입니다.");

  try {
    const configResponse = await fetch("/api/config", { cache: "no-store" });
    const config = await configResponse.json();

    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      setAccountState("게스트", "Supabase 환경값을 넣으면 로그인 저장이 켜집니다.");
      return;
    }

    const { createClient } = await import(SUPABASE_CDN);
    supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    cloudReady = true;

    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      await applyUser(data.session.user);
    } else {
      setAccountState("게스트", "로그인하면 진행도가 클라우드에 저장됩니다.");
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await applyUser(session.user);
      } else {
        activeUser = null;
        setAccountState("게스트", "로컬 저장으로 플레이 중입니다.");
      }
    });
  } catch {
    setAccountState("게스트", "로그인 서비스 연결 실패, 게스트로 플레이 중입니다.");
  }
}

function setAccountState(title, status) {
  accountTitle.textContent = title;
  accountStatus.textContent = status;
  logoutBtn.hidden = !activeUser;
}

async function applyUser(user) {
  activeUser = user;
  setAccountState(user.email || "로그인됨", "진행도가 Supabase에 저장됩니다.");
  await loadCloudProgress();
  await syncCloudProgress();
}

async function loadCloudProgress() {
  if (!supabase || !activeUser) return;

  const { data, error } = await supabase
    .from("arrow_progress")
    .select("cleared_levels,current_level")
    .eq("user_id", activeUser.id)
    .maybeSingle();

  if (error || !data) return;

  const cloudCleared = Array.isArray(data.cleared_levels) ? data.cleared_levels : [];
  const merged = new Set([...cleared, ...cloudCleared].filter((item) => Number.isInteger(item)));
  cleared = new Set([...merged].filter((item) => item >= 0 && item <= MAX_REASONABLE_LEVEL));
  maxUnlocked = getContiguousUnlocked(cleared);
  currentLevel = Math.min(Math.max(readStoredNumber("arrows-level"), data.current_level || 0), maxUnlocked);
  startLevel(currentLevel);
}

async function syncCloudProgress() {
  if (!cloudReady || !supabase || !activeUser) return;

  await supabase.from("arrow_progress").upsert({
    user_id: activeUser.id,
    cleared_levels: [...cleared].sort((a, b) => a - b).slice(-MAX_STORED_CLEARS),
    current_level: currentLevel,
    updated_at: new Date().toISOString()
  });
}

async function loginWithEmail(event) {
  event.preventDefault();
  if (!supabase) {
    setAccountState("게스트", ".env에 Supabase URL과 anon key를 넣어주세요.");
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    setAccountState("입력 필요", "이메일과 비밀번호를 입력하세요.");
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) setAccountState("로그인 실패", error.message);
}

async function signUpWithEmail() {
  if (!supabase) {
    setAccountState("게스트", ".env에 Supabase URL과 anon key를 넣어주세요.");
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    setAccountState("입력 필요", "이메일과 비밀번호를 입력하세요.");
    return;
  }

  const { error } = await supabase.auth.signUp({ email, password });
  setAccountState(error ? "가입 실패" : "가입 완료", error ? error.message : "메일 확인이 필요할 수 있습니다.");
}

async function logout() {
  if (supabase) await supabase.auth.signOut();
  activeUser = null;
  setAccountState("게스트", "로컬 저장으로 플레이 중입니다.");
}

hintBtn.addEventListener("click", showHint);
resetBtn.addEventListener("click", openResetDialog);
restartStageBtn.addEventListener("click", restartCurrentStage);
resetAllBtn.addEventListener("click", resetAllProgress);
undoBtn.addEventListener("click", undo);
nextBtn.addEventListener("click", () => startLevel(currentLevel + 1));
prevLevelBtn.addEventListener("click", () => startLevel(currentLevel - 1));
nextLevelBtn.addEventListener("click", () => startLevel(currentLevel + 1));
soundBtn.addEventListener("click", toggleSound);
authForm.addEventListener("submit", loginWithEmail);
signupBtn.addEventListener("click", signUpWithEmail);
guestBtn.addEventListener("click", logout);
logoutBtn.addEventListener("click", logout);

startLevel(currentLevel);
initAccount();
