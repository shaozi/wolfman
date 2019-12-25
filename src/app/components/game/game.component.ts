import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SocketioService } from 'src/app/services/socketio.service';
import { WmGame, WmUser } from 'src/app/interfaces';
import { Router } from '@angular/router';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.sass']
})
export class GameComponent implements OnInit {
  public game: WmGame
  public user: WmUser
  public modalRef: BsModalRef

  private socket
  
  @ViewChild('userRole', { static: true }) userRole
  @ViewChild('runSheriffOrNot', { static: true }) runSheriffOrNot

  constructor(private http: HttpClient, private sio: SocketioService, private router: Router,
    private modalService: BsModalService) { }

  ngOnInit() {
    this.getGame()
    this.getMyRole()
    this.socket = this.sio.socket
  }

  handleError(error) {
    console.log(error)
  }

  getGame() {
    this.http.get(`/api/game`)
      .subscribe((game: WmGame) => {
        this.game = game
        if (game.status == -1) {
          this.router.navigate(['/manage'])
        }
      },
        error => this.handleError(error)
      )
  }

  getMyRole() {
    this.http.get(`/api/myrole`)
      .subscribe((user: WmUser) => {
        this.user = user
        //this.openModal(this.userRole)
      },
        error => this.handleError(error)
      )
  }

  revealRole() {
    //window.alert(`You are a ${this.user.role}`)
    this.openModal(this.userRole)
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
