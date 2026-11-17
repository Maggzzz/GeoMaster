let countries = [];
let score = 0;
let questionCount = 0;
let currentQuestion = null;
let answered = false;
let reviewMode = false;
let selectedExplorerCode = null;
let quizActive = false;

const storageKey = "geomaster-data";
const defaultStats = { bestScore: 0, totalCorrect: 0, totalAnswered: 0, mistakes: [] };
let stats;
try {
  stats = { ...defaultStats, ...JSON.parse(localStorage.getItem(storageKey) || "{}") };
  if (!Array.isArray(stats.mistakes)) stats.mistakes = [];
} catch {
  stats = { ...defaultStats };
}

const elements = {
  score: document.getElementById("score"), bestScore: document.getElementById("bestScore"),
  totalCorrect: document.getElementById("totalCorrect"), accuracy: document.getElementById("accuracy"),
  quizSetup: document.getElementById("quizSetup"), quizPlaying: document.getElementById("quizPlaying"),
  quizSetupTitle: document.getElementById("quizSetupTitle"),
  quizPoolInfo: document.getElementById("quizPoolInfo"),
  quizCurrentScore: document.getElementById("quizCurrentScore"),
  startQuizButton: document.getElementById("startQuizButton"),
  quizSettingsButton: document.getElementById("quizSettingsButton"),
  questionNumber: document.getElementById("questionNumber"), questionText: document.getElementById("questionText"),
  questionVisual: document.getElementById("questionVisual"), answers: document.getElementById("answers"),
  feedback: document.getElementById("feedback"), nextButton: document.getElementById("nextButton"),
  mode: document.getElementById("mode"), difficulty: document.getElementById("difficulty"),
  quizTitle: document.getElementById("quizTitle"), reviewButton: document.getElementById("reviewButton"),
  regionFilter: document.getElementById("regionFilter"), countrySearch: document.getElementById("countrySearch"),
  explorerRegion: document.getElementById("explorerRegion"), countryGrid: document.getElementById("countryGrid"),
  countryDetails: document.getElementById("countryDetails"), countryCount: document.getElementById("countryCount"),
  mapMode: document.getElementById("mapMode"), mapQuizPrompt: document.getElementById("mapQuizPrompt"),
  mapNextButton: document.getElementById("mapNextButton"), mapFeedback: document.getElementById("mapFeedback"),
  mapSelected: document.getElementById("mapSelected"),
  mapRegionFilter: document.getElementById("mapRegionFilter")
};

const easyCodes = new Set(["NO","SE","DK","FI","IS","US","CA","BR","GB","FR","DE","IT","ES","JP","CN","AU","IN","RU","EG","MX","NL","CH","GR","PT","IE","PL","TR","KR","AR","NZ"]);
const regionNames = { Africa: "Afrika", Americas: "Amerika", Asia: "Asia", Europe: "Europa", Oceania: "Oseania", Polar: "Polare områder", Antarctic: "Antarktis", "Antarctic Ocean": "Antarktishavet" };

async function loadCountries() {
  const response = await fetch("./data/countries.json");
  if (!response.ok) throw new Error("Kunne ikke laste landdatabasen.");
  countries = await response.json();
  if (!Array.isArray(countries) || countries.length < 4) throw new Error("Landdatabasen ser ikke ut til å være gyldig.");
  populateRegionFilters();
  updateStats();
  updateQuizSetup();
  renderExplorer();
  hlUpdatePool();
  await initializeWorldMap();
}

function saveStats() {
  try { localStorage.setItem(storageKey, JSON.stringify(stats)); }
  catch (error) { console.warn("Kunne ikke lagre statistikken lokalt:", error); }
}

function updateStats() {
  elements.score.textContent = score;
  elements.bestScore.textContent = stats.bestScore;
  elements.totalCorrect.textContent = stats.totalCorrect;
  const accuracy = stats.totalAnswered ? Math.round(stats.totalCorrect / stats.totalAnswered * 100) : 0;
  elements.accuracy.textContent = `${accuracy}%`;
  // Oppdater fremgangen på startsiden
  const homeBest = document.getElementById("homeBestScore");
  const homeCorrect = document.getElementById("homeTotalCorrect");
  const homeAccuracy = document.getElementById("homeAccuracy");

  if (homeBest) homeBest.textContent = stats.bestScore;
  if (homeCorrect) homeCorrect.textContent = stats.totalCorrect;
  if (homeAccuracy) homeAccuracy.textContent = `${accuracy}%`;
  elements.reviewButton.textContent = `Start repetisjon (${stats.mistakes.length})`;
  if (typeof renderHigherLowerRecords === "function") renderHigherLowerRecords();
}

const categoryNames = {
  all: "Alle land og steder",
  africa: "Afrika",
  asia: "Asia",
  europe: "Europa",
  "north-america": "Nord-Amerika",
  "south-america": "Sør-Amerika",
  oceania: "Oseania",
  other: "Annet (territorier og områder)"
};
const categoryOrder = ["africa", "asia", "europe", "north-america", "south-america", "oceania", "other"];

function countryMatchesCategory(country, category) {
  return category === "all" || country.category === category;
}

function populateRegionFilters() {
  [elements.regionFilter, elements.explorerRegion, elements.mapRegionFilter].forEach(select => {
    if (!select) return;
    select.replaceChildren(new Option(categoryNames.all, "all"));
    categoryOrder.forEach(category => {
      select.add(new Option(categoryNames[category], category));
    });
  });
}

function getCountryPool() {
  const difficulty = elements.difficulty.value;
  const mode = elements.mode.value;
  const region = elements.regionFilter.value;
  let pool = countries.filter(country => country.flag && country.name);
  if (mode === "capital") {
    pool = pool.filter(country => country.capital && country.capital !== "Ukjent");
  }
  pool = pool.filter(country => countryMatchesCategory(country, region));

  // Difficulty is relative to the selected region so small regions and
  // territories always have enough distinct answers to play.
  if (difficulty === "easy") {
    const ranked = [...pool].sort((a, b) =>
      Number(easyCodes.has(b.code)) - Number(easyCodes.has(a.code)) ||
      (Number(b.population) || 0) - (Number(a.population) || 0));
    pool = ranked.slice(0, Math.max(4, Math.ceil(pool.length * 0.45)));
  } else if (difficulty === "hard") {
    // Keep a broader answer pool; harder questions are selected in newQuestion.
    pool = [...pool];
  }
  return pool;
}

