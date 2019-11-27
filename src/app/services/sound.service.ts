import { Injectable } from '@angular/core';
import { Howl, Howler } from 'howler'

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  sound = new Howl({
    src: ['/assets/ra2.mp3'],
    // autoplay: true,
    loop: true,
    volume: 0.5,
    onend: function () {
      console.log('Finished!');
    },
    onplayerror: function () {
        this.sound.once('unlock', function () {
        this.sound.play();
      });
    }
  })

  constructor() { }
  play() {
    this.sound.play()
  }
  stop() {
    this.sound.stop()
  }
  toggle() {
    if (this.sound.playing()) {
      this.sound.stop()
    } else {
      this.sound.play()
    }
  }
}
