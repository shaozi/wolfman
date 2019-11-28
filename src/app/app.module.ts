import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms'
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './components/app.component';
import { HttpClientModule } from '@angular/common/http';
import { LoginComponent } from './components/login/login.component';
import { CreateorjoinComponent } from './components/createorjoin/createorjoin.component';
import { Routes, RouterModule } from '@angular/router';
import { ManagepageComponent } from './components/managepage/managepage.component';
import { GameComponent } from './components/game/game.component';



@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    CreateorjoinComponent,
    ManagepageComponent,
    GameComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
