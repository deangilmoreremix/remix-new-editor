import * as React from 'react';

import PropTypes from '../../../../../lib/PropTypes';
import { DEFAULT_PERMISSIONS, FACEBOOK_LOGIN } from '../../../../../lib/constants/campaigns/constants';

const FacebookLogin = ({ provider, nextStage, setStage }) => (
  <div className="facebook-login">
    <div className="login-note">
      <span>
        You must login to Facebook and authorize our app to post Videos into Facebook Pages
      </span>
    </div>
    <button
      className="go-button fb-login"
      onClick={async () => {
        try {
          await provider.logIn(DEFAULT_PERMISSIONS);
          nextStage();
        } catch (e) {
          setStage(FACEBOOK_LOGIN);
        }
      }}
      type="button"
    >
      <i className="fa fa-facebook-official" />
      Log in
    </button>
  </div>
);

FacebookLogin.propTypes = {
  settings: PropTypes.shape({
    userData: PropTypes.shape({}),
    postData: PropTypes.shape({
      link: PropTypes.string,
      title: PropTypes.string,
      description: PropTypes.string,
      thumbnail: PropTypes.string,
    }),
    facebookPageTab: PropTypes.shape({
      name: PropTypes.string,
    }),
    facebookPages: PropTypes.array,
    selectedFbPage: PropTypes.string,
    embedLocation: PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      prompt: PropTypes.string,
      embedGenerator: PropTypes.func,
    }),
    preload: PropTypes.bool,
  }).isRequired,
  project: PropTypes.shape({
    url: PropTypes.string.isRequired,
  }).isRequired,
  provider: PropTypes.shape({
    logIn: PropTypes.func.isRequired,
    getPageTabs: PropTypes.func.isRequired,
  }).isRequired,
  nextStage: PropTypes.func.isRequired,
  setStage: PropTypes.func.isRequired,
};

export default FacebookLogin;
