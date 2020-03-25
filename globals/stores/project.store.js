import { observable, action } from 'mobx';

import BaseStore from './base.store';
import { EMAIL_SKIP_TOKENS } from '../../lib/constants/campaigns/constants';

const defaultItem = {
  tags: [],
  title: '',
  background: '',
  description: '',
  allowedSocials: [],
  project: {
    data: {},
  },
};

// TODO: remove the fake data when ready
const mockPersonalizations = ['FIRSTNAME', 'LASTNAME', 'GENDER', 'FIRSTNAME', 'GEOCOUNTRY'];

// todo add to global consts
const PAUSE_PLUGIN_TIME_MARGIN = 0.5;

export default class ProjectStore extends BaseStore {
  constructor(props) {
    super(props);
    this.item = defaultItem;
  }

  @observable assets = [];

  @observable item = {};

  @observable projectData = {};

  @observable popcornObject = null;

  @observable popcorn = {};

  @observable modified = false;

  // TODO: remove the fake data when ready
  @observable personalizations = new Set(
    mockPersonalizations.filter(token => !EMAIL_SKIP_TOKENS.includes(token)),
  );

  @action
  setProjectData = () => {
    this.projectData = JSON.parse(this.item.project.data);
    this.projectData.media.forEach((media) => {
      media.tracks.forEach((track) => {
        track.trackEvents.forEach((trackEvent) => {
          if (trackEvent.type === 'pausePlugin') {
            trackEvent.popcornOptions.start = media.duration - PAUSE_PLUGIN_TIME_MARGIN;
            trackEvent.popcornOptions.end = media.duration;
          }
        });
      });
    });
  };

  generatePopcornObject = () => {
    this.projectData.media.forEach((currentMedia) => {
      // We expect a string (one url) or an array of url strings.
      // Turn a single url into an array of 1 string.
      const mediaUrls = typeof currentMedia.url === 'string' ? [currentMedia.url] : currentMedia.url;
      const mediaUrlsString = `[ '${mediaUrls.join('')}' ]`;

      const mediaPopcornOptions = currentMedia.popcornOptions || {};
      // Force the Popcorn instance we generate to have an ID we can query.
      mediaPopcornOptions.id = 'Butter-Generated';

      const popcornData = {
        target: currentMedia.target,
        mediaUrlsString,
        elements: [],
      };

      currentMedia.tracks.forEach((currentTrack) => {
        currentTrack.trackEvents.forEach((currentTrackEvent) => {
          popcornData.elements.push({
            type: currentTrackEvent.type,
            popcornOptions: currentTrackEvent.popcornOptions,
          });
        });
      });
      this.popcornObject = popcornData;
    });
  };


  @action
  getOne = async (projectId) => {
    if (!projectId) {
      this.item = defaultItem;
      this.projectData = {};
      return this.item;
    }
    const path = `/api/users/me/makes/${projectId}`;
    try {
      this.item = await this.request(
        path, {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
      this.setProjectData();
      this.generatePopcornObject();
    } catch (e) {
      this.item = defaultItem;
      throw e;
    }
    return this.item;
  };

  @action
  setPopcorn = (target) => {
    if (!this.popcornObject) {
      return;
    }

    this.popcorn = window.Popcorn.smart(target,
      this.popcornObject.mediaUrlsString, this.popcornObject.mediaPopcornOptions);
    this.attach(target);
  };

  @action
  attach = (target) => {
    const findMediaSource = (sources, acceptableSources) => sources.filter((source) => {
      const extension = source.split('.').reverse()[0];
      return acceptableSources.some(extension);
    })[0];

    this.popcornObject.elements.forEach((element) => {
      if (element.type === 'sequencer') {
        if (element.type === 'sequencer') {
          if (element.type === 'sequencer' && element.popcornOptions.source[0].split('|').length > 1) {
            element.popcornOptions.source = [findMediaSource(
              element.popcornOptions.source[0].split('|'), ['mp4', 'webm'],
            )];
          }
        }
      }
      this.popcorn[element.type](target
        ? { ...element.popcornOptions, target }
        : element.popcornOptions);
    });
    this.popcorn.target = target;
    return this.popcorn;
  };

  @action
  updateItem = (value) => {
    this.item = { ...this.item, ...value };
  };

  @action
  addAsset = (asset) => {
    this.assets.push(asset);
  };

  @action
  serialize() {
    return {
      data: JSON.stringify(this.item),
      allowedSocials: this.item.allowedSocials,
      name: this.item.name,
      editor: 'smart-video',
      description: this.item.description,
      thumbnail: this.item.thumbnail,
      source: this.item.source,
    };
  }

  @action
  save = async () => {
    // TODO: should be refactored in https://app.asana.com/0/1134020730337032/1154072706347831
    try {
      const path = this.item
        ? `/api/users/me/makes/${this.item._id}`
        : '/api/users/me/makes';
      const serializedProject = this.serialize();
      this.item = await this.request(
        path, {
          method: this.item ? 'PATCH' : 'POST',
          headers: {
            'on-behalf': this.currentUser.id,
          },
          body: {
            title: serializedProject.name,
            description: serializedProject.description,
            project: serializedProject,
            thumbnail: serializedProject.thumbnail,
            remixedFrom: serializedProject.source,
          },
        });
      this.modified = false;
      return this.item;
    } catch (e) {
      console.error(e);
    }
  };
}
