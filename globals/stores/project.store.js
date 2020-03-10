import { observable, action } from 'mobx';

import BaseStore from './base.store';

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

// todo add const
const PAUSE_PLUGIN_TIME_MARGIN = 0.5;

export default class ProjectStore extends BaseStore {
  @observable item = {};

  @observable projectData = {};

  @observable popcornObject = {};

  @observable popcorn = {};

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
            // todo update it. Implemented for testing until login
            'on-behalf': '5a9007349ab52100041dac25',
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
  setPopcorn(target) {
    //todo for empty object
    this.popcorn = window.Popcorn.smart(target,
      this.popcornObject.mediaUrlsString, this.popcornObject.mediaPopcornOptions);
    // popcorn.seek = (at) => {
    //   popcorn.currentTime(at + 0.01);
    // };
    // this.engines.push(popcorn);
    // return popcorn;
  }

  // preparePopcornScriptsAndCallbacks = (readyCallback) => {
  //   const popcornConfig = _config.value('popcorn') || {};
  //
  //
  //   const { callbacks, scripts } = popcornConfig;
  //
  //   const toLoad = [];
  //
  //
  //   let loaded = 0;
  //
  //   // wrap the load function to remember the script
  //   function genLoadFunction(script) {
  //     return function () {
  //       // this = XMLHttpRequest object
  //       if (this.readyState === 4) {
  //         // if the server sent back a bad response, record empty string and log error
  //         if (this.status !== 200) {
  //           _defaultPopcornScripts[script] = '';
  //           _logger.log(`WARNING: Trouble loading Popcorn script: ${this.response}`);
  //         } else {
  //           // otherwise, store the response as text
  //           _defaultPopcornScripts[script] = this.response;
  //         }
  //
  //         // see if we can call the readyCallback yet
  //         ++loaded;
  //         if (loaded === toLoad.length && readyCallback) {
  //           readyCallback();
  //         }
  //       }
  //     };
  //   }
  //
  //   _defaultPopcornCallbacks = callbacks;
  //
  //   for (const script in scripts) {
  //     if (scripts.hasOwnProperty(script)) {
  //       const url = scripts[script];
  //
  //
  //       const probableElement = document.getElementById(url.substring(1));
  //       // check to see if an element on the page contains the script we want
  //       if (url.indexOf('#') === 0) {
  //         if (probableElement) {
  //           _defaultPopcornScripts[script] = probableElement.innerHTML;
  //         }
  //       } else {
  //         // if not, treat it as a url and try to load it
  //         toLoad.push({
  //           url,
  //           onLoad: genLoadFunction(script),
  //         });
  //       }
  //     }
  //   }
  //
  //   // if there are scripts to load, load them
  //   if (toLoad.length > 0) {
  //     for (let i = 0; i < toLoad.length; ++i) {
  //       xhr.get(toLoad[i].url, toLoad[i].onLoad);
  //     }
  //   } else {
  //     // otherwise, call the ready callback right away
  //     readyCallback();
  //   }
  // };
  //
  // preparePage = (callback) => {
  //   const targets = document.body.querySelectorAll("*[data-butter='target']");
  //
  //
  //   const medias = document.body.querySelectorAll("*[data-butter='media']");
  //
  //   if (_config.value('scrapePage')) {
  //     let i; let j; let il; let jl; let url; let oldTarget; let oldMedia; let mediaPopcornOptions; let
  //       mediaObj;
  //     for (i = 0, il = targets.length; i < il; ++i) {
  //       // Only add targets that don't already exist.
  //       oldTarget = _this.getTargetByType('elementID', targets[i].element);
  //       if (!oldTarget) {
  //         _this.addTarget({ element: targets[i].id });
  //       }
  //     }
  //
  //     for (i = 0, il = medias.length; i < il; i++) {
  //       oldMedia = null;
  //       mediaPopcornOptions = null;
  //       url = '';
  //       mediaObj = medias[i];
  //
  //       if (mediaObj.getAttribute('data-butter-source')) {
  //         url = mediaObj.getAttribute('data-butter-source');
  //       }
  //
  //       if (_media.length > 0) {
  //         for (j = 0, jl = _media.length; j < jl; ++j) {
  //           if (_media[j].id !== medias[i].id && _media[j].url !== url) {
  //             oldMedia = _media[j];
  //             break;
  //           }
  //         }
  //       } else if (_config.value('mediaDefaults')) {
  //         mediaPopcornOptions = _config.value('mediaDefaults');
  //       }
  //
  //       if (!oldMedia) {
  //         _this.addMedia({ target: medias[i].id, url, popcornOptions: mediaPopcornOptions });
  //       }
  //     }
  //   }
  //
  //   if (callback) {
  //     callback();
  //   }
  //
  //   _this.dispatch('pageready');
  // };
  //
  // load = () => {
  //   // prepare the page next
  //   this.preparePopcornScriptsAndCallbacks(() => {
  //     this.preparePage(() => {
  //       Project.checkForBackup(_this, (projectBackup, backupDate) => {
  //         function useProject(project) {
  //           project.template = project.template || _config.value('name');
  //           _this.project = project;
  //           _this.chain(project, ['projectchanged', 'projectsaved']);
  //
  //           // Fire the ready event
  //           _isReady = true;
  //           _this.setRatios();
  //           _this.dispatch('ready', _this);
  //         }
  //
  //         if (projectBackup && projectBackup.useBackup) {
  //           // Found backup, ask user what to do
  //           const _dialog = Dialog.spawn('backup', {
  //             data: {
  //               backupDate,
  //               projectName: projectBackup.name,
  //               loadProject() {
  //                 // Build a new Project and import projectBackup data
  //                 const project = new Project(_this);
  //                 project.import(projectBackup);
  //                 useProject(project);
  //               },
  //               discardProject() {
  //                 projectBackup = null;
  //                 attemptDataLoad(useProject);
  //               },
  //             },
  //           });
  //           _dialog.open();
  //         } else {
  //           // No backup found, keep loading
  //           attemptDataLoad(useProject);
  //         }
  //       });
  //     });
  //   });
  // };


  @action
  updateItem = (value) => {
    this.item = { ...this.item, ...value };
  }
}
