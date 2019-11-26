export interface WmClientRequest {
  user: string
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
