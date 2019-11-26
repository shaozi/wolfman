import { Component } from '@angular/core';
import * as io from 'socket.io-client'
import { WmJoinRequest, WmServerResponse, WmCreateRequest, WmServerMessage } from './interfaces';
import { HttpClient } from '@angular/common/http'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})
export class AppComponent {
  title = 'wolfman';
  public messages = []
  public errorMessage = ''
  public game
  public sess : {gamename: string, username: string} = { username: '', gamename: ''}
  public userList = []
  public chatMessage = ''

  private socket
  //private url = 'http://localhost:3100'

  constructor(private http: HttpClient) {
  }

  ngOnInit() {
    this.me()
    this.socket = io()
    this.socket.on('message', (message: WmServerMessage) => {
      console.log('got server message')
      this.messages.push(message)
    })
    this.socket.on('chat', (chat) => {
      this.messages.push({type: 'chat', message: chat.message, from: chat.from})
    })

    this.socket.on('refresh', ()=> {
      this.refreshGame()
    })
  }

  refreshGame() {
    this.http.get(`/api/game/${this.sess.gamename}/${this.sess.username}`)
      .subscribe(game => {
        this.game = game
      },
        error => {
          this.messages.push(error)
        }
      )
  }

  me() {
    this.http.get(`/api/me`)
      .subscribe((me: {username: string, gamename: string}) => {
        this.sess = me
      },
        error => {
          this.messages.push(error)
        }
      )
  }
  joinGame() {
    if (!this.sess.username) {
      return
    }
    if (!this.sess.gamename) {
      return
    }
    if (!this.socket) {
      return
    }
    let joinRequest: WmJoinRequest = {
      user: this.sess.username,
      game: this.sess.gamename
    }
    this.socket.emit('join', joinRequest)
  }

  newGame() {
    if (!this.sess.username) {
      return
    }
    if (!this.sess.gamename) {
      return
    }
    if (!this.socket) {
      return
    }
    let createRequest: WmCreateRequest = {
      user: this.sess.username,
      game: this.sess.gamename
    }
    this.socket.emit('new', createRequest)
  }

  sendChat() {
    if (this.chatMessage == '') {
      return
    }
    this.socket.emit('chat', {message: this.chatMessage})
    this.chatMessage = ''
  }
}
