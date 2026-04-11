import { Component } from '../../../base/Component.js';
import { getStore } from '../../../stores/base/Store.js';
import moment from 'moment';
import _ from 'lodash';
import Timeline from 'timeline/lib/index';
import classnames from 'classnames';
import { ASSET_TYPES } from '../../../lib/constants/media';
import { FRACTIONAL_NUMBER, SANTISECOND, ONE_SECOND } from '../../../lib/constants/project';
import { MIN_DURATION, POPCORN_ELEMENT_TYPES, SEQUENCER } from '../../../lib/constants/popcorn';
import { NONE_CLASS } from '../../../lib/constants/animations';
import { DEFAULT_SETTINGS } from '../../../lib/constants/settings';
import { getTransitionButtons } from '../../../lib/utils/timeline';
import { LOWER_THIRDS_END_DURATION } from '../../../lib/constants/lowerThirds';
import { selectItem, arrayDeleteListener, emitterActions } from '../../../lib/mitt/emitter';
import { contextButtons } from '../../../lib/constants/timelineContextMenu';
import { acceptedDraggableItems } from '../../../lib/constants/dragNDropConstants';
import { dropItemOnTimeline } from '../../../lib/utils/dropItemOnTimeline';
import PopcornElement from './PopcornElement.js';
import { TRANSITION_TIMELINE_OFFSET } from '../../../lib/constants/settings/video-transition';
import TransitionButton from './TransitionButton.js';

const timelineRowHeight = 35;

