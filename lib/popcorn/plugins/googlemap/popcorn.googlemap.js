// PLUGIN: Google Maps
import { POPCORN_ELEMENT_TYPES } from '../../../constants/popcorn';
import { GOOGLE_MAP_VALUES, GOOGLE_MAP_ITEMS, GOOGLE_MAP_CONSTANTS } from '../../../constants/googleMap';
import { addDeleteListener, emitter, emitterActions, removeDeleteListener, selectItem } from '../../../mitt/emitter';
import { draggableResizable, onDblClick, removeDbClick, createDraggableHandle } from '../../helpers';

/* eslint-disable space-in-parens,no-underscore-dangle,no-new-func,no-multi-assign,prefer-destructuring,no-var,vars-on-top,no-shadow,camelcase,block-scoped-var,no-use-before-define,no-plusplus,no-undef,max-len,no-unused-vars,no-restricted-globals */

const GOOGLE_API_KEY = 'AIzaSyBY0KNG1j-Ir_SQhg81IfKYGXPvTDxByIk';
let googleCallback;
let draggableHandle = null;
let isResize = false;

const {
  MAX_MAP_ZOOM_VALUE,
  MAX_STREETVIEW_ZOOM_VALUE,
  DEFAULT_STREETVIEW_ZOOM_VALUE,
  MAX_MAP_PITCH_VALUE,
  MAX_MAP_HEADING_VALUE,
  ZOOM_DEFAULT,
} = GOOGLE_MAP_CONSTANTS;

