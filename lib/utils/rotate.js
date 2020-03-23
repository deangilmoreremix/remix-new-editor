export default class Rotate {
  constructor(el, deg, cb) {
    this.box = el.parentNode;
    this.deg = deg || 0;
    this.cb = cb;
  }

  start() {
    this.box.addEventListener('mousedown', this.handler);
    this.box.style.transform = `rotate(${this.deg}deg)`;
  }

  delete() {
    this.box.removeEventListener('mousedown', this.handler);
    document.removeEventListener('mouseup', this.stop);
    document.removeEventListener('mousemove', this.rotate);
  }

  get degree() {
    return Math.round(this.deg);
  }

  stop = () => {
    document.removeEventListener('mouseup', this.stop);
    document.removeEventListener('mousemove', this.rotate);
  };

  handler = () => {
    const rect = this.box.getBoundingClientRect();
    this.cX = window.pageXOffset + rect.left + rect.width / 2;
    this.cY = window.pageYOffset + rect.top + rect.height / 2;
    document.addEventListener('mouseup', this.stop);
    document.addEventListener('mousemove', this.rotate);
  };

  rotate = (e) => {
    this.box.style.transform = `rotate(${this.getAngle(e.pageX, e.pageY)}deg)`;
  };

  getAngle(x, y) {
    const dy = y - this.cY;
    const dx = x - this.cX;
    let theta = Math.atan2(dy, dx); // range (-PI, PI]
    theta *= 180 / Math.PI; // rads to degs, range (-180, 180]

    if (theta < 0) theta = 360 + theta; // range [0, 360)
    this.deg = (theta + 90) % 360;
    this.cb(Math.round(this.deg));
    return this.deg;
  }
}