function updateQuizSetup() {
  const isCapital = elements.mode.value === "capital";
  elements.quizSetupTitle.textContent = isCapital ? "🏛️ Hovedstadquiz" : "🚩 Flaggquiz";
  const pool = getCountryPool();
  elements.quizPoolInfo.textContent = `${pool.length} mulige ${pool.length === 1 ? "land/steder" : "land og steder"} i dette utvalget`;
  elements.startQuizButton.disabled = pool.length < 4;
}

function showQuizSetup() {
  quizActive = false;
  reviewMode = false;
  elements.quizSetup.hidden = false;
  elements.quizPlaying.hidden = true;
  updateQuizSetup();
}

function beginQuiz() {
  if (getCountryPool().length < 4) return;
  quizActive = true;
  score = 0;
  questionCount = 0;
  reviewMode = false;
  elements.quizSetup.hidden = true;
  elements.quizPlaying.hidden = false;
  updateStats();
  newQuestion();
}

function randomItem(array) { return array[Math.floor(Math.random() * array.length)]; }

function newQuestion() {
  answered = false;
  const answerPool = getCountryPool();
  let questionPool = answerPool;
  if (reviewMode) questionPool = answerPool.filter(country => stats.mistakes.includes(country.code));

  if (reviewMode && questionPool.length === 0) {
    finishReview();
    return;
  }

  if (answerPool.length < 4) {
    reviewMode = false;
    elements.feedback.textContent = "Det er for få land i dette utvalget. Velg en annen verdensdel eller vanskelighetsgrad.";
    elements.feedback.className = "feedback wrong";
    elements.answers.innerHTML = "";
    elements.questionVisual.textContent = "🌍";
    elements.questionText.textContent = "For få land i utvalget";
    elements.nextButton.disabled = true;
    return;
  }

  if (elements.difficulty.value === "hard" && !reviewMode) {
    // Hard: prioritize lesser-known entries while retaining some variety.
    const sorted = [...questionPool].sort((a, b) =>
      (Number(a.population) || 0) - (Number(b.population) || 0));
    questionPool = sorted.slice(0, Math.max(4, Math.ceil(sorted.length * 0.65)));
  }
  currentQuestion = randomItem(questionPool);
  questionCount++;
  const mode = elements.mode.value;
  elements.quizTitle.textContent = mode === "flag" ? "Flaggquiz" : "Hovedstadquiz";
  elements.questionNumber.textContent = `SPØRSMÅL ${questionCount}`;
  elements.quizCurrentScore.textContent = `${score} poeng`;
  elements.questionText.textContent = mode === "flag" ? "Hvilket land tilhører dette flagget?" : `Hva er hovedstaden i ${currentQuestion.name}?`;
  if (mode === "flag") {
    elements.questionVisual.replaceChildren(createFlagImage(currentQuestion, "quiz-flag-image"));
    elements.questionVisual.setAttribute("aria-label", "Flagg – velg riktig land");
    elements.questionVisual.classList.remove("capital-visual");
  } else {
    elements.questionVisual.textContent = currentQuestion.name;
    elements.questionVisual.setAttribute("aria-label", `Land: ${currentQuestion.name}`);
    elements.questionVisual.classList.add("capital-visual");
  }
  elements.answers.innerHTML = "";
  elements.feedback.textContent = "Velg riktig svar!";
  elements.feedback.className = "feedback";
  elements.nextButton.disabled = true;

  // Capital names must be unique; otherwise multiple answer buttons could
  // be correct for a single question.
  const seen = new Set([mode === "capital" ? currentQuestion.capital : currentQuestion.name]);
  let alternatives = shuffle(answerPool.filter(country => country.code !== currentQuestion.code))
    .filter(country => {
      const label = mode === "capital" ? country.capital : country.name;
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });
  if (elements.difficulty.value === "hard") {
    // For hard mode, favor distractors from nearby population ranks.
    alternatives.sort((a, b) =>
      Math.abs(Math.log1p(Number(a.population) || 0) - Math.log1p(Number(currentQuestion.population) || 0)) -
      Math.abs(Math.log1p(Number(b.population) || 0) - Math.log1p(Number(currentQuestion.population) || 0)));
  }
  const choices = [currentQuestion, ...alternatives.slice(0, 3)];
  shuffle(choices).forEach(country => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-button";
    button.textContent = mode === "flag" ? country.name : country.capital;
    button.addEventListener("click", () => checkAnswer(country, button));
    elements.answers.appendChild(button);
  });
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function checkAnswer(selected, selectedButton) {
  if (answered) return;
  answered = true;
  const correct = selected.code === currentQuestion.code;
  const buttons = [...elements.answers.querySelectorAll("button")];
  buttons.forEach(button => { button.disabled = true; });
  stats.totalAnswered++;

  if (correct) {
    score++;
    stats.totalCorrect++;
    stats.mistakes = stats.mistakes.filter(code => code !== currentQuestion.code);
    selectedButton.classList.add("correct");
    elements.feedback.textContent = "Riktig! Bra jobbet! 🎉";
    elements.feedback.className = "feedback correct";
  } else {
    if (!stats.mistakes.includes(currentQuestion.code)) stats.mistakes.push(currentQuestion.code);
    selectedButton.classList.add("wrong");
    const correctAnswer = elements.mode.value === "flag" ? currentQuestion.name : currentQuestion.capital;
    buttons.forEach(button => { if (button.textContent === correctAnswer) button.classList.add("correct"); });
    elements.feedback.textContent = `Feil! Riktig svar var ${correctAnswer}.`;
    elements.feedback.className = "feedback wrong";
  }
  stats.bestScore = Math.max(stats.bestScore, score);
  saveStats();
  updateStats();
  elements.quizCurrentScore.textContent = `${score} poeng`;
  elements.nextButton.disabled = false;
}

function finishReview() {
  reviewMode = false;
  elements.feedback.textContent = "Flott jobbet! Du har repetert alle feilene. 🏆";
  elements.feedback.className = "feedback correct";
  elements.nextButton.disabled = true;
  elements.answers.innerHTML = "";
  elements.questionVisual.textContent = "🏆";
  elements.questionText.textContent = "Repetisjonen er fullført!";
  updateStats();
}

function startReview() {
  if (stats.mistakes.length === 0) {
    elements.feedback.textContent = "Du har ingen feil svar å repetere ennå!";
    elements.feedback.className = "feedback correct";
    return;
  }
  reviewMode = true;
  quizActive = true;
  elements.quizSetup.hidden = true;
  elements.quizPlaying.hidden = false;
  score = 0;
  questionCount = 0;
  updateStats();
  newQuestion();
}

function restartQuiz() {
  score = 0;
  questionCount = 0;
  reviewMode = false;
  updateStats();
  newQuestion();
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? new Intl.NumberFormat("no-NO").format(number) : "Ikke oppgitt";
}

