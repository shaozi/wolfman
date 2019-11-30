import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SocketioService } from 'src/app/services/socketio.service';
import { WmGame, WmUser } from 'src/app/interfaces';
import { Router } from '@angular/router';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.sass']
})
export class GameComponent implements OnInit {
  public game: WmGame
  public user: WmUser

  constructor(private http: HttpClient, private sio: SocketioService, private router: Router) { }

  ngOnInit() {
    this.getGame()
  }

  handleError(error) {
    console.log(error)
  }

  getGame() {
    this.http.get(`/api/game`)
      .subscribe((game : WmGame) => {
        this.game = game
        if (game.status > 0)  {
          this.router.navigate(['/game'])
        }
      },
        error => this.handleError(error)
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
}
