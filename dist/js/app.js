import { QUESTION_BANK } from "./questions.js";
import { buildQuiz, calculatePoints, createRoomCode, percentage, QUESTION_SECONDS, TOTAL_QUESTIONS } from "./core.js";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const playerId = sessionStorage.getItem("anatomyPlayerId") || crypto.randomUUID();
sessionStorage.setItem("anatomyPlayerId", playerId);

const state = {
  screen: "cover",
  name: sessionStorage.getItem("anatomyPlayerName") || "",
  roomCode: "",
  isHost: false,
  mode: "solo",
  quiz: [],
  questionIndex: 0,
  score: 0,
  correct: 0,
  responseTimes: [],
  locked: false,
  questionStartedAt: 0,
  deadline: 0,
  timerId: null,
  nextId: null,
  channel: null
};

const roomKey = (code) => `anatomyRoom:${code}`;
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function shell(content, options = {}) {
  const { quiz = false, centered = false } = options;
  return `
    <div class="shell">
      <section class="card">
        <header class="topbar">
          <div class="brand"><span class="brand-mark" aria-hidden="true">VB</span><span>Virtual Book</span></div>
          <div class="topbar-meta">¿Cuánto sabes de anatomía?</div>
        </header>
        <div class="${quiz ? "quiz-content" : `content${centered ? " centered" : ""}`}">${content}</div>
      </section>
    </div>`;
}

function render() {
  clearTimers();
  if (state.screen === "cover") renderCover();
  if (state.screen === "setup") renderSetup();
  if (state.screen === "join") renderJoin();
  if (state.screen === "waiting") renderWaiting();
  if (state.screen === "quiz") renderQuestion();
  if (state.screen === "results") renderResults();
}

function renderCover() {
  app.innerHTML = `
    <div class="shell cover-shell">
      <section class="cover-card" aria-label="Portada del desafío de anatomía">
        <img class="cover-image" src="assets/portada-anatomia.png" alt="¿Cuánto sabes de anatomía? Desafío multijugador de Virtual Book." />
        <button class="hotspot hotspot-start" id="start-cover" aria-label="Comenzar desafío">Comenzar desafío</button>
        <button class="hotspot hotspot-teacher" id="teacher-cover" aria-label="Acceso docente">Acceso docente</button>
      </section>
    </div>`;
  document.querySelector("#start-cover").addEventListener("click", () => { state.screen = "setup"; render(); });
  document.querySelector("#teacher-cover").addEventListener("click", openTeacherAccess);
}

function renderSetup() {
  app.innerHTML = shell(`
    <div class="panel">
      <p class="pill">20 preguntas · 15 segundos cada una</p>
      <h1>Prepara tu desafío</h1>
      <p class="lead">Escribe tu nombre y elige cómo quieres jugar. Cada partida selecciona una pregunta distinta de cada grupo muscular.</p>
      <div class="field">
        <label for="player-name">Nombre del jugador</label>
        <input id="player-name" maxlength="28" autocomplete="name" placeholder="Ejemplo: Nicole" value="${escapeHtml(state.name)}" />
      </div>
      <div class="mode-grid">
        <button class="mode" id="solo"><strong>Jugar individual</strong><span>Comienza de inmediato y compite contra tu propio puntaje.</span></button>
        <button class="mode" id="create"><strong>Crear partida</strong><span>Genera un código y abre una sala de espera para otros jugadores.</span></button>
        <button class="mode" id="join"><strong>Ingresar con código</strong><span>Únete a una sala creada en este navegador.</span></button>
        <button class="mode" id="teacher"><strong>Acceso docente</strong><span>Revisa el banco completo de 40 preguntas.</span></button>
      </div>
      <div class="actions"><button class="button button-ghost" id="back">Volver a la portada</button></div>
    </div>
  `, { centered: true });

  const nameInput = document.querySelector("#player-name");
  const captureName = () => {
    const value = nameInput.value.trim();
    if (!value) { nameInput.focus(); notify("Escribe tu nombre para continuar"); return false; }
    state.name = value;
    sessionStorage.setItem("anatomyPlayerName", value);
    return true;
  };
  document.querySelector("#solo").addEventListener("click", () => { if (captureName()) startSoloGame(); });
  document.querySelector("#create").addEventListener("click", () => { if (captureName()) createRoom(); });
  document.querySelector("#join").addEventListener("click", () => { if (captureName()) { state.screen = "join"; render(); } });
  document.querySelector("#teacher").addEventListener("click", openTeacherAccess);
  document.querySelector("#back").addEventListener("click", resetToMenu);
}

