import * as React from 'react';

import PropTypes from '../../../../../lib/PropTypes';
import { LINKEDIN_LOGIN } from '../../../../../lib/constants/campaigns/constants';

const LinkedinLogin = ({ provider, nextStage, setStage }) => (
  <div className="linkedin-login">
    <div className="login-note">
      <span>
        You must login to LinkedIn and authorize our app to share videos into timeline
      </span>
    </div>
    <button
      className="go-button linkedin-login"
      onClick={async () => {
        try {
          await provider.logIn();
          return nextStage();
        } catch (e) {
          console.error(e);
          return setStage(LINKEDIN_LOGIN);
        }
      }}
      type="button"
    >
      <i className="fa fa-linkedin-square" />
      Log in
    </button>
  </div>
);

LinkedinLogin.propTypes = {
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
  }).isRequired,
  nextStage: PropTypes.func.isRequired,
  setStage: PropTypes.func.isRequired,
};

export default LinkedinLogin;
