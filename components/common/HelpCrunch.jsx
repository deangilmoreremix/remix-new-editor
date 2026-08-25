import React, { useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import useUserStore from '../hooks/useUserStore';
// Assuming `UserStoreContext` is the context for userStore if it's provided via Context API
// If not, you will pass userStore as a prop as before
// import UserStoreContext from 'path-to-userstore-context';

const canUseDOM = !!(
  (typeof window !== 'undefined' &&
    window.document && window.document.createElement)
);

const HelpCrunch = ({ applicationId, applicationSecret, userStore }) => {
  const [roleNames, setRoleNames] = useState('');
  const [userData, setUserData] = useState('');

  const userStoreData = useUserStore()
  // If userStore is provided via context, use the useContext hook to get it
  // const userStore = useContext(UserStoreContext);

  const getUserData = async () => {
    const userData =  await userStoreData.getUserAllDetails()
    console.log(userData,"userData") 
    setUserData(userData)
  }

  useEffect(() => {
    if (!canUseDOM) return;

    const user = userStore.currentUser;
    console.log(user, "user=============>>");

    getUserData()
    console.log(userData,"userData")
    if (!window.HelpCrunch) {
      (function () {
        var w = window;
        var ic = w.HelpCrunch;
        console.log(typeof (ic), "check type of");
        if (typeof ic === "function") {
          ic('updateUser', window.helpCrunchSettings);
        } else {
          var d = document;
          var i = function () {
            i.c(arguments);
          };
          i.q = [];
          i.c = function (args) {
            i.q.push(args);
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
      })();
    }

    if (window.HelpCrunch) {
      window.HelpCrunch('init', 'videoremix', {
        applicationId,
        applicationSecret,
        user: {
          email: user.email,
          name: user.fullName,
          user_id: user.hash,
        },
      });
    }

    window.helpCrunchSettings = {
      email: user.email,
      name: user.fullName,
      user_id: user.hash,
    };

    // fetchData function could be defined here or outside the component if it does not use any props or state


    userStore.setRoles().then(() => {
      const roles = userStore.roles || [];
      window.HelpCrunch('onReady', () => {
        window.HelpCrunch('showChatWidget');
        window.HelpCrunch('updateUserData', {
          active_roles: Array.isArray(roles) ? roles.map(({ name }) => name).join(', ') : '',
          signed_up:userData && userData.createdAt
        });
      });
    });

  }, [applicationId, applicationSecret, userStore]);

  // getDerivedStateFromProps logic here if necessary, using useEffect with specific dependencies

  // Render nothing since the original component returned false in render
  return null;
};

HelpCrunch.propTypes = {
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

export default HelpCrunch;