function renderJoin() {
  app.innerHTML = shell(`
    <div class="panel">
      <p class="pill">Jugador: ${escapeHtml(state.name)}</p>
      <h1>Ingresar a una partida</h1>
      <p class="lead">Escribe el código de seis caracteres que aparece en la sala del anfitrión.</p>
      <div class="field">
        <label for="room-code">Código de partida</label>
        <input id="room-code" maxlength="6" inputmode="text" autocomplete="off" placeholder="ABC234" />
        <span class="field-hint">Para la versión sin servidor, ambas pestañas deben usar el mismo navegador y dominio.</span>
      </div>
      <div class="actions">
        <button class="button button-primary" id="join-room">Ingresar</button>
        <button class="button button-ghost" id="back">Volver</button>
      </div>
    </div>
  `, { centered: true });
  const input = document.querySelector("#room-code");
  input.addEventListener("input", () => { input.value = input.value.toUpperCase().replace(/[^A-Z2-9]/g, ""); });
  document.querySelector("#join-room").addEventListener("click", () => joinRoom(input.value));
  document.querySelector("#back").addEventListener("click", () => { state.screen = "setup"; render(); });
}

function createRoom() {
  let code = createRoomCode();
  while (localStorage.getItem(roomKey(code))) code = createRoomCode();
  state.roomCode = code;
  state.isHost = true;
  state.mode = "room";
  const room = {
    code,
    status: "waiting",
    quiz: buildQuiz(),
    createdAt: Date.now(),
    players: [{ id: playerId, name: state.name, score: 0, correct: 0, finished: false }]
  };
  saveRoom(room);
  connectRoom();
  state.screen = "waiting";
  render();
}

function joinRoom(rawCode) {
  const code = rawCode.trim().toUpperCase();
  if (code.length !== 6) { notify("Ingresa un código válido de seis caracteres"); return; }
  const room = getRoom(code);
  if (!room) { notify("No encontramos esa sala en este navegador"); return; }
  if (room.status !== "waiting") { notify("La partida ya comenzó"); return; }
  state.roomCode = code;
  state.isHost = false;
  state.mode = "room";
  const existing = room.players.find((player) => player.id === playerId);
  if (!existing) room.players.push({ id: playerId, name: state.name, score: 0, correct: 0, finished: false });
  saveRoom(room);
  connectRoom();
  state.screen = "waiting";
  render();
}

function connectRoom() {
  if (state.channel) state.channel.close();
  state.channel = new BroadcastChannel(`anatomy-room-${state.roomCode}`);
  state.channel.onmessage = ({ data }) => {
    if (data?.type !== "room-update") return;
    const room = getRoom(state.roomCode);
    if (!room) return;
    if (room.status === "playing" && state.screen === "waiting") beginRoomQuiz(room);
    else if (state.screen === "waiting" || state.screen === "results") render();
  };
}

