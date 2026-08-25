import { Component } from '../../../base/Component.js';
import { getStore } from '../../../stores/base/Store.js';
import timelineArrowPosition from '../../../lib/utils/timelineArrowPosition';

export class SliderArrow extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');
    this.uiStore = getStore('uiStore');

    this.state = {
      windowWidth: window.innerWidth,
      ...this.getDerivedStateFromProps(props),
    };

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
  }

  handleResize() {
    this.setState({ windowWidth: window.innerWidth });
  }

  getDerivedStateFromProps(props) {
    const { isPlayed } = this.projectStore;
    const { isTimelineOpen } = this.uiStore;
    const { sortableWidth, time, timelineSideRef, startDateWithZoom, endDateWithZoom, startDate } = props;

    let style = null;
    if (timelineSideRef?.current) {
      style = timelineArrowPosition({
        time,
        startDateWithZoom,
        startDate,
        endDateWithZoom,
        isPlayed,
        timelineSideRef,
        sortableWidth,
      });
    }

    const arrowDisplay = isTimelineOpen ? 'block' : 'none';

    return {
      sortableWidth,
      time,
      timelineSideRef,
      startDateWithZoom,
      endDateWithZoom,
      startDate,
      style,
      arrowDisplay,
    };
  }

  render() {
    const { arrowDisplay, style } = this.state;

    const html = `
      <div class="slider-arrow" style="display: ${arrowDisplay}; ${style ? Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; ') : ''}"></div>
    `;

    return this.createElementFromHTML(html);
  }
}
