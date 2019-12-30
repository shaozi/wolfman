import { Component, OnInit, TemplateRef, ViewChild, ViewChildren } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SocketioService } from 'src/app/services/socketio.service';
import { WmGame, WmUser, WmClientReponse, WmServerResponse, WmServerNotify, WmGameStatus } from 'src/app/interfaces';
import { Router } from '@angular/router';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { SoundService } from 'src/app/services/sound.service';


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
  public isNight: boolean = true
  private socket
  private gameStatus: WmGameStatus

  private counter = 0

  @ViewChild('userRole', { static: true }) userRole
  @ViewChild('runSheriffOrNot', { static: true }) runSheriffOrNot
  @ViewChild('saveOrNot', { static: true }) saveOrNot
  @ViewChild('poisonOrNot', { static: true }) poisonOrNot
  @ViewChild('passBadgeOrNot', { static: true }) passBadgeOrNot: TemplateRef<any>
  public templates: { [name: string]: TemplateRef<any> } = null

  // used for saved state so to re-display later


  constructor(private http: HttpClient,
    public sio: SocketioService,
    private router: Router,
    private modalService: BsModalService,
    private soundService: SoundService
  ) { }

  ngOnInit() {
    console.log(`counter = ${this.counter++}`)
    this.templates = {
      userRole: this.userRole,
      runSheriffOrNot: this.runSheriffOrNot,
      saveOrNot: this.saveOrNot,
      poisonOrNot: this.poisonOrNot,
      passBadgeOrNot: this.passBadgeOrNot
    }
    if (this.counter > 1) throw new Error('double init')
    this.user = this.sio.user
    console.log('saved user is ', this.user)
    this.getGameAndUser().then(async () => {
      await this.restoreSavedStatus()
      this.socket = this.sio.socket
      this.socket.on('restart', () => {
        this.router.navigate(['/manage'])
      })
      this.socket.on('gameOver', async (info: { winState: number }) => {
        //window.alert(`Game Over! ${info.winState === 1 ? 'Wolf WINS' : 'Wolf LOSE'}`)
        console.log('game over')
        this.router.navigate(['/manage'])
      })
      this.socket.on('gameState', async (info: WmServerNotify) => {
        console.log(`Got socket signal gameState - ${JSON.stringify(info)}. delay 1s`)
        await this.delay(1000)
        console.log(`process signal ${info.state}`)
        this.sio.gameStatus = { state: info.state }
        this.currentRound = info.round
        this.currentState = info.state
        await this.getGameAndUser()
        await this.giveInstruction()
        switch (this.currentState) {
          case 'nightStart':
            this.isNight = true
            setTimeout(() => { this.sendReady() }, 2000)
            break
          case 'witchsave':
            setTimeout(() => {
              if (this.user.role == 'witch')
                this.openModal('saveOrNot')
            }, 2000)
            break
          case 'witchkill':
            setTimeout(() => {
              if (this.user.role == 'witch')
                this.openModal('poisonOrNot')
            }, 2000)
            break
          case 'sheriff':
            setTimeout(() => {
              if (this.user.sheriff)
                this.openModal('passBadgeOrNot')
            }, 2000)
            console.log('sheriff died')
            break
          case 'roleCheck':
            console.log('Please check your role')
            //this.openModal(this.userRole)
            break
          case 'sheriffNom':
            this.openModal('runSheriffOrNot')
            break
          case 'dayStart':
            this.isNight = false
            setTimeout(() => { this.sendReady() }, 2000)
            break

          default:
            break
        }
      })
    })
  }

  delay(ms: number) {
    return new Promise((resolve) => {
      setTimeout(() => { resolve() }, ms)
    })
  }

  handleError(error) {
    console.log(error)
  }

  async getGameAndUser() {
    try {
      this.game = (await this.http.get('/api/game').toPromise()) as WmGame
      if (this.game.round == 0 || this.game.over) {
        this.router.navigate(['/manager'])
        return
      }
      this.currentState = this.game.roundState
      let dayStates = ['sheriffNom', 'sheriffVote', 'hunterdeath', 'sheriffdeath', 'killVote', 'hunterdeath2', 'sheriffdeath2']
      this.isNight = dayStates.indexOf(this.currentState) == -1
      let data = (await this.http.get('/api/me').toPromise()) as { user: WmUser }
      this.user = data.user
    } catch (error) {
      console.error(error)
      this.router.navigate(['/login'])
    }
  }

  async restoreSavedStatus() {
    if (this.currentRound === 0) {
      // new game, clean up status
      this.sio.gameStatus = {}
      return
    }
    let status = this.sio.gameStatus
    if (status.state !== this.game.roundState) {
      return
    }
    if (status.readySent) {
      return
    }
    if (status.diaglogInProgress) {
      this.openModal(status.diaglogInProgress)
    }
    if (!status.instructionGiven) {
      this.giveInstruction()
    }
  }

  async giveInstruction() {
    if (!this.user) {
      console.log('user is not ready')
      return
    }
    if (!this.user.isOrganizer) {
      console.log('user is not organizer')
      return
    }
    let opt = this.game.options
    console.log('opt is', opt)
    let seq = []
    switch (this.currentState) {
      case 'nightStart':
        seq = ['isNight', 'everyone', 'closeEyes']
        break
      case 'guard':
        seq = ['guard', 'openEyes', 'guard', 'choose']
        break
      case 'wolf':
        if (opt && opt.guard) {
          seq = ['guard', 'closeEyes']
        }
        seq.push('wolves', 'openEyes', 'wolves', 'choose')
        break
      case 'witchsave':
        seq = ['wolves', 'closeEyes', 'witch', 'openEyes', 'witch', 'choose']
        break
      case 'witchkill':
        break
      case 'prophet':
        if (opt && opt.witch) seq = ['witch', 'closeEyes']
        seq.push('prophet', 'openEyes', 'prophet', 'choose')
        break
      case 'hunter':
        if (opt && opt.prophet) seq = ['prophet', 'closeEyes']
        seq.push('hunter', 'openEyes', 'hunter', 'choose')
        break
      case 'dayStart':
        if (opt && opt.hunter) seq = ['hunter', 'closeEyes']
        seq.push('isDay', 'everyone', 'openEyes')
        break
      case 'killVote':
        seq = ['everyone', 'pleaseSpeak', 'everyone', 'voteStart']
        break
      case 'sheriff':
        seq = ['voteSheriff']
        break
      case 'roleCheck':
        break
      case 'sheriffNom':
        seq = ['everyone', 'voteSheriff']
        break
      case 'sheriffVote':
        seq = ['voteSheriff', 'voteStart']
        break
      default:
        window.alert(`socket info state ${this.currentState} is not implemented!`)
    }
    await this.soundService.playSequence(seq)
    this.sio.updateGameStatus('instructionGiven', true)
  }

  sendStart() {
    if (this.modalRef) this.modalRef.hide()
    if ('roleCheck' === this.currentState &&
      !this.sio.gameStatus.readySent) {
      this.sendReady()
    }
  }

  sendReady(username?: string) {
    if (this.modalRef) this.modalRef.hide()
    if (!this.allowVote(username)) {
      console.log('vote is not allowed, dont send ready')
      return
    }
    // FIXME: status update need to be atomic
    this.sio.updateGameStatus('readySent', true)
    console.log(`send ready ${this.currentState}`)
    this.http.post('/api/ready', { state: this.currentState })
      .subscribe((result: WmServerResponse) => {
        if (!result.success) {
          console.log(result)
        } else {

        }
      },
        error => {
          console.log(error)
          window.alert(error.message)
        })
  }

  allowVote(username?: string) {
    let allow = (
      (
        this.currentState == 'dayStart'
        ||
        this.user.alive && (
          this.currentState === 'killVote'
          || this.currentState === 'nightStart'
          || this.currentState === 'roleCheck'
          || this.currentState.includes(this.user.role)
        )
      )
      ||
      (
        this.currentState.includes(this.user.role)
        && this.user.role !== 'wolf'
      )
      || (
        this.currentState === 'sheriffNom'
        || this.currentState === 'sheriffVote' && !this.user.sheriffRunning
      )
    )
    if (this.sio.gameStatus.state === this.currentState &&
      this.sio.gameStatus.readySent) {
      allow = false
    }
    if (allow && this.currentState === 'sheriffVote') {
      let user = this.game.users.find(u => { return u.name === username })
      if (!user || !user.sheriffRunning) { // only allow select running user
        allow = false
      }
    }
    console.log('allowVote check username: ', username, this.user, this.currentState, this.sio.gameStatus, allow)
    return allow
  }

  sendVote(username: string) {

    let allow = this.allowVote(username)
    if (this.currentState == 'roleCheck') {
      allow == false
    }
    if (!allow) {
      this.setAutoDismissMessage('选择无效')
      return
    }
    if (this.modalRef) {
      this.modalRef.hide()
    }
    let data = { vote: username, state: this.currentState }
    this.http.post('/api/vote/', data)
      .subscribe((result: WmServerResponse) => {
        if (!result.success) {
          this.setAutoDismissMessage(`你选了${username}，但是有错：${result.message}`)
        } else {
          if ('wolf' in result) {
            this.setAutoDismissMessage(`${username}的身份是个${result.wolf ? '狼人' : '平民'}!!`)
            setTimeout(() => {
              this.sendReady(username)
            }, 2000)
          } else {
            this.setAutoDismissMessage(`你选了${username}`)
            this.sendReady(username)
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
    setTimeout(() => {
      let index = this.messages.indexOf(message)
      if (index != -1) {
        this.messages.splice(index, 1)
      }
    }, timeout)
  }

  openModal(name: string) {
    this.sio.updateGameStatus('diaglogInProgress', name)

    var template = this.templates[name]
    if (!template) {
      console.error(`template name not found: ${name}`, this.templates)
    }
    this.modalRef = this.modalService.show(template, { class: 'modal-sm', backdrop: 'static' })
  }

  restartGame() {
    this.http.post('/api/restart', {}).subscribe()
  }
}
