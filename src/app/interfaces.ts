export interface WmUser {
  name: string,
  avatar: string,
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
  hunterCanShoot: boolean,
  lastAttacked: string,
  revealedIdot: boolean,
  isOrganizer: boolean,
  selected: boolean
}

export interface WmGame {
  name: string,
  round: number,
  users: WmUser[],
  roundState: string,
  options: WmGameOptions,
  over?: boolean
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
  round: number,
  winState?: number
}

export interface WmGameOptions {
  wolfCount: number,
  gameType: string,
  witch: boolean,
  prophet: boolean,
  hunter: boolean,
  guard: boolean,
  idiot: boolean
}
export interface WmGameStatus {
  state?: string,
  diaglogInProgress?: string,
  instructionGiven?: boolean,
  message?: string,
  readySent?: boolean
}