function renderWaiting() {
  const room = getRoom(state.roomCode);
  if (!room) { notify("La sala ya no está disponible"); resetToMenu(); return; }
  app.innerHTML = shell(`
    <div class="panel">
      <p class="pill">Sala de espera</p>
      <h1>Comparte este código</h1>
      <button class="room-code" id="copy-code" title="Copiar código">${room.code}</button>
      <h2 style="margin-top:32px">Jugadores (${room.players.length})</h2>
      <ul class="players">${room.players.map((player, index) => `<li><span>${escapeHtml(player.name)}</span><strong>${index === 0 ? "Anfitrión" : "Listo"}</strong></li>`).join("")}</ul>
      <p class="muted">Todos recibirán la misma combinación de 20 preguntas y alternativas.</p>
      <div class="actions">
        ${state.isHost ? '<button class="button button-primary" id="start-room">Comenzar partida</button>' : '<button class="button button-secondary" disabled>Esperando al anfitrión…</button>'}
        <button class="button button-ghost" id="leave-room">Salir de la sala</button>
      </div>
    </div>
  `, { centered: true });
  document.querySelector("#copy-code").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(room.code); notify("Código copiado"); }
    catch { notify(`Código: ${room.code}`); }
  });
  document.querySelector("#leave-room").addEventListener("click", leaveRoom);
  document.querySelector("#start-room")?.addEventListener("click", () => {
    room.status = "playing";
    room.startedAt = Date.now();
    saveRoom(room);
    beginRoomQuiz(room);
  });
}

function startSoloGame() {
  state.mode = "solo";
  initializeGame(buildQuiz());
}

function beginRoomQuiz(room) { initializeGame(room.quiz); }

function initializeGame(quiz) {
  state.quiz = quiz;
  state.questionIndex = 0;
  state.score = 0;
  state.correct = 0;
  state.responseTimes = [];
  state.locked = false;
  state.screen = "quiz";
  render();
}

function renderQuestion() {
  const question = state.quiz[state.questionIndex];
  if (!question) { finishGame(); return; }
  state.locked = false;
  state.questionStartedAt = performance.now();
  state.deadline = state.questionStartedAt + QUESTION_SECONDS * 1000;
  app.innerHTML = shell(`
    <div class="quiz-header">
      <div><div class="counter">Pregunta ${state.questionIndex + 1} de ${TOTAL_QUESTIONS}</div><div class="muted">${escapeHtml(state.name)}</div></div>
      <div class="score"><span id="score-value">${state.score.toLocaleString("es-CL")}</span> puntos</div>
    </div>
    <div class="timer-wrap">
      <div class="timer-line"><span>Tiempo restante</span><span id="timer-value">${QUESTION_SECONDS.toFixed(1)} s</span></div>
      <div class="timer-track"><div class="timer-bar" id="timer-bar"></div></div>
    </div>
    <article class="question-card">
      <div class="question-meta"><span class="pill">${escapeHtml(question.group)}</span><span class="pill">${escapeHtml(question.difficulty)}</span></div>
      <h1 class="question-text">${escapeHtml(question.prompt)}</h1>
      <div class="answers">${question.options.map((option, index) => `<button class="answer" data-option="${index}">${String.fromCharCode(65 + index)}. ${escapeHtml(option)}</button>`).join("")}</div>
      <div class="feedback" id="feedback" aria-live="assertive"></div>
    </article>
  `, { quiz: true });
  document.querySelectorAll(".answer").forEach((button) => button.addEventListener("click", () => answerQuestion(question.options[Number(button.dataset.option)])));
  tickTimer();
}

function tickTimer() {
  const remainingMs = Math.max(0, state.deadline - performance.now());
  const remaining = remainingMs / 1000;
  const value = document.querySelector("#timer-value");
  const bar = document.querySelector("#timer-bar");
  if (!value || !bar || state.locked) return;
  value.textContent = `${remaining.toFixed(1)} s`;
  bar.style.width = `${(remaining / QUESTION_SECONDS) * 100}%`;
  bar.classList.toggle("warning", remaining <= 5);
  if (remainingMs <= 0) { handleTimeout(); return; }
  state.timerId = window.setTimeout(tickTimer, 100);
}

