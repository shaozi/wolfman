import { Injectable } from '@angular/core';
import * as io from 'socket.io-client'
import { WmJoinRequest, WmServerResponse, WmCreateRequest, WmServerMessage, WmGameStatus, WmGameOptions, WmUser } from '../interfaces';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class SocketioService {
  public socket
  public user: WmUser
  public roleLabel = {
    wolf: '狼人',
    villager: '村民',
    witch: '女巫',
    guard:'守卫',
    hunter:'猎人',
    idiot:'傻瓜',
    prophet:'预言家'
  }

  constructor(private http: HttpClient) {
    console.log('socket created')
    this.socket = io()
  }

  getGameOptions(): Promise<WmGameOptions> {
    console.log('get game options promise')
    return this.http.get('/api/game').toPromise() as Promise<WmGameOptions>
  }

  set gameOptions(opt: WmGameOptions) {
    localStorage.setItem('gameOptions', JSON.stringify(opt))
  }

  get gameStatus(): WmGameStatus {
    return JSON.parse(localStorage.getItem('gameStatus')) || {}
  }

  set gameStatus(status: WmGameStatus) {
    localStorage.setItem('gameStatus', JSON.stringify(status))
    console.log(`save state:`, this.gameStatus)
  }
  
  updateGameStatus(key: string, value: string|boolean) {
    let status = this.gameStatus
    status[key] = value
    this.gameStatus = status
    return status
  }
}
