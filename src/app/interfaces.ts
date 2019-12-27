export interface WmUser {
  name: string,
  role: string,
  alive: boolean,
  poison: number,
  antidote: number,
  vote: string,
  sheriffRunning: boolean,
  quitSheriffRunning: boolean,
  sheriff: boolean,
  protect: string,
  lastProtect: string,
  hunterKilled: string,
  lastAttacked: string,
  revealedIdot: boolean,
  isOrganizer: boolean
}

export interface WmGame {
  name: string,
  round: number,
  users: WmUser[],
  roundState: string
}

export interface WmClientRequest {
  user: string
  socket: string
}

export interface WmJoinRequest extends WmClientRequest {
  game: string
}

export interface WmCreateRequest extends WmClientRequest {
  game: string
}

export interface WmServerResponse {
  success: boolean,
  message?: string,
  wolf?: boolean
}

export interface WmServerMessage {
  type?: string,
  message: string
}

export interface WmClientReponse {
  id: string,
  inReplyTo: string,
  userId: string
}

export interface WmServerNotify {
  state: string,
  round: number
}