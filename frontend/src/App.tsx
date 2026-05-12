import { type CSSProperties, type ReactNode, useState } from 'react'
import './App.css'
import {
  chooseTrump,
  createGame,
  nextRound,
  playCard,
  startRound,
  submitPrediction,
} from './api/client'
import type { Card, GameState, Player, Suit } from './types'

const DEFAULT_PLAYERS = ['Alex', 'Eva', 'Jannes']
const SUITS: Suit[] = ['red', 'blue', 'green', 'yellow']

function formatLabel(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
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

function currentPlayer(game: GameState): Player | null {
  return game.players[game.current_player_index] ?? null
}

function playerNameById(game: GameState, playerId: string): string {
  return game.players.find((player) => player.id === playerId)?.name ?? playerId
}

function playedCardForPlayer(game: GameState, playerId: string): Card | null {
  return game.current_trick.find((playedCard) => playedCard.player_id === playerId)?.card ?? null
}

function seatStyle(index: number, total: number): CSSProperties {
  const angle = -90 + (360 / total) * index
  const radians = (angle * Math.PI) / 180
  const x = 50 + Math.cos(radians) * 42
  const y = 50 + Math.sin(radians) * 39

  return {
    left: `${x}%`,
    top: `${y}%`,
  }
}

function finalWinners(game: GameState): Player[] {
  if (game.players.length === 0) {
    return []
  }

  const highestScore = Math.max(...game.players.map((player) => player.score))
  return game.players.filter((player) => player.score === highestScore)
}

function CardFront({ card }: { card: Card }) {
  return (
    <span className={`card card-front card-${card.suit ?? card.type}`}>
      {formatCard(card)}
    </span>
  )
}

function CardBack() {
  return (
    <span className="card card-back" aria-label="Face-down card">
      Wizard
    </span>
  )
}

function PublicStats({ game }: { game: GameState }) {
  return (
    <div className="public-stats" aria-label="Public game information">
      <div>
        <span>Phase</span>
        <strong>{formatLabel(game.phase)}</strong>
      </div>
      <div>
        <span>Round</span>
        <strong>
          {game.round_number} / {game.max_rounds}
        </strong>
      </div>
      <div>
        <span>Trump</span>
        <strong>{game.trump_suit ? formatLabel(game.trump_suit) : 'None'}</strong>
      </div>
      <div>
        <span>Trump Card</span>
        <strong>{formatCard(game.trump_card)}</strong>
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
}: {
  game: GameState
  player: Player
  index: number
  isCurrent: boolean
  isRevealed: boolean
}) {
  const publicPlayedCard = playedCardForPlayer(game, player.id)
  const showCardFronts = isCurrent && isRevealed

  return (
    <div
      className={`player-seat${isCurrent ? ' current-seat' : ''}`}
      style={seatStyle(index, game.players.length)}
    >
      {publicPlayedCard && (
        <div className="seat-played-card">
          <span>Played</span>
          <CardFront card={publicPlayedCard} />
        </div>
      )}

      <div className="prediction-badge">
        Prediction: {player.prediction ?? '-'}
      </div>
      <div className="seat-name">{player.name}</div>
      <div className="seat-meta">
        <span>Score {player.score}</span>
        <span>Tricks {player.tricks_won}</span>
      </div>
      <div className="seat-hand" aria-label={`${player.name}'s hand`}>
        {player.hand.map((card) =>
          showCardFronts ? <CardFront card={card} key={card.id} /> : <CardBack key={card.id} />,
        )}
      </div>
    </div>
  )
}

function RoundScores({
  game,
  isLoading,
  onNextRound,
}: {
  game: GameState
  isLoading: boolean
  onNextRound: () => void
}) {
  return (
    <div className="panel scoring-panel">
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
              <td>{score.score_change}</td>
              <td>{score.total_score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function App() {
  const [playerNames, setPlayerNames] = useState(DEFAULT_PLAYERS)
  const [variantPlusMinusOne, setVariantPlusMinusOne] = useState(false)
  const [game, setGame] = useState<GameState | null>(null)
  const [predictionInput, setPredictionInput] = useState('0')
  const [revealedPlayerId, setRevealedPlayerId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activePlayer = game ? currentPlayer(game) : null
  const isActionRevealed = Boolean(activePlayer && revealedPlayerId === activePlayer.id)

  function updatePlayerName(index: number, value: string) {
    setPlayerNames((current) =>
      current.map((name, playerIndex) => (playerIndex === index ? value : name)),
    )
  }

  function addPlayer() {
    setPlayerNames((current) => {
      if (current.length >= 6) {
        return current
      }

      return [...current, `Player ${current.length + 1}`]
    })
  }

  function removePlayer(index: number) {
    setPlayerNames((current) => {
      if (current.length <= 3) {
        return current
      }

      return current.filter((_, playerIndex) => playerIndex !== index)
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
    void runAction(() => createGame(playerNames, variantPlusMinusOne))
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

  function revealCurrentPlayer() {
    if (activePlayer) {
      setError(null)
      setRevealedPlayerId(activePlayer.id)
    }
  }

  function renderActionPanel() {
    if (!game) {
      return null
    }

    if (game.phase === 'setup') {
      return (
        <div className="panel action-panel">
          <div className="section-heading">
            <h2>Ready to Deal</h2>
            <p>Start round {game.round_number} when the table is ready.</p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={handleStartRound}
            disabled={isLoading}
          >
            {isLoading ? 'Starting...' : 'Start Round'}
          </button>
        </div>
      )
    }

    if (game.phase === 'trump_selection') {
      return (
        <PrivateActionShell
          playerName={activePlayer?.name}
          isRevealed={isActionRevealed}
          onReveal={revealCurrentPlayer}
        >
          <div className="section-heading">
            <h2>{activePlayer?.name}, choose trump</h2>
            <p>The revealed Wizard needs a trump suit.</p>
          </div>
          <div className="suit-actions">
            {SUITS.map((suit) => (
              <button
                type="button"
                className={`suit-button suit-${suit}`}
                key={suit}
                onClick={() => handleChooseTrump(suit)}
                disabled={isLoading}
              >
                {formatLabel(suit)}
              </button>
            ))}
          </div>
        </PrivateActionShell>
      )
    }

    if (game.phase === 'prediction') {
      return (
        <PrivateActionShell
          playerName={activePlayer?.name}
          isRevealed={isActionRevealed}
          onReveal={revealCurrentPlayer}
        >
          <div className="section-heading">
            <h2>{activePlayer?.name}, make your prediction</h2>
            <p>Choose a number from 0 to {game.round_number}.</p>
          </div>
          <div className="action-hand" aria-label="Current player's revealed hand">
            {activePlayer?.hand.map((card) => <CardFront card={card} key={card.id} />)}
          </div>
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
              {isLoading ? 'Submitting...' : 'Submit Prediction'}
            </button>
          </div>
        </PrivateActionShell>
      )
    }

    if (game.phase === 'playing') {
      return (
        <PrivateActionShell
          playerName={activePlayer?.name}
          isRevealed={isActionRevealed}
          onReveal={revealCurrentPlayer}
        >
          <div className="section-heading">
            <h2>{activePlayer?.name}, play a card</h2>
            <p>The backend will validate whether the card is legal.</p>
          </div>
          <div className="playable-hand" aria-label="Current player's revealed hand">
            {activePlayer?.hand.map((card) => (
              <button
                type="button"
                className="card-button"
                key={card.id}
                onClick={() => handlePlayCard(card.id)}
                disabled={isLoading}
              >
                <CardFront card={card} />
              </button>
            ))}
          </div>
        </PrivateActionShell>
      )
    }

    if (game.phase === 'round_scoring') {
      return (
        <RoundScores
          game={game}
          isLoading={isLoading}
          onNextRound={handleNextRound}
        />
      )
    }

    if (game.phase === 'game_over') {
      const winners = finalWinners(game)

      return (
        <div className="panel action-panel">
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

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Wizard Game</p>
          <h1>Pass-and-Play Table</h1>
        </div>
        <p className="api-note">Backend: http://127.0.0.1:8000</p>
      </header>

      {error && <div className="alert">{error}</div>}

      {!game ? (
        <section className="panel setup-panel" aria-labelledby="setup-title">
          <div className="section-heading">
            <h2 id="setup-title">New Game</h2>
            <p>Set up 3 to 6 players, then create the game on the backend.</p>
          </div>

          <div className="player-inputs">
            {playerNames.map((name, index) => (
              <label className="player-input" key={`player-${index + 1}`}>
                <span>Player {index + 1}</span>
                <div className="input-row">
                  <input
                    value={name}
                    onChange={(event) => updatePlayerName(index, event.target.value)}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => removePlayer(index)}
                    disabled={playerNames.length <= 3 || isLoading}
                    aria-label={`Remove player ${index + 1}`}
                  >
                    -
                  </button>
                </div>
              </label>
            ))}
          </div>

          <div className="setup-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={addPlayer}
              disabled={playerNames.length >= 6 || isLoading}
            >
              Add Player
            </button>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={variantPlusMinusOne}
                onChange={(event) => setVariantPlusMinusOne(event.target.checked)}
                disabled={isLoading}
              />
              Plus/minus one variant
            </label>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={handleCreateGame}
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Create Game'}
          </button>
        </section>
      ) : (
        <section className="dashboard" aria-labelledby="dashboard-title">
          <div className="dashboard-top">
            <div>
              <p className="eyebrow">Game Dashboard</p>
              <h2 id="dashboard-title">{game.id}</h2>
            </div>
            <div className="current-player-chip">
              Current: {activePlayer?.name ?? 'None'}
            </div>
          </div>

          <div className="table-and-action">
            <section className="table-stage" aria-label="Card table">
              <div className="card-table">
                <div className="table-center">
                  <PublicStats game={game} />
                  <CurrentTrick game={game} />
                </div>

                {game.players.map((player, index) => (
                  <PlayerSeat
                    game={game}
                    player={player}
                    index={index}
                    isCurrent={index === game.current_player_index}
                    isRevealed={revealedPlayerId === player.id}
                    key={player.id}
                  />
                ))}
              </div>
            </section>

            <aside className="action-column">{renderActionPanel()}</aside>
          </div>

          <div className="panel players-panel">
            <div className="section-heading">
              <h2>Public Player State</h2>
              <p>Predictions, scores, and tricks are visible to everyone.</p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Score</th>
                    <th>Prediction</th>
                    <th>Tricks Won</th>
                    <th>Current</th>
                  </tr>
                </thead>
                <tbody>
                  {game.players.map((player, index) => (
                    <tr key={player.id}>
                      <td>{player.name}</td>
                      <td>{player.score}</td>
                      <td>{player.prediction ?? '-'}</td>
                      <td>{player.tricks_won}</td>
                      <td>{index === game.current_player_index ? 'Yes' : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <details className="debug-details">
            <summary>Debug JSON</summary>
            <pre>{JSON.stringify(game, null, 2)}</pre>
          </details>
        </section>
      )}
    </main>
  )
}

function PrivateActionShell({
  playerName,
  isRevealed,
  onReveal,
  children,
}: {
  playerName: string | undefined
  isRevealed: boolean
  onReveal: () => void
  children: ReactNode
}) {
  if (!isRevealed) {
    return (
      <div className="panel action-panel pass-panel">
        <div className="section-heading">
          <h2>Give device to {playerName ?? 'current player'}</h2>
          <p>Private hand information is hidden until the player is ready.</p>
        </div>
        <button type="button" className="primary-button" onClick={onReveal}>
          Reveal cards
        </button>
      </div>
    )
  }

  return <div className="panel action-panel">{children}</div>
}

export default App
