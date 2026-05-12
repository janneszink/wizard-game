import type { GameState, Suit } from '../types'

const API_BASE_URL = 'http://127.0.0.1:8000'

interface GameResponse {
  success: boolean
  game: GameState
}

interface ActionResponse {
  success: boolean
  message: string
  game: GameState | null
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`

    try {
      const data = (await response.json()) as { detail?: unknown }
      if (typeof data.detail === 'string') {
        message = data.detail
      }
    } catch {
      // Keep the status-based message if the response is not JSON.
    }

    throw new Error(message)
  }

  return response.json() as Promise<T>
}

function requireGame(response: ActionResponse): GameState {
  if (!response.game) {
    throw new Error(response.message || 'The backend did not return a game.')
  }

  return response.game
}

export async function createGame(
  playerNames: string[],
  variantPlusMinusOne: boolean,
): Promise<GameState> {
  const response = await request<GameResponse>('/games', {
    method: 'POST',
    body: JSON.stringify({
      player_names: playerNames,
      variant_plus_minus_one: variantPlusMinusOne,
    }),
  })

  return response.game
}

export async function getGame(gameId: string): Promise<GameState> {
  const response = await request<GameResponse>(`/games/${gameId}`)
  return response.game
}

export async function startRound(gameId: string): Promise<GameState> {
  const response = await request<ActionResponse>(`/games/${gameId}/start-round`, {
    method: 'POST',
  })

  return requireGame(response)
}

export async function nextRound(gameId: string): Promise<GameState> {
  const response = await request<ActionResponse>(`/games/${gameId}/next-round`, {
    method: 'POST',
  })

  return requireGame(response)
}

export async function chooseTrump(gameId: string, suit: Suit): Promise<GameState> {
  const response = await request<ActionResponse>(`/games/${gameId}/choose-trump`, {
    method: 'POST',
    body: JSON.stringify({ suit }),
  })

  return requireGame(response)
}

export async function submitPrediction(
  gameId: string,
  playerId: string,
  prediction: number,
): Promise<GameState> {
  const response = await request<ActionResponse>(`/games/${gameId}/predict`, {
    method: 'POST',
    body: JSON.stringify({
      player_id: playerId,
      prediction,
    }),
  })

  return requireGame(response)
}

export async function playCard(
  gameId: string,
  playerId: string,
  cardId: string,
): Promise<GameState> {
  const response = await request<ActionResponse>(`/games/${gameId}/play-card`, {
    method: 'POST',
    body: JSON.stringify({
      player_id: playerId,
      card_id: cardId,
    }),
  })

  return requireGame(response)
}

export async function deleteGame(gameId: string): Promise<void> {
  await request<ActionResponse>(`/games/${gameId}`, {
    method: 'DELETE',
  })
}
