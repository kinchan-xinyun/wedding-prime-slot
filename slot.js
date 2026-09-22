(() => {
  "use strict";

  const GUEST_COUNT = 63;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Prime generation ----------

  function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) {
      if (n % i === 0) return false;
    }
    return true;
  }

  function generatePrimes(count) {
    const primes = [];
    let n = 2;
    while (primes.length < count) {
      if (isPrime(n)) primes.push(n);
      n++;
    }
    return primes;
  }

  const ALL_PRIMES = generatePrimes(GUEST_COUNT);
  let pool = [...ALL_PRIMES];
  let isDrawing = false;

  // ---------- DOM refs ----------

  const frame = document.getElementById("frame");
  const slotsEl = document.getElementById("slots");
  const probabilityEl = document.getElementById("probability");
  const counterEl = document.getElementById("counter");
  const hintEl = document.getElementById("hint");
  const drawBtn = document.getElementById("drawBtn");
  const drawBtnLabel = document.getElementById("drawBtnLabel");
  const resetBtn = document.getElementById("resetBtn");
  const historyGrid = document.getElementById("historyGrid");
  const historyEmpty = document.getElementById("historyEmpty");

  // ---------- Sound (tiny synthesized tones, no assets needed) ----------

  let audioCtx = null;
  function ensureAudio() {
    if (audioCtx) return audioCtx;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      audioCtx = null;
    }
    return audioCtx;
  }

  function tone(freq, duration, type, gainValue) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainValue;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  }

  function tickSound() {
    tone(520, 0.04, "sine", 0.035);
  }
  function lockSound() {
    tone(180, 0.14, "sine", 0.12);
  }
  function chimeSound() {
    [660, 880, 990].forEach((f, i) => {
      setTimeout(() => tone(f, 0.28, "triangle", 0.07), i * 90);
    });
  }

  // ---------- Helpers ----------

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function updateCounter() {
    if (!counterEl) return;
    counterEl.textContent = `残り ${pool.length} / ${ALL_PRIMES.length}`;
  }

  function pickRandom() {
    const idx = Math.floor(Math.random() * pool.length);
    const value = pool[idx];
    pool.splice(idx, 1);
    return value;
  }

  function showProbability(prefix, digitIndex) {
    const matchingCount = ALL_PRIMES.filter((prime) => (
      String(prime).padStart(3, "0").startsWith(prefix)
    )).length;
    const percentage = (matchingCount / ALL_PRIMES.length) * 100;
    const labels = ["百の位", "百・十の位", "番号"];
    probabilityEl.textContent = `${labels[digitIndex]}が${prefix}の当選確率：${percentage.toFixed(2)}%`;
    probabilityEl.hidden = false;
  }

  function buildSlots(digitCount) {
    slotsEl.innerHTML = "";
    slotsEl.classList.remove("reveal-final");
    const slots = [];
    for (let i = 0; i < digitCount; i++) {
      const el = document.createElement("div");
      el.className = "slot";
      el.textContent = "0";
      slotsEl.appendChild(el);
      slots.push(el);
    }
    return slots;
  }

  function addHistoryChip(value) {
    if (historyEmpty) historyEmpty.remove();
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = value;
    historyGrid.insertBefore(chip, historyGrid.firstChild);
  }

  // ---------- Core reveal sequence ----------

  async function spinSlot(el, ms) {
    if (reduceMotion) {
      await wait(Math.min(ms, 150));
      return;
    }
    el.classList.add("spinning");
    const stepMs = 55;
    let elapsed = 0;
    while (elapsed < ms) {
      el.textContent = String(Math.floor(Math.random() * 10));
      tickSound();
      await wait(stepMs);
      elapsed += stepMs;
    }
    el.classList.remove("spinning");
  }

  async function revealNumber(value) {
    const digits = String(value).padStart(3, "0").split("");
    const slots = buildSlots(3);

    frame.classList.add("tension");

    frame.style.setProperty("--tension-speed", "900ms");

    // Keep later digits turning after the preceding digit has stopped.
    await Promise.all(slots.map(async (slot, index) => {
      const spinDuration = reduceMotion ? 120 : [3000, 8000, 13000][index];
      await spinSlot(slot, spinDuration);
      slot.textContent = digits[index];
      slot.classList.add("locked");
      lockSound();
      showProbability(digits.slice(0, index + 1).join(""), index);
    }));

    frame.classList.remove("tension");
    frame.style.removeProperty("--tension-speed");

    slotsEl.classList.add("reveal-final");
    chimeSound();

    await wait(reduceMotion ? 100 : 500);
  }

  // ---------- Draw flow ----------

  async function handleDraw() {
    if (isDrawing || pool.length === 0) return;
    isDrawing = true;
    drawBtn.disabled = true;
    resetBtn.disabled = true;
    drawBtnLabel.textContent = "抽選中…";
    probabilityEl.textContent = "";
    probabilityEl.hidden = true;
    hintEl.textContent = "抽選中......";

    const value = pickRandom();
    await revealNumber(value);
    addHistoryChip(value);
    updateCounter();

    if (pool.length === 0) {
      hintEl.textContent = "63名全員の番号が出そろいました";
      drawBtn.disabled = true;
      drawBtnLabel.textContent = "抽選終了";
    } else {
      hintEl.textContent = "次のゲストの番号を引きましょう";
      drawBtn.disabled = false;
      drawBtnLabel.textContent = "もう一度抽選";
    }

    resetBtn.disabled = false;
    isDrawing = false;
  }

  function handleReset() {
    if (isDrawing) return;
    const confirmed = window.confirm("すべての記録をリセットして、はじめからやり直しますか？");
    if (!confirmed) return;

    pool = [...ALL_PRIMES];
    updateCounter();

    slotsEl.innerHTML = '<div class="slot slot-idle">—</div>';
    slotsEl.classList.remove("reveal-final");
    probabilityEl.textContent = "";
    probabilityEl.hidden = true;

    historyGrid.innerHTML = "";
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "history-empty";
    emptyMsg.id = "historyEmpty";
    emptyMsg.textContent = "まだ番号は出ていません";
    historyGrid.appendChild(emptyMsg);

    drawBtn.disabled = false;
    drawBtnLabel.textContent = "抽選する";
    hintEl.textContent = "ボタンを押して、最初の番号を引いてください";
  }

  // ---------- Init ----------

  updateCounter();
  drawBtn.addEventListener("click", handleDraw);
  resetBtn.addEventListener("click", handleReset);
})();