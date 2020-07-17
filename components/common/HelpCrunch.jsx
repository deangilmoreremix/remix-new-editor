/*eslint-disable */
import React, { Component } from "react";
import PropTypes from 'prop-types';

const canUseDOM = !!(
  (typeof window !== 'undefined' &&
    window.document && window.document.createElement)
);

export default class HelpCrunch extends Component {
  static propTypes = {
    appID: PropTypes.string.isRequired,
    user: PropTypes.shape({
      fullName: PropTypes.string.isRequired,
      email: PropTypes.string.isRequired,
      hash: PropTypes.string.isRequired,
      createdAt: PropTypes.string.isRequired,
    }),
    domain: PropTypes.string.isRequired,
  };

  static displayName = 'HelpCrunch';
//last loggin
  constructor(props) {
    super(props);
    const { appID, user, domain } = props;

    // if (!appID || !canUseDOM) {
    //   return;
    // }
    if (!canUseDOM) {
      return;
    }

    if (!window.HelpCrunch) {
      debugger
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
        applicationId: 1,
        applicationSecret: 'Jo2+/wkeh+c/eWCksMl2jSOtDynf5QtuoWJNKfWQpylz50Ydivy7L5CN44CYjVtoBZ/JfnURGrkf8LGfNh69+w==',
        user: {
          email: user.email,
          name: user.fullName,
          user_id: user.hash,
          // security_hash: user.hash,
        }
      });
    }

    window.helpCrunchSettings = {
      email: user.email,
      name: user.fullName,
      user_id: user.hash,
      // security_hash: user.hash,
    };
  }

  componentWillReceiveProps(nextProps) {
    const { appID, user, domain } = nextProps;

    if (!canUseDOM) return;

    window.helpCrunchSettings = {
      email: user.email,
      name: user.fullName,
      user_id: user.hash,
      // security_hash: user.hash,
    };

    if (window.HelpCrunch) {
      window.HelpCrunch('updateUser', {
        email: user.email,
        name: user.fullName,
        // user_id: user._id,
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