function answerQuestion(selected) {
  if (state.locked) return;
  const question = state.quiz[state.questionIndex];
  const elapsed = Math.min(QUESTION_SECONDS, (performance.now() - state.questionStartedAt) / 1000);
  const remaining = Math.max(0, QUESTION_SECONDS - elapsed);
  const isCorrect = selected === question.answer;
  const points = calculatePoints(isCorrect, remaining);
  state.locked = true;
  state.responseTimes.push(elapsed);
  if (isCorrect) { state.correct += 1; state.score += points; }
  showAnswerFeedback(question, selected, isCorrect, points);
  state.nextId = window.setTimeout(nextQuestion, 1250);
}

function handleTimeout() {
  if (state.locked) return;
  const question = state.quiz[state.questionIndex];
  state.locked = true;
  state.responseTimes.push(QUESTION_SECONDS);
  showAnswerFeedback(question, null, false, 0, true);
  state.nextId = window.setTimeout(nextQuestion, 1250);
}

function showAnswerFeedback(question, selected, isCorrect, points, timedOut = false) {
  clearTimeout(state.timerId);
  document.querySelectorAll(".answer").forEach((button) => {
    button.disabled = true;
    const text = button.textContent.slice(3);
    if (text === question.answer) button.classList.add("correct");
    else if (text === selected) button.classList.add("wrong");
  });
  const feedback = document.querySelector("#feedback");
  feedback.innerHTML = timedOut
    ? `<strong>Tiempo agotado.</strong> ${escapeHtml(question.explanation)}`
    : isCorrect
      ? `<strong>¡Correcto! +${points} puntos.</strong> ${escapeHtml(question.explanation)}`
      : `<strong>Respuesta incorrecta.</strong> La respuesta correcta es: ${escapeHtml(question.answer)}.`;
  document.querySelector("#score-value").textContent = state.score.toLocaleString("es-CL");
}

function nextQuestion() {
  state.questionIndex += 1;
  if (state.questionIndex >= state.quiz.length) finishGame();
  else render();
}

function finishGame() {
  clearTimers();
  if (state.mode === "room") {
    const room = getRoom(state.roomCode);
    const player = room?.players.find((item) => item.id === playerId);
    if (player) {
      player.score = state.score;
      player.correct = state.correct;
      player.finished = true;
      saveRoom(room);
    }
  }
  state.screen = "results";
  render();
}

