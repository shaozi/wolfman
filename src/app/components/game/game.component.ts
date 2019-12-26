import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SocketioService } from 'src/app/services/socketio.service';
import { WmGame, WmUser, WmClientReponse, WmServerResponse, WmServerNotify } from 'src/app/interfaces';
import { Router } from '@angular/router';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { SoundService } from 'src/app/services/sound.service';
import { RestfulService } from 'src/app/services/restful.service';
import { assertNotNull } from '@angular/compiler/src/output/output_ast';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.sass']
})
export class GameComponent implements OnInit {
  public game: WmGame
  public user: WmUser
  public modalRef: BsModalRef
  public readySent: {[key: string]: boolean} = {}
  public currentRound = 0
  public currentState = ''
  public gameOpt
  private socket

  private counter = 0

  @ViewChild('userRole', { static: true }) userRole
  @ViewChild('runSheriffOrNot', { static: true }) runSheriffOrNot

  constructor(private http: HttpClient, private sio: SocketioService, private router: Router,
    private modalService: BsModalService,
    private soundService: SoundService,
    private rest: RestfulService
    ) { }

  ngOnInit() {
    console.log(`counter = ${this.counter++}`)
    if (this.counter > 1) throw new Error('double init')
    this.user = this.rest.user
    console.log('user from rest is ', this.user)
    this.getGame()
    this.getMyRole()
    this.socket = this.sio.socket
    this.socket.on('gameState', async (info: WmServerNotify) => {
      this.currentRound = info.round
      this.currentState = info.state
      this.gameOpt = this.rest.gameOpt
      var opt = this.gameOpt
      console.log('game opt is ', opt)
      switch (info.state) {
        case 'nightStart':
          console.log('Got nightStart signal')
          await this.playSound(['isNight', 'everyone', 'closeEyes'])
          setTimeout(()=>{this.sendReady()}, 2000)
          break
        case 'guard':
          await this.playSound(['guard', 'openEyes'])
          await this.playSound(['guard', 'choose'])
          break
        case 'wolf':
          if (opt && opt.guard) await this.playSound(['guard', 'closeEyes'])
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
          if (opt && opt.witch) await this.playSound(['witch', 'closeEyes'])
          await this.playSound(['prophet', 'openEyes'])
          await this.playSound(['prophet', 'choose'])
          break
        case 'hunter':
          if (opt && opt.prophet) await this.playSound(['prophet', 'closeEyes'])
          await this.playSound(['hunter', 'openEyes'])
          await this.playSound(['hunter', 'choose'])
          break
        case 'dayStart':
          if (opt && opt.hunter) await this.playSound(['hunter', 'closeEyes'])
          await this.playSound(['isDay', 'everyone', 'openEyes', 'pleaseSpeak'])
          break
        case 'killVote':
          await this.playSound(['voteStart'])
          break
        case 'sheriff':
          console.log('sheriff died')
          break
        case 'roleCheck':
          console.log('Please check your role')
          //this.openModal(this.userRole)
          break
        case 'sheriffNom':
          await this.playSound(['voteSheriff'])
          break
        default:
          console.log(info)
          window.alert(`socket info state ${info.state} is not implemented!`)
      }
    })
  }

  async playSound(seq) {
    if (!this.rest.user) {
      console.log('user is not ready')
      return
    }
    if (!this.rest.user.isOrganizer) {
      console.log('user is not organizer')
      return
    }
    await this.soundService.playSequence(seq)
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
    let key = `${this.currentRound}-${this.currentState}`
    if (this.readySent[key]) return
    this.readySent[key] = true
    console.log(`send ready ${key}`)
    console.log(this.readySent)
    this.http.post('/api/ready', {for: key})
      .subscribe((result: WmServerResponse) => {
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
