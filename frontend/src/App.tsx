import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import './App.css'
import {
  chooseTrump,
  createGame,
  deleteGame,
  nextRound,
  playCard,
  startRound,
  submitPrediction,
} from './api/client'
import type { Card, GameState, GamePhase, Player, RoundScore, Suit } from './types'

const DEFAULT_PLAYERS = ['', '', '']
const PLAYER_COUNTS = [3, 4, 5, 6]
const SUITS: Suit[] = ['red', 'blue', 'green', 'yellow']
const CHARACTER_COLORS = ['blue', 'green', 'orange', 'purple', 'red', 'yellow'] as const

type CharacterColor = (typeof CHARACTER_COLORS)[number]
type SetupCharacterColor = CharacterColor | ''

interface ScoreHistoryRound {
  roundNumber: number
  scores: RoundScore[]
}

type SeatCSSProperties = CSSProperties & {
  '--seat-x': string
  '--seat-y': string
}

type SeatZone =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

function formatLabel(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function phaseTitle(phase: GamePhase): string {
  const titles: Record<GamePhase, string> = {
    setup: 'Setup',
    trump_selection: 'Trump Selection',
    prediction: 'Prediction Round',
    playing: 'Playing Round',
    round_scoring: 'Round Scoring',
    game_over: 'Game Over',
  }

  return titles[phase]
}

function formatCard(card: Card | null): string {
  if (!card) {
    return 'None'
  }

  if (card.type === 'number') {
    return `${formatLabel(card.suit ?? 'unknown')} ${card.value ?? ''}`.trim()
  }

  return formatLabel(card.type)
}

function cardFaceText(card: Card): string {
  if (card.type === 'number') {
    return String(card.value ?? '')
  }

  return formatLabel(card.type)
}

function currentPlayer(game: GameState): Player | null {
  return game.players[game.current_player_index] ?? null
}

function playerNameById(game: GameState, playerId: string): string {
  return game.players.find((player) => player.id === playerId)?.name ?? playerId
}

function playedCardForPlayer(game: GameState, playerId: string): Card | null {
  return game.current_trick.find((playedCard) => playedCard.player_id === playerId)?.card ?? null
}

function characterImagePath(color: CharacterColor): string {
  return `/assets/character-${color}.png`
}

function hasDuplicateCharacterColors(colors: SetupCharacterColor[]): boolean {
  const selectedColors = colors.filter((color): color is CharacterColor => color !== '')
  return new Set(selectedColors).size !== selectedColors.length
}

function seatVector(index: number, total: number) {
  const angle = -90 + (360 / total) * index
  const radians = (angle * Math.PI) / 180
  return {
    directionX: Math.cos(radians),
    directionY: Math.sin(radians),
  }
}

function seatZone(index: number, total: number): SeatZone {
  const { directionX, directionY } = seatVector(index, total)

  if (directionY < -0.72) {
    if (directionX < -0.28) {
      return 'top-left'
    }

    if (directionX > 0.28) {
      return 'top-right'
    }

    return 'top'
  }

  if (directionY > 0.72) {
    if (directionX < -0.28) {
      return 'bottom-left'
    }

    if (directionX > 0.28) {
      return 'bottom-right'
    }

    return 'bottom'
  }

  return directionX < 0 ? 'left' : 'right'
}

function seatStyle(index: number, total: number): SeatCSSProperties {
  const { directionX, directionY } = seatVector(index, total)
  const x = 50 + directionX * 35
  const y = 50 + directionY * 42

  return {
    left: `${x}%`,
    top: `${y}%`,
    '--seat-x': directionX.toFixed(3),
    '--seat-y': directionY.toFixed(3),
  }
}

function finalWinners(game: GameState): Player[] {
  if (game.players.length === 0) {
    return []
  }

  const highestScore = Math.max(...game.players.map((player) => player.score))
  return game.players.filter((player) => player.score === highestScore)
}

function CardFront({ card, variant = '' }: { card: Card; variant?: string }) {
  return (
    <span
      className={`card card-front card-${card.suit ?? card.type} ${variant}`.trim()}
      aria-label={formatCard(card)}
      title={formatCard(card)}
    >
      {cardFaceText(card)}
    </span>
  )
}

function CardBack() {
  return (
    <span className="card card-back" aria-label="Face-down card">
      W
    </span>
  )
}

function CenterStatus({ game }: { game: GameState }) {
  const noTrumpMessage =
    game.round_number === game.max_rounds ? 'No trump this round' : 'No trump card'
  const trumpVariant =
    game.trump_card?.type === 'wizard' && game.trump_suit
      ? `center-trump-card wizard-trump-${game.trump_suit}`
      : 'center-trump-card'

  return (
    <div className="center-status" aria-label="Public round information">
      <div className="round-display">
        <span>Round</span>
        <strong>{game.round_number}</strong>
        <small>of {game.max_rounds}</small>
      </div>

      <div className="trump-display">
        <span>Trump Card</span>
        {game.trump_card ? (
          <div className="trump-card-glow">
            <CardFront card={game.trump_card} variant={trumpVariant} />
          </div>
        ) : (
          <strong className="no-trump-message">{noTrumpMessage}</strong>
        )}
        {game.trump_card?.type === 'wizard' && game.trump_suit && (
          <small>Chosen trump: {formatLabel(game.trump_suit)}</small>
        )}
      </div>
    </div>
  )
}

function CurrentTrick({ game }: { game: GameState }) {
  return (
    <div className="current-trick" aria-label="Current trick">
      <h3>Current Trick</h3>
      {game.current_trick.length > 0 ? (
        <div className="trick-list">
          {game.current_trick.map((playedCard) => (
            <div className="trick-card" key={playedCard.card.id}>
              <span>{playerNameById(game, playedCard.player_id)}</span>
              <CardFront card={playedCard.card} />
            </div>
          ))}
        </div>
      ) : (
        <p>No cards played yet.</p>
      )}
    </div>
  )
}

function PlayerSeat({
  game,
  player,
  index,
  characterColor,
  isCurrent,
  isRevealed,
  isLoading,
  onPlayCard,
  children,
}: {
  game: GameState
  player: Player
  index: number
  characterColor: CharacterColor
  isCurrent: boolean
  isRevealed: boolean
  isLoading: boolean
  onPlayCard: (cardId: string) => void
  children?: ReactNode
}) {
  const publicPlayedCard = playedCardForPlayer(game, player.id)
  const showCardFronts = isCurrent && isRevealed
  const showPlayableCards = showCardFronts && game.phase === 'playing'
  const handSizeClass =
    player.hand.length >= 12 ? ' extra-compact-hand' : player.hand.length >= 7 ? ' large-hand' : ''
  const zone = seatZone(index, game.players.length)

  return (
    <div
      className={`player-place seat-${zone}${isCurrent ? ' current-place' : ''}`}
      style={seatStyle(index, game.players.length)}
    >
      <div className="chair">
        <img
          className="character-image"
          src={characterImagePath(characterColor)}
          alt={`${player.name} character`}
        />
      </div>

      <div className={`player-seat${isCurrent ? ' current-seat' : ''}`}>
        {isCurrent && <div className="current-turn-badge">Current Turn</div>}

        <div className="prediction-badge">
          Prediction: {player.prediction ?? '—'}
        </div>
        <div className="seat-name">{player.name}</div>
        <div className="seat-meta">
          <span>Score {player.score}</span>
          <span>Tricks {player.tricks_won}</span>
        </div>

        {publicPlayedCard && (
          <div className="seat-played-card">
            <span>Played</span>
            <CardFront card={publicPlayedCard} />
          </div>
        )}

        <div
          className={`seat-hand${handSizeClass}`}
          aria-label={`${player.name}'s hand`}
        >
          {player.hand.map((card) =>
            showPlayableCards ? (
              <button
                type="button"
                className="card-button"
                key={card.id}
                onClick={() => onPlayCard(card.id)}
                disabled={isLoading}
              >
                <CardFront card={card} />
              </button>
            ) : showCardFronts ? (
              <CardFront card={card} key={card.id} />
            ) : (
              <CardBack key={card.id} />
            ),
          )}
        </div>

        {isCurrent && children}
      </div>
    </div>
  )
}

function ScoreTable({ game }: { game: GameState }) {
  const scores =
    game.round_scores.length > 0
      ? game.round_scores
      : game.players.map((player) => ({
          player_id: player.id,
          player_name: player.name,
          prediction: player.prediction ?? 0,
          tricks_won: player.tricks_won,
          score_change: 0,
          total_score: player.score,
        }))

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Prediction</th>
            <th>Tricks Won</th>
            <th>Score Change</th>
            <th>Total Score</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((score) => (
            <tr key={score.player_id}>
              <td>{score.player_name}</td>
              <td>{score.prediction}</td>
              <td>{score.tricks_won}</td>
              <td>
                <span
                  className={`score-change ${
                    score.score_change >= 0 ? 'score-positive' : 'score-negative'
                  }`}
                >
                  {score.score_change > 0 ? '+' : ''}
                  {score.score_change}
                </span>
              </td>
              <td>{score.total_score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CenterResultPanel({
  game,
  isLoading,
  onNextRound,
  onBackToMenu,
  playerColorById,
}: {
  game: GameState
  isLoading: boolean
  onNextRound: () => void
  onBackToMenu: () => void
  playerColorById: Record<string, CharacterColor>
}) {
  if (game.phase === 'round_scoring') {
    return (
      <div className="table-result-panel">
        <div className="section-heading scoring-heading">
          <div>
            <h2>Round Scores</h2>
            <p>Results for round {game.round_number}.</p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={onNextRound}
            disabled={isLoading}
          >
            {isLoading ? 'Advancing...' : 'Next Round'}
          </button>
        </div>
        <ScoreTable game={game} />
      </div>
    )
  }

  if (game.phase === 'game_over') {
    const winners = finalWinners(game)
    const rankedPlayers = [...game.players].sort((leftPlayer, rightPlayer) => {
      if (rightPlayer.score !== leftPlayer.score) {
        return rightPlayer.score - leftPlayer.score
      }

      return leftPlayer.name.localeCompare(rightPlayer.name)
    })
    const podiumPlayers = rankedPlayers.slice(0, 3)
    const remainingPlayers = rankedPlayers.slice(3)

    return (
      <div className="table-result-panel game-over-panel">
        <div className="section-heading">
          <h2>Game Over</h2>
          <p>
            Winner{winners.length === 1 ? '' : 's'}:{' '}
            {winners.map((winner) => winner.name).join(', ')}
          </p>
        </div>
        <div className="winner-podium" aria-label="Top three players">
          {podiumPlayers.map((player, index) => {
            const rank = index + 1
            const characterColor = playerColorById[player.id]

            return (
              <div className={`podium-card podium-rank-${rank}`} key={player.id}>
                {rank === 1 && (
                  <img className="winner-crown" src="/assets/crown.png" alt="" />
                )}
                {characterColor && (
                  <img
                    className="podium-character"
                    src={characterImagePath(characterColor)}
                    alt={`${player.name} character`}
                  />
                )}
                <span className="podium-rank">#{rank}</span>
                <strong>{player.name}</strong>
                <span>{player.score} points</span>
              </div>
            )
          })}
        </div>

        {remainingPlayers.length > 0 && (
          <div className="final-leaderboard" aria-label="Remaining player standings">
            {remainingPlayers.map((player, index) => {
              const rank = index + 4
              const characterColor = playerColorById[player.id]

              return (
                <div className="leaderboard-row" key={player.id}>
                  <span className="leaderboard-rank">#{rank}</span>
                  {characterColor && (
                    <img
                      className="leaderboard-character"
                      src={characterImagePath(characterColor)}
                      alt={`${player.name} character`}
                    />
                  )}
                  <strong>{player.name}</strong>
                  <span>{player.score} points</span>
                </div>
              )
            })}
          </div>
        )}

        <button
          type="button"
          className="primary-button back-to-menu-button"
          onClick={onBackToMenu}
          disabled={isLoading}
        >
          {isLoading ? 'Returning...' : 'Back to Menu'}
        </button>
      </div>
    )
  }

  return null
}

function Scoreboard({
  game,
  history,
  onClose,
}: {
  game: GameState
  history: ScoreHistoryRound[]
  onClose: () => void
}) {
  return (
    <div className="scoreboard-backdrop" role="dialog" aria-modal="true">
      <div className="scoreboard-panel">
        <div className="scoreboard-heading">
          <div>
            <p className="eyebrow">Scorecard</p>
            <h2>Wizard Scoreboard</h2>
          </div>
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="totals-strip">
          {game.players.map((player) => (
            <div className="total-card" key={player.id}>
              <span>{player.name}</span>
              <strong>{player.score}</strong>
            </div>
          ))}
        </div>

        <div className="scorecard-wrap">
          <table className="scorecard-table">
            <thead>
              <tr>
                <th>Round</th>
                {game.players.map((player) => (
                  <th key={player.id}>{player.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={game.players.length + 1}>No completed rounds yet.</td>
                </tr>
              ) : (
                history.map((round) => (
                  <tr key={round.roundNumber}>
                    <td>{round.roundNumber}</td>
                    {game.players.map((player) => {
                      const score = round.scores.find(
                        (roundScore) => roundScore.player_id === player.id,
                      )

                      return (
                        <td key={player.id}>
                          {score ? (
                            <span
                              className={`scorecard-cell ${
                                score.score_change >= 0 ? 'score-positive' : 'score-negative'
                              }`}
                            >
                              {score.score_change > 0 ? '+' : ''}
                              {score.score_change} / {score.total_score}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <th>Totals</th>
                {game.players.map((player) => (
                  <th key={player.id}>{player.score}</th>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

function TrumpSelectionModal({
  player,
  isRevealed,
  isLoading,
  onReveal,
  onChooseTrump,
}: {
  player: Player | null
  isRevealed: boolean
  isLoading: boolean
  onReveal: () => void
  onChooseTrump: (suit: Suit) => void
}) {
  return (
    <div className="trump-modal-backdrop" role="dialog" aria-modal="true">
      <div className="trump-modal">
        {!isRevealed ? (
          <>
            <p className="eyebrow">Trump Selection</p>
            <h2>Give device to {player?.name ?? 'the dealer'}</h2>
            <p>
              A Wizard was revealed as the trump card. The dealer must choose the trump suit.
            </p>
            <button type="button" className="primary-button" onClick={onReveal}>
              Reveal cards
            </button>
          </>
        ) : (
          <>
            <p className="eyebrow">Wizard Trump Card</p>
            <h2>
              <span>{player?.name ?? 'Dealer'}</span>, choose the trump suit
            </h2>
            <p>A Wizard was revealed as the trump card.</p>
            <div className="modal-hand" aria-label="Dealer hand">
              {player?.hand.map((card) => <CardFront card={card} key={card.id} />)}
            </div>
            <div className="modal-suit-actions">
              {SUITS.map((suit) => (
                <button
                  type="button"
                  className={`suit-button suit-${suit}`}
                  key={suit}
                  onClick={() => onChooseTrump(suit)}
                  disabled={isLoading}
                >
                  {formatLabel(suit)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function InstructionsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="instructions-backdrop" role="dialog" aria-modal="true" aria-labelledby="instructions-title">
      <div className="instructions-panel">
        <div className="instructions-heading">
          <div>
            <p className="eyebrow">Instructions</p>
            <h2 id="instructions-title">How to Play Wizard</h2>
          </div>
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="instructions-content">
          <section className="rule-section">
            <h3>Objective</h3>
            <p>
              Wizard is a trick-taking card game. Each player is an apprentice trying to
              predict exactly how many tricks they will win in each round. Correct
              predictions earn points. The player with the most points at the end of the
              final round wins.
            </p>
          </section>

          <section className="rule-section">
            <h3>Round Flow</h3>
            <p>Each round has four phases:</p>
            <h4>1. Dealing Cards</h4>
            <p>
              Each player receives cards equal to the round number. In round 1, each player
              receives 1 card. In round 2, each player receives 2 cards, and so on.
            </p>
            <h4>2. Determining Trump</h4>
            <p>After dealing, one card is revealed from the remaining deck.</p>
            <ul>
              <li>If the revealed card is a number card, its color becomes trump.</li>
              <li>If the revealed card is a Wizard, the dealer chooses the trump color.</li>
              <li>If the revealed card is a Jester, there is no trump color.</li>
              <li>In the final round, there is no trump because all cards are dealt.</li>
            </ul>
            <h4>3. Predicting Tricks</h4>
            <p>
              Players look at their cards and predict how many tricks they think they will
              win that round. Predictions are public and remain visible during the round.
            </p>
            <h4>4. Playing Tricks</h4>
            <p>
              Players take turns playing one card each. The cards played together form one
              trick.
            </p>
          </section>

          <section className="rule-section">
            <h3>Playing Cards</h3>
            <p>The first player in a trick may play any card.</p>
            <p>
              After the first card is played, other players must follow the first color
              played if they can. For example, if the first colored card is blue, players
              with blue cards must play blue.
            </p>
            <p>
              A player may only play a different color or a trump card if they do not have
              the required color.
            </p>
            <p>
              Wizards and Jesters are special. They can be played at any time, even if the
              player could follow suit.
            </p>
          </section>

          <section className="rule-section">
            <h3>Winning a Trick</h3>
            <p>A trick is won according to these rules:</p>
            <ol>
              <li>The first Wizard played wins the trick.</li>
              <li>If no Wizard is played, the highest card in the trump color wins.</li>
              <li>
                If there is no Wizard and no trump card, the highest card in the first
                played color wins.
              </li>
              <li>If only Jesters are played, the first Jester wins.</li>
            </ol>
            <p>The winner of a trick starts the next trick.</p>
          </section>

          <section className="rule-section">
            <h3>Wizards</h3>
            <p>
              A Wizard can be played at any time. If a Wizard is played, the first Wizard in
              the trick wins.
            </p>
            <p>If a Wizard is the first card of a trick, the other players may play any card.</p>
          </section>

          <section className="rule-section">
            <h3>Jesters</h3>
            <p>A Jester can be played at any time. Jesters usually lose.</p>
            <p>
              If a Jester is the first card of a trick, the next colored number card
              determines the color that must be followed. If only Jesters are played, the
              first Jester wins.
            </p>
          </section>

          <section className="rule-section">
            <h3>Scoring</h3>
            <p>At the end of each round, scores are calculated.</p>
            <p><strong>If your prediction was correct:</strong></p>
            <p>You score 20 points plus 10 points for each trick you won.</p>
            <p><strong>Example:</strong></p>
            <p>Prediction: 2 tricks<br />Tricks won: 2<br />Score: 20 + 10 + 10 = 40 points</p>
            <p><strong>If your prediction was wrong:</strong></p>
            <p>
              You lose 10 points for each trick difference between your prediction and your
              actual tricks won.
            </p>
            <p><strong>Example:</strong></p>
            <p>Prediction: 2 tricks<br />Tricks won: 1<br />Score: -10 points</p>
          </section>

          <section className="rule-section">
            <h3>End of the Game</h3>
            <p>The game ends after the final round.</p>
            <p>Number of rounds:</p>
            <ul>
              <li>3 players: 20 rounds</li>
              <li>4 players: 15 rounds</li>
              <li>5 players: 12 rounds</li>
              <li>6 players: 10 rounds</li>
            </ul>
            <p>
              The player with the highest total score wins. If multiple players share the
              highest score, they all win.
            </p>
          </section>

          <section className="rule-section">
            <h3>Plus/Minus One Variant</h3>
            <p>
              When this variant is enabled, the total number of predicted tricks may not
              equal the number of tricks available in the round.
            </p>
            <p><strong>Example:</strong></p>
            <p>
              In round 5, there are 5 tricks available. The total of all predictions cannot
              be exactly 5. It must be higher or lower.
            </p>
          </section>

          <section className="rule-section">
            <h3>Pass-and-Play Mode</h3>
            <p>This digital version is designed for one shared device.</p>
            <p>When it is your turn:</p>
            <ol>
              <li>Take the device.</li>
              <li>Tap “Reveal cards.”</li>
              <li>Make your prediction or play your card.</li>
              <li>Pass the device to the next player.</li>
            </ol>
            <p>
              Only the current player can reveal their hand. Predictions, played cards,
              scores, trump, and the current trick are public information.
            </p>
          </section>
        </div>

        <a
          className="pdf-button"
          href="/assets/wizard-rules.pdf"
          target="_blank"
          rel="noreferrer"
        >
          Open Full Rulebook PDF
        </a>
      </div>
    </div>
  )
}

function App() {
  const [playerNames, setPlayerNames] = useState(DEFAULT_PLAYERS)
  const [playerCharacterColors, setPlayerCharacterColors] = useState<SetupCharacterColor[]>(
    Array.from({ length: DEFAULT_PLAYERS.length }, () => ''),
  )
  const [playerColorById, setPlayerColorById] = useState<Record<string, CharacterColor>>({})
  const [variantPlusMinusOne, setVariantPlusMinusOne] = useState(false)
  const [game, setGame] = useState<GameState | null>(null)
  const [predictionInput, setPredictionInput] = useState('0')
  const [revealedPlayerId, setRevealedPlayerId] = useState<string | null>(null)
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryRound[]>([])
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false)
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activePlayer = game ? currentPlayer(game) : null
  const isActionRevealed = Boolean(activePlayer && revealedPlayerId === activePlayer.id)

  useEffect(() => {
    if (!error) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => setError(null), 2000)
    return () => window.clearTimeout(timeoutId)
  }, [error])

  useEffect(() => {
    if (
      !game ||
      !['round_scoring', 'game_over'].includes(game.phase) ||
      game.round_scores.length === 0
    ) {
      return
    }

    setScoreHistory((current) => {
      if (current.some((round) => round.roundNumber === game.round_number)) {
        return current
      }

      return [
        ...current,
        {
          roundNumber: game.round_number,
          scores: game.round_scores,
        },
      ]
    })
  }, [game])

  function updatePlayerName(index: number, value: string) {
    setPlayerNames((current) =>
      current.map((name, playerIndex) => (playerIndex === index ? value : name)),
    )
  }

  function updatePlayerCharacterColor(index: number, value: SetupCharacterColor) {
    setPlayerCharacterColors((current) =>
      current.map((color, playerIndex) => (playerIndex === index ? value : color)),
    )
  }

  function updatePlayerCount(count: number) {
    setPlayerNames((current) => {
      if (count > current.length) {
        return [...current, ...Array.from({ length: count - current.length }, () => '')]
      }

      return current.slice(0, count)
    })

    setPlayerCharacterColors((current) => {
      if (count > current.length) {
        return [
          ...current,
          ...Array.from(
            { length: count - current.length },
            (): SetupCharacterColor => '',
          ),
        ]
      }

      return current.slice(0, count)
    })
  }

  async function runAction(
    action: () => Promise<GameState>,
    onSuccess?: (updatedGame: GameState) => void,
  ) {
    setIsLoading(true)
    setError(null)

    try {
      const updatedGame = await action()
      setGame(updatedGame)
      setRevealedPlayerId(null)
      onSuccess?.(updatedGame)
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Something went wrong.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleCreateGame() {
    const hasEmptyName = playerNames.some((name) => name.trim() === '')
    const hasMissingColor = playerCharacterColors.some((color) => color === '')
    const hasDuplicateColor = hasDuplicateCharacterColors(playerCharacterColors)

    if (hasEmptyName) {
      setError('Please enter a name for every player.')
      return
    }

    if (hasMissingColor) {
      setError('Please choose a character color for every player.')
      return
    }

    if (hasDuplicateColor) {
      setError('Each player must choose a different character color.')
      return
    }

    const selectedColors = playerCharacterColors as CharacterColor[]
    const names = playerNames.map((name) => name.trim())

    void runAction(() => createGame(names, variantPlusMinusOne), (createdGame) => {
      const colorById = Object.fromEntries(
        createdGame.players.map((player, index) => [player.id, selectedColors[index]]),
      )

      setPlayerColorById(colorById)
      setScoreHistory([])
      setIsScoreboardOpen(false)
    })
  }

  function handleStartRound() {
    if (!game) {
      return
    }

    void runAction(() => startRound(game.id))
  }

  function handleNextRound() {
    if (!game) {
      return
    }

    void runAction(() => nextRound(game.id), () => setPredictionInput('0'))
  }

  function handleChooseTrump(suit: Suit) {
    if (!game) {
      return
    }

    void runAction(() => chooseTrump(game.id, suit))
  }

  function handleSubmitPrediction() {
    if (!game || !activePlayer) {
      return
    }

    const prediction = Number(predictionInput)

    void runAction(
      () => submitPrediction(game.id, activePlayer.id, prediction),
      () => setPredictionInput('0'),
    )
  }

  function handlePlayCard(cardId: string) {
    if (!game || !activePlayer) {
      return
    }

    void runAction(() => playCard(game.id, activePlayer.id, cardId))
  }

  function resetGameState(message?: string) {
    setGame(null)
    setPlayerColorById({})
    setRevealedPlayerId(null)
    setScoreHistory([])
    setIsScoreboardOpen(false)
    setPredictionInput('0')
    setIsLoading(false)
    setError(message ?? null)
  }

  async function handleEndGame() {
    if (!game) {
      return
    }

    const gameId = game.id

    setIsLoading(true)
    setError(null)

    try {
      await deleteGame(gameId)
      resetGameState()
    } catch {
      resetGameState('The local game was closed, but the backend delete request failed.')
    }
  }

  function revealCurrentPlayer() {
    if (activePlayer) {
      setError(null)
      setRevealedPlayerId(activePlayer.id)
    }
  }

  function renderCurrentSeatAction() {
    if (!game || !activePlayer) {
      return null
    }

    if (!['prediction', 'playing'].includes(game.phase)) {
      return null
    }

    if (!isActionRevealed) {
      return (
        <div className="seat-action pass-action">
          <strong>Give device to {activePlayer.name}</strong>
          <button type="button" className="primary-button" onClick={revealCurrentPlayer}>
            Reveal cards
          </button>
        </div>
      )
    }

    if (game.phase === 'prediction') {
      return (
        <div className="seat-action">
          <strong>Make your prediction</strong>
          <div className="prediction-controls">
            <label className="prediction-input">
              <span>Prediction</span>
              <input
                type="number"
                min={0}
                max={game.round_number}
                value={predictionInput}
                onChange={(event) => setPredictionInput(event.target.value)}
                disabled={isLoading}
              />
            </label>
            <button
              type="button"
              className="primary-button"
              onClick={handleSubmitPrediction}
              disabled={isLoading || predictionInput === ''}
            >
              {isLoading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="seat-action">
        <strong>Play a card</strong>
      </div>
    )
  }

  if (!game) {
    return (
      <main className="app-shell menu-shell">
        {error && <div className="error-toast" role="alert">{error}</div>}

        <button
          type="button"
          className="secondary-button instructions-button"
          onClick={() => setIsInstructionsOpen(true)}
        >
          Instructions
        </button>

        <section className="menu-card" aria-labelledby="setup-title">
          <div className="menu-heading">
            <p className="eyebrow">Pass-and-play digital card game</p>
            <img
              id="setup-title"
              className="menu-logo"
              src="/assets/wizard-logo.png"
              alt="Wizard"
            />
          </div>

          <label className="player-count">
            <span>Number of players</span>
            <select
              value={playerNames.length}
              onChange={(event) => updatePlayerCount(Number(event.target.value))}
              disabled={isLoading}
            >
              {PLAYER_COUNTS.map((count) => (
                <option value={count} key={count}>
                  {count} players
                </option>
              ))}
            </select>
          </label>

          <div className="player-inputs">
            {playerNames.map((name, index) => {
              const selectedColor = playerCharacterColors[index] ?? ''

              return (
                <div className="player-input" key={`player-${index + 1}`}>
                  <span>Player {index + 1}</span>
                  <div className="setup-player-row">
                    <input
                      value={name}
                      placeholder={`Player ${index + 1}`}
                      onChange={(event) => updatePlayerName(index, event.target.value)}
                      disabled={isLoading}
                      aria-label={`Player ${index + 1} name`}
                    />
                    <label className="character-select">
                      <span>Character</span>
                      <select
                        value={selectedColor}
                        onChange={(event) =>
                          updatePlayerCharacterColor(
                            index,
                            event.target.value as SetupCharacterColor,
                          )
                        }
                        disabled={isLoading}
                        aria-label={`Player ${index + 1} character color`}
                      >
                        <option value="">Choose</option>
                        {CHARACTER_COLORS.map((color) => {
                          const isTaken = playerCharacterColors.some(
                            (playerColor, playerIndex) =>
                              playerIndex !== index && playerColor === color,
                          )

                          return (
                            <option value={color} disabled={isTaken} key={color}>
                              {formatLabel(color)}
                            </option>
                          )
                        })}
                      </select>
                    </label>
                    <div className="character-preview" aria-hidden="true">
                      {selectedColor ? (
                        <img src={characterImagePath(selectedColor)} alt="" />
                      ) : (
                        <span>?</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={variantPlusMinusOne}
              onChange={(event) => setVariantPlusMinusOne(event.target.checked)}
              disabled={isLoading}
            />
            Plus/minus one variant
          </label>

          <button
            type="button"
            className="primary-button start-game-button"
            onClick={handleCreateGame}
            disabled={isLoading}
          >
            {isLoading ? 'Starting...' : 'Start Game'}
          </button>
        </section>

        {isInstructionsOpen && (
          <InstructionsModal onClose={() => setIsInstructionsOpen(false)} />
        )}
      </main>
    )
  }

  if (game.phase === 'game_over') {
    return (
      <main className="app-shell game-shell game-over-shell">
        {error && <div className="error-toast" role="alert">{error}</div>}

        <section className="final-results-screen" aria-label="Final game results">
          <CenterResultPanel
            game={game}
            isLoading={isLoading}
            onNextRound={handleNextRound}
            onBackToMenu={handleEndGame}
            playerColorById={playerColorById}
          />
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell game-shell">
      {error && <div className="error-toast" role="alert">{error}</div>}

      <section className="dashboard" aria-label="Wizard game table">
        <div className="turn-banner">
          <span>{phaseTitle(game.phase)}</span>
          <strong>Current Turn: {activePlayer?.name ?? 'None'}</strong>
          <button
            type="button"
            className="scoreboard-toggle"
            onClick={() => setIsScoreboardOpen((isOpen) => !isOpen)}
          >
            {isScoreboardOpen ? 'Hide Scoreboard' : 'Show Scoreboard'}
          </button>
          <button
            type="button"
            className="end-game-button"
            onClick={handleEndGame}
            disabled={isLoading}
          >
            End Game
          </button>
        </div>

        <section className="table-stage" aria-label="Card table">
          <div className="card-table">
            <div className="table-center">
              <div className="phase-chip">{phaseTitle(game.phase)}</div>
              <CenterStatus game={game} />
              {game.phase === 'setup' && (
                <button
                  type="button"
                  className="primary-button center-start-button"
                  onClick={handleStartRound}
                  disabled={isLoading}
                >
                  {isLoading ? 'Starting...' : 'Start Round'}
                </button>
              )}
              <CurrentTrick game={game} />
            </div>

            <CenterResultPanel
              game={game}
              isLoading={isLoading}
              onNextRound={handleNextRound}
              onBackToMenu={handleEndGame}
              playerColorById={playerColorById}
            />

            {game.players.map((player, index) => (
            <PlayerSeat
                game={game}
                player={player}
                index={index}
                characterColor={
                  playerColorById[player.id] ?? CHARACTER_COLORS[index % CHARACTER_COLORS.length]
                }
                isCurrent={index === game.current_player_index}
                isRevealed={revealedPlayerId === player.id}
                isLoading={isLoading}
                onPlayCard={handlePlayCard}
                key={player.id}
              >
                {index === game.current_player_index ? renderCurrentSeatAction() : null}
              </PlayerSeat>
            ))}
          </div>
        </section>
      </section>

      {game.phase === 'trump_selection' && (
        <TrumpSelectionModal
          player={activePlayer}
          isRevealed={isActionRevealed}
          isLoading={isLoading}
          onReveal={revealCurrentPlayer}
          onChooseTrump={handleChooseTrump}
        />
      )}

      {isScoreboardOpen && (
        <Scoreboard
          game={game}
          history={scoreHistory}
          onClose={() => setIsScoreboardOpen(false)}
        />
      )}
    </main>
  )
}

export default App
