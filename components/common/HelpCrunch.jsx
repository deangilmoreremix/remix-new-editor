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
    userStore: PropTypes.shape({
      roleNames: PropTypes.string,
      currentUser: PropTypes.shape({
        hash: PropTypes.string.isRequired,
        email: PropTypes.string.isRequired,
        fullName: PropTypes.string.isRequired,
      }).isRequired,
    }),
  };

  static displayName = 'HelpCrunch';
  constructor(props) {
    super(props);
    const { applicationId, applicationSecret, userStore: { currentUser: user } } = props;
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
    }

    window.helpCrunchSettings = {
      email: user.email,
      name: user.fullName,
      user_id: user.hash,
    };
  }

  async componentDidMount() {
    if (!canUseDOM) {
      return;
    }
    const { userStore } = this.props;
    await userStore.setRoles();

    const { roles = [] } = userStore;
    window.HelpCrunch('onReady', () => {
      window.HelpCrunch('showChatWidget');
      window.HelpCrunch('updateUserData', {
        active_roles: roles && roles.map(({ name }) => name).join(', '),
      });
    });
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { userStore: { currentUser: user, roles = [] } } = nextProps;

    if (!canUseDOM) {
      return;
    }

    const roleNames = roles && roles.map(({ name }) => name).join(', ');

    window.helpCrunchSettings = {
      email: user.email,
      name: user.fullName,
      user_id: user.hash,
      active_roles: roleNames,
    };

    if (window.HelpCrunch) {
      window.HelpCrunch('updateUser', {
        email: user.email,
        name: user.fullName,
        user_id: user.hash,
        custom_data: {
          active_roles: roleNames,
        },
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
