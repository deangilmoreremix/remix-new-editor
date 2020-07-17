/*eslint-disable */
import React, { Component } from "react";
import PropTypes from 'prop-types';

const canUseDOM = !!(
  (typeof window !== 'undefined' &&
    window.document && window.document.createElement)
);

export default class HelpCrunch extends Component {
  static propTypes = {
    applicationId: PropTypes.string.isRequired,
    applicationSecret: PropTypes.string.isRequired,
    user: PropTypes.shape({
      fullName: PropTypes.string.isRequired,
      email: PropTypes.string.isRequired,
      hash: PropTypes.string.isRequired,
    }),
  };

  static displayName = 'HelpCrunch';
  constructor(props) {
    super(props);
    const { applicationId, applicationSecret, user } = props;

    if (!applicationId || !applicationSecret || !canUseDOM) {
      return;
    }

    if (!window.HelpCrunch) {
      (function () {
        var w = window;
        var ic = w.HelpCrunch;
        if (typeof ic === "function") {
          ic('updateUser', helpCrunchSettings);
        } else {
          var d = document;
          var i = function () {
            i.c(arguments)
          };
          i.q = [];
          i.c = function (args) {
            i.q.push(args)
          };
          w.HelpCrunch = i;
          function r(){
            var s = d.createElement('script');
            s.async = 1;
            s.type = 'text/javascript';
            s.src = 'https://widget.helpcrunch.com/';
            (d.body||d.head).appendChild(s);
          }

          if (w.attachEvent) {
            w.attachEvent('onload', r);
          } else {
            w.addEventListener('load', r, false);
          }
        }
      })()
    }

    if (window.HelpCrunch) {
      window.HelpCrunch('init', 'videoremix', {
        applicationId,
        applicationSecret,
        user: {
          email: user.email,
          name: user.fullName,
          user_id: user.hash,
        }
      });

      window.HelpCrunch('onReady', function() {
        window.HelpCrunch('showChatWidget');
      });
    }

    window.helpCrunchSettings = {
      email: user.email,
      name: user.fullName,
      user_id: user.hash,
    };
  }

  componentWillReceiveProps(nextProps) {
    const { user } = nextProps;

    if (!canUseDOM) {
      return;
    }

    window.helpCrunchSettings = {
      email: user.email,
      name: user.fullName,
      user_id: user.hash,
    };

    if (window.HelpCrunch) {
      window.HelpCrunch('updateUser', {
        email: user.email,
        name: user.fullName,
        user_id: user.hash,
      });
    }
  }

  shouldComponentUpdate() {
    return false;
  }

  render() {
    return false;
  }
}
