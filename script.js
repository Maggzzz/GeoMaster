let countries = [];
let score = 0;
let questionCount = 0;
let currentQuestion = null;
let answered = false;
let reviewMode = false;
let selectedExplorerCode = null;

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
  mapSelected: document.getElementById("mapSelected")
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
  newQuestion();
  renderExplorer();
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
}

function populateRegionFilters() {
  const regions = [...new Set(countries.map(c => c.region).filter(Boolean))].sort((a,b) => (regionNames[a] || a).localeCompare(regionNames[b] || b, "no"));
  regions.forEach(region => {
    const label = regionNames[region] || region;
    [elements.regionFilter, elements.explorerRegion].forEach(select => {
      const option = document.createElement("option");
      option.value = region;
      option.textContent = label;
      select.appendChild(option);
    });
  });
}

function getCountryPool() {
  const difficulty = elements.difficulty.value;
  const mode = elements.mode.value;
  const region = elements.regionFilter.value;
  let pool = countries.filter(country => country.flag && country.name);

  // Hovedstadquizen skal aldri vise tomme eller ukjente hovedsteder.
  if (mode === "capital") pool = pool.filter(country => country.capital && country.capital !== "Ukjent");
  if (region !== "all") pool = pool.filter(country => country.region === region);

  if (difficulty === "easy") {
    pool = pool.filter(country => easyCodes.has(country.code));
  } else if (difficulty === "medium") {
    // Middels: land med minst én million innbyggere, uten polare/antarktiske områder.
    pool = pool.filter(country => (Number(country.population) || 0) >= 1000000 && !["Polar", "Antarctic", "Antarctic Ocean"].includes(country.region));
  }
  return pool;
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

  currentQuestion = randomItem(questionPool);
  questionCount++;
  const mode = elements.mode.value;
  elements.quizTitle.textContent = mode === "flag" ? "Flaggquiz" : "Hovedstadquiz";
  elements.questionNumber.textContent = `SPØRSMÅL ${questionCount}`;
  elements.questionText.textContent = mode === "flag" ? "Hvilket land tilhører dette flagget?" : `Hva er hovedstaden i ${currentQuestion.name}?`;
  elements.questionVisual.replaceChildren(
    createFlagImage(currentQuestion, "quiz-flag-image"));
  elements.questionVisual.setAttribute("aria-label", `Flagget til ${currentQuestion.name}`);
  elements.answers.innerHTML = "";
  elements.feedback.textContent = "Velg riktig svar!";
  elements.feedback.className = "feedback";
  elements.nextButton.disabled = true;

  const alternatives = answerPool.filter(country => country.code !== currentQuestion.code);
  const choices = [currentQuestion, ...shuffle(alternatives).slice(0, 3)];
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
    return (region === "all" || country.region === region) && (!query || searchable.includes(query));
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
    const regionLabel = document.createElement("span"); regionLabel.className = "country-region"; regionLabel.textContent = regionNames[country.region] || country.region || "Region ikke oppgitt";
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
  const region = document.createElement("p"); region.textContent = `${regionNames[country.region] || country.region || "Region ikke oppgitt"}${country.subregion ? ` · ${country.subregion}` : ""}`;
  top.append(flag, title, region);
  const rows = [
    ["Hovedstad", country.capital && country.capital !== "Ukjent" ? country.capital : "Ikke oppgitt"],
    ["Befolkning", formatNumber(country.population)],
    ["Areal", country.area ? `${formatNumber(country.area)} km²` : "Ikke oppgitt"],
    ["Valuta", country.currency || "Ikke oppgitt"],
    ["Språk", Array.isArray(country.languages) && country.languages.length ? country.languages.join(", ") : "Ikke oppgitt"],
    ["Naboland", Array.isArray(country.borders) && country.borders.length ? country.borders.length : "Ingen registrert"]
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
    if (elements.mapMode.value === "quiz") startMapQuiz();
  } catch (error) {
    console.error(error);
    showMapError("Kunne ikke laste kartdata. Du kan fortsatt bruke quiz og Country Explorer.");
  }
}


