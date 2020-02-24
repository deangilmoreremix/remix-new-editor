/**
 * Created by vedi on 24/03/16.
 */

define(['jquery'], function ($) {

  var SUPPORTED_KEYS = ['GEOCOUNTRY', 'GEOCITY', 'GEOSTATE'];

  var FIELD_MAPPING = {
    'country': 'GEOCOUNTRY',
    'city': 'GEOCITY',
    'regionName': 'GEOSTATE'
  };

  var result;

  var country;
  var city;
  var awaitingCallbacks = [];

  function getCountry(variables, callback) {
    if (country) {
      return callback(null, country);
    }
    awaitingCallbacks.push(callback);

    if (awaitingCallbacks.length > 1) {
      return;
    }
    $.getJSON('//pro.ip-api.com/json/?key=PjlxsWS2ccSdeop&callback=?')
      .then(function (data) {
        if (!data) {
          throw new Error("Wrong result");
        }

        country = variables["GEOCOUNTRY"] = data["country"];
        city = variables["GEOCITY"] = data["city"];
        while (awaitingCallbacks.length > 0) {
          var awaitingCallback = awaitingCallbacks.shift();
          awaitingCallback(null, country);
        }
      })
      .fail(function(jqxhr, textStatus, error) {
        var errorDetails = textStatus + ", " + error;
        var err = new Error(errorDetails);
        while (awaitingCallbacks.length > 0) {
          var awaitingCallback = awaitingCallbacks.shift();
          awaitingCallback(err);
        }
      });
  }

  return {
    name: 'geo',

    onReady: function () {
      // it's supposed to be redefined
    },

    canSupplyAny: function canSupplyAny(customVarKeys) {
      var found = false;
      SUPPORTED_KEYS.forEach(function (supportedKey) {
        found = found || customVarKeys.indexOf(supportedKey) >= 0;
      });
      return found;
    },

    init: function init() {
      this.onReady();
    },

    fetchData: function fetchData(callback) {
      if (!result) {
        $.getJSON('//pro.ip-api.com/json/?key=PjlxsWS2ccSdeop&callback=?')
          .then(function (data) {
            if (!data) {
              throw new Error("Wrong result");
            }

            result = {};
            for (var key in data) {
              if (data.hasOwnProperty(key)) {
                var mapper = FIELD_MAPPING[key];
                if (mapper) {
                  if (typeof mapper === 'function') {
                    mapper(result, data[key]);
                  } else {
                    result[mapper] = data[key];
                  }
                }
              }
            }
            
            callback(null, result);
          })
          .fail(function(jqxhr, textStatus, error) {
            var errorDetails = textStatus + ", " + error;
            var err = new Error(errorDetails);
            callback(err);
          });
      } else {
        callback(null, result);
      }
    },

    getCountry: getCountry  // TODO: Remove it
  };
});
