import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateorjoinComponent } from './createorjoin.component';

describe('CreateorjoinComponent', () => {
  let component: CreateorjoinComponent;
  let fixture: ComponentFixture<CreateorjoinComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CreateorjoinComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CreateorjoinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
