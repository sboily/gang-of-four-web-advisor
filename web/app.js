/**
 * Gang of Four AI - Main Application
 */

// ONNX Runtime session
let session = null;

// Get encoder from global
const GF = window.GangOfFour || {};
const Card = GF.Card;
const GameEncoder = GF.GameEncoder;
const decodeAction = GF.decodeAction;
const softmax = GF.softmax;
const INPUT_DIM = GF.INPUT_DIM || 328;
const MAX_ACTIONS = GF.MAX_ACTIONS || 40;
const ACTION_MASK_OFFSET = GF.ACTION_MASK_OFFSET || 256;

const encoder = GameEncoder ? new GameEncoder() : null;

// State
let currentMode = 'hand';
let handCards = [];
let trickCards = [];

// All available cards in the deck
const ALL_CARDS = [];

/**
 * Initialize all cards in the deck
 */
function initCards() {
  // Numbers 1-10 in each color (2 copies each)
  for (let rank = 1; rank <= 10; rank++) {
    for (const color of ['G', 'Y', 'R']) {
      ALL_CARDS.push({ id: `${rank}${color}-1`, notation: `${rank}${color}`, rank, color, copy: 1 });
      ALL_CARDS.push({ id: `${rank}${color}-2`, notation: `${rank}${color}`, rank, color, copy: 2 });
    }
  }
  // Special cards
  ALL_CARDS.push({ id: '1M', notation: '1M', rank: 1, color: 'M', special: true, label: '1 Multi' });
  ALL_CARDS.push({ id: 'PG', notation: 'PhoenixG', rank: 11, color: 'G', special: true, label: 'Ph G' });
  ALL_CARDS.push({ id: 'PY', notation: 'PhoenixY', rank: 11, color: 'Y', special: true, label: 'Ph Y' });
  ALL_CARDS.push({ id: 'D', notation: 'Dragon', rank: 12, color: 'R', special: true, label: 'D' });
}

/**
 * Get CSS class for card color
 */
function getColorClass(color) {
  if (color === 'G') return 'green';
  if (color === 'Y') return 'yellow';
  if (color === 'R') return 'red';
  if (color === 'M') return 'multi';
  return 'special';
}

/**
 * Create a card DOM element
 */
function createCardElement(cardData) {
  const div = document.createElement('div');
  div.className = `card ${getColorClass(cardData.color)}${cardData.special ? ' special' : ''}`;
  div.dataset.id = cardData.id;
  div.dataset.notation = cardData.notation;

  if (cardData.label) {
    div.innerHTML = `<span class="rank">${cardData.label}</span>`;
  } else if (cardData.color === 'M') {
    div.innerHTML = `<span class="rank">1</span><span class="suit">Multi</span>`;
  } else {
    div.innerHTML = `<span class="rank">${cardData.rank}</span><span class="suit">${cardData.color}</span>`;
  }

  return div;
}

/**
 * Render the card picker grid
 */
function renderCardPicker() {
  const picker = document.getElementById('card-picker');
  picker.innerHTML = '';

  let currentRank = 0;

  for (const cardData of ALL_CARDS) {
    if (!cardData.special && cardData.rank !== currentRank && cardData.copy === 1) {
      currentRank = cardData.rank;
    }

    const cardEl = createCardElement(cardData);

    // Check if already selected
    const inHand = handCards.some(c => c.id === cardData.id);
    const inTrick = trickCards.some(c => c.id === cardData.id);

    if (inHand || inTrick) {
      cardEl.classList.add('selected');
      if ((currentMode === 'hand' && inTrick) || (currentMode === 'trick' && inHand)) {
        cardEl.classList.add('disabled');
      }
    }

    cardEl.addEventListener('click', () => toggleCard(cardData));
    picker.appendChild(cardEl);
  }
}

/**
 * Toggle card selection
 */
