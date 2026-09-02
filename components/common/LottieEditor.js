import { Component } from '../base/Component.js';
import isEmpty from 'lodash/isEmpty.js';
import Lottie from '../../lib/lottie/Lottie.js';
import FormColor from '../form/FormColor.js';
import { rgbToHex, setColors } from '../../lib/lottie/utils.js';
import { colorToRgbaString, parseRgbaString } from '../../lib/utils/color.js';
import { isValidJsonUrl } from '../../lib/popcorn/helpers.js';
import { loadUrl } from '../../lib/requestCreator.js';

const fetchAnimation = async (url) => new Promise((resolve, reject) => {
  if (isValidJsonUrl(url)) {
    resolve(url);
  } else {
    reject(new Error('Not correct URL'));
  }
}).then(loadUrl);

export class LottieEditor extends Component {
  constructor(props = {}) {
    super(props);
    this.state = {
      isStopped: false,
      isPaused: false,
      colors: props.value || [],
      animation: null,
    };
    this.animationElement = null;
    this.handleStop = this.handleStop.bind(this);
    this.completeAnimation = this.completeAnimation.bind(this);
    this.pickColor = this.pickColor.bind(this);
  }

  async fetchAnimationData() {
    try {
      this.setState({ animation: await fetchAnimation(this.props.file) });
    } catch (error) {
      console.error('Failed to fetch animation:', error);
    }
  }

  onMount() {
    this.fetchAnimationData();
  }

  handleStop() {
    this.setState({ isStopped: !this.state.isStopped, isPaused: false });
  }

  completeAnimation() {
    this.setState({ isStopped: true });
  }

  pickColor(newColor, oldColor) {
    const newRgb = parseRgbaString(newColor);
    const oldRgb = parseRgbaString(oldColor);

    const newColors = this.state.colors.map(c => {
      const shouldUpdate = Object.keys(oldRgb).every(key => c[key] === oldRgb[key]);

      if (shouldUpdate) {
        const { r, g, b } = newRgb;
        const hex = rgbToHex(r, g, b);
        return { ...c, color: hex, ...newRgb };
      }

      return c;
    });
    this.props.setColor(newColors);
    this.setState({ colors: newColors });
  }

  render() {
    const { showControls, segments = {}, className, showPreview, formColorClassName, isLabel } = this.props;
    const { isStopped, isPaused, colors, animation } = this.state;

    const container = document.createDocumentFragment();

    // Colors
    const showColors = new Set();
    if (colors && colors.length) {
      colors.forEach(color => {
        showColors.add(colorToRgbaString(color));
      });
    }
    Array.from(showColors).forEach((oldColor, i) => {
      const formColor = new FormColor({
        value: oldColor,
        onChange: (newColor) => this.pickColor(newColor, oldColor),
        className: formColorClassName,
        label: isLabel ? `Lower Third color ${i + 1}` : null,
      });
      container.appendChild(formColor.render());
    });

    // Animation
    if (!isEmpty(animation) && showPreview) {
      const preparedAnimation = colors && colors.length ? setColors(animation, colors) : animation;
      const options = {
        loop: false,
        autoplay: true,
        animationData: preparedAnimation,
        rendererSettings: {
          viewBoxOnly: false,
          preserveAspectRatio: 'xMidYMid slice',
        },
      };

      const lottie = new Lottie({
        options,
        isStopped,
        isPaused,
        eventListeners: [
          { eventName: 'DOMLoaded', callback: () => {
            const anim = this.animationElement?.anim;
            if (anim) {
              if (isEmpty(segments)) {
                anim.play();
              } else {
                anim.playSegments(segments, true);
              }
            }
          }},
          { eventName: 'complete', callback: this.completeAnimation },
        ],
        speed: 1,
        looped: false,
        className,
      });
      this.animationElement = lottie;
      container.appendChild(lottie.render());
    }

    // Controls
    if (showControls) {
      const controls = document.createElement('div');
      controls.className = 'lottie-controls';

      const stopButton = document.createElement('button');
      stopButton.className = 'icon-button timeline-play';
      stopButton.innerHTML = !isStopped ? stopIcon : playIcon; // Assume SVG strings
      this.addEventListener(stopButton, 'click', this.handleStop);
      controls.appendChild(stopButton);

      const pauseButton = document.createElement('button');
      pauseButton.className = 'icon-button timeline-play';
      pauseButton.innerHTML = pauseIcon;
      this.addEventListener(pauseButton, 'click', () => this.setState({ isPaused: !isPaused }));
      controls.appendChild(pauseButton);

      container.appendChild(controls);
    }

    return container;
  }
}

export default LottieEditor;