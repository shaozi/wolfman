import { Injectable } from '@angular/core';
import * as io from 'socket.io-client'
import { WmJoinRequest, WmServerResponse, WmCreateRequest, WmServerMessage } from '../interfaces';

@Injectable({
  providedIn: 'root'
})
export class SocketioService {
  public socket
  public readySent: {[key: string]: boolean} = {}
  constructor() {
    console.log('socket created')
    this.socket = io()
  }
}
