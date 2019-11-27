import { Component } from '@angular/core';
import * as io from 'socket.io-client'
import { WmJoinRequest, WmServerResponse, WmCreateRequest, WmServerMessage } from '../interfaces';
import { HttpClient, HttpErrorResponse } from '@angular/common/http'
import { SocketioService } from 'src/app/services/socketio.service';
import {Howl, Howler} from 'howler'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})
export class AppComponent {

  constructor() {
  }

  
}
