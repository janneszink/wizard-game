export type Suit = 'red' | 'blue' | 'green' | 'yellow'

export type CardType = 'number' | 'wizard' | 'jester'

export type GamePhase =
  | 'setup'
  | 'trump_selection'
  | 'prediction'
  | 'playing'
  | 'round_scoring'
  | 'game_over'

export interface Card {
  id: string
  type: CardType
  suit: Suit | null
  value: number | null
}

export interface Player {
  id: string
  name: string
  hand: Card[]
  prediction: number | null
  tricks_won: number
  score: number
}

export interface PlayedCard {
  player_id: string
  card: Card
}

export interface RoundScore {
  player_id: string
  player_name: string
  prediction: number
  tricks_won: number
  score_change: number
  total_score: number
}

export interface GameState {
  id: string
  players: Player[]
  dealer_index: number
  current_player_index: number
  round_number: number
  max_rounds: number
  phase: GamePhase
  deck: Card[]
  trump_card: Card | null
  trump_suit: Suit | null
  current_trick: PlayedCard[]
  completed_tricks: PlayedCard[][]
  variant_plus_minus_one: boolean
  round_scores: RoundScore[]
  log: string[]
}
