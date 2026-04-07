import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';
import Timeline from 'timeline/lib/index.js';
import moment from 'moment';
import { SANTISECOND } from '../../../lib/constants/project.js';

export class LineSlider extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');
  }

  render() {
    const { startDate, endDate, startDateWithZoom, endDateWithZoom } = this.props;
    const { duration } = this.projectStore;

    const layouts = [
      {
        key: 1,
        row: 0,
        start: startDate,
        end: endDate,
        isResizable: false,
      },
    ];

    const array = [];
    const maxI = duration / SANTISECOND;
    const stampNum = parseInt(maxI / 30, 10) || 1;
    for (let i = 0; i <= maxI; i++) {
      array.push(i);
    }

    const itemWidth = `${100 / (maxI - 1)}%`;

    if (!Number.isInteger(maxI)) {
      array.pop();
      array.push(maxI);
    }

    const line = array.map((el, i) => {
      if (el * stampNum <= maxI) {
        if (el % 2 === 0 && el !== maxI) {
          const momentTime = moment.duration(el * stampNum, 'seconds');
          const stamp = moment({ minutes: 0, seconds: 0 }).add(momentTime).format('mm:ss');
          const item = document.createElement('div');
          item.className = 'line-slider-item';
          item.style.width = itemWidth;

          const block = document.createElement('div');
          block.className = 'line-slider-block';
          item.appendChild(block);

          const number = document.createElement('div');
          number.className = 'line-slider-number';
          number.textContent = stamp;
          item.appendChild(number);

          return item;
        } else if (el === maxI && (array[i - 1] % 2 !== 0)) {
          let lastItemWidth = '1px';
          if (!Number.isInteger(el)) {
            const restSeconds = maxI % 1;
            lastItemWidth = `${(100 / (maxI - 1)) * restSeconds}%`;
          }
          const item = document.createElement('div');
          item.className = 'line-slider-item';
          item.style.width = lastItemWidth;

          const block = document.createElement('div');
          block.className = 'line-slider-block';
          item.appendChild(block);

          return item;
        } else if (el === maxI && (array[i - 1] % 2 === 0)) {
          let lastItemWidth = '1px';
          if (!Number.isInteger(el)) {
            const restSeconds = maxI % 1;
            lastItemWidth = `${(100 / (maxI - 1)) * restSeconds}%`;
          }
          const item = document.createElement('div');
          item.className = 'line-slider-item';
          item.style.width = lastItemWidth;

          const block = document.createElement('div');
          block.className = 'line-slider-little-block';
          item.appendChild(block);

          return item;
        } else {
          const item = document.createElement('div');
          item.className = 'line-slider-item';
          item.style.width = itemWidth;

          const block = document.createElement('div');
          block.className = 'line-slider-little-block';
          item.appendChild(block);

          return item;
        }
      }
      return null;
    }).filter(Boolean);

    const components = layouts.map(item => {
      const element = document.createElement('span');
      element.className = 'line-slider-element';
      line.forEach(l => element.appendChild(l));
      item.render = () => element;
      return item;
    });

    if (startDateWithZoom && endDateWithZoom) {
      // Since Timeline is JS library, assume it can take options
      const timeline = new Timeline({
        shallowUpdateCheck: true,
        items: components,
        groups: [{ id: 0 }],
        startDate: startDateWithZoom,
        endDate: endDateWithZoom,
        originalStartDate: startDate,
        originalEndDate: endDate,
        onInteraction: () => {},
        itemHeight: 29,
        componentId: 'timeline-line',
        withDragSelection: false,
        layersNumber: 1,
      });
      return timeline.render ? timeline.render() : document.createElement('div'); // Placeholder
    }
    return null;
  }
}

export default LineSlider;