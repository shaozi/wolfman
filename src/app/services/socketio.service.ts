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
    wolf: '狼人 - wolf',
    villager: '村民 - villager',
    witch: '女巫 - witch',
    guard:'守卫 - guard',
    hunter:'猎人 - hunter',
    idiot:'傻瓜 - iaiot',
    prophet:'预言家 - prophet'
  }

  public stateLabel = {
    'roleCheck': '检查身份',
    'nightStart': '天黑了',
    'guard': '守卫选择',
    'wolf': '狼人杀人',
    'witchsave': '女巫救人',
    'witchkill': '女巫杀人',
    'prophet': '预言家验人',
    'hunter': '猎人查看',
    'dayStart': '天亮了',
    'sheriffNom': '警长参选',
    'sheriffVote': '警长选举投票',
    'hunterKill': '猎人晚上开枪',
    'sheriffdeath': '警长夜里死亡',
    'killVote': '投票出局',
    'hunterKill2': '猎人白天开枪',
    'sheriffdeath2': '警长白天死亡'
  }

  constructor(private http: HttpClient) {
    console.log('socket created')
    this.socket = io()
  }

  get gameStatus(): WmGameStatus {
    return JSON.parse(localStorage.getItem('gameStatus')) || {}
  }

  set gameStatus(status: WmGameStatus) {
    localStorage.setItem('gameStatus', JSON.stringify(status))
  }
  
  updateGameStatus(key: string, value: string|boolean) {
    let status = this.gameStatus
    status[key] = value
    this.gameStatus = status
    return status
  }
}
