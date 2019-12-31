import { Injectable } from '@angular/core';
import { Howl, Howler } from 'howler'

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  public backgroundMusic: Howl
  public sounds: { [key: string]: Howl } = {}
  public mute: boolean

  public soundNames: Array<string> = [
    'isNight',		  // 天黑了
    'isDay',		    // 天亮了
    'closeEyes',		// 请闭眼
    'openEyes',		  // 请睁眼
    'everyone',		  // 大家
    'wolves',		    // 狼人
    'guard',		    // 守卫
    'witch',		    // 女巫
    'hunter',		    // 猎人
    'prophet',		  // 预言家
    'voteSheriff',	// 开始竞选警长 
    'voteStart',		// 请投票
    'voteStop',		  // 投票结束
    'pleaseSpeak',	// 请发言
    'lastword', 		// 请说遗言
    'choose' 		    // 请选择
  ]

  toggleMute() {
    this.mute = !this.mute
    Howler.mute(this.mute)
  }

  constructor() {
    this.backgroundMusic = new Howl({
      src: ['/assets/ra2.mp3'],
      loop: true,
      volume: 0.25,
      onplayerror: function () {
        this.backgroundMusic.once('unlock', function () {
          this.backgroundMusic.play();
        });
      }
    })
    this.soundNames.forEach(name => {
      this.sounds[name] = new Howl({
        src: [`/assets/${name}.mp3`],
        loop: false
      })
    })
  }

  playAsync(sound: Howl) {
    return new Promise(function (resolve, reject) {
      sound.on('end', function () {
        resolve()
      })
      sound.once('playerror', function () {
        sound.once('unlock', function () {
          sound.play()
        })
      })
      sound.play()
    })
  }

  async playSequence(names: Array<string>) {
    for (let name of names) {
      await this.playAsync(this.sounds[name])
    }
  }

  playBackgroundMusic() {
    this.backgroundMusic.play()
  }
  stopBackgroundMusic() {
    this.backgroundMusic.stop()
  }
  toggleBackgroundMusic() {
    if (this.backgroundMusic.playing()) {
      this.backgroundMusic.stop()
    } else {
      this.backgroundMusic.play()
    }
  }
}