function createFlagImage(country, className) {
    const img = document.createElement("img");

    img.className = className;
    img.alt = `Flagget til ${country.name}`;
    img.loading = "lazy";
    img.src = `https://flagcdn.com/${country.code.toLowerCase()}.svg`;

    // Reservevisning dersom flaggbildet ikke finnes.
    img.onerror = () => {
        const fallback = document.createElement("span");
        fallback.className = className;
        fallback.textContent = country.flag || "🌐";
        img.replaceWith(fallback);
    };

    return img;
}

function renderExplorer() {
  const query = elements.countrySearch.value.trim().toLocaleLowerCase("no");
  const region = elements.explorerRegion.value;
  const filtered = countries.filter(country => {
    const searchable = [country.name, country.capital, country.currency, ...(country.languages || [])].filter(Boolean).join(" ").toLocaleLowerCase("no");
    return countryMatchesCategory(country, region) && (!query || searchable.includes(query));
  }).sort((a,b) => a.name.localeCompare(b.name, "no"));

  elements.countryCount.textContent = `${filtered.length} av ${countries.length} oppføringer`;
  elements.countryGrid.innerHTML = "";
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "no-results";
    empty.textContent = "Fant ingen land som passer søket.";
    elements.countryGrid.appendChild(empty);
    return;
  }

  filtered.forEach(country => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `country-card${selectedExplorerCode === country.code ? " active" : ""}`;
    const flag = createFlagImage(country, "country-flag");
    const text = document.createElement("span");
    const name = document.createElement("span"); name.className = "country-name"; name.textContent = country.name;
    const regionLabel = document.createElement("span"); regionLabel.className = "country-region"; regionLabel.textContent = country.category === "other" ? "Annet · " + (regionNames[country.region] || country.region) : categoryNames[country.category] || "Region ikke oppgitt";
    text.append(name, regionLabel); button.append(flag, text);
    button.addEventListener("click", () => {
      selectedExplorerCode = country.code;
      renderExplorer();
      renderCountryDetails(country);

      // Åpne egen detaljvisning på mobil
      showExplorerDetailsOnMobile();
    });
    elements.countryGrid.appendChild(button);
  });

  if (selectedExplorerCode && !filtered.some(c => c.code === selectedExplorerCode)) {
    selectedExplorerCode = null;
    showEmptyDetails();
  }
}

function showEmptyDetails() {
  elements.countryDetails.className = "country-details empty-details";
  elements.countryDetails.innerHTML = '<div class="details-placeholder"><span>🌐</span><strong>Velg et land</strong><span>Trykk på et land for å se mer informasjon.</span></div>';
}

// Mobil: vis enten landlisten eller landdetaljene
function showExplorerDetailsOnMobile() {
    if (window.innerWidth > 700) return;

    document.getElementById("explorerView")
        .classList.add("show-country-details");

    document.getElementById("explorerBackButton").hidden = false;
}

function showExplorerListOnMobile() {
    document.getElementById("explorerView")
        .classList.remove("show-country-details");

    document.getElementById("explorerBackButton").hidden = true;
}

const explorerBackButton = document.getElementById("explorerBackButton");

if (explorerBackButton) {
    explorerBackButton.addEventListener(
        "click",
        showExplorerListOnMobile
    );
}

function renderCountryDetails(country) {
  elements.countryDetails.className = "country-details";
  elements.countryDetails.innerHTML = "";
  const top = document.createElement("div"); top.className = "detail-top";
  const flag = createFlagImage(country, "detail-flag-image");
  const title = document.createElement("h3"); title.textContent = country.name;
  const region = document.createElement("p"); region.textContent = `${categoryNames[country.category] || "Region ikke oppgitt"}${country.subregion ? ` · ${country.subregion}` : ""}`;
  top.append(flag, title, region);
  const rows = [
    ["Hovedstad", country.capital && country.capital !== "Ukjent" ? country.capital : "Ikke oppgitt"],
    ["Befolkning", formatNumber(country.population)],
    ["Areal", country.area ? `${formatNumber(country.area)} km²` : "Ikke oppgitt"],
    ["Valuta", country.currency || "Ikke oppgitt"],
    ["Språk", Array.isArray(country.languages) && country.languages.length ? country.languages.join(", ") : "Ikke oppgitt"],
    ["Naboland", Array.isArray(country.borders) && country.borders.length ? country.borders.length : "Ingen registrert"],
    ["Høyeste punkt", country.highestPoint && Number.isFinite(country.highestPoint.meters)
      ? `${country.highestPoint.name} · ${formatNumber(country.highestPoint.meters)} moh.` : "Ikke registrert"]
  ];
  const list = document.createElement("div"); list.className = "detail-list";
  rows.forEach(([label, value]) => {
    const row = document.createElement("div"); row.className = "detail-row";
    const key = document.createElement("span"); key.textContent = label;
    const val = document.createElement("strong"); val.textContent = value;
    row.append(key, val); list.appendChild(row);
  });
  elements.countryDetails.append(top, list);
  const note = document.createElement("p"); note.className = "detail-note"; note.textContent = "Befolknings- og arealtall er hentet fra den lokale landdatabasen og kan være omtrentlige.";
  elements.countryDetails.appendChild(note);
}

// Interaktivt verdenskart med Leaflet og GeoJSON fra Natural Earth.
let worldMap = null;
let countryGeoLayer = null;
let mapFeaturesByCode = new Map();
let mapQuizTarget = null;
let mapQuizAnswered = false;
let mapQuizWrongCode = null;
let selectedMapCode = null;

// Fase 4: separat utfordringsstatistikk; eksisterende quizstatistikk endres ikke.
const mapChallengeStorageKey = "geomaster-continent-records-v1";
let mapChallengeRecords = {};
try { mapChallengeRecords = JSON.parse(localStorage.getItem(mapChallengeStorageKey) || "{}"); }
catch { mapChallengeRecords = {}; }
let mapGameType = "single"; // single | challenge
let mapGameScreen = "setup"; // setup | playing | result | explore
let mapChallengeQueue = [];
let mapChallengeCompleted = new Set();
let mapChallengeCurrent = null;
let mapChallengeErrors = 0;
let mapChallengeStartTime = 0;
let mapChallengeElapsed = 0;
let mapChallengeTimer = null;
let mapChallengeCategory = "all";
const mapGameSetup = document.getElementById("mapGameSetup");
const mapGameRegion = document.getElementById("mapGameRegion");
const mapGamePoolInfo = document.getElementById("mapGamePoolInfo");
const mapChallengeHud = document.getElementById("mapChallengeHud");
const mapChallengeResult = document.getElementById("mapChallengeResult");