function toggleCard(cardData) {
  const cards = currentMode === 'hand' ? handCards : trickCards;
  const otherCards = currentMode === 'hand' ? trickCards : handCards;

  // Check if in other selection
  if (otherCards.some(c => c.id === cardData.id)) {
    return; // Can't select same card in both
  }

  const idx = cards.findIndex(c => c.id === cardData.id);
  if (idx >= 0) {
    cards.splice(idx, 1);
  } else {
    cards.push(cardData);
  }

  updateDisplays();
  renderCardPicker();
}

/**
 * Update hand and trick displays
 */
function updateDisplays() {
  // Hand display
  const handDisplay = document.getElementById('hand-display');
  handDisplay.innerHTML = '';
  for (const cardData of handCards) {
    const cardEl = createCardElement(cardData);
    cardEl.addEventListener('click', () => {
      const idx = handCards.findIndex(c => c.id === cardData.id);
      if (idx >= 0) handCards.splice(idx, 1);
      updateDisplays();
      renderCardPicker();
    });
    handDisplay.appendChild(cardEl);
  }
  document.getElementById('hand-count').textContent = `${handCards.length} cards`;

  // Trick display
  const trickDisplay = document.getElementById('trick-display');
  trickDisplay.innerHTML = '';
  for (const cardData of trickCards) {
    const cardEl = createCardElement(cardData);
    cardEl.addEventListener('click', () => {
      const idx = trickCards.findIndex(c => c.id === cardData.id);
      if (idx >= 0) trickCards.splice(idx, 1);
      updateDisplays();
      renderCardPicker();
    });
    trickDisplay.appendChild(cardEl);
  }
  document.getElementById('trick-count').textContent = trickCards.length ? `${trickCards.length} cards` : 'Leading (empty)';
}

/**
 * Set selection mode (hand or trick)
 */
function setMode(mode) {
  currentMode = mode;
  document.getElementById('mode-hand').classList.toggle('active', mode === 'hand');
  document.getElementById('mode-trick').classList.toggle('active', mode === 'trick');
  document.getElementById('hand-section').style.opacity = mode === 'hand' ? '1' : '0.6';
  document.getElementById('trick-section').style.opacity = mode === 'trick' ? '1' : '0.6';
  renderCardPicker();
}

/**
 * Clear hand selection
 */
function clearHand() {
  handCards = [];
  updateDisplays();
  renderCardPicker();
}

/**
 * Clear trick selection
 */
function clearTrick() {
  trickCards = [];
  updateDisplays();
  renderCardPicker();
}

/**
 * Render cards in an element
 */
function renderCardsInElement(element, cards, showPass = false) {
  element.innerHTML = '';
  if (!cards || cards.length === 0) {
    if (showPass) {
      element.innerHTML = '<span class="pass-text">PASS</span>';
    }
    return;
  }
  for (const cardData of cards) {
    const cardEl = createCardElement(cardData);
    element.appendChild(cardEl);
  }
}

/**
 * Load the ONNX model
 */
async function loadModel() {
  const statusEl = document.getElementById('status');
  const analyzeBtn = document.getElementById('analyze');

  try {
    statusEl.textContent = 'Loading ONNX Runtime...';
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';

    statusEl.textContent = 'Loading model (3.8 MB)...';

    // Load model with embedded weights
    session = await ort.InferenceSession.create('./model/neural_v3_embedded.onnx', {
      executionProviders: ['wasm']
    });

    statusEl.textContent = 'Ready! Select your cards below.';
    statusEl.className = 'status ready';
    analyzeBtn.disabled = false;

  } catch (err) {
    console.error('Failed to load model:', err);
    statusEl.textContent = `Error: ${String(err)}`;
    statusEl.className = 'status error';
  }
}

/**
 * Run AI analysis
 */
