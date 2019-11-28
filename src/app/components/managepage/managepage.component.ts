import { Component, OnInit } from '@angular/core';
import * as io from 'socket.io-client'
import { WmJoinRequest, WmServerResponse, WmCreateRequest, WmServerMessage } from 'src/app/interfaces';
import { HttpClient, HttpErrorResponse } from '@angular/common/http'
import { SocketioService } from 'src/app/services/socketio.service';
import { SoundService } from 'src/app/services/sound.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-managepage',
  templateUrl: './managepage.component.html',
  styleUrls: ['./managepage.component.sass']
})
export class ManagepageComponent implements OnInit {

  title = 'wolfman';
  public messages = []
  public errorMessage = ''
  public game
  public sess: { gamename: string, username: string } = { username: '', gamename: '' }
  public userList = []
  public chatMessage = ''
  public inGame: boolean = false

  private socket

  constructor(private http: HttpClient, private sio: SocketioService, 
    //private sound: SoundService,
    private router: Router) {
  }

  ngOnInit() {
    this.me()
    this.socket = this.sio.socket
    this.socket.on('message', (message: WmServerMessage) => {
      console.log('got server message')
      this.messages.push(message)
    })
    this.socket.on('chat', (chat) => {
      this.messages.push({ type: 'chat', message: chat.message, from: chat.from })
    })

    this.socket.on('refresh', () => {
      this.refreshGame()
    })
    
    this.socket.on('start', () => {
      this.router.navigate(['/game'])
    })
  }

  handleError(error: HttpErrorResponse) {
    if (error.error instanceof ErrorEvent) {
      // A client-side or network error occurred. Handle it accordingly.
      console.error('An error occurred:', error.error.message);
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong,
      console.error(
        `Backend returned code ${error.status}, ` +
        `body was: ${error.error}`)
    }
    this.messages.push({ type: 'error', message: error.error.message })
  }

  refreshGame() {
    this.http.get(`/api/game`)
      .subscribe(game => {
        this.game = game
      },
        error => this.handleError(error)
      )
  }

  me() {
    this.http.get(`/api/me`)
      .subscribe((me: { username: string, gamename: string }) => {
        if (!me.username) {
          this.router.navigate(['/login'])
          return
        }
        if (!me.gamename) {
          this.router.navigate(['/join'])
          return
        }
        console.log('me is ', me)
        this.sess = me
        if (this.sess.gamename) {
          this.inGame = true
          this.refreshGame()
        }
      },
      error => this.handleError(error)
      )
      
  }

  

  leaveGame() {
    let leaveRequest = {
      socket: this.socket.id
    }
    this.http.post('/api/leave', leaveRequest).subscribe(res => {
      this.router.navigate(['/join'])
    },
      error => this.handleError(error)
    )
  }

  logout() {
    this.http.post('/api/logout', {}).subscribe(res => {
      this.router.navigate(['/login'])
    },
    error => this.handleError(error)
    )
  }
  startGame() {
    this.http.post('/api/start', {}).subscribe(res => {
      this.router.navigate(['/game'])
    },
    error => this.handleError(error)
    )
  }
  
  sendChat() {
    if (this.chatMessage == '') {
      return
    }
    var message = { message: this.chatMessage, socket: this.socket.id }
    this.http.post('/api/chat', message).subscribe(res => {
      this.chatMessage = ''
    },
      error => this.handleError(error)
    )
  }

  chatOnEnter() {
    this.sendChat()
  }

  toggleMusic() {
    //this.sound.toggle()
  }
}