function getMapGameCandidates(category) {
  return countries.filter(c => c.name && mapFeaturesByCode.has(c.code) && countryMatchesCategory(c, category));
}
function formatChallengeTime(seconds) {
  const sec = Math.floor(seconds);
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}
function shuffleMapCountries(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function clearMapChallengeTimer() {
  if (mapChallengeTimer !== null) { clearInterval(mapChallengeTimer); mapChallengeTimer = null; }
}
function updateMapChallengeHud() {
  document.getElementById("mapChallengeProgress").textContent = `${mapChallengeCompleted.size} / ${mapChallengeQueue.length} land`;
  document.getElementById("mapChallengeTime").textContent = formatChallengeTime(mapChallengeElapsed);
  document.getElementById("mapChallengeMistakes").textContent = `Feil: ${mapChallengeErrors}`;
}
function zoomMapToCategory(category) {
  if (!worldMap || !countryGeoLayer) return;
  const pool = getMapGameCandidates(category);
  const bounds = L.latLngBounds([]);
  for (const c of pool) {
    const layer = mapFeaturesByCode.get(c.code);
    if (layer && typeof layer.getBounds === "function") bounds.extend(layer.getBounds());
  }
  if (bounds.isValid()) worldMap.fitBounds(bounds, { padding: [26, 26], maxZoom: 5, animate: false });
  else worldMap.setView([20, 0], 2);
}
function updateMapGamePoolInfo() {
  const count = getMapGameCandidates(mapGameRegion.value).length;
  mapGamePoolInfo.textContent = `${count} kartlagte land/steder i denne kategorien. Områder uten kartgrenser kan ikke spilles.`;
  document.getElementById("startSingleMapGame").disabled = count === 0;
  document.getElementById("startChallengeMapGame").disabled = count === 0;
}
function updateMapGameScreen() {
  const quiz = mapOpenedAsQuiz && elements.mapMode.value === "quiz";
  mapGameSetup.hidden = !(quiz && mapGameScreen === "setup");
  mapChallengeHud.hidden = !(quiz && mapGameType === "challenge" && mapGameScreen === "playing");
  mapChallengeResult.hidden = !(quiz && mapGameScreen === "result");
  const playing = quiz && mapGameScreen === "playing";
  const toolbar = document.querySelector("#mapView .map-toolbar");
  if (toolbar) toolbar.hidden = !playing;
  const feedback = elements.mapFeedback;
  if (feedback) feedback.hidden = !playing;
  if (!playing) elements.mapNextButton.hidden = true;
  if (playing && mapGameType === "challenge") elements.mapNextButton.hidden = true;
}
function showMapGameSetup() {
  clearMapChallengeTimer();
  mapGameScreen = "setup";
  mapChallengeCurrent = null;
  mapQuizTarget = null;
  mapQuizAnswered = false;
  mapQuizWrongCode = null;
  selectedMapCode = null;
  elements.mapSelected.hidden = true;
  updateMapGamePoolInfo();
  updateMapGameScreen();
  refreshMapStyles();
}
function startSingleMapGame() {
  clearMapChallengeTimer();
  mapGameType = "single";
  mapGameScreen = "playing";
  elements.mapRegionFilter.value = mapGameRegion.value;
  updateMapGameScreen();
  startMapQuiz();
  zoomMapToCategory(mapGameRegion.value);
}
function startMapChallenge() {
  mapChallengeCategory = mapGameRegion.value;
  const candidates = getMapGameCandidates(mapChallengeCategory);
  if (!candidates.length) { updateMapGamePoolInfo(); return; }
  clearMapChallengeTimer();
  mapGameType = "challenge";
  mapGameScreen = "playing";
  mapChallengeQueue = shuffleMapCountries(candidates);
  mapChallengeCompleted = new Set();
  mapChallengeCurrent = mapChallengeQueue[0];
  mapChallengeErrors = 0;
  mapChallengeElapsed = 0;
  mapChallengeStartTime = Date.now();
  mapQuizTarget = null;
  mapQuizAnswered = false;
  selectedMapCode = null;
  elements.mapSelected.hidden = true;
  mapChallengeTimer = setInterval(() => {
    mapChallengeElapsed = Math.floor((Date.now() - mapChallengeStartTime) / 1000);
    updateMapChallengeHud();
  }, 250);
  updateMapGameScreen();
  elements.mapQuizPrompt.textContent = `Trykk på ${mapChallengeCurrent.name}`;
  elements.mapFeedback.textContent = "Finn landet uten å avsløre fasiten.";
  elements.mapFeedback.className = "map-feedback";
  updateMapChallengeHud();
  zoomMapToCategory(mapChallengeCategory);
  refreshMapStyles();
}
function finishMapChallenge() {
  mapChallengeElapsed = Math.floor((Date.now() - mapChallengeStartTime) / 1000);
  clearMapChallengeTimer();
  mapChallengeCurrent = null;
  mapGameScreen = "result";
  const category = mapChallengeCategory;
  const old = mapChallengeRecords[category];
  const isNewBest = !old || mapChallengeErrors < old.errors || (mapChallengeErrors === old.errors && mapChallengeElapsed < old.seconds);
  if (isNewBest) {
    mapChallengeRecords[category] = { errors: mapChallengeErrors, seconds: mapChallengeElapsed, count: mapChallengeQueue.length };
    try { localStorage.setItem(mapChallengeStorageKey, JSON.stringify(mapChallengeRecords)); }
    catch (err) { console.warn("Kunne ikke lagre kartrekord:", err); }
  }
  document.getElementById("mapChallengeResultTitle").textContent = `${categoryNames[category]} fullført!`;
  document.getElementById("mapChallengeResultSummary").textContent = `${mapChallengeQueue.length} land/steder · ${formatChallengeTime(mapChallengeElapsed)} · ${mapChallengeErrors} feiltrykk`;
  const best = mapChallengeRecords[category];
  document.getElementById("mapChallengeBest").textContent = `${isNewBest ? "🏆 Ny rekord! " : "Din rekord: "}${best.errors} feil · ${formatChallengeTime(best.seconds)}`;
  updateMapGameScreen();
  refreshMapStyles();
}
function handleChallengeCountryClick(code) {
  if (mapGameScreen !== "playing" || !mapChallengeCurrent) return;
  if (code === mapChallengeCurrent.code) {
    mapChallengeCompleted.add(code);
    if (mapChallengeCompleted.size === mapChallengeQueue.length) {
      finishMapChallenge();
      return;
    }
    mapChallengeCurrent = mapChallengeQueue[mapChallengeCompleted.size];
    elements.mapQuizPrompt.textContent = `Trykk på ${mapChallengeCurrent.name}`;
    elements.mapFeedback.textContent = "Riktig! Neste land …";
    elements.mapFeedback.className = "map-feedback correct";
  } else {
    mapChallengeErrors++;
    elements.mapFeedback.textContent = "Feiltrykk! Prøv igjen.";
    elements.mapFeedback.className = "map-feedback wrong";
  }
  updateMapChallengeHud();
  refreshMapStyles();
}

const geoJsonUrl = "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";

async function initializeWorldMap() {
  if (!window.L) {
    showMapError("Kartbiblioteket kunne ikke lastes. Kontroller internettilkoblingen og last siden på nytt.");
    return;
  }

  worldMap = L.map("worldMap", {
    center: [20, 0],
    zoom: 2,
    minZoom: 1.5,
    maxZoom: 7,
    worldCopyJump: true,
    scrollWheelZoom: true,
    wheelDebounceTime: 40
  });

  // OpenStreetMap standard tiles: no API key required.
  // Mouse-wheel zoom is enabled immediately; no click/focus is needed first.
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(worldMap);

  try {
    const response = await fetch(geoJsonUrl);
    if (!response.ok) throw new Error("Kartdata kunne ikke lastes.");
    const geoData = await response.json();
    countryGeoLayer = L.geoJSON(geoData, {
      style: mapFeatureStyle,
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        const code = props["ISO3166-1-Alpha-2"];
        if (code && code !== "-99") mapFeaturesByCode.set(code, layer);
        layer.on({
          mouseover: () => { if (elements.mapMode.value !== "quiz") layer.setStyle({ weight: 1.5, color: "#a9c4ff", fillOpacity: 0.88 }); },
          mouseout: () => countryGeoLayer.resetStyle(layer),
          click: () => handleMapCountryClick(code, props.name || "Ukjent område")
        });
      }
    }).addTo(worldMap);
    window.setTimeout(() => worldMap.invalidateSize(), 150);
    updateMapGamePoolInfo();
    if (mapOpenedAsQuiz) showMapGameSetup();
  } catch (error) {
    console.error(error);
    showMapError("Kunne ikke laste kartdata. Du kan fortsatt bruke quiz og Country Explorer.");
  }
}


