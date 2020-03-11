/* eslint-disable no-underscore-dangle */
// PLUGIN: sequencer

(function (Popcorn) {
  // XXX: SoundCloud has a bug (reported by us, but as yet unfixed) which blocks
  // loading of a second iframe/player if the iframe for the first is removed
  // from the DOM.  We can simply move old ones to a quarantine div, hidden from
  // the user for now (see #2630).  We lazily create and memoize the instance.
  // I am seeing this on other iframes as well. Going to do this on all cases.

  function buildScripts(options) {
    if (!options.scripts) {
      options.scripts = {};

      Object.keys(options._natives.manifest.options.scripts).forEach((key) => {
        options.scripts[key] = '';
      });
    } else {
      options.scripts._compiled = options.scripts._compiled || {};

      Object.keys(options._natives.manifest.options.scripts).forEach((key) => {
        /* jslint evil: true */
        // eslint-disable-next-line no-new-func
        const fn = new Function('options', options.scripts[key]);
        options.scripts._compiled[key] = () => fn.apply(fn, [{
          event: options,
        }]);
      });
    }
  }

  let _waiting = 0;

  const loadingHandler = {
    loading: [],
    compare(a, b) {
      return a.start - b.start;
    },
    add(options, beginLoad) {
      const _this = this;
      this.loading.push({
        start: options.start,
        end: options.end,
        beginLoad,
      });
      this.loading.sort(this.compare);
      if (this.loading.length === 1) {
        setTimeout(() => {
          _this.next();
        }, 0);
      }
    },
    next(currentTime) {
      // If no clip is found because we're at the end of any loading
      // clip's range, default to 0, the first clip in the sequence.
      let nextClip = 0;
      // Find the clip closest to the currentTime.
      for (let index = 0; index < this.loading.length; index += 1) {
        if (this.loading[index].start <= currentTime
          && this.loading[index].end >= currentTime) {
          nextClip = index;
          break;
        }
      }
      // Load the clip, and remove it from the loading clips.
      // Once the clip is loaded (or fails), it knows to call next.
      if (this.loading[nextClip]) {
        this.loading[nextClip].beginLoad();
      }
      this.loading.splice(nextClip, 1);
    },
  };

  Popcorn.plugin('sequencer', {
    _setup(options) {
      const _this = this;
      options._context = _this;

      options.setupContainer = () => {
        options.displayLoading();
        const container = document.createElement('div');
        let target = Popcorn.dom.find(options.target);

        if (!target) {
          target = _this.media.parentNode;
        }

        options._target = target;
        options._container = container;

        container.style.zIndex = options.zindex;
        container.className = 'popcorn-sequencer';
        container.style.position = 'absolute';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.top = 0;
        container.style.left = 0;

        // for VideoRemix GO editor we're making this element non-interactive
        container.style.pointerEvents = 'none';

        function suppressClick() {
          if (options._clip.paused()) {
            _this.pause();
          } else {
            _this.play();
          }
        }

        container.addEventListener('mouseover', () => {
          if (options._clip) {
            options._clip.on('play', suppressClick);
            options._clip.on('pause', suppressClick);
          }
        });

        container.addEventListener('mouseout', () => {
          if (options._clip) {
            options._clip.off('play', suppressClick);
            options._clip.off('pause', suppressClick);
          }
        });

        target.appendChild(container);
      };
      options.displayLoading = () => {
        if (!options.waiting) {
          options.waiting = true;
          _waiting += 1;
        }
      };
      options.hideLoading = () => {
        if (options.waiting) {
          options.waiting = false;
          _waiting -= 1;
          if (_waiting === 0) {
            _this.emit('sequencesReady');
          }
        }
      };
      options.setZIndex = () => {
        if (!options.hidden && options.active) {
          options._container.style.zIndex = +options.zindex;
        } else {
          options._container.style.zIndex = 0;
        }
      };

      if (!options.from || options.from > options.duration) {
        options.from = 0;
      }

      options._volumeEvent = () => {
        if (_this.muted()) {
          options._clip.mute();
        } else if (!options.mute) {
          options._clip.unmute();
          options._clip.volume((options.volume / 100) * _this.volume());
        } else {
          options._clip.mute();
        }
      };

      options.readyEvent = () => {
        options._clip.media.style.width = '100%';
        options._clip.media.style.height = '100%';
        options._container.style.width = '100%';
        options._container.style.height = '100%';
        // If teardown was hit before ready, ensure we teardown.
        if (options._cancelLoad) {
          options.playIfReady();
          options._cancelLoad = false;
          options.tearDown();
        }
        options.failed = false;
        options._clip.off('error', options.fail);
        options._clip.off('loadedmetadata', options.readyEvent);
        options.ready = true;
        options._container.style.width = `${options.width || '100'}%`;
        options._container.style.height = `${options.height || '100'}%`;
        options._container.style.top = `${options.top || '0'}%`;
        options._container.style.left = `${options.left || '0'}%`;
        _this.on('volumechange', options._volumeEvent);
        if (options.active) {
          options._startEvent();
        } else {
          options._setClipCurrentTime(+options.from);
          options._container.style.zIndex = 0;
        }
        options.hideLoading();
      };

      options.clearLoading = () => {
        loadingHandler.next(_this.currentTime());
        options._clip.off('loadedmetadata', options.clearLoading);
      };

      // Function to ensure the mixup as to if a clip is an array
      // or string is normalized to an array as often as possible.
      options.sourceToArray = (object, type) => {
        // If our src is not an array, create an array of one.
        object[type] = typeof object[type] === 'string' ? [object[type]] : object[type];
      };

      // If loading times out, we want to let the media continue to play.
      // The clip that failed to load would be ignored,
      // and everything else playable.
      options.fail = () => {
        options.clearLoading();
        options.failed = true;
        options.setZIndex();
        options.hideLoading();
        options.playIfReady();
      };

      options.attemptJWPlayer = () => {
        options._clip.off('error', options.attemptJWPlayer);
        if (!options._clip.error) {
          // For some reason html5 media clips are throwing error events,
          // with no actual error, only in the embed...
          return;
        }
        const jwDiv = document.createElement('div');
        const videoElement = document.getElementById(options._clip.media.id);

        if (!videoElement) {
          options.fail();
          return;
        }
        // Remove the dead html5 video element.
        options._container.removeChild(videoElement);
        options._container.appendChild(jwDiv);
        jwDiv.id = Popcorn.guid('popcorn-jwplayer-');
        const jwplayer = Popcorn.HTMLJWPlayerVideoElement(jwDiv);
        // We use an already decoded src string from before.
        const { src } = options._clip.media;
        // Now we can fail.
        options._clip = new Popcorn(jwplayer, { frameAnimation: true, framerate: 120 });
        options._clip.on('error', options.fail);
        options._clip.on('loadedmetadata', options.readyEvent);
        options._clip.on('loadedmetadata', options.clearLoading);
        jwplayer.src = src;
      };

      options.tearDown = () => {
        _this.off('volumechange', options._volumeEvent);
        // If we have no options._clip, no source was given to this track event,
        // and it is being torn down.
        if (options._clip) {
          options._clip.destroy();
        }

        // Tear-down old instances, special-casing iframe removal, see above.
        if (options._container && options._container.parentNode) {
          options._container.parentNode.removeChild(options._container);
        }
      };

      options.clearEvents = () => {
        _this.off('play', options._playEvent);
        _this.off('pause', options._pauseEvent);
        _this.off('seeked', options._onSeeked);
        _this.off('timeupdate', options._onTimeUpdate);
      };

      options.addSource = () => {
        // if the video is denied for any reason, most cases youtube embedding disabled,
        // don't bother waiting and display fail case.
        if (options.denied) {
          options.fail();
        }

        for (let i = 0; i < options.source.length; i += 1) {
          let value = options.source[i];
          const split = value.split('?');
          const querystring = split[1];

          value = split[0].trim();
          options.source[i] = querystring ? `${value}?${querystring}` : value;
        }

        options._clip = Popcorn.smart(
          options._container, options.source,
          { frameAnimation: true, framerate: 120 },
        );

        options._clip.on('seeked', options._onSeekBack);
        options._clip.on('error', options.attemptJWPlayer);

        if (options._clip.error) {
          options.attemptJWPlayer();
          return;
        }

        if (options._clip.media.readyState >= 1) {
          options.readyEvent();
          options.clearLoading();
        } else {
          options._clip.on('loadedmetadata', options.readyEvent);
          options._clip.on('loadedmetadata', options.clearLoading);
        }
      };

      options._onProgress = () => {
        if (options._clip.ended()) {
          return;
        }
        if (!options._isBuffering()) {
          // We found a valid range so playing can resume.
          options.hideLoading();
          if (options.playIfReady()) {
            options._clip.play();
          }
        }
      };

      options._onSeekBack = (event) => {
        if (options.active && event && event.detail && event.detail.data) {
          for (let i = 0; i < Popcorn.instances.length; i += 1) {
            if (Popcorn.instances[i].media !== options._clip.media) {
              Popcorn.instances[i].media.currentTime = options.start + event.detail.data.seconds;
            }
          }
        }
      };

      options._isBuffering = () => {
        let i;
        let l;
        const { buffered } = options._clip.media;
        const time = (_this.currentTime() - options.start) + (+options.from);

        for (i = 0, l = buffered.length; i < l; i += 1) {
          // Check if a range is valid, if so, return early.
          if (buffered.start(i) <= time
            && buffered.end(i) > time) {
            // We found a valid range so playing can resume.
            return false;
          }
        }
        return true;
      };

      options._onTimeUpdate = () => {
        if (options._clip.ended()) {
          return;
        }

        // If we hit here, we failed to find a valid range,
        // so we should probably stop everything. We'll get out of sync.
        if (options._isBuffering() && !_this.paused()) {
          options.playWhenReady = true;
          _this.pause();
          options._clip.pause();
          options.displayLoading();
        }
      };

      // Ensures seek time is seekable, and not already seeked.
      // Returns true for successful seeks.
      options._setClipCurrentTime = (time) => {
        if (!time && time !== 0) {
          time = (_this.currentTime() - options.start) + (+options.from);
        }
        if (time !== options._clip.currentTime()
          && time >= (+options.from) && time <= options.duration) {
          options._clip.currentTime(time);
        }
      };

      // While clip is loading, do not let the timeline play.
      options.playIfReady = () => {
        if (options.playWhenReady && !_waiting) {
          options.playWhenReady = false;
          _this.play();
          return true;
        }
        return false;
      };

      options.setupContainer();
      if (options.source) {
        options.sourceToArray(options, 'source');
        if (options.fallback) {
          options.sourceToArray(options, 'fallback');
        }
        if (options.fallback) {
          options.source = options.source.concat(options.fallback);
        }
        loadingHandler.add(options, options.addSource);
      }

      options._startEvent = () => {
        options._setClipCurrentTime();
        _this.on('seeked', options._onSeeked);

        // Ensure this wrapper supports buffered.
        // Once these wrappers have a buffered time range object, it should just work.
        if (options._clip.media.buffered.length) {
          _this.on('timeupdate', options._onTimeUpdate);
          options._clip.on('progress', options._onProgress);
        }
        if (options.playIfReady()) {
          options._clip.play();
        }
        _this.on('play', options._playEvent);
        _this.on('pause', options._pauseEvent);
        options.hideLoading();
        options.setZIndex();
        if (options.active) {
          options._volumeEvent();
        }
      };

      options._endEvent = () => {
        if (!options._clip.paused()) {
          options._clip.pause();
        }
        // reset current time so next play from start is smooth. We've pre seeked.
        options._setClipCurrentTime(+options.from);
        options._clip.mute();
        options._container.style.zIndex = 0;
      };

      options._playEvent = () => {
        if (options._clip.paused()
          && !_waiting
          && !options._clip.ended()) {
          options._clip.play();
        }
      };

      options._pauseEvent = () => {
        if (!options._clip.paused()) {
          options._clip.pause();
        }
      };

      // event to seek the clip if the main timeline seeked.
      options._onSeeked = () => {
        options._setClipCurrentTime();
      };

      options.toString = () => options.title || options.source || '';

      if (options.duration > 0
        && options.end - (options.start - (+options.from)) > options.duration) {
        options.end = options.duration + (options.start - (+options.from));
      }

      buildScripts(options);
    },
    _update(options, updates) {
      if (updates.duration !== undefined) {
        options.duration = updates.duration;
      }
      if (updates.from !== undefined && updates.from < options.duration) {
        options.from = updates.from;
      }
      if (options.end - (options.start - (+options.from)) > options.duration) {
        options.end = options.duration + (options.start - (+options.from));
      }
      if (updates.zindex !== undefined) {
        options.zindex = updates.zindex;
        options.setZIndex();
      }
      if (updates.title) {
        options.title = updates.title;
      }
      if (updates.denied) {
        options.denied = updates.denied;
      }
      if (updates.hidden !== undefined) {
        options.hidden = updates.hidden;
        options.setZIndex();
      }
      if (updates.fallback) {
        options.sourceToArray(updates, 'fallback');
        options.fallback = updates.fallback;
      }
      if (updates.source) {
        options.sourceToArray(updates, 'source');
        if (options.fallback) {
          updates.source = updates.source.concat(options.fallback);
        }
        if (updates.source.toString() !== options.source.toString()) {
          options.ready = false;
          options.playWhenReady = false;
          if (options.active) {
            options.displayLoading();
          }
          if (updates.fallback) {
            updates.source = updates.source.concat(updates.fallback);
          }
          options.source = updates.source;
          options.clearEvents();
          options.tearDown();
          options.setupContainer();
          if (!options._context.paused()) {
            options.playWhenReady = true;
            options._context.pause();
            if (options._clip && !options._clip.paused()) {
              options._clip.pause();
            }
          }
          loadingHandler.add(options, options.addSource);
        }
      }
      if (updates.top !== undefined) {
        options.top = updates.top;
        options._container.style.top = `${options.top || '0'}%`;
      }
      if (updates.left !== undefined) {
        options.left = updates.left;
        options._container.style.left = `${options.left || '0'}%`;
      }
      if (updates.height !== undefined) {
        options.height = updates.height;
        options._container.style.height = `${options.height || '100'}%`;
      }
      if (updates.width !== undefined) {
        options.width = updates.width;
        options._container.style.width = `${options.width || '100'}%`;
      }
      if (options.ready) {
        if (updates.mute !== undefined) {
          options.mute = updates.mute;
          options._volumeEvent();
        }
        if (updates.volume !== undefined) {
          options.volume = updates.volume;
          options._volumeEvent();
        }
        if (updates.from !== undefined
          || updates.start !== undefined || updates.end !== undefined) {
          options._setClipCurrentTime();
        }
      }
    },
    _teardown(options) {
      // If we're ready, or never going to be, simply teardown.
      if (options.ready || !options.source) {
        options.tearDown();
      } else {
        // If we're not ready yet, ensure we do the proper teardown once ready.
        options._cancelLoad = true;
      }
    },
    start(event, options) {
      options.active = true;
      options._container.style.zIndex = options.zindex;
      if (options.source) {
        if (!options.hidden && options.failed) {
          // display player in case any external players show a fail message.
          // eg. youtube embed disabled by uploader.
          options._container.style.zIndex = +options.zindex;
          return;
        }
        if (!options._context.paused()) {
          options.playWhenReady = true;
        }
        if (options.ready) {
          options._startEvent();
        } else {
          options._context.pause();
          options.displayLoading();
        }
      }

      buildScripts(options);
      if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
        options.scripts._compiled.onStart();
      }
    },
    end(event, options) {
      // cancel any pending or future starts
      options.active = false;
      options.playWhenReady = false;
      options.clearEvents();
      options.hideLoading();
      if (options.ready) {
        options._clip.off('progress', options._onProgress);
        options._endEvent();
      }

      buildScripts(options);
      if (options.scripts && options.scripts._compiled && options.scripts._compiled.onEnd) {
        options.scripts._compiled.onEnd();
      }
    },
    manifest: {
      about: {},
      options: {
        start: {
          elem: 'input',
          type: 'text',
          label: 'In',
          units: 'seconds',
        },
        end: {
          elem: 'input',
          type: 'text',
          label: 'Out',
          units: 'seconds',
        },
        source: {
          elem: 'input',
          type: 'url',
          label: 'Source URL',
          default: '',
        },
        fallback: {
          elem: 'input',
          type: 'url',
          label: 'Fallback URL (only applies to exported projects)',
          default: '',
        },
        title: {
          elem: 'input',
          type: 'text',
          label: 'Clip title',
          default: '',
        },
        width: {
          elem: 'input',
          type: 'number',
          label: 'Width',
          default: 100,
          units: '%',
          hidden: true,
        },
        height: {
          elem: 'input',
          type: 'number',
          label: 'Height',
          default: 100,
          units: '%',
          hidden: true,
        },
        top: {
          elem: 'input',
          type: 'number',
          label: 'Top',
          default: 0,
          units: '%',
          hidden: true,
        },
        left: {
          elem: 'input',
          type: 'number',
          label: 'Left',
          default: 0,
          units: '%',
          hidden: true,
        },
        from: {
          elem: 'input',
          type: 'seconds',
          units: 'seconds',
          label: 'Start at',
          default: 0,
        },
        volume: {
          elem: 'input',
          type: 'range',
          units: '%',
          label: 'Volume',
          slider_unit: '%',
          min: 0,
          max: 100,
          default: 100,
        },
        hidden: {
          elem: 'input',
          type: 'checkbox',
          label: 'Sound only',
          default: false,
        },
        mobile: {
          elem: 'input',
          type: 'checkbox',
          label: 'Used for Mobile platforms',
          default: false,
        },
        mute: {
          elem: 'input',
          type: 'checkbox',
          label: 'Mute',
          default: false,
        },
        zindex: {
          hidden: true,
          default: 0,
        },
        denied: {
          hidden: true,
          default: false,
        },
        duration: {
          hidden: true,
          default: 0,
        },
        linkback: {
          hidden: true,
          default: '',
        },
        contentType: {
          hidden: true,
          default: '',
        },
        type: {
          hidden: true,
          default: '',
        },
        scripts: {
          onStart: '',
          onEnd: '',
        },
      },
    },
  });
}(window.Popcorn));
