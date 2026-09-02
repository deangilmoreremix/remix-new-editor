/*eslint-disable */
import React, { Component } from "react";
import PropTypes from 'prop-types';

const canUseDOM = !!(
  (typeof window !== 'undefined' &&
    window.document && window.document.createElement)
);

export default class Intercom extends Component {
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

  static displayName = 'Intercom';

  constructor(props) {
    super(props);
    const { appID, user, domain } = props;

    if (!appID || !canUseDOM) {
      return;
    }

    if (!window.Intercom) {
      (function () {
        var w = window;
        var ic = w.Intercom;
        if (typeof ic === "function") {
          ic('reattach_activator');
          ic('update', intercomSettings);
        } else {
          var d = document;
          var i = function () {
            i.c(arguments)
          };
          i.q = [];
          i.c = function (args) {
            i.q.push(args)
          };
          w.Intercom = i;
          function l() {
            var s = d.createElement('script');
            s.type = 'text/javascript';
            s.async = true;
            s.src = `https://widget.intercom.io/widget/${appID}`;
            var x = d.getElementsByTagName('script')[0];
            x.parentNode.insertBefore(s, x);
          }

          if (w.attachEvent) {
            w.attachEvent('onload', l);
          } else {
            w.addEventListener('load', l, false);
          }
        }
      })()
    }

    window.intercomSettings = {
      app_id: appID,
      name: user.fullName,
      email: user.email,
      user_hash: user.hash,
      created_at: user.createdAt,
      domain,
    };

    if (window.Intercom) {
      window.Intercom('boot', {
        name: user.fullName,
        email: user.email,
        user_hash: user.hash,
        created_at: user.createdAt,
        domain,
      });
    }
  }

  componentWillReceiveProps(nextProps) {
    const { appID, user, domain } = nextProps;

    if (!canUseDOM) return;

    window.intercomSettings = {
      app_id: appID,
      name: user.fullName,
      email: user.email,
      user_hash: user.hash,
      created_at: user.createdAt,
      domain,
    };

    if (window.Intercom) {
      window.Intercom('update', {
        name: user.fullName,
        email: user.email,
        user_hash: user.hash,
        created_at: user.createdAt,
        domain,
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
