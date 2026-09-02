import { action, observable, reaction } from 'mobx';

import { emitter, emitterActions } from '../../lib/mitt/emitter';
import { SANTISECOND } from '../../lib/constants/project';

export default class TimelineStore {
  constructor(props) {
    this.projectStore = props.projectStore;

    emitter.on(emitterActions.ARRAY_DELETE, () => {
      if (!this.isActiveTimeline) {
        return null;
      }
      this.timelineSelectedItems.forEach(id => {
        this.projectStore.removeElement(id);
      });
      this.timelineSelectedItems = [];
    });

    emitter.on(emitterActions.DELETE, id => {
      if (this.timelineSelectedItems.includes(id)) {
        this.timelineSelectedItems = this.timelineSelectedItems.filter(el => el !== id) || [];
      }
      if (this.copiedItems.includes(id)) {
        this.copiedItems = this.copiedItems.filter(el => el !== id) || [];
      }
    });

    reaction(
      () => this.projectStore.elements.length,
      (elementsLength) => {
        if (elementsLength >= this.projectElementsLength) {
          this.projectElementsLength = elementsLength;
          return;
        }
        this.projectElementsLength = elementsLength;
        this.handleUpdateCopiedItems();
      },
    );
  }

  @observable timelineHeight = 35;

  @observable isActiveTimeline = false;

  @observable projectElementsLength = 0;

  @observable timelineSelectedItems = [];

  @observable copiedItems = [];

  @observable activeRow = null;

  @observable timeOnClick = null;

  @observable contextMenu = {
    posX: 0,
    posY: 0,
    isClickOnRow: true,
    isOpen: false,
    buttons: [],
  };

  @action
  setTimelineHeight = (value = 35) => {
    this.timelineHeight = value;
  };

  @action
  setIsActiveTimeline = (value = false) => {
    this.isActiveTimeline = value;
  };

  @action
  setTimelineSelectedItems = (ids = []) => {
    this.timelineSelectedItems = ids;
  };

  @action
  setCopiedItems = () => {
    this.copiedItems = this.timelineSelectedItems;
  };

  @action
  setActiveRow = track => {
    if (track) {
      this.activeRow = track;
    }
  };

  @action
  setTimeOnClick = time => {
    this.timeOnClick = time;
  };

  @action
  setContextMenu = (data = {}) => {
    this.contextMenu = { ...this.contextMenu, ...data };
  };

  handleUpdateCopiedItems = () => {
    this.copiedItems = this.copiedItems.filter(element => (
      this.projectStore.elements.some(projectElement => projectElement.id === element)
    ));

    if (!this.copiedItems.length) {
      this.setContextMenu({ buttons: [] });
    }
  };