function renderResults() {
  const average = state.responseTimes.length ? state.responseTimes.reduce((sum, value) => sum + value, 0) / state.responseTimes.length : 0;
  const room = state.mode === "room" ? getRoom(state.roomCode) : null;
  const ranking = room ? [...room.players].sort((a, b) => b.score - a.score) : [];
  app.innerHTML = shell(`
    <div class="result-hero">
      <p class="pill">Partida finalizada</p>
      <h1>Resultado de ${escapeHtml(state.name)}</h1>
      <div class="result-score">${state.score.toLocaleString("es-CL")}</div>
      <div class="result-max">de 20.000 puntos</div>
    </div>
    <div class="stats">
      <div class="stat"><strong>${state.correct} de 20</strong><span>Respuestas correctas</span></div>
      <div class="stat"><strong>${percentage(state.correct)}%</strong><span>Precisión</span></div>
      <div class="stat"><strong>${average.toFixed(1)} s</strong><span>Tiempo promedio</span></div>
    </div>
    ${room ? `
      <h2>Clasificación de la sala</h2>
      <table class="ranking"><thead><tr><th>Posición</th><th>Jugador</th><th>Correctas</th><th>Puntaje</th></tr></thead><tbody>
        ${ranking.map((player, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(player.name)}${player.id === playerId ? " (tú)" : ""}</td><td>${player.finished ? `${player.correct}/20` : "Jugando"}</td><td>${player.score.toLocaleString("es-CL")}</td></tr>`).join("")}
      </tbody></table>` : ""}
    <div class="actions">
      <button class="button button-primary" id="play-again">Jugar nuevamente</button>
      <button class="button button-ghost" id="finish-menu">Finalizar y volver al menú</button>
    </div>
  `);
  document.querySelector("#play-again").addEventListener("click", () => {
    if (state.mode === "room" && state.isHost) {
      const currentRoom = getRoom(state.roomCode);
      currentRoom.quiz = buildQuiz();
      currentRoom.status = "waiting";
      currentRoom.players.forEach((player) => Object.assign(player, { score: 0, correct: 0, finished: false }));
      saveRoom(currentRoom);
      state.screen = "waiting";
      render();
    } else if (state.mode === "room") {
      state.screen = "waiting";
      render();
    } else startSoloGame();
  });
  document.querySelector("#finish-menu").addEventListener("click", resetToMenu);
}

function getRoom(code) {
  try { return JSON.parse(localStorage.getItem(roomKey(code))); }
  catch { return null; }
}

function saveRoom(room) {
  localStorage.setItem(roomKey(room.code), JSON.stringify(room));
  state.channel?.postMessage({ type: "room-update", code: room.code, timestamp: Date.now() });
}

function leaveRoom() {
  const room = getRoom(state.roomCode);
  if (room) {
    room.players = room.players.filter((player) => player.id !== playerId);
    if (room.players.length) saveRoom(room);
    else localStorage.removeItem(roomKey(state.roomCode));
  }
  resetToMenu();
}

function clearTimers() {
  clearTimeout(state.timerId);
  clearTimeout(state.nextId);
  state.timerId = null;
  state.nextId = null;
}

function resetToMenu() {
  clearTimers();
  state.channel?.close();
  Object.assign(state, { screen: "cover", roomCode: "", isHost: false, mode: "solo", quiz: [], questionIndex: 0, score: 0, correct: 0, responseTimes: [], locked: false, channel: null });
  render();
}

function openTeacherAccess() {
  const overlay = document.createElement("div");
  overlay.className = "modal-backdrop";
  overlay.innerHTML = `
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="teacher-title">
      <div id="teacher-login">
        <p class="pill">Acceso docente</p>
        <h2 id="teacher-title">Banco de preguntas</h2>
        <p class="lead">Ingresa la clave local para revisar las 40 preguntas. Esta protección es solo para la versión demostrativa.</p>
        <div class="field"><label for="teacher-pin">Clave</label><input id="teacher-pin" type="password" inputmode="numeric" maxlength="4" placeholder="••••" /></div>
        <div class="actions"><button class="button button-primary" id="teacher-enter">Ingresar</button><button class="button button-ghost" id="teacher-close">Cerrar</button></div>
        <p class="field-hint">Clave inicial: 2026. Puedes cambiarla en js/app.js antes de publicar.</p>
      </div>
    </section>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector("#teacher-close").addEventListener("click", close);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  overlay.querySelector("#teacher-enter").addEventListener("click", () => {
    if (overlay.querySelector("#teacher-pin").value !== "2026") { notify("Clave incorrecta"); return; }
    overlay.querySelector(".modal").innerHTML = `
      <p class="pill">40 preguntas · 20 grupos</p>
      <h2 id="teacher-title">Banco completo</h2>
      <p class="lead">Cada partida toma aleatoriamente una de las dos preguntas disponibles por grupo muscular.</p>
      <div class="bank-list">${QUESTION_BANK.map((question, index) => `<article class="bank-item"><strong>${index + 1}. ${escapeHtml(question.group)} · ${escapeHtml(question.difficulty)}</strong><p>${escapeHtml(question.prompt)}</p></article>`).join("")}</div>
      <div class="actions"><button class="button button-primary" id="export-bank">Exportar preguntas</button><button class="button button-ghost" id="teacher-close-2">Cerrar</button></div>`;
    overlay.querySelector("#teacher-close-2").addEventListener("click", close);
    overlay.querySelector("#export-bank").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(QUESTION_BANK, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "banco-preguntas-anatomia.json";
      link.click();
      URL.revokeObjectURL(link.href);
    });
  });
  overlay.querySelector("#teacher-pin").focus();
}

window.addEventListener("storage", (event) => {
  if (event.key === roomKey(state.roomCode) && (state.screen === "waiting" || state.screen === "results")) render();
});

render();