async function analyze() {
  if (handCards.length === 0) {
    alert('Please select at least one card for your hand');
    return;
  }

  const resultEl = document.getElementById('result');
  const recCardsEl = document.getElementById('recommendation-cards');
  const declareEl = document.getElementById('declare-warning');
  const optionsEl = document.getElementById('options');

  // Parse cards
  const hand = handCards.map(c => Card.parse(c.notation));
  const trickToBeat = trickCards.length > 0 ? trickCards.map(c => Card.parse(c.notation)) : null;

  // Generate valid plays using complete rules
  const validPlays = window.GangOfFourRules.getValidPlays(hand, trickToBeat);

  // Check if only PASS is available (when following)
  const hasOnlyPass = validPlays.length === 1 && validPlays[0].length === 0;
  if (validPlays.length === 0 || hasOnlyPass) {
    renderCardsInElement(recCardsEl, null, true);
    declareEl.style.display = 'none';
    optionsEl.innerHTML = '<div class="option"><span>No valid plays - must PASS</span></div>';
    resultEl.classList.add('visible');
    return;
  }

  // Encode state
  const { state, orderedPlays } = encoder.encodeSimple(
    hand,
    validPlays,
    !trickToBeat || trickToBeat.length === 0,
    trickToBeat
  );

  // Prepare tensors
  const stateTensor = new ort.Tensor('float32', state, [1, INPUT_DIM]);
  const maskData = state.slice(ACTION_MASK_OFFSET, ACTION_MASK_OFFSET + MAX_ACTIONS);
  const maskTensor = new ort.Tensor('float32', maskData, [1, MAX_ACTIONS]);

  try {
    const results = await session.run({
      state: stateTensor,
      action_mask: maskTensor
    });

    const logits = Array.from(results.action_logits.data);
    const declareProb = results.declare_prob.data[0];

    // Find best action
    let bestIdx = 0;
    let bestLogit = logits[0];
    for (let i = 1; i < orderedPlays.length; i++) {
      if (logits[i] > bestLogit) {
        bestLogit = logits[i];
        bestIdx = i;
      }
    }

    const bestPlay = decodeAction(bestIdx, orderedPlays);

    // Convert to card data for display
    const bestPlayData = bestPlay ? bestPlay.map(card => {
      const notation = card.toString();
      return handCards.find(c => c.notation === notation) || { notation, rank: card.rank, color: notation.slice(-1) };
    }) : null;

    renderCardsInElement(recCardsEl, bestPlayData, true);
    declareEl.style.display = declareProb > 0.5 ? 'block' : 'none';

    // Calculate probabilities
    const probs = softmax(logits.slice(0, orderedPlays.length));

    // Sort by probability
    const playsWithProbs = orderedPlays.map((play, i) => ({
      play,
      prob: probs[i],
      idx: i
    }));
    playsWithProbs.sort((a, b) => b.prob - a.prob);

    // Render options
    optionsEl.innerHTML = '';
    for (const { play, prob, idx } of playsWithProbs.slice(0, 8)) {
      const optionDiv = document.createElement('div');
      optionDiv.className = `option${idx === bestIdx ? ' best' : ''}`;

      const cardsDiv = document.createElement('div');
      cardsDiv.className = 'option-cards';

      if (!play || play.length === 0) {
        cardsDiv.innerHTML = '<span style="color: var(--text-muted);">PASS</span>';
      } else {
        for (const card of play) {
          const notation = card.toString();
          const cardData = handCards.find(c => c.notation === notation) || { notation, rank: card.rank, color: notation.slice(-1) };
          cardsDiv.appendChild(createCardElement(cardData));
        }
      }

      const probSpan = document.createElement('span');
      probSpan.className = 'option-prob';
      probSpan.textContent = `${(prob * 100).toFixed(1)}%`;

      optionDiv.appendChild(cardsDiv);
      optionDiv.appendChild(probSpan);
      optionsEl.appendChild(optionDiv);
    }

    resultEl.classList.add('visible');

  } catch (err) {
    console.error('Inference error:', err);
    alert(`Error running model: ${err.message}`);
  }
}

/**
 * Initialize app on DOM ready
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing app...');
  initCards();
  console.log('Cards initialized:', ALL_CARDS.length);
  renderCardPicker();
  console.log('Card picker rendered');
  loadModel();
});
