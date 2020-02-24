define(["q", "util/xhr", "json!/api/butterconfig"], function(Q, xhr, config) {
  var _this = {};
  var types = [];
  var isProduction = JSON.parse(document.querySelector("meta[name=is-prod]").content);
  var path = typeof (config.cdn_hostname) !== 'undefined' ?
    config.cdn_hostname + "/src/plugins/combined/events/" : "/src/plugins/combined/events/";
  var eventsList = [
    "ignite-dark",
    "blackred-credits",
    "blackred-next",
    "blackred-now-showing",
    "blackred-schedule",
    "blackred-schedule-program",
    "blackred-sponsored",
    "blur-bg-title-overlay-a",
    "blur-bg-title-overlay-b",
    "box-out-stroke-a",
    "box-out-stroke-b",
    "center-overlay-band",
    "clear",
    "cloudy-lower-3rd",
    "color-mini-block",
    "desktop-flat-lay-ipad",
    "desktop-flat-lay-iphone",
    "desktop3d-imac",
    "desktop3d-macbook",
    "diagonal",
    "ds-opening-title",
    "ds-schedule-a",
    "ds-schedule-b",
    "ds-schedule-c",
    "ds-schedule-d",
    "ds-schedule-e",
    "ds-lower-thirds",
    "ds-schedule-program",
    "ds-next-session",
    "extreme-opening-a",
    "extreme-opening-b",
    "extreme-info",
    "extreme-schedule",
    "fit-broadcast-a",
    "fit-broadcast-b",
    "fit-broadcast-c",
    "fit-broadcast-d",
    "fit-broadcast-e",
    "flat-browser",
    "flat-next",
    "flat-next-schedule",
    "flat-premiere",
    "flat-today-show",
    "flat-tonight-show",
    "flat-responsive-showcase-a",
    "flat-responsive-showcase-b",
    "float-center",
    "fun-intro",
    "fun-opening",
    "fun-schedule",
    "fun-seetoday-lowerthirds",
    "fun-social-lowerthirds",
    "full-color-overlay",
    "glassy",
    "hand-written-arrows",
    "ignite",
    "ipad-a",
    "ipad-b",
    "ipad-c",
    "ipad-cover",
    "iphone-5-a",
    "iphone-5-b",
    "iphone-flat-color-a",
    "iphone-flat-color-b",
    "multi-color-a",
    "multi-color-b",
    "multi-color-c",
    "mustache",
    "minimal-typography-a",
    "minimal-typography-b",
    "minimal-typography-c",
    "minimal-typography-d",
    "minimal-typography-e",
    "modern-lowerthirds-a",
    "modern-lowerthirds-b",
    "modern-lowerthirds-c",
    "modern-lowerthirds-d",
    "modern-lowerthirds-e",
    "modern-lowerthirds-f",
    "monitor-effect",
    "monochrome-showcase-black",
    "monochrome-showcase-white",
    "partial-cover-cool",
    "retro-trapezoid",
    "simple-band",
    "split-screen",
    "textcolor-bleed",
    "thuglife",
    "transparent-dark-lower-third",
    "vox-schedule-a",
    "vox-schedule-b",
    "vox-next-movie",
    "vox-lowerthirds-a",
    "vox-lowerthirds-b",
    "vox-fullscreen-overlay",
    "vox-sponsor",
    "vox-schedule-program",
    "white-thirds-a",
    "white-thirds-b"
  ];

  function init() {
    eventsList.forEach(function(eventName) {
      var deferred = Q.defer();

      xhr.get(path + /*"build/" +*/ eventName + ".json", function(data) {
        deferred.resolve(data);
      });

      types.push(deferred.promise);
    });
  }

  !isProduction && init();

  _this.getTypes = function() {
    return !isProduction ? Q.all(types) : Q.fcall(function() {
      var deferred = Q.defer();

      xhr.get(path + "build/dist.json", function(data) {
        deferred.resolve(data);
      });

      return deferred.promise;
    });
  };

  _this.find = function(type) {
    return _this.getTypes()
    .then(function(types) {
      for (var i=0; i<types.length; i++) {
        if(types[i].type === type) {
          return types[i];
        }
      }

      throw new Error("Couldnt find combo event with given type: " + type);
    });
  };

  return _this;
});
