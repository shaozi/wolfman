import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SocketioService } from 'src/app/services/socketio.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.sass']
})
export class LoginComponent implements OnInit {
  
  public username: string

  constructor(private http: HttpClient, private router: Router) { }

  ngOnInit() {
    this.me()
  }

  me() {
    this.http.get(`/api/whoami`)
      .subscribe((me: { username: string, gamename: string }) => {
        this.username = me.username
        if (me.username && me.gamename) {
          this.router.navigate(['/manage'])
        }
      },
      error => {
        console.log(error)
      }
      )
  }
  next() {
    if(this.username) {
      this.http.post(`/api/login`, {user: this.username})
      .subscribe((res: {success: boolean}) => {
        if (res.success) {
          this.router.navigate(['/join'])
        }
      },
      error => {
        console.log(error)
      }
      )
    }
  }

}
