/**
 * Gang of Four Game Encoder
 * Port of game_utils.py to JavaScript
 */
(function() {
  // Card colors
  const Color = {
    MULTI: 0,
    GREEN: 1,
    YELLOW: 2,
    RED: 3
  };

  // Card types
  const CardType = {
    NUMBER: 0,
    PHOENIX: 1,
    DRAGON: 2
  };

  // Constants
  const INPUT_DIM = 328;
  const MAX_ACTIONS = 40;
  const HAND_OFFSET = 0;
  const PLAYED_OFFSET = 64;
  const TRICK_OFFSET = 128;
  const OPPONENT_OFFSET = 192;
  const ACTION_MASK_OFFSET = 256;
  const CONTEXT_OFFSET = 296;

  /**
   * Card class
   */
  class Card {
    constructor(cardType, color, rank) {
      this.cardType = cardType;
      this.color = color;
      this.rank = rank;
    }

    toString() {
      if (this.cardType === CardType.DRAGON) return "Dragon";
      if (this.cardType === CardType.PHOENIX) {
        return this.color === Color.GREEN ? "PhoenixG" : "PhoenixY";
      }
      if (this.color === Color.MULTI) return "1M";
      const colorChar = { [Color.GREEN]: "G", [Color.YELLOW]: "Y", [Color.RED]: "R" }[this.color];
      return `${this.rank}${colorChar}`;
    }

    static parse(s) {
      s = s.trim();
      const upper = s.toUpperCase();

      if (upper === "DRAGON" || upper === "D") {
        return new Card(CardType.DRAGON, Color.GREEN, 12);
      }
      if (upper === "PHOENIXG" || upper === "PG") {
        return new Card(CardType.PHOENIX, Color.GREEN, 11);
      }
      if (upper === "PHOENIXY" || upper === "PY") {
        return new Card(CardType.PHOENIX, Color.YELLOW, 11);
      }
      if (upper === "1M" || upper === "M1") {
        return new Card(CardType.NUMBER, Color.MULTI, 1);
      }

      const colorMap = { "G": Color.GREEN, "Y": Color.YELLOW, "R": Color.RED };

      if (s.length >= 2) {
        const colorChar = s[s.length - 1].toUpperCase();
        const rankStr = s.slice(0, -1);

        if (colorMap[colorChar] !== undefined && /^\d+$/.test(rankStr)) {
          const rank = parseInt(rankStr);
          if (rank >= 1 && rank <= 10) {
            return new Card(CardType.NUMBER, colorMap[colorChar], rank);
          }
        }
      }

      throw new Error(`Cannot parse card: ${s}`);
    }

    static parseHand(s) {
      return s.split(/\s+/).filter(p => p).map(p => Card.parse(p));
    }
  }

  function cardToIndex(card, copy = 0) {
    if (card.cardType === CardType.DRAGON) return 63;
    if (card.cardType === CardType.PHOENIX) {
      return card.color === Color.GREEN ? 61 : 62;
    }
    if (card.color === Color.MULTI) return 60;
    const colorIdx = card.color - 1;
    return (card.rank - 1) * 6 + colorIdx * 2 + copy;
  }

  function orderValidPlays(validPlays) {
    const ordered = [null];
    const nonPass = validPlays.filter(p => p && p.length > 0);

    nonPass.sort((a, b) => {
      if (a.length !== b.length) return a.length - b.length;
      const sumRankA = a.reduce((s, c) => s + c.rank, 0);
      const sumRankB = b.reduce((s, c) => s + c.rank, 0);
      if (sumRankA !== sumRankB) return sumRankA - sumRankB;
      const sumColorA = a.reduce((s, c) => s + c.color, 0);
      const sumColorB = b.reduce((s, c) => s + c.color, 0);
      return sumColorA - sumColorB;
    });

    ordered.push(...nonPass);
    return ordered.slice(0, MAX_ACTIONS);
  }

  class GameEncoder {
    encodeCards(cards) {
      const vec = new Float32Array(64);
      const copyCounts = new Map();

      for (const card of cards) {
        const key = `${card.cardType}-${card.color}-${card.rank}`;
        const copyIdx = copyCounts.get(key) || 0;
        const idx = cardToIndex(card, Math.min(copyIdx, 1));
        vec[idx] += 0.5;
        copyCounts.set(key, copyIdx + 1);
      }

      for (let i = 0; i < 64; i++) {
        vec[i] = Math.min(Math.max(vec[i], 0), 1);
      }
      return vec;
    }

    encodeCardsBinary(cards) {
      const vec = new Float32Array(64);
      const copyCounts = new Map();

      for (const card of cards) {
        const key = `${card.cardType}-${card.color}-${card.rank}`;
        const copyIdx = copyCounts.get(key) || 0;
        const idx = cardToIndex(card, Math.min(copyIdx, 1));
        vec[idx] = 1.0;
        copyCounts.set(key, copyIdx + 1);
      }
      return vec;
    }

    encodeSimple(hand, validPlays, isLeading = true, trickCards = null, playedCards = null, opponentHandSizes = [16, 16, 16]) {
      const state = new Float32Array(INPUT_DIM);

      const handVec = this.encodeCards(hand);
      state.set(handVec, HAND_OFFSET);

      if (playedCards && playedCards.length > 0) {
        const playedVec = this.encodeCardsBinary(playedCards);
        state.set(playedVec, PLAYED_OFFSET);
      }

      if (trickCards && trickCards.length > 0) {
        const trickVec = this.encodeCardsBinary(trickCards);
        state.set(trickVec, TRICK_OFFSET);
      }

      if (playedCards) {
        const allCards = new Float32Array(64).fill(1);
        const handBinary = this.encodeCardsBinary(hand);
        const playedBinary = this.encodeCardsBinary(playedCards);

        for (let i = 0; i < 64; i++) {
          state[OPPONENT_OFFSET + i] = Math.max(0, Math.min(1, allCards[i] - handBinary[i] - playedBinary[i]));
        }
      }

      const orderedPlays = orderValidPlays(validPlays);
      for (let i = 0; i < orderedPlays.length; i++) {
        state[ACTION_MASK_OFFSET + i] = 1.0;
      }

      const handSize = hand.length;
      state[CONTEXT_OFFSET + 0] = handSize / 16.0;
      for (let i = 0; i < 3; i++) {
        state[CONTEXT_OFFSET + 1 + i] = opponentHandSizes[i] / 16.0;
      }
      state[CONTEXT_OFFSET + 12] = isLeading ? 1.0 : 0.0;
      state[CONTEXT_OFFSET + 20] = handSize / 16.0;

      return { state, orderedPlays };
    }
  }

  function getValidPlaysForHand(hand, trickToBeat = null) {
    const validPlays = [[]];

    if (!trickToBeat || trickToBeat.length === 0) {
      for (const card of hand) {
        validPlays.push([card]);
      }

      for (let i = 0; i < hand.length; i++) {
        for (let j = i + 1; j < hand.length; j++) {
          if (hand[i].rank === hand[j].rank && hand[i].cardType === hand[j].cardType) {
            validPlays.push([hand[i], hand[j]]);
          }
        }
      }

      const ranks = new Map();
      for (const card of hand) {
        const key = `${card.rank}-${card.cardType}`;
        if (!ranks.has(key)) ranks.set(key, []);
        ranks.get(key).push(card);
      }
      for (const cards of ranks.values()) {
        if (cards.length >= 3) {
          validPlays.push(cards.slice(0, 3));
        }
      }
    } else {
      const trickLen = trickToBeat.length;
      const trickRank = Math.max(...trickToBeat.map(c => c.rank));

      if (trickLen === 1) {
        for (const card of hand) {
          if (card.rank > trickRank) {
            validPlays.push([card]);
          }
        }
      } else if (trickLen === 2) {
        for (let i = 0; i < hand.length; i++) {
          for (let j = i + 1; j < hand.length; j++) {
            if (hand[i].rank === hand[j].rank &&
                hand[i].cardType === hand[j].cardType &&
                hand[i].rank > trickRank) {
              validPlays.push([hand[i], hand[j]]);
            }
          }
        }
      }
    }

    return validPlays;
  }

  function decodeAction(actionIdx, orderedPlays) {
    if (actionIdx === 0) return null;
    if (actionIdx >= orderedPlays.length) return null;
    return orderedPlays[actionIdx];
  }

  function formatPlay(play) {
    if (!play || play.length === 0) return "PASS";
    return play.map(c => c.toString()).join(" ");
  }

  function softmax(logits) {
    const maxLogit = Math.max(...logits);
    const exps = logits.map(x => Math.exp(x - maxLogit));
    const sumExps = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / sumExps);
  }

  // Export to window
  window.GangOfFour = {
    Card,
    GameEncoder,
    getValidPlaysForHand,
    decodeAction,
    formatPlay,
    softmax,
    INPUT_DIM,
    MAX_ACTIONS,
    ACTION_MASK_OFFSET
  };
})();
