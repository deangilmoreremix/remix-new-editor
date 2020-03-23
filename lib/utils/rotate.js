export default class Rotate {
  constructor(el, deg, cb) {
    this.box = el.parentNode;
    this.deg = deg || 0;
    this.cb = cb;
  }

  start() {
    this.box.addEventListener('mousedown', this._handler);
    this.box.style.transform = `rotate(${this.deg}deg)`;
  }

  delete() {
    this.box.removeEventListener('mousedown', this._handler);
    document.removeEventListener('mouseup', this._stop);
    document.removeEventListener('mousemove', this._rotate);
  }

  get degree() {
    return Math.round(this.deg);
  }

  _stop = () => {
    document.removeEventListener('mouseup', this._stop);
    document.removeEventListener('mousemove', this._rotate);
  };

  _handler = () => {
    const rect = this.box.getBoundingClientRect();
    this.cX = window.pageXOffset + rect.left + rect.width / 2;
    this.cY = window.pageYOffset + rect.top + rect.height / 2;
    document.addEventListener('mouseup', this._stop);
    document.addEventListener('mousemove', this._rotate);
  };

  _rotate = (e) => {
    this.box.style.transform = `rotate(${this._getAngle(e.pageX, e.pageY)}deg)`;
  };

  _getAngle(x, y) {
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
