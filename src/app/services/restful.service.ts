import { Injectable } from '@angular/core';
import { WmJoinRequest, WmServerResponse, WmCreateRequest, WmServerMessage } from '../interfaces';
import { HttpClient, HttpErrorResponse } from '@angular/common/http'
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RestfulService {

  public user

  constructor(private http: HttpClient) { 
  }

  checkLogin() {
    this.http.get('/api/myrole').subscribe(user=>{
      this.user = user
    })
  }
}
