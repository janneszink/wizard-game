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

const DEFAULT_PLAYERS = ['Alex', 'Eva', 'Jannes']
const PLAYER_COUNTS = [3, 4, 5, 6]
const SUITS: Suit[] = ['red', 'blue', 'green', 'yellow']

interface ScoreHistoryRound {
  roundNumber: number
  scores: RoundScore[]
}

type SeatCSSProperties = CSSProperties & {
  '--menu-x': string
  '--menu-y': string
}

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

function seatStyle(index: number, total: number): SeatCSSProperties {
  const angle = -90 + (360 / total) * index
  const radians = (angle * Math.PI) / 180
  const x = 50 + Math.cos(radians) * 47
  const y = 50 + Math.sin(radians) * 44
  const directionX = Math.cos(radians)
  const directionY = Math.sin(radians)

  let menuX = directionX * 128
  let menuY = directionY * 112

  if (directionY < -0.72) {
    menuY = 84
  }

  if (directionY > 0.72) {
    menuY = -88
  }

  return {
    left: `${x}%`,
    top: `${y}%`,
    '--menu-x': `${menuX}px`,
    '--menu-y': `${menuY}px`,
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
  isCurrent,
  isRevealed,
  isLoading,
  onPlayCard,
  children,
}: {
  game: GameState
  player: Player
  index: number
  isCurrent: boolean
  isRevealed: boolean
  isLoading: boolean
  onPlayCard: (cardId: string) => void
  children?: ReactNode
}) {
  const publicPlayedCard = playedCardForPlayer(game, player.id)
  const showCardFronts = isCurrent && isRevealed
  const showPlayableCards = showCardFronts && game.phase === 'playing'

  return (
    <div
      className={`player-place${isCurrent ? ' current-place' : ''}`}
      style={seatStyle(index, game.players.length)}
    >
      <div className="chair" aria-hidden="true">
        <div className="avatar">
          <span className="wizard-hat"></span>
          <span className="avatar-face"></span>
        </div>
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

        <div className="seat-hand" aria-label={`${player.name}'s hand`}>
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
}: {
  game: GameState
  isLoading: boolean
  onNextRound: () => void
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

    return (
      <div className="table-result-panel">
        <div className="section-heading">
          <h2>Game Over</h2>
          <p>
            Winner{winners.length === 1 ? '' : 's'}:{' '}
            {winners.map((winner) => winner.name).join(', ')}
          </p>
        </div>
        <ScoreTable game={game} />
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

function App() {
  const [playerNames, setPlayerNames] = useState(DEFAULT_PLAYERS)
  const [variantPlusMinusOne, setVariantPlusMinusOne] = useState(false)
  const [game, setGame] = useState<GameState | null>(null)
  const [predictionInput, setPredictionInput] = useState('0')
  const [revealedPlayerId, setRevealedPlayerId] = useState<string | null>(null)
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryRound[]>([])
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false)
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

  function updatePlayerCount(count: number) {
    setPlayerNames((current) => {
      if (count > current.length) {
        return [...current, ...Array.from({ length: count - current.length }, () => '')]
      }

      return current.slice(0, count)
    })
  }

  async function runAction(
    action: () => Promise<GameState>,
    onSuccess?: () => void,
  ) {
    setIsLoading(true)
    setError(null)

    try {
      const updatedGame = await action()
      setGame(updatedGame)
      setRevealedPlayerId(null)
      onSuccess?.()
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

    if (hasEmptyName) {
      setError('Please enter a name for every player.')
      return
    }

    void runAction(() => createGame(playerNames, variantPlusMinusOne), () => {
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
        <span>The backend validates legal play.</span>
      </div>
    )
  }

  if (!game) {
    return (
      <main className="app-shell menu-shell">
        {error && <div className="error-toast" role="alert">{error}</div>}

        <section className="menu-card" aria-labelledby="setup-title">
          <div className="menu-heading">
            <p className="eyebrow">Pass-and-play digital card game</p>
            <h1 id="setup-title">Wizard</h1>
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
            {playerNames.map((name, index) => (
              <label className="player-input" key={`player-${index + 1}`}>
                <span>Player {index + 1}</span>
                <input
                  value={name}
                  placeholder={`Player ${index + 1}`}
                  onChange={(event) => updatePlayerName(index, event.target.value)}
                  disabled={isLoading}
                />
              </label>
            ))}
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
            />

            {game.players.map((player, index) => (
              <PlayerSeat
                game={game}
                player={player}
                index={index}
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
