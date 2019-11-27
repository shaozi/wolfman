import { Injectable } from '@angular/core';
import * as io from 'socket.io-client'
import { WmJoinRequest, WmServerResponse, WmCreateRequest, WmServerMessage } from '../interfaces';

@Injectable({
  providedIn: 'root'
})
export class SocketioService {
  public socket
  constructor() { 
    this.socket = io()
  }
}