(function (Popcorn) {
  // We load our own cached copy of this in order to deal with mix-content (http vs. https).
  // At some point the stamen API is going to change, and this will break.
  // We'll need to watch for this. NOTE: if you change the location of this file, the path
  // below needs to reflect that change.
  const STAMEN_BUTTER_CACHED_URL = 'https://cdn.vidcloud.io/external/stamen/tile.stamen-1.2.4.js';

  let _mapFired = false;
  let _mapLoaded = false;
  // Store location objects in case the same string location is used multiple times.
  const _cachedGeoCode = {};
  const MAP_FAILURE_TIMEOUT = 100;
  let geocoder;

  // google api callback
  window.googleCallback = (data) => {
    // ensure all of the maps functions needed are loaded
    // before setting _maploaded to true
    if (typeof google !== 'undefined' && window.google.maps && window.google.maps.Geocoder && window.google.maps.LatLng) {
      geocoder = new window.google.maps.Geocoder();
      Popcorn.getScript(STAMEN_BUTTER_CACHED_URL, () => {
        _mapLoaded = true;
      });
    } else {
      setTimeout(() => {
        googleCallback(data);
      }, 10);
    }
  };

  // function that loads the google api
  function loadMaps() {
    // for some reason the Google Map API adds content to the body
    if (document.body) {
      _mapFired = true;
      Popcorn.getScript(`https://maps.google.com/maps/api/js?sensor=false&key=${GOOGLE_API_KEY}&callback=googleCallback`);
    } else {
      setTimeout(() => {
        loadMaps();
      }, 10);
    }
  }

  function buildScripts(options) {
    if (!options.scripts) {
      options.scripts = {};

      Object.keys(options._natives.manifest.options.scripts).forEach((key) => {
        options.scripts[key] = '';
      });
    } else {
      options.scripts._compiled = options.scripts._compiled || {};

      Object.keys(options._natives.manifest.options.scripts).forEach((key) => {
        var fn = new Function('options', options.scripts[key]);
        options.scripts._compiled[key] = () => fn.apply(fn, [{
          event: options,
        }]);
      });
    }
  }

  function buildMap(options, mapDiv, pluginInstance) {
    const type = options.type ? options.type.toUpperCase() : options._natives.manifest.options.type.default;
    let layer;

    // See if we need to make a custom Stamen map layer
    if (type === 'STAMEN-WATERCOLOR'
      || type === 'STAMEN-TERRAIN'
      || type === 'STAMEN-TONER') {
      // Stamen types are lowercase
      layer = type.replace('STAMEN-', '').toLowerCase();
    }

    const map = new google.maps.Map(mapDiv, {
      // If a custom layer was specified, use that, otherwise use type
      mapTypeId: layer || google.maps.MapTypeId[type],
      // Hide the layer selection UI
      mapTypeControlOptions: {
        mapTypeIds: [],
      },
      streetViewControl: options.type === 'SIDEBYSIDE',
      panControl: false,
      zoom: options.type === 'STREETVIEW' ? DEFAULT_STREETVIEW_ZOOM_VALUE : ZOOM_DEFAULT,
      zoomControlOptions: {
        position: google.maps.ControlPosition.TOP_LEFT,
      },
    });

    const element = options;

    // Used to notify any users of the plugin when the maps has completely loaded
    google.maps.event.addListenerOnce(map, 'idle', () => {
      pluginInstance.emit('googlemaps-loaded');

      const panorama = map.getStreetView();
      panorama.setOptions({ zoomControl: false, fullscreenControl: false });

      map.addListener('zoom_changed', () => {
        if (options.zoom !== map.getZoom()) {
          element._context.emit('elementUpdated', {
            element,
            options: {
              zoom: map.getZoom(),
            },
          });
        }
      });

      google.maps.event.addListener(map.streetView, 'pov_changed', () => {
        const pov = map.streetView.pov;
        const latlng = map.streetView.getPosition();
        const updateOptions = {};
        updateOptions.heading = pov.heading;
        updateOptions.pitch = pov.pitch;
        updateOptions.lat = latlng.lat();
        updateOptions.lng = latlng.lng();

        if (!isResize) {
          element._context.emit('elementUpdated', {
            element,
            options: {
              heading: updateOptions.heading,
              pitch: updateOptions.pitch,
              lat: updateOptions.lat,
              lng: updateOptions.lng,
            },
          });
        } else {
          isResize = false;
        }
      });
    });

    if (layer) {
      map.mapTypes.set(layer, new google.maps.StamenMapType(layer));
    }

    return map;
  }

  /**
   * googlemap popcorn plug-in
   * Adds a map to the target div centered on the location specified by the user
   * Options parameter will need a start, end, target, type, zoom, lat and lng, and location
   * -Start is the time that you want this plug-in to execute
   * -End is the time that you want this plug-in to stop executing
   * -Target is the id of the DOM element that you want the map to appear in. This element must be in the DOM
   * -Type [optional] either: HYBRID (default), ROADMAP, SATELLITE, TERRAIN, STREETVIEW, or one of the
   *                          Stamen custom map types (http://http://maps.stamen.com): STAMEN-TONER,
   *                          STAMEN-WATERCOLOR, or STAMEN-TERRAIN.
   * -Zoom [optional] defaults to 10
   * -Heading [optional] STREETVIEW orientation of camera in degrees relative to true north (0 north, 90 true east, ect)
   * -Pitch [optional] STREETVIEW vertical orientation of the camera (between 1 and 3 is recommended)
   * -Lat and Lng: the coordinates of the map must be present if location is not specified.
   * -Height [optional] the height of the map, in "px" or "%". Defaults to "100%".
   * -Width [optional] the width of the map, in "px" or "%". Defaults to "100%".
   * -Location: the address you want the map to display, must be present if lat and lng are not specified.
   * Note: using location requires extra loading time, also not specifying both lat/lng and location will
   * cause and error.
   *
   * Tweening works using the following specifications:
   * -location is the start point when using an auto generated route
   * -tween when used in this context is a string which specifies the end location for your route
   * Note that both location and tween must be present when using an auto generated route, or the map will not tween
   * -interval is the speed in which the tween will be executed, a reasonable time is 1000 ( time in milliseconds )
   * Heading, Zoom, and Pitch streetview values are also used in tweening with the autogenerated route
   *
   * -tween is an array of objects, each containing data for one frame of a tween
   * -position is an object with has two parameters, lat and lng, both which are mandatory for a tween to work
   * -pov is an object which houses heading, pitch, and zoom parameters, which are all optional, if undefined, these values default to 0
   * -interval is the speed in which the tween will be executed, a reasonable time is 1000 ( time in milliseconds )
   *
   * @param {Object} options
   *
   * Example:
   var p = Popcorn("#video")
   .googlemap({
    start: 5, // seconds
    end: 15, // seconds
    type: "ROADMAP",
    target: "map"
   } )
   *
   */

  Popcorn.plugin('googlemap', function (options) {
    // if this is defined, this is an update and we can return early.
    if (options._map) {
      return;
    }

    options.type = options.type || GOOGLE_MAP_VALUES.ROADMAP;
    options.lat = options.lat || 0;
    options.lng = options.lng || 0;
    options.location = options.location || 'Toronto, Ontario, Canada';
    options.heading = options.heading || 0;
    options.pitch = options.pitch ?? 1;
    options.zoom = options.zoom ?? ZOOM_DEFAULT;
    options.transition = options.transition || 'popcorn-fade';
    options._context = this;

    let _container;
    let mapDiv;
    let streetDiv;
    let map;
    let location;
    let target = Popcorn.dom.find(options.target);
    const that = this;
    let ranOnce = false;

    function geoCodeCallback(results, status) {
      // second check for mapDiv since it could have disappeared before
      // this callback is actually run
      if (!mapDiv) {
        return;
      }

      if (status === google.maps.GeocoderStatus.OK) {
        options.lat = results[0].geometry.location.lat();
        options.lng = results[0].geometry.location.lng();
        _cachedGeoCode[options.location] = location = results[0].geometry.location;

        map = buildMap(options, mapDiv, that);
      } else if (status === google.maps.GeocoderStatus.OVER_QUERY_LIMIT) {
        setTimeout(() => {
          // calls an anonymous google function called on separate thread
          geocoder.geocode({
            address: options.location,
          }, geoCodeCallback);
        }, MAP_FAILURE_TIMEOUT);
      } else {
        // Some other failure occurred
        console.warn(`Google maps geocoder returned status: ${status}`);
      }
    }

    // ensure that google maps and its functions are loaded
    // before setting up the map parameters
    const isMapReady = () => {
      if (_mapLoaded) {
        if (mapDiv) {
          if (options.location) {
            location = _cachedGeoCode[options.location];

            if (location) {
              map = buildMap(options, mapDiv, that);
            } else {
              // calls an anonymous google function called on separate thread
              geocoder.geocode({
                address: options.location,
              }, geoCodeCallback);
            }
          } else {
            location = new google.maps.LatLng(options.lat, options.lng);
            map = buildMap(options, mapDiv, that);
          }
        }
      } else {
        setTimeout(() => {
          isMapReady();
        }, 5);
      }
    };

    return {
      _setup(options) {
        if (!target) {
          target = that.media.parentNode;
        }

        const containerLeft = options.fullscreen ? 0 : options.left;
        const containerTop = options.fullscreen ? 0 : options.top;
        options._target = target;
        options._context = this;
        options.stopMove = false;
        options.width = (options.fullscreen ? 100 : options.width) || options._natives.manifest.options.width.default;
        options.height = (options.fullscreen ? 100 : options.height || options._natives.manifest.options.height.default);
        options.left = containerLeft === 0 || containerLeft ? containerLeft : options._natives.manifest.options.left.default;
        options.top = containerTop === 0 || containerTop ? containerTop : options._natives.manifest.options.top.default;
        options.type = options.actionType || options._natives.manifest.options.type.default;
        options.actionType = options.type;
        options.stopMove = options.fullscreen;
        options.stopResize = options.fullscreen;

        // if this is the first time running the plugins
        // call the function that gets the script
        if (!_mapFired) {
          loadMaps();
        }

        // create a new div this way anything in the target div is left intact
        // this is later passed on to the maps api
        mapDiv = document.createElement('div');
        mapDiv.classList.add('map');

        streetDiv = document.createElement('div');
        streetDiv.classList.add('streetview');
        _container = document.createElement('div');
        _container.id = Popcorn.guid('googlemap');
        _container.classList.add('popcorn-googlemap');
        _container.style.width = `${options.width}%`;
        _container.style.height = `${options.height}%`;
        _container.style.left = `${options.left}%`;
        _container.style.top = `${options.top}%`;
        _container.style.zIndex = +options.zindex;
        _container.style.position = 'absolute';
        _container.classList.add(options.transition);
        _container.classList.add(options.type.toLowerCase());
        _container.classList.add('off');

        draggableHandle = createDraggableHandle(options, _container);

        _container.appendChild(mapDiv);
        _container.appendChild(streetDiv);
        _container.appendChild(draggableHandle);
        options._container = _container;

        if (target) {
          target.appendChild(_container);
        }

        isMapReady();

        options.toString = () => {
          if (options.type === 'STREETVIEW') {
            return 'Streetview';
          }
          return options.location || ((options.lat && options.lng) ? `${options.lat}, ${options.lng}` : options._natives.manifest.options.location.default);
        };

        removeDeleteListener(_container, options.id);
        addDeleteListener(_container, options.id);

        const selectElement = event => {
          event.stopPropagation();
          selectItem(event, options.id);
        };

        const emitterSelectItem = id => {
          const isSelected = id === options.id;
          if (options && options._container) {
            options._container.classList[isSelected ? 'add' : 'remove']('active');
          }

          if (isSelected) {
            draggableResizable({ ...options, _container, type: POPCORN_ELEMENT_TYPES.GOOGLE_MAP }, null, { ratio: 'preserve' });
          } else {
            options.stopMove = false;
            options.stopResize = false;
            removeDbClick(options, _container);
          }
        };

        options._container.addEventListener('click', selectElement);
        emitter.on(emitterActions.SELECT, emitterSelectItem);

        buildScripts(options);
      },
      /**
       * @member googlemap
       * The start function will be executed when the currentTime
       * of the video reaches the start time provided by the
       * options variable
       */
      start(event, options) {
        const that = this;
        let redrawBug;
        const DEFAULT_MAP_ZOOM_VALUE = options._natives.manifest.options.zoom.default;
        const DEFAULT_MAP_PITCH_VALUE = options._natives.manifest.options.pitch.default;
        const DEFAULT_MAP_HEADING_VALUE = options._natives.manifest.options.heading.default;

        that.on('seeking', () => {
          options.stopMove = false;
          options.stopResize = false;
          removeDbClick({ ...options, type: POPCORN_ELEMENT_TYPES.GOOGLE_MAP }, _container);
        });

        // ensure the map has been initialized in the setup function above
        const isMapSetup = () => {
          function tween(rM, t) {
            const computeHeading = google.maps.geometry.spherical.computeHeading;
            setTimeout(() => {
              const current_time = that.media.currentTime;

              //  Checks whether this is a generated route or not
              if (typeof options.tween === 'object') {
                for (let i = 0, m = rM.length; i < m; i++) {
                  const waypoint = rM[i];

                  //  Checks if this position along the tween should be displayed or not
                  if (current_time >= (waypoint.interval * (i + 1)) / 1000
                    && (current_time <= (waypoint.interval * (i + 2)) / 1000
                      || current_time >= (waypoint.interval * m) / 1000)) {
                    streetDiv.setPosition(new google.maps.LatLng(waypoint.position.lat, waypoint.position.lng));

                    streetDiv.setPov({
                      heading: waypoint.pov.heading || computeHeading(waypoint, rM[i + 1]) || 0,
                      zoom: options.zoom ?? DEFAULT_MAP_ZOOM_VALUE,
                      pitch: waypoint.pov.pitch || 0,
                    });
                  }
                }

                //  Calls the tween function again at the interval set by the user
                tween(rM, rM[0].interval);
              } else {
                for (let k = 0, l = rM.length; k < l; k++) {
                  const interval = options.interval;

                  if (current_time >= (interval * (k + 1)) / 1000
                    && (current_time <= (interval * (k + 2)) / 1000
                      || current_time >= (interval * l) / 1000)) {
                    streetDiv.setPov({
                      heading: computeHeading(rM[k], rM[k + 1]) || 0,
                      zoom: options.zoom ?? DEFAULT_MAP_ZOOM_VALUE,
                      pitch: options.pitch || 0,
                    });
                    streetDiv.setPosition(checkpoints[k]);
                  }
                }

                tween(checkpoints, options.interval);
              }
            }, t);
          }

          if (map && !ranOnce) {
            options._map = map;
            ranOnce = true;
            // reset the location and zoom just in case the user played with the map
            _container.classList.remove('off');
            _container.classList.add('on');
            google.maps.event.trigger(map, 'resize');
            map.setCenter(location);

            // make sure options.zoom is a number
            if (options.zoom !== undefined && typeof options.zoom !== 'number') {
              options.zoom = +options.zoom >= 0 && +options.zoom <= MAX_MAP_ZOOM_VALUE ? +options.zoom : DEFAULT_MAP_ZOOM_VALUE;
            }

            map.setZoom(options.zoom);

            // Make sure heading is a number
            if (options.heading && typeof options.heading !== 'number') {
              options.heading = +options.heading >= 0 && +options.heading <= MAX_MAP_HEADING_VALUE ? +options.heading : DEFAULT_MAP_HEADING_VALUE;
            }
            // Make sure pitch is a number
            if (options.pitch && typeof options.pitch !== 'number') {
              options.pitch = +options.pitch >= 0 && +options.pitch <= MAX_MAP_PITCH_VALUE ? +options.pitch : DEFAULT_MAP_PITCH_VALUE;
            }


            // Switch this map into streeview mode
            map.setStreetView(
              // Pass a new StreetViewPanorama instance into our map
              streetDiv = new google.maps.StreetViewPanorama(streetDiv, {
                position: location,
                pov: {
                  heading: options.heading,
                  pitch: options.pitch,
                  zoom: options.zoom ?? DEFAULT_MAP_ZOOM_VALUE,
                },
                enableCloseButton: false,
              }),
            );

            //  Determines if we should use hardcoded values ( using options.tween ),
            //  or if we should use a start and end location and let google generate
            //  the route for us
            if (options.location && typeof options.tween === 'string') {
              //  Creating another variable to hold the streetview map for tweening,
              //  Doing this because if there was more then one streetview map, the tweening would sometimes appear in other maps

              //  Create an array to store all the lat/lang values along our route
              const checkpoints = [];

              //  Creates a new direction service, later used to create a route
              const directionsService = new google.maps.DirectionsService();

              //  Creates a new direction renderer using the current map
              //  This enables us to access all of the route data that is returned to us
              const directionsDisplay = new google.maps.DirectionsRenderer(streetDiv);

              const request = {
                origin: options.location,
                destination: options.tween,
                travelMode: google.maps.TravelMode.DRIVING,
              };

              //  Create the route using the direction service and renderer
              directionsService.route(request, (response, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                  directionsDisplay.setDirections(response);
                  showSteps(response, that);
                }
              });

              const showSteps = function (directionResult) {
                //  Push new google map lat and lng values into an array from our list of lat and lng values
                const routes = directionResult.routes[0].overview_path;
                for (let j = 0, k = routes.length; j < k; j++) {
                  checkpoints.push(new google.maps.LatLng(routes[j].lat(), routes[j].lng()));
                }

                //  Check to make sure the interval exists, if not, set to a default of 1000
                options.interval = options.interval || 1000;
                tween(checkpoints, 10);
              };
            } else if (typeof options.tween === 'object') {
              //  Same as the above to stop streetview maps from overflowing into one another

              for (let i = 0, l = options.tween.length; i < l; i++) {
                //  Make sure interval exists, if not, set to 1000
                options.tween[i].interval = options.tween[i].interval || 1000;
                tween(options.tween, 10);
              }
            }

            // For some reason, in some cases the map can wind up being undefined at this point
            if (options.onmaploaded && map) {
              options.onmaploaded(options, map);
            }
          } else if (ranOnce) {
            _container.classList.remove('off');
            _container.classList.add('on');

            // Safari Redraw hack - #3066
            _container.style.display = 'none';
            redrawBug = _container.offsetHeight;
            _container.style.display = '';
          } else {
            setTimeout(() => {
              isMapSetup();
            }, 50);
          }
        };
        isMapSetup();

        buildScripts(options);
        if (options.scripts && options.scripts._compiled && options.scripts._compiled.onStart) {
          options.scripts._compiled.onStart();
        }
      },
      /**
       * @member webpage
       * The end function will be executed when the currentTime
       * of the video reaches the end time provided by the
       * options variable
       */
      end() {
        this.off('seeking');
        draggableHandle.removeEventListener('dblclick', onDblClick);
        options.stopMove = false;
        // if the map exists hide it do not delete the map just in
        // case the user seeks back to time b/w start and end
        if (map) {
          _container.classList.remove('on');
          _container.classList.add('off');
        }

        buildScripts(options);
        if (options.scripts && options.scripts._compiled && options.scripts._compiled.onEnd) {
          options.scripts._compiled.onEnd();
        }
      },
      _teardown(options) {
        // the map must be manually removed
        options._target.removeChild(_container);
        mapDiv = map = location = null;

        options._map = null;
      },
      _update(trackEvent, options) {
        let updateLocation = false;
        const map = trackEvent._map;
        let triggerResize = false;
        let ignoreValue = false;
        let clearLocation = false;
        let location;
        let layer;
        let oldType;

        function streetViewSearch(latLng, res, errorMsg, toggleMaps, success) {
          var streetViewService = new google.maps.StreetViewService();

          streetViewService.getPanoramaByLocation(latLng, res, (data, status) => {
            if (status === google.maps.StreetViewStatus.OK) {
              success(data.location.latLng);
            } else {
              that.emit('googlemaps-zero-results', {
                error: errorMsg,
                toggleMaps,
              });
            }
          });
        }

        const recalculatingMapSize = () => {
          if ((trackEvent.type === 'STREETVIEW' || trackEvent.type === 'SIDEBYSIDE') && map) {
            streetViewSearch(
              map.getCenter(),
              5000,
              "There is no Street View data available within 5 kilometres of your map's centre. Try moving the map and selecting Street View again.",
              true,
              (latLng) => {
                map.streetView.setVisible(true);
              },
            );
          }
        };

        if (options.runResize) {
          isResize = true;
          recalculatingMapSize();
        }

        if (options.type && options.type !== trackEvent.type) {
          oldType = trackEvent.type;

          trackEvent._container.classList.remove(oldType.toLowerCase());
          trackEvent._container.classList.add(options.type.toLowerCase());

          map.setOptions({ streetViewControl: options.type === 'SIDEBYSIDE' });
          if (['STREETVIEW', 'SIDEBYSIDE'].indexOf(options.type) === -1) {
            trackEvent.type = options.type;
            trackEvent.actionType = options.actionType;
            if (['STREETVIEW', 'SIDEBYSIDE'].indexOf(oldType) !== -1) {
              map.streetView.setVisible(false);
            }
            if (/STAMEN/.test(trackEvent.type)) {
              layer = trackEvent.type.toLowerCase();
            }
            map.setMapTypeId(layer || google.maps.MapTypeId[trackEvent.type]);
            if (layer) {
              map.mapTypes.set(layer, new google.maps.StamenMapType(layer.replace('stamen-', '')));
            }
          } else {
            ignoreValue = true;
            trackEvent.location = '';
            let newZoom = 0;
            if (options.zoom) {
              newZoom = options.zoom;
            } else if (trackEvent.zoom !== undefined && trackEvent.zoom > MAX_STREETVIEW_ZOOM_VALUE) {
              newZoom = MAX_STREETVIEW_ZOOM_VALUE;
            } else if (trackEvent.zoom !== undefined && trackEvent.zoom <= MAX_STREETVIEW_ZOOM_VALUE) {
              newZoom = trackEvent.zoom;
            } else if (trackEvent.zoom === undefined) {
              newZoom = DEFAULT_STREETVIEW_ZOOM_VALUE;
            }

            streetViewSearch(
              map.getCenter(),
              5000,
              "There is no Street View data available within 5 kilometres of your map's centre. Try moving the map and selecting Street View again.",
              true,
              (latLng) => {
                trackEvent.type = options.type;
                trackEvent.actionType = options.actionType;
                trackEvent.heading = 0;
                trackEvent.pitch = 0;
                trackEvent.zoom = options.zoom ?? ZOOM_DEFAULT;
                map.streetView.setVisible(true);
                map.streetView.setPosition(latLng);
                map.streetView.setPov({
                  heading: trackEvent.heading,
                  pitch: trackEvent.pitch,
                  zoom: newZoom,
                });
              },
            );
          }
        }

        if (!ignoreValue && options.zoom !== undefined && options.zoom !== trackEvent.zoom) {
          trackEvent.zoom = options.zoom;

          map.setZoom(+trackEvent.zoom);
          if (trackEvent.type === 'STREETVIEW') {
            map.streetView.setPov({
              heading: trackEvent.heading,
              pitch: trackEvent.pitch,
              zoom: +trackEvent.zoom,
            });
          }
        }

        if (!ignoreValue && options.location && options.location !== trackEvent.location) {
          updateLocation = true;
          location = _cachedGeoCode[options.location];
          trackEvent.location = options.location;
          if (location) {
            if (trackEvent.type === 'STREETVIEW') {
              streetViewSearch(
                location,
                250,
                false,
                'There is no Street View data available within 250 metres of the searched location. Try another location',
                (latLng) => {
                  map.streetView.setPosition(latLng);
                },
              );
            } else {
              map.panTo(location);
            }
          } else {
            geocoder.geocode({ address: trackEvent.location }, (results, status) => {
              if (status === google.maps.GeocoderStatus.OK) {
                _cachedGeoCode[trackEvent.location] = location = results[0].geometry.location;
                if (trackEvent.type === 'STREETVIEW') {
                  streetViewSearch(
                    location,
                    250,
                    'There is no Street View data available within 250 metres of the searched location. Try another location',
                    false,
                    (latLng) => {
                      map.streetView.setPosition(latLng);
                    },
                  );
                } else {
                  map.panTo(location);
                }
              }
            });
          }
        }

        if (!ignoreValue && !updateLocation && options.lat && options.lat !== trackEvent.lat) {
          trackEvent.lat = options.lat;
          clearLocation = true;
        }

        if (!ignoreValue && !updateLocation && options.lng && options.lng !== trackEvent.lng) {
          trackEvent.lng = options.lng;
          clearLocation = true;
        }

        if (clearLocation) {
          trackEvent.location = '';
        }

        if (!ignoreValue && trackEvent.type === 'STREETVIEW' && options.heading && options.heading !== trackEvent.heading) {
          trackEvent.heading = options.heading;
          map.getStreetView().setPov({
            heading: +trackEvent.heading,
            pitch: +trackEvent.pitch || 0,
            zoom: +trackEvent.zoom || 0,
          });
        }

        if (!ignoreValue && trackEvent.type === 'STREETVIEW' && options.pitch && options.pitch !== trackEvent.pitch) {
          trackEvent.pitch = options.pitch;
          map.getStreetView().setPov({
            heading: +trackEvent.heading || 0,
            pitch: +trackEvent.pitch,
            zoom: +trackEvent.zoom || 0,
          });
        }

        if (options.fullscreen !== undefined) {
          trackEvent.fullscreen = options.fullscreen;
          trackEvent.top = options.top;
          trackEvent.left = options.left;
          trackEvent.width = options.width;
          trackEvent.height = options.height;
          trackEvent.stopMove = options.stopMove;
          trackEvent.stopResize = options.stopResize;
          removeDbClick(trackEvent, trackEvent._container);
          recalculatingMapSize();
        }

        if ((options.left || options.left === 0) && options.left !== trackEvent.left && options.fullscreen === undefined) {
          trackEvent.left = options.left;
        }

        if ((options.top || options.top === 0) && options.top !== trackEvent.top && options.fullscreen === undefined) {
          trackEvent.top = options.top;
        }

        if ((options.height || options.height === 0) && options.height !== trackEvent.height && options.fullscreen === undefined) {
          trackEvent.height = options.height;
          triggerResize = true;
          recalculatingMapSize();
        }

        if ((options.width || options.width === 0) && options.width !== trackEvent.width && options.fullscreen === undefined) {
          trackEvent.width = options.width;
          triggerResize = true;
          recalculatingMapSize();
        }

        trackEvent._container.style.top = `${trackEvent.top}%`;
        trackEvent._container.style.left = `${trackEvent.left}%`;
        trackEvent._container.style.height = `${trackEvent.height}%`;
        trackEvent._container.style.width = `${trackEvent.width}%`;

        if (triggerResize) {
          google.maps.event.trigger(map, 'resize');
        }

        if (options.transition && options.transition !== trackEvent.transition) {
          _container.classList.remove(trackEvent.transition);
          trackEvent.transition = options.transition;
          _container.classList.add(trackEvent.transition);
        }
      },
    };
  }, {
    about: {
      name: 'Popcorn Google Map Plugin',
      version: '0.1',
      author: '@annasob, Matthew Schranz @mjschranz',
      website: 'annasob.wordpress.com, http://github.com/mjschranz',
      attribution: 'Map tiles by <a target="_blank" href="http://stamen.com">Stamen Design</a>,'
        + 'under <a target="_blank" href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. '
        + 'Data by <a target="_blank" href="http://openstreetmap.org">OpenStreetMap</a>, '
        + 'under <a target="_blank" href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.',
    },
    options: {
      start: {
        type: 'time',
        label: 'Start',
      },
      end: {
        type: 'time',
        label: 'End',
      },
      type: {
        type: 'select',
        items: GOOGLE_MAP_ITEMS,
        label: 'Map Type',
        default: GOOGLE_MAP_VALUES.ROADMAP,
        optional: true,
      },
      location: {
        type: 'input',
        label: 'Location',
        default: 'Toronto, Ontario, Canada',
      },
      fullscreen: {
        type: 'checkbox',
        label: 'Fullscreen',
        default: false,
        optional: true,
      },
      heading: {
        type: 'number',
        label: 'Heading',
        default: 0,
        optional: true,
      },
      pitch: {
        type: 'number',
        label: 'Pitch',
        default: 1,
        optional: true,
      },
      zoom: {
        type: 'slider',
        step: '1',
        label: 'Zoom',
        default: ZOOM_DEFAULT,
        streetViewDefault: DEFAULT_STREETVIEW_ZOOM_VALUE,
        optional: true,
        maxValue: MAX_MAP_ZOOM_VALUE,
        maxStreetViewValue: MAX_STREETVIEW_ZOOM_VALUE,
      },
      transition: {
        type: 'select',
        items: [
          { label: 'None', value: 'popcorn-none' },
          { label: 'Fade', value: 'popcorn-fade' },
          { label: 'Slide Up', value: 'popcorn-slide-up' },
          { label: 'Slide Down', value: 'popcorn-slide-down' },
          { label: 'Fade In Up', value: 'popcorn-fade-in-up' },
        ],
        label: 'Transition',
        default: 'popcorn-fade',
      },
      left: {
        elem: 'input',
        type: 'number',
        label: 'Left',
        default: 15,
      },
      top: {
        elem: 'input',
        type: 'number',
        label: 'Top',
        default: 15,
      },
      width: {
        elem: 'input',
        type: 'number',
        label: 'Width',
        default: 70,
      },
      height: {
        elem: 'input',
        type: 'number',
        label: 'height',
        default: 70,
      },
      lat: {
        type: 'number',
        label: 'Lat',
        optional: true,
        hidden: true,
      },
      lng: {
        type: 'number',
        label: 'Lng',
        optional: true,
        hidden: true,
      },
      zindex: {
        hidden: true,
      },
      scripts: {
        onStart: '',
        onEnd: '',
      },
    },
  });
}(Popcorn));
