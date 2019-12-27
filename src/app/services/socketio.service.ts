import { Injectable } from '@angular/core';
import * as io from 'socket.io-client'
import { WmJoinRequest, WmServerResponse, WmCreateRequest, WmServerMessage, WmGameStatus, WmGameOptions, WmUser } from '../interfaces';

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

  constructor() {
    console.log('socket created')
    this.socket = io()
    this.gameStatus = {state: '', message: ''}
  }

  get gameOptions(): WmGameOptions {
    return JSON.parse(localStorage.getItem('gameOptions'))
  }
  set gameOptions(opt: WmGameOptions) {
    localStorage.setItem('gameOptions', JSON.stringify(opt))
  }

  get gameStatus(): WmGameStatus {
    return JSON.parse(localStorage.getItem('gameStatus'))
  }
  set gameStatus(status: WmGameStatus) {
    localStorage.setItem('gameStatus', JSON.stringify(status))
  }
}
