import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { CreateorjoinComponent } from './components/createorjoin/createorjoin.component';
import { ManagepageComponent } from './components/managepage/managepage.component';


const routes: Routes = [
  {path: 'login', component: LoginComponent},
  {path: 'join', component: CreateorjoinComponent},
  {path: 'manage', component: ManagepageComponent},
  {path: '', redirectTo: '/login', pathMatch: 'full'}
]
@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