function mapFeatureStyle(feature) {
    const code = feature.properties?.["ISO3166-1-Alpha-2"];

    // Kontinentutfordring: allerede funne land forblir grønne.
    if (mapOpenedAsQuiz && mapGameType === "challenge" && mapGameScreen !== "setup" && mapChallengeCompleted.has(code)) {
      return { color: "#36c98a", weight: 1.4, opacity: 1, fillColor: "#25a574", fillOpacity: 0.85 };
    }
    // Vis resultatfargene etter at spilleren har svart.
    if (elements.mapMode.value === "quiz" && mapQuizAnswered) {

        // Riktig land blir grønt.
        if (code === mapQuizTarget?.code) {
            return {
                color: "#36c98a",
                weight: 1.8,
                opacity: 1,
                fillColor: "#36c98a",
                fillOpacity: 0.85
            };
        }

        // Landet spilleren valgte feil blir rødt.
        if (code === mapQuizWrongCode) {
            return {
                color: "#ff6d7e",
                weight: 1.8,
                opacity: 1,
                fillColor: "#ff6d7e",
                fillOpacity: 0.85
            };
        }
    }

    // Vanlig kartvisning.
    const isSelected = code && code === selectedMapCode;

    return {
        color: isSelected ? "#9bbaff" : "#526987",
        weight: isSelected ? 1.8 : 0.65,
        opacity: 0.95,
        fillColor: isSelected ? "#3971ed" : "#182a43",
        fillOpacity: isSelected ? 0.8 : 0.58
    };
}

function refreshMapStyles() {
  if (countryGeoLayer) countryGeoLayer.setStyle(mapFeatureStyle);
}

function showMapError(message) {
  elements.mapFeedback.textContent = message;
  elements.mapFeedback.className = "map-feedback wrong";
}

function renderMapCountry(country) {
  if (!country) return;
  elements.mapSelected.innerHTML = "";
  const flag = createFlagImage(country, "map-country-flag");
  const details = document.createElement("span");
  const name = document.createElement("strong");
  name.textContent = country.name;
  const facts = document.createElement("span");
  facts.textContent = ` · ${country.capital && country.capital !== "Ukjent" ? country.capital : "Hovedstad ikke oppgitt"} · ${regionNames[country.region] || country.region || "Region ukjent"}`;
  details.append(name, facts);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "map-popup-close";
  close.textContent = "×";
  close.setAttribute("aria-label", "Lukk landinformasjon");
  close.addEventListener("click", () => {
    elements.mapSelected.hidden = true;
    selectedMapCode = null;
    refreshMapStyles();
  });
  elements.mapSelected.append(flag, details, close);
  elements.mapSelected.hidden = false;
  selectedExplorerCode = country.code;
  renderCountryDetails(country);
}

function handleMapCountryClick(code, mapName) {
  if (mapOpenedAsQuiz && mapGameScreen !== "playing") return;
  if (mapOpenedAsQuiz && mapGameType === "challenge") {
    handleChallengeCountryClick(code);
    return;
  }
  if (elements.mapMode.value === "quiz") {
    if (mapQuizAnswered || !mapQuizTarget) return;
    mapQuizAnswered = true;

    const correct = code === mapQuizTarget.code;

    // Husk hvilket land spilleren eventuelt valgte feil.
    mapQuizWrongCode = correct ? null : code;
    if (correct) {
      elements.mapFeedback.textContent = `Riktig! Dette er ${mapQuizTarget.name}. 🎉`;
      elements.mapFeedback.className = "map-feedback correct";
    } else {
      const clickedCountry = countries.find(country => country.code === code);
      elements.mapFeedback.textContent = clickedCountry
        ? `Ikke helt! Du valgte ${clickedCountry.name}. Finn ${mapQuizTarget.name} neste gang.`
        : `Det var ${mapName}. Prøv å finne ${mapQuizTarget.name}.`;
      elements.mapFeedback.className = "map-feedback wrong";
    }
    elements.mapNextButton.hidden = false;
    refreshMapStyles();
    return;
  }

  const country = countries.find(item => item.code === code);
  if (!country) {
    elements.mapFeedback.textContent = `${mapName} finnes ikke som egen oppføring i landdatabasen.`;
    elements.mapFeedback.className = "map-feedback";
    return;
  }
  selectedMapCode = country.code;
  renderMapCountry(country);
  elements.mapFeedback.textContent = `Du har valgt ${country.name}.`;
  elements.mapFeedback.className = "map-feedback";
  refreshMapStyles();
}

