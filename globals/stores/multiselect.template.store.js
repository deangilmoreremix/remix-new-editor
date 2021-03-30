import { action, observable } from 'mobx';
import Bb from 'bluebird';

import { entities } from '../../lib/constants/templateGenerator';
import { recompressProject, removeVideos, setOptions } from '../../lib/utils/popcorn-helper';
import { POPCORN_ELEMENT_TYPES } from '../../lib/constants/popcorn';
import { MAX_ZINDEX } from '../../lib/constants/project';
import { generateUid } from '../../lib/lottie/utils';


const videoProps = {
  fallback: '',
  denied: false,
  from: 0,
  hidden: false,
  target: 'video-container',
  mobile: true,
  width: 100,
  height: 100,
  top: 0,
  left: 0,
  volume: 100,
  mute: false,
  audioFadeIn: 0,
  audioFadeOut: 0,
  blendMode: 'normal',
  contentType: 'video',
  fill: false,
  in: 0,
  is360: false,
  kind: 'video',
  opacity: 100,
};

const elements = {
  [entities.NICHE_SCRIPT]: 'selectedNiche',
  [entities.OVERLAY]: 'selectedOverlay',
  [entities.VIDEO]: 'selectedVideo',
};

export default class MultiselectTemplateStore {
  constructor(props) {
    this.projectStore = props.projectStore;
    this.userStore = props.userStore;
  }

  selectedVideo = observable.map();

  @observable selectedNiche = null;

  @observable selectedOverlay = null;

  @observable item;

  @action
  toggleElement = (entity, value) => {
    this.item = null;
    switch (entity) {
      case entities.VIDEO:
        if (this.selectedVideo.has(value._id)) {
          this.selectedVideo.delete(value._id);
        } else {
          this.selectedVideo.set(value._id, value);
        }
        return;
      default: {
        const elementName = elements[entity];
        if (elementName) {
          this[elementName] = value;
        }
      }
    }
  }

  getOverlayData = () => {
    if (this.selectedVideo.size < 2 || !this.selectedOverlay) {
      return {};
    }
    const overlayProject = JSON.parse(this.selectedOverlay.project.data);
    const overlay = overlayProject.media[0].tracks[0].trackEvents[0];
    const overlayDuration = overlayProject.media[0].duration;
    const halfLength = overlayDuration / 2;
    const overlayLayerId = `${generateUid()}`;
    return { overlay, overlayDuration, halfLength, overlayLayerId };
  }

  getVideoOptions = (video, zindex, newDuration) => {
    const start = newDuration || 0;
    const end = start + video.duration;
    const videoId = `${generateUid()}`;
    return {
      duration: video.duration,
      start,
      end,
      zindex,
      id: videoId,
      source: video.source,
      title: video.title,
      type: video.type,
      ...videoProps,
    };
  }

  clearData = () => {
    this.selectedVideo = observable.map();
    this.selectedNiche = null;
    this.selectedOverlay = null;
  }

  getProjectData = async () => {
    const selectedVideoSize = this.selectedVideo.size;
    if (!selectedVideoSize || !this.selectedNiche) {
      return;
    }
    const projectData = JSON.parse(this.selectedNiche.project.data);

    removeVideos(projectData);
    const layersCount = projectData.media[0].tracks.length;
    const promises = [];
    this.selectedVideo.forEach((video) => {
      promises.push(setOptions(video, POPCORN_ELEMENT_TYPES.SEQUENCER));
    });
    await Bb.all(promises);

    let newDuration = 0;
    const layerId = `${generateUid()}`;
    const zindex = MAX_ZINDEX - layersCount;
    const trackEvents = [];

    const { overlay, overlayDuration, halfLength, overlayLayerId } = this.getOverlayData();

    const overlays = [];

    const lastVideoId = [...this.selectedVideo.keys()].pop();
    this.selectedVideo.forEach((video, key) => {
      if (video.hasError) {
        return;
      }
      const popcornOptions = this.getVideoOptions(video, zindex, newDuration);
      const { id: videoId } = popcornOptions;
      trackEvents.push({
        type: POPCORN_ELEMENT_TYPES.SEQUENCER,
        track: layerId,
        name: videoId,
        id: videoId,
        popcornOptions,
      });
      newDuration += video.duration;
      if (lastVideoId !== key && overlay) {
        const { end } = popcornOptions;
        const overlayStart = end - halfLength;
        const overlayId = `${generateUid()}`;
        const overlayOptions = {
          ...overlay.popcornOptions,
          start: end - halfLength,
          end: overlayStart + overlayDuration,
          id: overlayId,
        };
        overlays.push({
          type: POPCORN_ELEMENT_TYPES.JSON_TRANSITION,
          track: overlayLayerId,
          name: overlayId,
          id: overlayId,
          popcornOptions: overlayOptions,
        });
      }
    });
    projectData.media[0].tracks.push({
      name: `Layer ${layersCount}`,
      id: layerId,
      order: layersCount,
      trackEvents,
    });

    if (overlays.length) {
      projectData.media[0].tracks.forEach((track) => {
        track.order += 1;
        track.defaultName = `Layer ${track.order}`;
        const elementZindex = MAX_ZINDEX - track.order;
        track.trackEvents.forEach(element => {
          element.popcornOptions.zindex = elementZindex;
        });
      });

      projectData.media[0].tracks.push({
        defaultName: 'Layer 0',
        id: overlayLayerId,
        order: 0,
        trackEvents: overlays,
      });
    }

    recompressProject(projectData, newDuration, true);
    const stringifyData = JSON.stringify(projectData);
    this.item = { project: { data: stringifyData }, url: this.selectedNiche.url };
    return stringifyData;
  }

  getPreviewData = async () => {
    if (this.item) {
      return this.item;
    }
    await this.getProjectData();
    return this.item;
  };

  addElements = async () => {
    let projectData;
    if (this.item) {
      projectData = this.item.project.data;
    } else {
      projectData = await this.getProjectData();
    }
    return this.projectStore.fillItem(projectData);
  };
}
