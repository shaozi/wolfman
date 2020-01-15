import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import {
  trigger,
  state,
  style,
  animate,
  transition,
  // ...
} from '@angular/animations';


@Component({
  selector: 'app-action-menu',
  templateUrl: './action-menu.component.html',
  styleUrls: ['./action-menu.component.sass'],
  animations: [
    trigger('menuInOutTrigger', [
      state('in', style({
        //transform: 'translateY(0)'
        top: 0
      })),
      state('out', style({
        //transform: 'translateY(100%)'
        top: 'calc(100% - 70px)'
      })),
      transition('in => out', [
        animate(300)
      ]),
      transition('out => in', [
        animate(300)
      ])
    ])
  ]
})
export class ActionMenuComponent implements OnInit {

  @Input() actions: Array<{ name: string }>
  @Output() clicked = new EventEmitter<string>()

  public isHidden = false

  constructor() { }

  ngOnInit() {
  }

  select(name: string) {
    this.clicked.emit(name)
  }
}
