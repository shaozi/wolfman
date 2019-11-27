import { Injectable } from '@angular/core';
import { WmJoinRequest, WmServerResponse, WmCreateRequest, WmServerMessage } from '../interfaces';
import { HttpClient, HttpErrorResponse } from '@angular/common/http'
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RestfulService {

  constructor(private http: HttpClient) { }

  checkLogin() {
    return this.http.get('/api/me')
  }
}