function startMapQuiz() {
  if (mapOpenedAsQuiz && (mapGameType !== "single" || mapGameScreen !== "playing")) return;
  const category = elements.mapRegionFilter?.value || "all";
  const candidates = countries.filter(country => mapFeaturesByCode.has(country.code) && country.name && countryMatchesCategory(country, category));
  if (!candidates.length) {
    showMapError("Fant ingen land som kan brukes i kartquizen.");
    return;
  }
  mapQuizTarget = randomItem(candidates);
  mapQuizAnswered = false;
  mapQuizWrongCode = null;
  selectedMapCode = null;
  elements.mapSelected.hidden = true;
  elements.mapQuizPrompt.textContent = `Finn ${mapQuizTarget.name} på kartet`;
  elements.mapFeedback.textContent = "Trykk på landet du tror er riktig.";
  elements.mapFeedback.className = "map-feedback";
  elements.mapNextButton.hidden = true;
  refreshMapStyles();
}

function updateMapMode() {
  const quizMode = elements.mapMode.value === "quiz";
  elements.mapNextButton.hidden = !quizMode;
  elements.mapQuizPrompt.textContent = quizMode ? "Gjør deg klar til å finne et land …" : "Velg et land på kartet for å utforske det.";
  elements.mapFeedback.textContent = quizMode ? "Finn landet som vises øverst." : "Trykk på et land for å se informasjon.";
  elements.mapFeedback.className = "map-feedback";
  elements.mapSelected.hidden = true;
  if (quizMode) startMapQuiz();
  else {
    mapQuizTarget = null;
    mapQuizAnswered = false;
    refreshMapStyles();
  }
}

// ==========================================
// NAVIGASJON MELLOM STARTSIDE OG FUNKSJONER
// ==========================================

const homeView = document.getElementById("homeView");
const homeButton = document.getElementById("homeButton");
const logoHome = document.getElementById("logoHome");
// Holder styr på hvordan kartet ble åpnet
let mapOpenedAsQuiz = false;
function showView(viewId) {
  const views = [
    "homeView",
    "quizView",
    "mapView",
    "explorerView",
    "statsView",
    "higherLowerView"
  ];

  views.forEach(id => {
    const view = document.getElementById(id);
    const isActive = id === viewId;

    view.hidden = !isActive;
    view.style.display = isActive ? "" : "none";
  });

  const isHome = viewId === "homeView";
  homeButton.hidden = isHome;

  window.scrollTo({ top: 0, behavior: "smooth" });

  // Leaflet må oppdatere størrelsen når kartet blir synlig.
  if (viewId === "mapView" && worldMap) {
    requestAnimationFrame(() => {
      worldMap.invalidateSize();
    });
  }

  // Oppdater statistikken når statistikksiden åpnes.
  if (viewId === "statsView") {
    updateStats();
  }
  if (viewId === "mapView") {
    updateMapInterface();
  } else {
    elements.mapSelected.hidden = true;
  }
}


// ==========================================
// FASE 5 – OVER/UNDER
// ==========================================
const hlStorageKey = "geomaster-higher-lower-v1";
let hlRecords = {};
try {
  const stored = JSON.parse(localStorage.getItem(hlStorageKey) || "{}");
  if (stored && typeof stored === "object" && !Array.isArray(stored)) hlRecords = stored;
} catch { hlRecords = {}; }
const hlEls = Object.fromEntries([
  "hlMetric", "hlRegion", "hlPoolInfo", "hlStart", "higherLowerSetup",
  "higherLowerPlaying", "higherLowerResult", "hlStreak", "hlBest", "hlQuestion",
  "hlCurrentCard", "hlChooseNext", "hlFeedback", "hlHigher", "hlLower",
  "hlContinue", "hlExit", "hlResultTitle", "hlResultDetails", "hlResultBest",
  "hlAgain", "hlMenu", "hlRecordsList"
].map(id => [id, document.getElementById(id)]));
const hlLabels = { population: "befolkning", area: "areal", highest: "høyeste punkt" };
let hlGame = null;
function hlNumber(value) { return new Intl.NumberFormat("nb-NO", {maximumFractionDigits: 2}).format(value); }
function hlValue(country, metric) {
  if (metric === "highest") return country.highestPoint?.meters;
  return country[metric];
}
function hlEligible(metric, region) {
  return countries.filter(c => countryMatchesCategory(c, region) && c.name &&
    typeof hlValue(c, metric) === "number" && Number.isFinite(hlValue(c, metric)) && hlValue(c, metric) > 0);
}
function hlRecordKey(metric, region) { return `${metric}:${region}`; }
function hlBestScore(metric, region) { return Number(hlRecords[hlRecordKey(metric, region)]) || 0; }
function hlSaveScore() {
  const key = hlRecordKey(hlGame.metric, hlGame.region);
  const best = Math.max(hlBestScore(hlGame.metric, hlGame.region), hlGame.streak);
  hlRecords[key] = best;
  try { localStorage.setItem(hlStorageKey, JSON.stringify(hlRecords)); }
  catch (e) { console.warn("Kunne ikke lagre Over/under-rekord:", e); }
}
function hlSelectPair(pool, previous = null) {
  const eligible = pool.filter(c => c.code !== previous?.code &&
    (previous === null || hlValue(c, hlGame.metric) !== hlValue(previous, hlGame.metric)) &&
    !hlGame.used.has(c.code));
  if (!eligible.length) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}