export class PopcornElements extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');
    this.timelineStore = getStore('timelineStore');

    this.state = {
      startDate: props.startDate,
      endDate: props.endDate,
      startDateWithZoom: props.startDateWithZoom,
      endDateWithZoom: props.endDateWithZoom,
      sortableWidth: props.sortableWidth,
      layersRef: props.layersRef,
      isOver: false,
    };

    this.getExtraDuration = this.getExtraDuration.bind(this);
    this.getEnd = this.getEnd.bind(this);
    this.insertTransition = this.insertTransition.bind(this);
    this.changeTimelineDuration = this.changeTimelineDuration.bind(this);
    this.handleRowClick = this.handleRowClick.bind(this);
    this.onRowContextClick = this.onRowContextClick.bind(this);
    this.onItemContextClick = this.onItemContextClick.bind(this);
    this.handleInteraction = this.handleInteraction.bind(this);
    this.onDropElement = this.onDropElement.bind(this);
    this.handleElementChange = this.handleElementChange.bind(this);
  }

  componentDidMount() {
    arrayDeleteListener();
  }

  getExtraDuration(animation, outDuration) {
    if (animation && animation.out && animation.out.duration && animation.out.type !== NONE_CLASS) {
      return animation.out.duration;
    }
    if (outDuration) {
      return outDuration;
    }
    return 0;
  }

  getEnd(end, animation, outDuration) {
    end += this.getExtraDuration(animation, outDuration);
    return end;
  }

  async insertTransition({ transition, element }) {
    const { setIsAddingTransition, removeTransition, removedTransition, setUndo, projectData, updateVideoDuration, updateElementFromTimeline, createNewElement, elements, duration: cols } = this.projectStore;
    setIsAddingTransition(true);
    const transitionDuration = +((transition.end - transition.start).toFixed(2));
    transition.start = +(transition.start.toFixed(2)) + TRANSITION_TIMELINE_OFFSET;
    transition.end = +(transition.end.toFixed(2)) + TRANSITION_TIMELINE_OFFSET;

    const elementsForUpdate = [];
    const elementsEnds = [];
    let animationOut = 0;
    let itemStartAfterToVideo = null;

    const currentLayer = elements.filter(item => item.id === element.id);

    projectData.media.forEach((media) => {
      media.tracks.map((track) => {
        track.trackEvents.forEach(trackEvent => {
          if (trackEvent.track === currentLayer[0].track) {
            elementsEnds.push(trackEvent.popcornOptions.end);
            if ((element.end - transitionDuration) <= trackEvent.popcornOptions.end) {
              elementsForUpdate.push(trackEvent);
              if (trackEvent.popcornOptions.animation && trackEvent.popcornOptions.animation.out) {
                animationOut += trackEvent.popcornOptions.animation.out.duration;
              }
            }
          }
        });
        return null;
      });
    });
    setUndo();
    if (elementsForUpdate && elementsForUpdate.length) {
      elementsForUpdate.forEach(item => {
        if (item.popcornOptions.start <= itemStartAfterToVideo || !itemStartAfterToVideo) {
          itemStartAfterToVideo = item.popcornOptions.start;
        }
      });
    }

    if (element.end > itemStartAfterToVideo) {
      if (cols < (Math.max(...elementsEnds)
        + transitionDuration + animationOut) * SANTISECOND) {
        await updateVideoDuration((cols / SANTISECOND) + transitionDuration);
      }

      if (elementsForUpdate && elementsForUpdate.length) {
        elementsForUpdate.forEach(item => (
          updateElementFromTimeline({
            needUpdateStartEnd: true,
            elementId: item.id,
            start: item.popcornOptions.start + transitionDuration,
            end: item.popcornOptions.end + transitionDuration,
          }, false)));
      }
    }

    await updateElementFromTimeline({
      needUpdateStartEnd: true,
      elementId: element.id,
      start: transition.end + TRANSITION_TIMELINE_OFFSET,
      end: (element.end - element.start) + transition.end,
    }, false);
    await createNewElement({
      ...DEFAULT_SETTINGS[POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION],
      ...transition,
    });
    setIsAddingTransition(false);
    if (removedTransition) {
      setUndo();
    }
    removeTransition();
  }

  changeTimelineDuration(value) {
    this.projectStore.changeDuration(value.diff(this.state.startDate) / ONE_SECOND);
  }

  handleRowClick(e, rowIndex, currentTime) {
    const { layers } = this.projectStore;
    const { setTimelineSelectedItems, setActiveRow, setTimeOnClick, setContextMenu, releaseElement } = this.timelineStore;
    const row = layers.find(item => item.order === rowIndex);
    releaseElement();
    setTimelineSelectedItems([]);
    setActiveRow(row);
    setTimeOnClick(currentTime.diff(this.state.startDate) / ONE_SECOND);
    setContextMenu({ isOpen: false });
  }

  onRowContextClick(e, rowIndex, currentTime) {
    const { layers } = this.projectStore;
    const { setActiveRow, setTimeOnClick, setContextMenu, contextMenu, copiedItems } = this.timelineStore;
    const row = layers.find(item => Number(item.order) === Number(rowIndex));
    const posX = e.screenX;
    const posY = e.clientY;
    const buttons = contextMenu?.buttons || [];

    if (buttons.includes(contextButtons.COPY)) {
      buttons.splice(buttons.indexOf(contextButtons.COPY), 1);
    }

    if (copiedItems?.length && !buttons.includes(contextButtons.PASTE)) {
      buttons.push(contextButtons.PASTE);
    }

    setActiveRow(row);
    setTimeOnClick(currentTime.diff(this.state.startDate) / ONE_SECOND);
    setContextMenu({ posX, posY, isClickOnRow: true, buttons, isOpen: true });
  }

  onItemContextClick(e, itemKey) {
    const { setContextMenu, contextMenu } = this.timelineStore;
    const posX = e.screenX;
    const posY = e.clientY;
    const buttons = contextMenu?.buttons || [];

    if (buttons.includes(contextButtons.PASTE)) {
      buttons.splice(buttons.indexOf(contextButtons.PASTE), 1);
    }

    if (!buttons.includes(contextButtons.COPY)) {
      buttons.push(contextButtons.COPY);
    }

    selectItem({ type: emitterActions.SELECT }, itemKey);
    setContextMenu({ posX, posY, isClickOnRow: false, buttons, isOpen: true });
  }

  handleInteraction(type, changes, newElements) {
    const { setIsActiveTimeline, timelineSelectedItems, setTimelineSelectedItems, setContextMenu, activeElementId, releaseElement, setTimeOnClick } = this.timelineStore;
    const { startDate } = this.state;
    setIsActiveTimeline(true);
    switch (type) {
      case Timeline.changeTypes.oneItemSelected: {
        setTimeOnClick(changes.currentTime.diff(startDate) / ONE_SECOND);
        changes.e.stopPropagation();
        const newSelection = timelineSelectedItems.slice();
        const idx = timelineSelectedItems.indexOf(changes.item.id);
        if (changes.e.ctrlKey || changes.e.shiftKey || changes.e.metaKey) {
          if (idx >= 0) {
            if (activeElementId === changes.item.id) {
              releaseElement();
            }
            newSelection.splice(idx, 1);
          } else {
            newSelection.push(changes.item.key);
            if (Object.values(POPCORN_ELEMENT_TYPES).includes(changes.item.type)) {
              selectItem(changes.e, changes.item.i);
            }
          }
          setTimelineSelectedItems(newSelection);
          setContextMenu({ isOpen: false });
        } else {
          if (activeElementId !== changes.item.id) {
            selectItem(changes.e, changes.item.i);
            setTimelineSelectedItems([changes.item.id]);
            setContextMenu({ isOpen: false });
          } else {
            setTimelineSelectedItems();
            setContextMenu({ isOpen: false });
            releaseElement();
          }
          return null;
        }
        break;
      }
      case Timeline.changeTypes.dragStart:
      case Timeline.changeTypes.resizeStart: {
        return timelineSelectedItems;
      }
      case Timeline.changeTypes.dragEnd:
      case Timeline.changeTypes.resizeEnd: {
        const { updateElementFromTimeline } = this.projectStore;
        const returnSelectedItems = [];
        newElements.forEach(item => {
          let needUpdateLayer = false;
          let needUpdateStartEnd = false;
          let start;
          let end;

          if (!item.notSelected) {
            returnSelectedItems.push(item.key);
          }

          if (item.isUpdatedRow) {
            needUpdateLayer = true;
          }
          if (item.isUpdatedStartEnd) {
            needUpdateStartEnd = true;
            start = item.start.diff(startDate) / ONE_SECOND;

            if (item.animation?.out?.duration) {
              end = (item.end.diff(startDate) - item.animation?.out?.duration * ONE_SECOND)
                / ONE_SECOND;
            } else if (item.type === POPCORN_ELEMENT_TYPES.JSON_ANIMATION) {
              end = (item.end.diff(startDate) - LOWER_THIRDS_END_DURATION * ONE_SECOND)
                / ONE_SECOND;
            } else {
              end = item.end.diff(startDate) / ONE_SECOND;
            }
          }

          if (needUpdateLayer || needUpdateStartEnd) {
            updateElementFromTimeline({
              end,
              start,
              needUpdateLayer,
              needUpdateStartEnd,
              elementId: item.id,
              layerLevel: item.row,
            });
          }
        });
        setTimelineSelectedItems(returnSelectedItems);
        break;
      }
      case Timeline.changeTypes.itemsSelected: {
        setTimelineSelectedItems(_.map(changes, 'key'));
        break;
      }
      default:
        return changes;
    }
  }

  onDropElement({ action }, monitor) {
    const data = dropItemOnTimeline({
      monitor,
      timelineRowHeight,
      sortableWidth: this.state.sortableWidth,
      startDateWithZoom: this.state.startDateWithZoom,
      startDate: this.state.startDate,
      endDateWithZoom: this.state.endDateWithZoom,
      layers: this.projectStore.layers,
      projectData: this.projectStore.projectData,
    });
    action(data);
  }

  handleElementChange(elementId, changes) {
    this.projectStore.updateElementFromTimeline({
      elementId,
      ...changes,
    });
  }

  render() {
    const { layers, elements, duration: cols, activeElementId } = this.projectStore;
    const { timelineSelectedItems } = this.timelineStore;
    const { startDateWithZoom, endDateWithZoom, startDate, endDate, sortableWidth, layersRef, isOver } = this.state;

    const layersCount = layers.length;

    if (!layersCount) {
      return null;
    }

    const layouts = elements.map(element => {
      const {
        popcornOptions,
        popcornOptions: { id, start, animation, title, outDuration, duration, kind },
        type,
        dimensions,
      } = element;

      let { popcornOptions: { end } } = element;

      if (kind === ASSET_TYPES.PERSONALIZED_VOICE && duration < 1) {
        end = start + (cols / FRACTIONAL_NUMBER > 1 ? cols / FRACTIONAL_NUMBER : 1);
      }

      let maxDuration = null;

      if (type === SEQUENCER) {
        maxDuration = duration * ONE_SECOND;
      }

      const x = start * SANTISECOND;
      const w = (this.getEnd(end, animation, outDuration) - start) * SANTISECOND;
      const layer = layers.find(item => item.id === element.track);
      const timeStart = moment(startDate.diff(0) + start * ONE_SECOND);
      let timeEnd = moment(startDate.diff(0) + end * ONE_SECOND);

      if (animation?.out?.duration) {
        timeEnd = moment(timeEnd.diff(0) + animation.out.duration * ONE_SECOND);
      } else if (type === POPCORN_ELEMENT_TYPES.JSON_ANIMATION) {
        timeEnd = moment(timeEnd.diff(0) + LOWER_THIRDS_END_DURATION * ONE_SECOND);
      }

      return {
        ...popcornOptions,
        x,
        y: layer.order,
        w,
        i: id,
        key: id,
        start: timeStart,
        end: timeEnd,
        type,
        animation,
        color: '#363651',
        title,
        row: layer.order,
        maxDuration,
        layer,
        dimensions,
        minDuration: (MIN_DURATION + this.getExtraDuration(animation, outDuration)) * ONE_SECOND,
        isResizable: type !== POPCORN_ELEMENT_TYPES.JSON_TRANSITION
          && kind !== ASSET_TYPES.PERSONALIZED_VOICE
          && type !== POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION,
      };
    });

    const components = layouts.map((item, index, array) => {
      const transitionButtons = getTransitionButtons(item, index, array);
      item.render = (props) => {
        const span = document.createElement('span');
        span.className = classnames('timeline-grid-item', item.type);
        Object.assign(span, props);

        const popcornElement = new PopcornElement({
          item,
          onChange: this.handleElementChange.bind(this, item.i),
          fields: this.props.fields || {},
          element: item,
        });
        span.appendChild(popcornElement.render());

        if (transitionButtons && transitionButtons.length) {
          transitionButtons.forEach(({ transition, element: el, type, key, from, to }) => {
            const button = new TransitionButton({ type, onClick: () => this.insertTransition({ transition, element: el }), from, to });
            span.appendChild(button.render());
          });
        }

        return span;
      };
      return item;
    });

    const groups = layers.length ? layers.map((item, i) => ({ id: Number(i) })) : [];

    if (startDateWithZoom && endDateWithZoom) {
      const div = document.createElement('div');
      div.className = classnames('timeline-container', { 'timeline-container-active': isOver });

      // Note: Timeline is a third-party component, assuming it can be instantiated similarly
      const timeline = new Timeline({
        shallowUpdateCheck: true,
        items: components,
        groups,
        startDate: startDateWithZoom,
        endDate: endDateWithZoom,
        originalStartDate: startDate,
        originalEndDate: endDate,
        selectedItems: timelineSelectedItems,
        showCursorTime: true,
        itemHeight: timelineRowHeight,
        scrollBlock: layersRef.current,
        onInteraction: this.handleInteraction,
        onRowClick: this.handleRowClick,
        componentId: 'timeline-block',
        updateEndDate: this.changeTimelineDuration,
        layersNumber: layersCount,
        offsetLeft: sortableWidth,
        activeElementId,
        onItemContextClick: this.onItemContextClick,
        onRowContextClick: this.onRowContextClick,
      });

      // Assuming Timeline has a render method that returns an element
      div.appendChild(timeline.render ? timeline.render() : timeline);

      return div;
    }
    return null;
  }
}