  @action
  pasteElement = () => {
    if (!this.copiedItems.length) {
      return null;
    }

    let maxNewEnd = null;
    const updatedElements = [];
    const newItems = {};

    this.copiedItems.forEach(id => {
      const elementById = this.projectStore.getElementById(id);
      const currentLayer = this.projectStore.layers.find(item => item.id === elementById.track);

      if (!currentLayer) {
        return null;
      }

      if (!newItems[currentLayer.order]) {
        newItems[currentLayer.order] = [];
      }

      newItems[currentLayer.order].push({
        popcornOptions: { ...elementById.popcornOptions },
        type: elementById.type,
        track: elementById.track,
      });
    });

    if (!Object.keys(newItems).length) {
      return null;
    }

    const orders = [...Object.keys(newItems)];
    orders.sort((a, b) => b - a);

    orders.forEach(el => {
      newItems[el].sort((a, b) => {
        const firstElementStart = a.popcornOptions.start;
        const secondElementStart = b.popcornOptions.start;
        return firstElementStart - secondElementStart;
      });
    });

    const firstItemStart = newItems[orders[0]][0].popcornOptions.start;

    orders.forEach((order, i) => {
      let newRow;

      this.projectStore.layers.forEach((layer, j) => {
        if (layer.id === this.activeRow?.id && this.projectStore.layers[j - i]?.id) {
          newRow = this.projectStore.layers[j - i];
        }
      });

      const firstItemEndOnLayer = newItems[order][0].popcornOptions.end;

      newItems[order].forEach((copiedItem, j) => {
        const itemDuration = copiedItem.popcornOptions.end - copiedItem.popcornOptions.start;
        copiedItem.isNewItem = true;
        if (i === 0) {
          if (j === 0) {
            copiedItem.popcornOptions.start = this.timeOnClick;
            copiedItem.popcornOptions.end = this.timeOnClick + itemDuration;
          } else {
            copiedItem.popcornOptions.start = newItems[order][0].popcornOptions.end
              + (copiedItem.popcornOptions.start - firstItemEndOnLayer);
            copiedItem.popcornOptions.end = copiedItem.popcornOptions.start + itemDuration;
          }
        } else {
          let difference = 0;
          if (firstItemStart < copiedItem.popcornOptions.start) {
            difference = copiedItem.popcornOptions.start - firstItemStart;
          } else {
            difference = -(firstItemStart - copiedItem.popcornOptions.start);
          }

          if (j === 0) {
            let newStart = this.timeOnClick + difference;
            if (newStart < 0) {
              newStart = 0;
            }
            copiedItem.popcornOptions.start = newStart;
            copiedItem.popcornOptions.end = newStart + itemDuration;
          } else {
            copiedItem.popcornOptions.start = newItems[order][0].popcornOptions.end
              + (copiedItem.popcornOptions.start - firstItemEndOnLayer);
            copiedItem.popcornOptions.end = copiedItem.popcornOptions.start + itemDuration;
          }
        }

        copiedItem.track = newRow?.id || null;
        copiedItem.popcornOptions.track = newRow || null;
        maxNewEnd = copiedItem.popcornOptions.end;
      });

      const itemsOnNewRow = this.projectStore.elements.filter(element => {
        if (element.track === newRow?.id) {
          return element;
        }
        return null;
      });

      if (itemsOnNewRow?.length) {
        newItems[order].forEach(item => itemsOnNewRow.push(item));
        itemsOnNewRow.sort((a, b) => {
          if (a.popcornOptions.start < b.popcornOptions.start) {
            return -1;
          }
          if (a.popcornOptions.start > b.popcornOptions.start) {
            return 1;
          }
          if (a.popcornOptions.start === b.popcornOptions.start) {
            if (a.isNewItem) {
              return -1;
            } else {
              return 1;
            }
          }
          return 0;
        });

        itemsOnNewRow.forEach((el, k) => {
          const { start, end } = el.popcornOptions;
          const elDuration = end - start;
          if (itemsOnNewRow[k - 1] && start <= itemsOnNewRow[k - 1].popcornOptions.end) {
            const newStart = itemsOnNewRow[k - 1].popcornOptions.end + 0.01;
            const newEnd = newStart + elDuration;
            itemsOnNewRow[k].popcornOptions.start = newStart;
            itemsOnNewRow[k].popcornOptions.end = newEnd;
            if (newEnd > maxNewEnd) {
              maxNewEnd = newEnd;
            }
            if (!el.isNewItem) {
              updatedElements.push(el);
            }
          }
        });
      }
    });

    if (maxNewEnd > this.projectStore.duration / SANTISECOND) {
      this.projectStore.changeDuration(maxNewEnd);
    }

    if (updatedElements.length) {
      updatedElements.forEach((item) => {
        this.projectStore.updateStartEnd(
          item.id,
          item.popcornOptions.start,
          item.popcornOptions.end,
        );
      });
    }

    orders.forEach(order => {
      newItems[order].forEach(item => {
        this.projectStore.addElement({
          ...item.popcornOptions,
          type: item.type,
          blendMode: null,
          opacity: null,
          id: null,
        });
      });
    });

    this.setContextMenu({ isOpen: false });
  };
}
