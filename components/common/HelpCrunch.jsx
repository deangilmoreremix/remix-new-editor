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
    this.state = {
      roleNames: '',
      // any other state variables you want to initialize
    };
    const { applicationId, applicationSecret, userStore: { currentUser: user } } = props;
    if (!applicationId || !applicationSecret || !canUseDOM) {
      return;
    }

    if (!window.HelpCrunch) {
      (function () {
        var w = window;
        var ic = w.HelpCrunch;
        console.log(typeof (ic), "check type of")
        if (typeof ic === "function") {
          console.log('call update jhdjj', helpCrunchSettings)
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
          function r() {
            var s = d.createElement('script');
            s.async = 1;
            s.type = 'text/javascript';
            s.src = 'https://widget.helpcrunch.com/';
            (d.body || d.head).appendChild(s);
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
      console.log('call 66');
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
    console.log('call 67');
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
    // await userStore.userCutOutProBalance();


    const { roles = [] } = userStore;
    window.HelpCrunch('onReady', () => {
      window.HelpCrunch('showChatWidget');
      window.HelpCrunch('updateUserData', {
        active_roles: Array.isArray(roles) ? roles.map(({ name }) => name).join(', ') : '',
      });
    });
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    // Extract necessary properties from nextProps
    const { userStore: { currentUser: user } } = nextProps;
    const roles = nextProps.userStore.roles || [];
    // Prepare the roles string
    const roleNames = Array.isArray(roles) ? roles.map(({ name }) => name).join(', ') : '';

    // Check if roleNames have changed
    if (roleNames !== prevState.roleNames) {
      // Return new state object with updated roleNames
      return {
        roleNames: roleNames,
      };
    }

    // No state update necessary
    return null;
  }


  shouldComponentUpdate() {
    return false;
  }

  render() {
    return false;
  }
}