function mapFeatureStyle(feature) {
    const code = feature.properties?.["ISO3166-1-Alpha-2"];

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
  elements.mapSelected.append(flag, details);
  selectedExplorerCode = country.code;
  renderCountryDetails(country);
}

function handleMapCountryClick(code, mapName) {
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
  const candidates = countries.filter(country => mapFeaturesByCode.has(country.code) && country.name && country.region !== "Polar" && country.region !== "Antarctic Ocean");
  if (!candidates.length) {
    showMapError("Fant ingen land som kan brukes i kartquizen.");
    return;
  }
  mapQuizTarget = randomItem(candidates);
  mapQuizAnswered = false;
  mapQuizWrongCode = null;
  selectedMapCode = null;
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
    "statsView"
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
  }
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
        updateMapMode();
        }

        // Åpne valgt side uten å starte et spill.
        showView(target);
    });
});

// Oppdater aktiv navigasjonsknapp når visningen endres.
const originalShowView = showView;

showView = function(viewId) {
    originalShowView(viewId);
    updateMobileNavigation(viewId);
};

// Marker Hjem ved oppstart
updateMobileNavigation("homeView");


// Koble startsideknappene til riktig visning.
document.querySelectorAll("[data-view-target]").forEach(button => {
  button.addEventListener("click", () => {
    const target = button.dataset.viewTarget;

    // Flaggquiz eller hovedstadquiz.
    if (button.dataset.quizMode) {
      elements.mode.value = button.dataset.quizMode;
      restartQuiz();
    }

    // Finn landet åpner kartet i quizmodus.
    if (button.dataset.mapMode) {
    mapOpenedAsQuiz = button.dataset.mapMode === "quiz";

    elements.mapMode.value = button.dataset.mapMode;
    updateMapMode();
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
elements.mode.addEventListener("change", restartQuiz);
elements.difficulty.addEventListener("change", restartQuiz);
elements.regionFilter.addEventListener("change", restartQuiz);
elements.reviewButton.addEventListener("click", () => {
  showView("quizView");
  startReview();
});
elements.countrySearch.addEventListener("input", renderExplorer);
elements.explorerRegion.addEventListener("change", renderExplorer);
elements.mapMode.addEventListener("change", updateMapMode);
elements.mapNextButton.addEventListener("click", startMapQuiz);

loadCountries().catch(error => {
  console.error(error);
  elements.feedback.textContent = "Kunne ikke laste landdatabasen. Kontroller at data/countries.json finnes og at Live Server kjører.";
  elements.feedback.className = "feedback wrong";
});

// Register GeoMaster service worker
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("./service-worker.js")
            .then(registration => {
                console.log(
                    "GeoMaster service worker registered:",
                    registration.scope
                );
            })
            .catch(error => {
                console.error(
                    "GeoMaster service worker registration failed:",
                    error
                );
            });
    });
}
// Skjul kartmodusvelgeren når kartet brukes til utforsking
function updateMapInterface() {
    const mapSection = document.getElementById("mapView");
    const modeField = document.querySelector("#mapView .map-mode-field");
    const nextButton = document.getElementById("mapNextButton");

    if (!mapSection) return;

    const exploreOnly = !mapOpenedAsQuiz;

    // Behold klassene for eventuell videre styling
    mapSection.classList.toggle("map-explore-only", exploreOnly);
    mapSection.classList.toggle("map-quiz-active", !exploreOnly);

    // Skjul modusvelgeren når kartet åpnes fra bunnmenyen
    if (modeField) {
        modeField.style.setProperty(
            "display",
            exploreOnly ? "none" : "",
            "important"
        );
    }

    // Skjul "Nytt land"-knappen i utforskingsmodus
    if (nextButton && exploreOnly) {
        nextButton.hidden = true;
    }
}