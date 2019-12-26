import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SocketioService } from 'src/app/services/socketio.service';
import { WmJoinRequest, WmServerResponse, WmCreateRequest, WmServerMessage } from 'src/app/interfaces';

import { Router } from '@angular/router';

@Component({
  selector: 'app-createorjoin',
  templateUrl: './createorjoin.component.html',
  styleUrls: ['./createorjoin.component.sass']
})
export class CreateorjoinComponent implements OnInit {
  public gamename: string
  public username: string
  public messages = []
  private socket

  constructor(private http: HttpClient, private router: Router, private sio: SocketioService) { }

  ngOnInit() {
    this.me()
    this.socket = this.sio.socket
  }

  me() {
    this.http.get(`/api/whoami`)
      .subscribe((me: { username: string, gamename: string }) => {
        this.username = me.username
        this.gamename = me.gamename
        if (!this.username) {
          this.router.navigate(['/login'])
        }
        if (this.gamename) {
          this.router.navigate(['/manage'])
        }
      },
      error => {this.router.navigate(['/login'])}
      )
  }

  pushMsg(msg) {
    if (this.messages.length > 5) {
      this.messages.shift()
    }
    this.messages.push(msg)
  }

  join() {
    if (!this.username) {
      return
    }
    if (!this.gamename) {
      return
    }
    if (!this.socket) {
      return
    }
    let joinRequest: WmJoinRequest = {
      user: this.username,
      game: this.gamename,
      socket: this.socket.id
    }
    this.http.post('/api/join', joinRequest).subscribe(res => {
      this.router.navigate(['/manage'])
    },
      error => { this.pushMsg({ type: 'error', message: error.error.message }) }
    )
  }
  
  create() {
    if (!this.username) {
      return
    }
    if (!this.gamename) {
      return
    }
    if (!this.socket) {
      return
    }
    let createRequest: WmCreateRequest = {
      user: this.username,
      game: this.gamename,
      socket: this.socket.id
    }
    this.http.post('/api/create', createRequest).subscribe(res => {
      console.log(res)
      this.router.navigate(['/manage'])
    },
      error => { this.pushMsg({ type: 'error', message: error.error.message }) }
    )
  }
}
