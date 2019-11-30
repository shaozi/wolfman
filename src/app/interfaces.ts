export interface WmUser {
  name: string,
  role: string,
  live: boolean,
  poison: number,
  antidote: number,
  vote: string,
  runSheriff: boolean,
  quitRunSheriff: boolean,
  sheriff: boolean,
  canShoot: boolean,
  protect: string,
  lastProtect: string,
  revealedIdot: boolean,
  isOrganizer: boolean
}

export interface WmGame {
  name: string,
  status: number,
  users: WmUser[]
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
  message?: string
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
