import { Component, OnInit, TemplateRef, ViewChild, ViewChildren } from '@angular/core';
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
  public currentRound = 0
  public currentState = ''
  public revealedRole = ''
  public messages = []
  private socket

  private counter = 0

  @ViewChild('userRole', { static: true }) userRole
  @ViewChild('runSheriffOrNot', { static: true }) runSheriffOrNot
  @ViewChild('saveOrNot', { static: false }) saveOrNot
  @ViewChild('poisonOrNot', { static: true }) poisonOrNot
  @ViewChild('passBadgeOrNot', { static: true }) passBadgeOrNot: TemplateRef<any>

  constructor(private http: HttpClient, private sio: SocketioService, private router: Router,
    private modalService: BsModalService,
    private soundService: SoundService
  ) { }

  ngOnInit() {
    console.log(`counter = ${this.counter++}`)
    this.modalService.onHide.subscribe(event => {
      console.log(`model hide on event: ${event}`)
      if (event == 'backdrop-click') {
        this.sendReady()
      }
    })
    if (this.counter > 1) throw new Error('double init')
    this.user = this.sio.user
    let opt = this.sio.gameOptions
    console.log('saved game status is: ', this.sio.gameStatus)
    console.log('saved user is ', this.user)
    this.getGame()
    this.getMyRole()
    this.socket = this.sio.socket
    this.socket.on('gameState', async (info: WmServerNotify) => {
      this.sio.gameStatus = { state: info.state, message: '' }
      this.currentRound = info.round
      this.currentState = info.state

      //var opt = this.gameOpt

      this.getGame((game) => {
        console.log(`get game ${JSON.stringify(info)}`, game)
        this.getMyRole(async (user) => {
          console.log(`get game ${JSON.stringify(info)}`, user)

          console.log('game opt is ', this.sio.gameOptions)
          switch (info.state) {
            case 'nightStart':
              console.log('Got nightStart signal')
              await this.playSound(['isNight', 'everyone', 'closeEyes'])
              setTimeout(() => { this.sendReady() }, 2000)
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
              setTimeout(() => {
                if (this.user.role == 'witch')
                  this.openModal(this.saveOrNot)
              }, 2000)
              break
            case 'witchkill':
              setTimeout(() => {
                if (this.user.role == 'witch')
                  this.openModal(this.poisonOrNot)
              }, 2000)
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
              await this.playSound(['isDay', 'everyone', 'openEyes', 'everyone', 'pleaseSpeak'])
              break
            case 'killVote':
              await this.playSound(['everyone', 'pleaseSpeak'])
              break
            case 'sheriff':
              await this.playSound(['voteSheriff'])
              setTimeout(() => {
                if (this.user.sheriff)
                  this.openModal(this.passBadgeOrNot)
              }, 2000)
              console.log('sheriff died')
              break
            case 'roleCheck':
              console.log('Please check your role')
              //this.openModal(this.userRole)
              break
            case 'sheriffNom':
              await this.playSound(['voteSheriff'])
              this.openModal(this.runSheriffOrNot)
              break
            case 'sheriffVote':
              await this.playSound(['everyone', 'voteSheriff', 'voteStart'])
              break

            default:
              console.log(info)
              window.alert(`socket info state ${info.state} is not implemented!`)
          }
        })
      })


    })
  }

  async playSound(seq: Array<string>, callback?: () => any) {
    console.log(`PLAY SOUND ${JSON.stringify(seq)}`)
    if (!this.user) {
      console.log('user is not ready')
      return
    }
    if (!this.user.isOrganizer) {
      console.log('user is not organizer')
      return
    }
    await this.soundService.playSequence(seq)
    Object.assign(this.sio.gameStatus, { instructionGiven: true })
    if (callback) {
      callback()
    }
  }

  handleError(error) {
    console.log(error)
  }

  getGame(callback?: (game: WmGame) => void) {
    this.http.get(`/api/game`)
      .subscribe((game: WmGame) => {
        this.game = game
        if (game.round == 0) {
          this.router.navigate(['/manage'])
          return
        }
        this.currentState = game.roundState
        this.currentRound = game.round
        if (callback) {
          callback(game)
        }
      },
        error => {
          this.router.navigate(['/'])
          this.handleError(error)
        }
      )
  }

  getMyRole(callback?: (user: WmUser) => void) {
    this.http.get(`/api/me`)
      .subscribe((data: { user: WmUser }) => {
        this.user = data.user
        if (callback) {
          callback(data.user)
        }
      },
        error => this.handleError(error)
      )
  }

  sendStart() {
    if (this.modalRef) this.modalRef.hide()
    if ('roleCheck' === this.currentState &&
      !this.sio.gameStatus.readySent) {
      this.sendReady()
    }
  }

  sendReady() {
    if (this.modalRef) this.modalRef.hide()
    if (this.sio.gameStatus.state === this.currentState &&
      this.sio.gameStatus.readySent) return
    Object.assign(this.sio.gameStatus, { readySent: true })
    console.log(`send ready ${this.currentState}`)
    this.http.post('/api/ready', { for: this.currentState })
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

  sendVote(username: string) {
    if (this.modalRef) {
      this.modalRef.hide()
    }
    let allow = this.user.alive && (
      this.currentState === 'killVote'
      || this.currentState === 'sheriffNom'
      || this.currentState === 'sheriffVote' // && !this.user.sheriffRunning
      || this.currentState.includes(this.user.role)
    )

    if (!allow) {
      console.log(this.currentState, this.currentRound, this.user)
      console.log('not allowed')
      this.setAutoDismissMessage('选择无效')
      return
    }

    let data = { vote: username }
    this.http.post('/api/vote/', data)
      .subscribe((result: WmServerResponse) => {
        if (!result.success) {
          this.setAutoDismissMessage(`你选了${username}，但是有错：${result.message}`)
        } else {
          if ('wolf' in result) {
            this.setAutoDismissMessage(`${username}的身份是个${result.wolf ? '狼人' : '平民'}!!`)
            setTimeout(()=>{
              this.sendReady()
            }, 2000)
          } else {
            this.setAutoDismissMessage(`你选了${username}`)
            this.sendReady()
          }
          
          this.game.users.forEach(user => {
            user.selected = user.name == username
          })
        }
      },
        error => {
          console.log(error)
          window.alert(error.message)
        })
  }

  setAutoDismissMessage(message: string, timeout?: number) {
    timeout = timeout || 5000
    this.messages.push(message)
    setTimeout(()=>{
      let index = this.messages.indexOf(message)
      if (index != -1) {
        this.messages.splice(index, 1)
      }
    }, timeout)
  }
  
  openModal(template: TemplateRef<any>) {
    this.modalRef = this.modalService.show(template, { class: 'modal-sm', backdrop: 'static' })
  }
}