function hlFormatValue(country, metric) {
  const val = hlNumber(hlValue(country, metric));
  return metric === "population" ? `${val} innbyggere` : metric === "area" ? `${val} km²` : `${val} moh.`;
}
function hlCard(container, country, revealed, metric) {
  container.replaceChildren();
  const flag = document.createElement("div"); flag.className = "hl-flag";
  flag.append(createFlagImage(country, "hl-flag-img"));
  const name = document.createElement("strong"); name.textContent = country.name;
  const value = document.createElement("span"); value.className = "hl-value";
  value.textContent = revealed ? hlFormatValue(country, metric) : "?";
  container.append(flag, name, value);
  if (metric === "highest") {
    const peak = document.createElement("small");
    peak.textContent = revealed ? country.highestPoint.name : "Høyeste punkt";
    container.appendChild(peak);
  }
}
function hlSetScreen(screen) {
  hlEls.higherLowerSetup.hidden = screen !== "setup";
  hlEls.higherLowerPlaying.hidden = screen !== "playing";
  hlEls.higherLowerResult.hidden = screen !== "result";
}
function hlUpdatePool() {
  const pool = hlEligible(hlEls.hlMetric.value, hlEls.hlRegion.value);
  hlEls.hlPoolInfo.textContent = `${pool.length} land/steder med registrerte verdier. ${hlEls.hlMetric.value === "highest" ? "Land uten fjellhøyde er utelatt." : ""}`;
  hlEls.hlStart.disabled = pool.length < 2 || new Set(pool.map(c => hlValue(c, hlEls.hlMetric.value))).size < 2;
}
function hlRenderRound() {
  const game = hlGame;
  hlEls.hlQuestion.textContent = `Har ${game.next.name} høyere eller lavere ${hlLabels[game.metric]} enn ${game.current.name}?`;
  hlEls.hlStreak.textContent = `${game.streak} riktige på rad`;
  hlEls.hlBest.textContent = `Rekord: ${hlBestScore(game.metric, game.region)}`;
  hlCard(hlEls.hlCurrentCard, game.current, true, game.metric);
  hlCard(hlEls.hlChooseNext, game.next, game.revealed, game.metric);
  hlEls.hlFeedback.textContent = game.revealed ? (game.correct ? "Riktig!" : "Feil svar.") : "Velg høyere eller lavere.";
  hlEls.hlFeedback.className = `hl-feedback${game.revealed ? (game.correct ? " correct" : " wrong") : ""}`;
  hlEls.hlHigher.hidden = game.revealed;
  hlEls.hlLower.hidden = game.revealed;
  hlEls.hlContinue.hidden = !game.revealed || !game.correct;
}
function hlShowResults(reason = "wrong") {
  hlSaveScore();
  hlSetScreen("result");
  hlEls.hlResultTitle.textContent = reason === "completed" ? "Alle tilgjengelige land brukt!" : "Runden er over!";
  hlEls.hlResultDetails.textContent = `${hlGame.streak} riktige på rad · ${hlLabels[hlGame.metric]} · ${categoryNames[hlGame.region]}`;
  hlEls.hlResultBest.textContent = `Personlig rekord: ${hlBestScore(hlGame.metric, hlGame.region)}`;
  renderHigherLowerRecords();
}
function hlStart() {
  const metric = hlEls.hlMetric.value, region = hlEls.hlRegion.value;
  const pool = hlEligible(metric, region);
  if (pool.length < 2) { hlUpdatePool(); return; }
  hlGame = { metric, region, pool, used: new Set(), streak: 0, current: null, next: null, revealed: false, correct: false };
  hlGame.current = pool[Math.floor(Math.random() * pool.length)];
  hlGame.used.add(hlGame.current.code);
  hlGame.next = hlSelectPair(pool, hlGame.current);
  if (!hlGame.next) { hlUpdatePool(); return; }
  hlSetScreen("playing");
  hlRenderRound();
}
function hlGuess(higher) {
  if (!hlGame || hlGame.revealed) return;
  const a = hlValue(hlGame.current, hlGame.metric);
  const b = hlValue(hlGame.next, hlGame.metric);
  hlGame.revealed = true;
  hlGame.correct = higher ? b > a : b < a;
  if (hlGame.correct) hlGame.streak++;
  hlRenderRound();
  if (!hlGame.correct) {
    hlEls.hlContinue.hidden = true;
    hlEls.hlFeedback.textContent = `Feil! ${hlGame.next.name}: ${hlFormatValue(hlGame.next, hlGame.metric)}. Trykk for resultat.`;
    hlEls.hlContinue.textContent = "Se resultat →";
    hlEls.hlContinue.hidden = false;
  } else {
    hlEls.hlContinue.textContent = "Neste sammenligning →";
  }
}
function hlNext() {
  if (!hlGame || !hlGame.revealed) return;
  if (!hlGame.correct) { hlShowResults(); return; }
  hlGame.current = hlGame.next;
  hlGame.used.add(hlGame.current.code);
  hlGame.next = hlSelectPair(hlGame.pool, hlGame.current);
  if (!hlGame.next) { hlShowResults("completed"); return; }
  hlGame.revealed = false;
  hlGame.correct = false;
  hlRenderRound();
}
function renderHigherLowerRecords() {
  if (!hlEls.hlRecordsList) return;
  hlEls.hlRecordsList.replaceChildren();
  const entries = Object.entries(hlRecords).filter(([key, val]) => /^\w+:[\w-]+$/.test(key) && Number.isFinite(Number(val)) && Number(val) > 0).sort((a,b) => Number(b[1]) - Number(a[1]));
  if (!entries.length) { hlEls.hlRecordsList.textContent = "Ingen rekorder ennå. Prøv Over/under!"; return; }
  for (const [key, val] of entries) {
    const [metric, region] = key.split(":");
    if (!hlLabels[metric] || !categoryNames[region]) continue;
    const line = document.createElement("div"); line.className = "hl-record-row";
    const name = document.createElement("span"); name.textContent = `${hlLabels[metric]} · ${categoryNames[region]}`;
    const score = document.createElement("strong"); score.textContent = `${Number(val)} på rad`;
    line.append(name, score); hlEls.hlRecordsList.appendChild(line);
  }
}
function initializeHigherLower() {
  hlEls.hlRegion.replaceChildren(new Option(categoryNames.all, "all"));
  categoryOrder.forEach(c => hlEls.hlRegion.add(new Option(categoryNames[c], c)));
  hlEls.hlMetric.addEventListener("change", hlUpdatePool);
  hlEls.hlRegion.addEventListener("change", hlUpdatePool);
  hlEls.hlStart.addEventListener("click", hlStart);
  hlEls.hlHigher.addEventListener("click", () => hlGuess(true));
  hlEls.hlLower.addEventListener("click", () => hlGuess(false));
  hlEls.hlContinue.addEventListener("click", hlNext);
  hlEls.hlExit.addEventListener("click", () => hlSetScreen("setup"));
  hlEls.hlAgain.addEventListener("click", hlStart);
  hlEls.hlMenu.addEventListener("click", () => { hlSetScreen("setup"); hlUpdatePool(); });
  hlSetScreen("setup");
  renderHigherLowerRecords();
}

// ==========================================
// MOBILNAVIGASJON
// ==========================================

const mobileNavButtons =
    document.querySelectorAll(".mobile-nav-item");

function updateMobileNavigation(viewId) {
    mobileNavButtons.forEach(button => {
        const isActive =
            button.dataset.mobileTarget === viewId;

        button.classList.toggle("active", isActive);

        if (isActive) {
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }
    });
}

