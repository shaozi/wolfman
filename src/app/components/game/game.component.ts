import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SocketioService } from 'src/app/services/socketio.service';
import { WmGame, WmUser, WmClientReponse, WmServerResponse, WmServerNotify } from 'src/app/interfaces';
import { Router } from '@angular/router';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { SoundService } from 'src/app/services/sound.service';
import { RestfulService } from 'src/app/services/restful.service';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.sass']
})
export class GameComponent implements OnInit {
  public game: WmGame
  public user: WmUser
  public modalRef: BsModalRef
  public readySent = false
  public currentRound = 0
  public currentState = ''
  private socket

  @ViewChild('userRole', { static: true }) userRole
  @ViewChild('runSheriffOrNot', { static: true }) runSheriffOrNot

  constructor(private http: HttpClient, private sio: SocketioService, private router: Router,
    private modalService: BsModalService,
    private soundService: SoundService,
    private rest: RestfulService
    ) { }

  ngOnInit() {
    this.getGame()
    this.getMyRole()
    this.socket = this.sio.socket
    this.socket.on('gameState', async (info: WmServerNotify) => {
      this.currentRound = info.round
      this.currentState = info.state
      this.readySent = false
      switch (info.state) {
        case 'nightStart':
          await this.playSound(['isNight', 'everyone', 'closeEyes'])
          this.sendReady()
          break
        case 'guard':
          await this.playSound(['guard', 'openEyes'])
          await this.playSound(['guard', 'choose'])
          break
        case 'wolf':
          await this.playSound(['guard', 'closeEyes'])
          await this.playSound(['wolves', 'openEyes'])
          await this.playSound(['wolves', 'choose'])
          break
        case 'witchsave':
          await this.playSound(['wolves', 'closeEyes'])
          await this.playSound(['witch', 'openEyes'])
          await this.playSound(['witch', 'choose'])
          break
        case 'witchkill':

          break
        case 'prophet':
          await this.playSound(['witch', 'closeEyes'])
          await this.playSound(['prophet', 'openEyes'])
          await this.playSound(['prophet', 'choose'])
          break
        case 'hunter':
          await this.playSound(['prophet', 'closeEyes'])
          await this.playSound(['hunter', 'openEyes'])
          await this.playSound(['hunter', 'choose'])
          break
        case 'dayStart':
          await this.playSound(['hunter', 'closeEyes'])
          await this.playSound(['isDay', 'everyone', 'openEyes'])
          break
        case 'killVote':
          await this.playSound(['hunter', 'closeEyes'])
          await this.playSound(['isDay', 'everyone', 'openEyes'])
          break
        case 'sheriff':
          console.log('sheriff died')
          break
        case 'roleCheck':
          console.log('Please check your role')
          break
        default:
          console.log(info)
          window.alert(`socket info state ${info.state} is not implemented!`)
      }
    })
  }

  async playSound(seq) {
    console.log('use rest service')
    console.log(this.rest.user)
    if (this.rest.user && this.rest.user.isOrganizer) {
      await this.soundService.playSequence(seq)
    } else {
      console.log('user is not ready')
    }
  }

  handleError(error) {
    console.log(error)
  }

  getGame() {
    this.http.get(`/api/game`)
      .subscribe((game: WmGame) => {
        this.game = game
        if (game.round == 0) {
          this.router.navigate(['/manage'])
          return
        }
        this.currentState = game.roundState
        this.currentRound = game.round
      },
        error => {
          this.router.navigate(['/'])
          this.handleError(error)
        }
      )
  }

  getMyRole() {
    this.http.get(`/api/myrole`)
      .subscribe((user: WmUser) => {
        this.user = user
      },
        error => this.handleError(error)
      )
  }

  sendReady() {
    if (this.modalRef) this.modalRef.hide()
    if (this.readySent) return
    this.http.post('/api/ready', {})
      .subscribe((result: WmServerResponse) => {
        this.readySent = true
        if (!result.success) {
          console.log(result)
        }
      },
        error => {
          console.log(error)
          window.alert(error.message)
        })
  }

  sendVote(user) {
    let allow = this.currentState === 'killVote' 
      || this.currentState.includes(this.user.role)
      || this.user.sheriff && this.currentState === 'sheriff'
      || this.user.role === 'hunter' && this.currentState === 'hunterDeath'
    if (!allow) {
      console.log(this.currentState, this.currentRound, this.user)
      console.log('not allowed')
      return
    }
    let data = { vote: user.name }
    this.http.post('/api/vote/', data)
      .subscribe((result: WmServerResponse) => {
        this.readySent = true
        if (!result.success) {
          console.log(result)
        } else {
          if ('wolf' in result) {
            window.alert(result.wolf ? '狼人' : '平民')
          }
          this.sendReady()
        }
      },
        error => {
          console.log(error)
          window.alert(error.message)
        })
  }

  confirmRunSheriff() {
    console.log('confirmRun')
    this.modalRef.hide()
  }
  declineRunSheriff() {
    console.log('declineRunSheriff')
    this.modalRef.hide()
  }
  openModal(template: TemplateRef<any>) {
    this.modalRef = this.modalService.show(template, { class: 'modal-sm' });
  }
}
