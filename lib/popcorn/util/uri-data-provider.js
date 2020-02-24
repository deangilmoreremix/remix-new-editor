/**
 * Created by vedi on 14/04/16.
 */

define([], function () {
  var urlParams;

  function getQueryParams(a) {
    if (a === "") {
      return {};
    }
    var b = {};
    for (var i = 0; i < a.length; ++i) {
      var p = a[i].split("=", 2);
      if (p.length === 1) {
        b[p[0]] = "";
      } else {
        b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
      }
    }
    return b;
  }
  
  return {
    name: 'uri',

    onReady: function () {
      // it's supposed to be redefined
    },

    canSupplyAny: function canSupplyAny() {
      return true;
    },
    
    init: function init() {
      this.onReady();
    },
    
    fetchData: function fetchData(callback) {
      try {
        if (!urlParams) {
          urlParams = getQueryParams(window.location.search.substr(1).split("&"));
          urlParams.url = window.location.origin + window.location.pathname;
        }
        
        callback(null, urlParams);
      } catch (err) {
        callback(err);
      }
    }
  };
});
