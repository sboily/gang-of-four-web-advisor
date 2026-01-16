/**
 * Gang of Four Game Rules
 * Complete valid plays generation with all combination types
 */
(function() {
  // Combination types
  const CombinationType = {
    SINGLE: 'single',
    PAIR: 'pair',
    THREE_OF_A_KIND: 'three_of_a_kind',
    STRAIGHT: 'straight',
    FLUSH: 'flush',
    FULL_HOUSE: 'full_house',
    STRAIGHT_FLUSH: 'straight_flush',
    GANG_OF_FOUR: 'gang_of_four',
    GANG_OF_FIVE: 'gang_of_five',
    GANG_OF_SIX: 'gang_of_six',
    GANG_OF_SEVEN: 'gang_of_seven'
  };

  const GANG_TYPES = new Set([
    CombinationType.GANG_OF_FOUR,
    CombinationType.GANG_OF_FIVE,
    CombinationType.GANG_OF_SIX,
    CombinationType.GANG_OF_SEVEN
  ]);

  const GANG_SIZES = {
    [CombinationType.GANG_OF_FOUR]: 4,
    [CombinationType.GANG_OF_FIVE]: 5,
    [CombinationType.GANG_OF_SIX]: 6,
    [CombinationType.GANG_OF_SEVEN]: 7
  };

  // Card types (from encoder.js)
  const CardType = { NUMBER: 0, PHOENIX: 1, DRAGON: 2 };
  const Color = { MULTI: 0, GREEN: 1, YELLOW: 2, RED: 3 };

  /**
   * Combination class
   */
  class Combination {
    constructor(cards, comboType, rankValue, colorValue) {
      this.cards = cards;
      this.comboType = comboType;
      this.rankValue = rankValue;
      this.colorValue = colorValue;
    }

    beats(other) {
      // Same cards can't beat
      if (this._sameCards(other)) return false;

      // Gang beats everything
      if (GANG_TYPES.has(this.comboType)) {
        if (GANG_TYPES.has(other.comboType)) {
          return this._compareGangs(other);
        }
        return true;
      }

      // Can't beat a gang with non-gang
      if (GANG_TYPES.has(other.comboType)) return false;

      // Must be same number of cards
      if (this.cards.length !== other.cards.length) return false;

      // Must be same combination type
      if (this.comboType !== other.comboType) return false;

      // Compare by rank, then color
      if (this.rankValue !== other.rankValue) {
        return this.rankValue > other.rankValue;
      }
      return this.colorValue > other.colorValue;
    }

    _sameCards(other) {
      if (this.cards.length !== other.cards.length) return false;
      const thisIds = this.cards.map(c => `${c.rank}-${c.color}-${c.cardType}`).sort();
      const otherIds = other.cards.map(c => `${c.rank}-${c.color}-${c.cardType}`).sort();
      return thisIds.every((id, i) => id === otherIds[i]);
    }

    _compareGangs(other) {
      const mySize = GANG_SIZES[this.comboType];
      const otherSize = GANG_SIZES[other.comboType];

      if (mySize !== otherSize) return mySize > otherSize;
      if (this.rankValue !== other.rankValue) return this.rankValue > other.rankValue;
      return this.colorValue > other.colorValue;
    }
  }

  /**
   * Detect combination from cards
   */
  function detectCombination(cards) {
    if (!cards || cards.length === 0) return null;

    const sorted = [...cards].sort((a, b) => a.rank - b.rank || a.color - b.color);
    const n = sorted.length;

    if (n === 1) return detectSingle(sorted);
    if (n === 2) return detectPair(sorted);
    if (n === 3) return detectThreeOfAKind(sorted);
    if (n === 4) return detectGangOfFour(sorted);
    if (n === 5) {
      const gang = detectGang(sorted, 5);
      if (gang) return gang;
      return detectFiveCard(sorted);
    }
    if (n === 6) return detectGang(sorted, 6);
    if (n === 7) return detectGang(sorted, 7);

    return null;
  }

  function detectSingle(cards) {
    const card = cards[0];
    return new Combination(cards, CombinationType.SINGLE, card.rank, card.color);
  }

  function detectPair(cards) {
    const [c1, c2] = cards;

    // Dragon cannot be in pairs
    if (c1.cardType === CardType.DRAGON || c2.cardType === CardType.DRAGON) {
      return null;
    }

    // Both Phoenix = valid pair
    if (c1.cardType === CardType.PHOENIX && c2.cardType === CardType.PHOENIX) {
      return new Combination(cards, CombinationType.PAIR, c2.rank, c2.color);
    }

    // Same rank numbers
    const bothNumbers = c1.cardType === CardType.NUMBER && c2.cardType === CardType.NUMBER;
    if (c1.rank === c2.rank && bothNumbers) {
      return new Combination(cards, CombinationType.PAIR, c1.rank, Math.max(c1.color, c2.color));
    }

    return null;
  }

  function detectThreeOfAKind(cards) {
    if (!cards.every(c => c.cardType === CardType.NUMBER)) return null;

    const ranks = cards.map(c => c.rank);
    if (new Set(ranks).size !== 1) return null;

    return new Combination(
      cards,
      CombinationType.THREE_OF_A_KIND,
      cards[0].rank,
      Math.max(...cards.map(c => c.color))
    );
  }

  function detectGangOfFour(cards) {
    if (!cards.every(c => c.cardType === CardType.NUMBER)) return null;

    const ranks = cards.map(c => c.rank);
    if (new Set(ranks).size !== 1) return null;

    return new Combination(
      cards,
      CombinationType.GANG_OF_FOUR,
      cards[0].rank,
      Math.max(...cards.map(c => c.color))
    );
  }

  function detectGang(cards, size) {
    if (!cards.every(c => c.cardType === CardType.NUMBER)) return null;

    const ranks = cards.map(c => c.rank);
    if (new Set(ranks).size !== 1) return null;

    const rank = cards[0].rank;

    // Gang of 7 only possible with 1s
    if (size === 7 && rank !== 1) return null;

    const comboTypes = {
      5: CombinationType.GANG_OF_FIVE,
      6: CombinationType.GANG_OF_SIX,
      7: CombinationType.GANG_OF_SEVEN
    };

    return new Combination(
      cards,
      comboTypes[size],
      rank,
      Math.max(...cards.map(c => c.color))
    );
  }

  function detectFiveCard(cards) {
    if (cards.some(c => c.cardType === CardType.DRAGON)) return null;

    const hasPhoenix = cards.some(c => c.cardType === CardType.PHOENIX);

    // Check full house first
    const fullHouse = detectFullHouse(cards);
    if (fullHouse) return fullHouse;

    // Phoenix cannot be in straight, flush, or straight flush
    if (hasPhoenix) return null;

    const isStraight = checkStraight(cards);
    const isFlush = checkFlush(cards);

    const highest = cards.reduce((max, c) =>
      (c.rank > max.rank || (c.rank === max.rank && c.color > max.color)) ? c : max
    );

    if (isStraight && isFlush) {
      return new Combination(cards, CombinationType.STRAIGHT_FLUSH, highest.rank, getFlushColorValue(cards));
    }

    if (isFlush) {
      return new Combination(cards, CombinationType.FLUSH, highest.rank, getFlushColorValue(cards));
    }

    if (isStraight) {
      return new Combination(cards, CombinationType.STRAIGHT, highest.rank, highest.color);
    }

    return null;
  }

  function checkStraight(cards) {
    const ranks = [...cards.map(c => c.rank)].sort((a, b) => a - b);
    for (let i = 1; i < ranks.length; i++) {
      if (ranks[i] !== ranks[i - 1] + 1) return false;
    }
    return true;
  }

  function checkFlush(cards) {
    const colors = cards.filter(c => c.color !== Color.MULTI).map(c => c.color);
    if (colors.length === 0) return true;
    return new Set(colors).size === 1;
  }

  function getFlushColorValue(cards) {
    for (const card of cards) {
      if (card.color !== Color.MULTI) return card.color;
    }
    return Color.RED;
  }

  function detectFullHouse(cards) {
    const phoenixCards = cards.filter(c => c.cardType === CardType.PHOENIX);
    const numberCards = cards.filter(c => c.cardType === CardType.NUMBER);

    const rankCounts = {};
    for (const c of numberCards) {
      rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
    }

    const counts = Object.values(rankCounts).sort((a, b) => b - a);

    // 3 + 2 (all numbers)
    if (phoenixCards.length === 0 && counts[0] === 3 && counts[1] === 2) {
      const threeRank = parseInt(Object.keys(rankCounts).find(r => rankCounts[r] === 3));
      const threeCards = numberCards.filter(c => c.rank === threeRank);
      return new Combination(
        cards,
        CombinationType.FULL_HOUSE,
        threeRank,
        Math.max(...threeCards.map(c => c.color))
      );
    }

    // 3 + 2 Phoenix
    if (phoenixCards.length === 2 && counts[0] === 3) {
      const threeRank = parseInt(Object.keys(rankCounts)[0]);
      return new Combination(
        cards,
        CombinationType.FULL_HOUSE,
        threeRank,
        Math.max(...numberCards.map(c => c.color))
      );
    }

    return null;
  }

  /**
   * Get all combinations for k cards from array
   */
  function* combinations(arr, k) {
    if (k === 0) { yield []; return; }
    if (k > arr.length) return;

    for (let i = 0; i <= arr.length - k; i++) {
      for (const combo of combinations(arr.slice(i + 1), k - 1)) {
        yield [arr[i], ...combo];
      }
    }
  }

  /**
   * Get all valid combinations from a hand
   */
  function getAllCombinations(hand) {
    const allCombos = [];

    // Singles
    for (const card of hand) {
      allCombos.push([card]);
    }

    // 2 to 7 cards
    for (let size = 2; size <= Math.min(7, hand.length); size++) {
      for (const comboCards of combinations(hand, size)) {
        const combo = detectCombination(comboCards);
        if (combo) {
          allCombos.push(comboCards);
        }
      }
    }

    return allCombos;
  }

  /**
   * Get valid plays given hand and trick to beat
   */
  function getValidPlays(hand, trickToBeat = null) {
    const validPlays = [];

    // Leading: can play any valid combination
    if (!trickToBeat || trickToBeat.length === 0) {
      return getAllCombinations(hand);
    }

    // Following: must beat the trick (or pass)
    const trickCombo = detectCombination(trickToBeat);
    if (!trickCombo) {
      return [[]]; // Invalid trick, can only pass
    }

    const trickSize = trickToBeat.length;

    // Try combinations of same size
    for (const comboCards of combinations(hand, trickSize)) {
      const combo = detectCombination(comboCards);
      if (combo && combo.beats(trickCombo)) {
        validPlays.push(comboCards);
      }
    }

    // Gang of Four+ can beat anything
    for (let size = 4; size <= Math.min(7, hand.length); size++) {
      if (size === trickSize) continue;
      for (const comboCards of combinations(hand, size)) {
        const combo = detectCombination(comboCards);
        if (combo && combo.beats(trickCombo)) {
          validPlays.push(comboCards);
        }
      }
    }

    // Can always pass when following
    validPlays.push([]);

    return validPlays;
  }

  /**
   * Check if play beats trick
   */
  function canBeat(play, trickToBeat) {
    const playCombo = detectCombination(play);
    const trickCombo = detectCombination(trickToBeat);
    if (!playCombo || !trickCombo) return false;
    return playCombo.beats(trickCombo);
  }

  // Export
  window.GangOfFourRules = {
    CombinationType,
    detectCombination,
    getAllCombinations,
    getValidPlays,
    canBeat
  };
})();