// Klikk på mobilnavigasjonen
mobileNavButtons.forEach(button => {
    button.addEventListener("click", () => {
        const target = button.dataset.mobileTarget;
        // Åpne alltid landlisten når Utforsk velges fra bunnmenyen
        if (target === "explorerView") {
            showExplorerListOnMobile();
        }

        if (target === "homeView") {
            showView("homeView");
            return;
        }

        // Gjenbruk startsideknappene slik at quiz og kart
        // åpnes med riktig modus og eksisterende logikk.
        // Kart i bunnmenyen skal alltid være utforskingsmodus.
        if (target === "mapView") {
        mapOpenedAsQuiz = false;

        elements.mapMode.value = "explore";
        elements.mapSelected.hidden = true;
        selectedMapCode = null;
        updateMapMode();
        mapGameScreen = "explore";
        updateMapGameScreen();
        }

        // Åpne valgt side uten å starte et spill.
        showView(target);
    });
});

// Oppdater aktiv navigasjonsknapp når visningen endres.
const originalShowView = showView;

showView = function(viewId) {
    if (viewId !== "mapView") clearMapChallengeTimer();
    originalShowView(viewId);
    updateMobileNavigation(viewId);
};

// Marker Hjem ved oppstart
updateMobileNavigation("homeView");


// Koble startsideknappene til riktig visning.
document.querySelectorAll("[data-view-target]").forEach(button => {
  button.addEventListener("click", () => {
    const target = button.dataset.viewTarget;

    if (target === "higherLowerView") { hlSetScreen("setup"); hlUpdatePool(); }

    // Flaggquiz eller hovedstadquiz.
    if (button.dataset.quizMode) {
      elements.mode.value = button.dataset.quizMode;
      showQuizSetup();
    }

    // Finn landet åpner kartet i quizmodus.
    if (button.dataset.mapMode) {
    mapOpenedAsQuiz = button.dataset.mapMode === "quiz";

    elements.mapMode.value = button.dataset.mapMode;
    if (mapOpenedAsQuiz) showMapGameSetup();
    else { clearMapChallengeTimer(); mapGameScreen = "explore"; updateMapMode(); }
    }

    showView(target);
  });
});

// Hjemknappen og logoen tar brukeren tilbake.
homeButton.addEventListener("click", () => {
  showView("homeView");
});

logoHome.addEventListener("click", event => {
  event.preventDefault();
  showView("homeView");
});

// Startsiden vises ved oppstart.
showView("homeView");

elements.nextButton.addEventListener("click", () => { if (answered) newQuestion(); });
elements.startQuizButton.addEventListener("click", beginQuiz);
elements.quizSettingsButton.addEventListener("click", showQuizSetup);
elements.difficulty.addEventListener("change", updateQuizSetup);
elements.regionFilter.addEventListener("change", updateQuizSetup);
elements.reviewButton.addEventListener("click", () => {
  showView("quizView");
  startReview();
});
elements.countrySearch.addEventListener("input", renderExplorer);
elements.explorerRegion.addEventListener("change", renderExplorer);
elements.mapMode.addEventListener("change", () => {
  if (elements.mapMode.value === "quiz") showMapGameSetup();
  else { clearMapChallengeTimer(); mapGameScreen = "explore"; updateMapMode(); }
});
elements.mapRegionFilter.addEventListener("change", () => {
  if (elements.mapMode.value === "quiz" && mapGameType === "single" && mapGameScreen === "playing") {
    mapGameRegion.value = elements.mapRegionFilter.value;
    startMapQuiz();
    zoomMapToCategory(elements.mapRegionFilter.value);
  }
});
document.getElementById("mapExitButton").addEventListener("click", () => showView("homeView"));
elements.mapNextButton.addEventListener("click", startMapQuiz);
// Fase 4-kontroller. Egen meny for kartspill, ikke for kartutforsking.
mapGameRegion.replaceChildren(new Option(categoryNames.all, "all"));
categoryOrder.forEach(c => mapGameRegion.add(new Option(categoryNames[c], c)));
mapGameRegion.addEventListener("change", updateMapGamePoolInfo);
document.getElementById("startSingleMapGame").addEventListener("click", startSingleMapGame);
document.getElementById("startChallengeMapGame").addEventListener("click", startMapChallenge);
document.getElementById("mapChallengeStop").addEventListener("click", showMapGameSetup);
document.getElementById("mapChallengeAgain").addEventListener("click", startMapChallenge);
document.getElementById("mapChallengeMenu").addEventListener("click", showMapGameSetup);

initializeHigherLower();

loadCountries().catch(error => {
  console.error(error);
  elements.feedback.textContent = "Kunne ikke laste landdatabasen. Kontroller at data/countries.json finnes og at Live Server kjører.";
  elements.feedback.className = "feedback wrong";
});

// PWA update management – show an opt-in update instead of interrupting a quiz.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const notice = document.getElementById("appUpdateNotice");
    const updateButton = document.getElementById("appUpdateButton");
    const dismissButton = document.getElementById("appUpdateDismiss");
    let waitingWorker = null;
    let updateRequested = false;

    function offerUpdate(worker) {
      if (!navigator.serviceWorker.controller || !worker) return;
      waitingWorker = worker;
      notice.hidden = false;
    }
    updateButton.addEventListener("click", () => {
      if (!waitingWorker) return;
      updateRequested = true;
      updateButton.disabled = true;
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    });
    dismissButton.addEventListener("click", () => { notice.hidden = true; });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (updateRequested) window.location.reload();
    });

    navigator.serviceWorker.register("./service-worker.js")
      .then(registration => {
        if (registration.waiting) offerUpdate(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed") offerUpdate(registration.waiting || worker);
          });
        });
        // Check for new releases on launch and when returning to the app.
        registration.update().catch(() => {});
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) registration.update().catch(() => {});
        });
      })
      .catch(error => console.warn("GeoMaster PWA kunne ikke registreres:", error));
  });
}
// Skjul kartmodusvelgeren når kartet brukes til utforsking
function updateMapInterface() {
    const mapSection = document.getElementById("mapView");
    const modeField = document.querySelector("#mapView .map-mode-field");
    const regionField = document.querySelector("#mapView .map-region-field");
    const nextButton = document.getElementById("mapNextButton");

    if (!mapSection) return;

    const exploreOnly = !mapOpenedAsQuiz;

    // Behold klassene for eventuell videre styling
    mapSection.classList.toggle("map-explore-only", exploreOnly);
    mapSection.classList.toggle("map-quiz-active", !exploreOnly);

    // Skjul modusvelgeren når kartet åpnes fra bunnmenyen
    if (regionField) regionField.hidden = exploreOnly;
    if (modeField) {
        modeField.style.setProperty(
            "display",
            exploreOnly ? "none" : "",
            "important"
        );
    }

    updateMapGameScreen();
    // Skjul "Nytt land"-knappen i utforskingsmodus
    if (nextButton && exploreOnly) {
        nextButton.hidden = true;
    }
}