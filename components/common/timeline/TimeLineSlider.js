import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';
import classnames from 'classnames';
import moment from 'moment';
import LineSlider from './LineSlider.js';

export class TimeLineSlider extends Component {
  constructor(props = {}) {
    super(props);
    this.uiStore = getStore('uiStore');
    this.projectStore = getStore('projectStore');
    this.state = {
      hoverCurrentTime: null,
      timestampLeft: null,
    };
    this.sliderBlockRef = null;
    this.handleSliderChange = this.handleSliderChange.bind(this);
    this.timeOnMove = this.timeOnMove.bind(this);
    this.timeOnLeave = this.timeOnLeave.bind(this);
    this.subscribeToStore(this.uiStore, () => this.update());
    this.subscribeToStore(this.projectStore, () => this.update());
  }

  onMount() {
    this.updateThumbVisibility();
  }

  updateThumbVisibility() {
    const thumb = document.querySelector('.timeline .slider-thumb');
    const { time, isPlayed } = this.projectStore.getState();
    const { startDateWithZoom, endDateWithZoom, startDate } = this.props;
    const sliderDuration = time * 10;
    const sliderStart = startDateWithZoom.diff(startDate);
    const sliderEnd = endDateWithZoom.diff(startDate);
    if ((sliderDuration < sliderStart || sliderDuration > sliderEnd) && !isPlayed) {
      if (thumb) thumb.style.display = 'none';
    } else {
      if (thumb) thumb.style.display = 'flex';
    }
  }

  handleSliderChange(event) {
    const newValue = parseFloat(event.target.value);
    const { startDateWithZoom, endDateWithZoom, startDate, setStartDateWithZoom, setEndDateWithZoom } = this.props;
    const { updateTime } = this.projectStore;

    if (newValue * 10 === endDateWithZoom.diff(startDate) && !endDateWithZoom.isSame(endDate)) {
      const newEnd = moment(startDateWithZoom.diff(0) + 1000);
      if (newEnd.diff(endDate) > 0) {
        setStartDateWithZoom(moment(endDateWithZoom.diff(0) - endDateWithZoom.diff(startDateWithZoom)));
        setEndDateWithZoom(endDate);
        updateTime((endDate.diff(startDate)) / 10);
      } else {
        setStartDateWithZoom(moment(startDateWithZoom.diff(0) + 1000));
        setEndDateWithZoom(newEnd);
        updateTime(newValue + 100);
      }
    } else if (newValue * 10 === startDateWithZoom.diff(startDate) && !startDateWithZoom.isSame(startDate)) {
      const newStart = moment(startDateWithZoom.diff(0) - 1000);
      if (newStart.diff(startDate) < 0) {
        setStartDateWithZoom(startDate);
        setEndDateWithZoom(moment(startDate.diff(0) - endDateWithZoom.diff(startDateWithZoom)));
        updateTime(0);
      } else {
        setStartDateWithZoom(newStart);
        setEndDateWithZoom(moment(endDateWithZoom.diff(0) - 1000));
        updateTime(newValue - 100);
      }
    } else {
      updateTime(newValue);
    }
  }

  timeOnMove(e) {
    const { endDateWithZoom, startDateWithZoom, sortableWidth } = this.props;
    if (endDateWithZoom.diff(startDateWithZoom) <= 0) return;
    const mousePosition = e.clientX - sortableWidth;
    const blockWidth = this.sliderBlockRef.getBoundingClientRect().width;
    const msWidth = blockWidth / endDateWithZoom.diff(startDateWithZoom);
    let currentTime = startDateWithZoom.diff(0) + (mousePosition / msWidth);
    if (currentTime < startDateWithZoom.diff(0)) currentTime = startDateWithZoom.diff(0);
    if (currentTime > endDateWithZoom.diff(0)) currentTime = endDateWithZoom.diff(0);

    this.setState({
      hoverCurrentTime: moment(currentTime).format('mm:ss.SS'),
      timestampLeft: mousePosition,
    });
  }

  timeOnLeave() {
    this.setState({ hoverCurrentTime: null });
  }

  render() {
    const {
      containerClassName,
      sliderClassName,
      disabled,
      startDate,
      endDate,
      startDateWithZoom,
      endDateWithZoom,
      sortableWidth,
    } = this.props;
    const { hoverCurrentTime, timestampLeft } = this.state;
    const { isTimelineOpen } = this.uiStore.getState();
    const { duration, time, layers } = this.projectStore.getState();

    const layersCount = layers.length;
    const marginRight = layersCount > 4 ? '20px' : '14px';

    const minValue = startDateWithZoom ? Math.max(startDateWithZoom.diff(startDate) / 10, 0) : 0;
    const maxValue = endDateWithZoom ? Math.min(endDateWithZoom.diff(startDate) / 10, duration) : duration;

    const container = document.createElement('div');
    container.className = classnames(containerClassName, 'slider-element', { 'slider-element-hidden': !isTimelineOpen });
    container.style.marginRight = marginRight;
    this.sliderBlockRef = container;
    this.addEventListener(container, 'mousemove', this.timeOnMove);
    this.addEventListener(container, 'mouseleave', this.timeOnLeave);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = classnames(sliderClassName);
    slider.value = time;
    slider.min = minValue;
    slider.max = maxValue;
    slider.disabled = disabled;
    this.addEventListener(slider, 'input', this.handleSliderChange);
    container.appendChild(slider);

    if (hoverCurrentTime) {
      const timestamp = document.createElement('div');
      timestamp.className = 'timestamp';
      timestamp.style.left = `${timestampLeft}px`;
      timestamp.textContent = hoverCurrentTime;
      this.addEventListener(timestamp, 'mouseover', this.timeOnLeave);
      this.addEventListener(timestamp, 'focus', this.timeOnLeave);
      container.appendChild(timestamp);
    }

    if (isTimelineOpen) {
      const lineSliderContainer = document.createElement('div');
      lineSliderContainer.className = 'line-slider';
      const lineSlider = new LineSlider({
        startDate,
        endDate,
        startDateWithZoom,
        endDateWithZoom,
      });
      lineSliderContainer.appendChild(lineSlider.render());
      container.appendChild(lineSliderContainer);
    }

    return container;
  }
}

export default TimeLineSlider;