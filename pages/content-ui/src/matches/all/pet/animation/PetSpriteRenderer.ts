import { PET_ANIMATION_SHEETS } from './sheets';
import { DISPLAY_SIZE, SOURCE_FRAME, VIEW_SIZE } from '../constants';
import { animTopic } from '../core/topics';
import type { PetAnimId } from './types';
import type { PetPublish } from '../core/topics';

/**
 * CSS 雪碧图渲染器。只负责帧动画与朝向。
 * 通过 publish 向总线推送 `run:start` 等主题，并同步汇总 `animation`。
 */
class PetSpriteRenderer {
  private publish: PetPublish | null = null;

  private el: HTMLDivElement | null = null;
  private facingLeft = false;
  private playing = false;
  private anim: PetAnimId = 'run';
  private frame = 0;
  private leftoverMs = 0;
  private oneShotFinished = false;
  private defaultAnim: PetAnimId = 'run';

  get viewSize() {
    return VIEW_SIZE;
  }

  bindPublish = (publish: PetPublish) => {
    this.publish = publish;
  };

  setDefaultAnim = (anim: PetAnimId) => {
    this.defaultAnim = anim;
  };

  mount = (host: HTMLElement) => {
    const el = document.createElement('div');
    el.className = 'sm-pet__sprite';
    el.setAttribute('aria-hidden', 'true');
    host.replaceChildren(el);
    this.el = el;
    this.applySheet(this.defaultAnim);
  };

  play = (anim: PetAnimId = this.defaultAnim) => {
    this.setAnim(anim);
  };

  pause = () => {
    this.playing = false;
    this.leftoverMs = 0;
  };

  sit = () => {
    this.setAnim('sit');
  };

  sitDown = () => {
    this.setAnim('sit-down');
  };

  tick = (dtMs: number) => {
    if (!this.playing || !this.el) {
      return;
    }

    const meta = PET_ANIMATION_SHEETS[this.anim];
    this.leftoverMs += dtMs;
    while (this.leftoverMs >= meta.frameMs) {
      this.leftoverMs -= meta.frameMs;
      if (meta.loop) {
        this.frame = (this.frame + 1) % meta.frames;
        this.notifyFrame();
      } else if (this.frame < meta.frames - 1) {
        this.frame += 1;
        this.notifyFrame();
      } else if (!this.oneShotFinished) {
        this.oneShotFinished = true;
        this.playing = false;
        this.paint();
        this.notifyComplete();
        return;
      }
    }
    this.paint();
  };

  setFacingLeft = (facingLeft: boolean) => {
    this.facingLeft = facingLeft;
    this.paint();
  };

  getAnim = (): PetAnimId => this.anim;

  getFrame = () => this.frame;

  isPlaying = () => this.playing;

  isSitting = () => this.anim === 'sit' && !this.playing;

  isSitDown = () => this.anim === 'sit-down';

  isSitLike = () => this.isSitting() || this.isSitDown();

  destroy = () => {
    this.publish = null;
    this.el = null;
  };

  private setAnim = (anim: PetAnimId) => {
    if (!this.el) {
      return;
    }
    const meta = PET_ANIMATION_SHEETS[anim];
    if (this.anim === anim && this.playing && meta.loop) {
      return;
    }
    this.applySheet(anim);
    this.playing = true;
    this.notifyStart();
  };

  private applySheet = (anim: PetAnimId) => {
    if (!this.el) {
      return;
    }
    const meta = PET_ANIMATION_SHEETS[anim];
    const sourceFrame = meta.sourceFrame ?? SOURCE_FRAME;
    const scale = DISPLAY_SIZE / sourceFrame;
    this.anim = anim;
    this.frame = 0;
    this.leftoverMs = 0;
    this.oneShotFinished = false;
    this.el.style.width = `${DISPLAY_SIZE}px`;
    this.el.style.height = `${DISPLAY_SIZE}px`;
    this.el.style.overflow = 'hidden';
    this.el.style.backgroundImage = `url("${meta.url}")`;
    this.el.style.backgroundRepeat = 'no-repeat';
    this.el.style.backgroundSize = `${sourceFrame * meta.frames * scale}px ${DISPLAY_SIZE}px`;
    this.el.style.imageRendering = 'pixelated';
    this.el.style.transformOrigin = 'center';
    this.paint();
  };

  private paint = () => {
    if (!this.el) {
      return;
    }
    this.el.style.backgroundPosition = `${-DISPLAY_SIZE * this.frame}px 0`;
    this.el.style.transform = this.facingLeft ? 'scaleX(-1)' : 'scaleX(1)';
  };

  private notifyStart = () => {
    if (!this.publish) {
      return;
    }
    const meta = PET_ANIMATION_SHEETS[this.anim];
    const payload = {
      frame: this.frame,
      frames: meta.frames,
      frameMs: meta.frameMs,
      loop: meta.loop,
    };
    this.publish(animTopic(this.anim, 'start'), payload);
    this.publish('animation', { type: 'start', anim: this.anim, ...payload });
  };

  private notifyFrame = () => {
    if (!this.publish) {
      return;
    }
    const meta = PET_ANIMATION_SHEETS[this.anim];
    const payload = { frame: this.frame, frames: meta.frames };
    this.publish(animTopic(this.anim, 'frame'), payload);
    this.publish('animation', { type: 'frame', anim: this.anim, ...payload });
  };

  private notifyComplete = () => {
    if (!this.publish) {
      return;
    }
    const meta = PET_ANIMATION_SHEETS[this.anim];
    const payload = { frames: meta.frames };
    this.publish(animTopic(this.anim, 'complete'), payload);
    this.publish('animation', { type: 'complete', anim: this.anim, ...payload });
  };
}

export { PetSpriteRenderer };
