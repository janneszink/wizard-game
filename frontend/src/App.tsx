import { useState } from 'react'
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

function CardDisplay({ card }: { card: Card }) {
  return (
    <span className={`card-face card-${card.suit ?? card.type}`}>
      {formatCard(card)}
    </span>
  )
}

function App() {
  const [playerNames, setPlayerNames] = useState(DEFAULT_PLAYERS)
  const [variantPlusMinusOne, setVariantPlusMinusOne] = useState(false)
  const [game, setGame] = useState<GameState | null>(null)
  const [predictionInput, setPredictionInput] = useState('0')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

    void runAction(() => nextRound(game.id))
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

  const activePlayer = game ? currentPlayer(game) : null

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Wizard Game</p>
          <h1>Table Control</h1>
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
            <div className="action-row">
              {game.phase === 'setup' && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleStartRound}
                  disabled={isLoading}
                >
                  {isLoading ? 'Starting...' : 'Start Round'}
                </button>
              )}
              {game.phase === 'round_scoring' && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleNextRound}
                  disabled={isLoading}
                >
                  {isLoading ? 'Advancing...' : 'Next Round'}
                </button>
              )}
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat">
              <span>Phase</span>
              <strong>{formatLabel(game.phase)}</strong>
            </div>
            <div className="stat">
              <span>Round</span>
              <strong>
                {game.round_number} / {game.max_rounds}
              </strong>
            </div>
            <div className="stat">
              <span>Trump Suit</span>
              <strong>{game.trump_suit ? formatLabel(game.trump_suit) : 'None'}</strong>
            </div>
            <div className="stat">
              <span>Trump Card</span>
              <strong>{formatCard(game.trump_card)}</strong>
            </div>
            <div className="stat">
              <span>Current Player</span>
              <strong>{activePlayer?.name ?? 'None'}</strong>
            </div>
          </div>

          {game.phase === 'trump_selection' && (
            <div className="panel turn-panel">
              <div className="section-heading">
                <h2>Choose Trump</h2>
                <p>{activePlayer?.name ?? 'The dealer'} chooses the trump suit.</p>
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
            </div>
          )}

          {game.phase === 'prediction' && (
            <div className="panel turn-panel">
              <div className="section-heading">
                <h2>Make Prediction</h2>
                <p>{activePlayer?.name ?? 'Current player'} predicts this round.</p>
              </div>

              <div className="hand-list" aria-label="Current player's hand">
                {activePlayer?.hand.map((card) => (
                  <CardDisplay card={card} key={card.id} />
                ))}
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
            </div>
          )}

          {game.phase === 'playing' && (
            <div className="panel turn-panel">
              <div className="section-heading">
                <h2>Play Card</h2>
                <p>{activePlayer?.name ?? 'Current player'} plays next.</p>
              </div>

              <div className="playable-hand" aria-label="Current player's hand">
                {activePlayer?.hand.map((card) => (
                  <button
                    type="button"
                    className="card-button"
                    key={card.id}
                    onClick={() => handlePlayCard(card.id)}
                    disabled={isLoading}
                  >
                    <CardDisplay card={card} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="panel trick-panel">
            <div className="section-heading">
              <h2>Current Trick</h2>
              <p>Cards played into the active trick.</p>
            </div>

            {game.current_trick.length > 0 ? (
              <div className="trick-list">
                {game.current_trick.map((playedCard) => (
                  <div className="trick-card" key={playedCard.card.id}>
                    <span>{playerNameById(game, playedCard.player_id)}</span>
                    <CardDisplay card={playedCard.card} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No cards in the current trick.</p>
            )}
          </div>

          {game.phase === 'round_scoring' && (
            <div className="panel scoring-panel">
              <div className="section-heading scoring-heading">
                <div>
                  <h2>Round Scores</h2>
                  <p>Results for round {game.round_number}.</p>
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleNextRound}
                  disabled={isLoading}
                >
                  {isLoading ? 'Advancing...' : 'Next Round'}
                </button>
              </div>

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
                    {game.round_scores.map((score) => (
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
            </div>
          )}

          <div className="panel table-panel">
            <div className="section-heading">
              <h2>Players</h2>
              <p>Scores and turn state returned by the backend.</p>
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

          <div className="panel debug-panel">
            <div className="section-heading">
              <h2>Raw Game State</h2>
              <p>Useful while the next interaction milestones are added.</p>
            </div>
            <pre>{JSON.stringify(game, null, 2)}</pre>
          </div>
        </section>
      )}
    </main>
  )
}

export default App
