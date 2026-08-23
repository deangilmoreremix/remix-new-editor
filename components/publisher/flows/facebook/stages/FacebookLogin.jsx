import * as React from 'react';

import PropTypes from '../../../../../lib/PropTypes';
import { DEFAULT_PERMISSIONS, FACEBOOK_LOGIN } from '../../../../../lib/constants/campaigns/constants';
import { showError } from '../../../../../lib/services/alertService';
import FacebookPostPreview from '../../../../common/post-previews/FacebookPostPreview';


const FacebookLogin = ({ settings }) => (
  <div className="facebook-login">
    {console.log(settings,"settings==>>")}
     <FacebookPostPreview
            className="cell"
            user={settings.userData}
            post={settings.postData}
          />
    {/* <h1>dfgfgfdjhgfjghfkgfjkfkdhg</h1>
    <FacebookShareButton
    url={item?.url}
    quote={title}
    onShareWindowClose={handleClose}
  >
    <FbShareLogo />
  </FacebookShareButton> */}
    {/* <div className="login-note">
      <span>
        You must login to Facebook and authorize our app to post Videos into Facebook Pages
      </span>
    </div>
    <button
      className="go-button fb-login"
      onClick={async () => {
        try {
          console.log("call 18 --------------",DEFAULT_PERMISSIONS)
          await provider.logIn(DEFAULT_PERMISSIONS);
          nextStage();
        } catch (e) {
          console.log("call 22 --------------",e)
          showError(e.message);
          setStage(FACEBOOK_LOGIN);
        }
      }}
      type="button"
    >
      <i className="fa fa-facebook-official" />
      Log in
    </button> */}
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
  provider: PropTypes.shape({
    logIn: PropTypes.func.isRequired,
    getPageTabs: PropTypes.func.isRequired,
  }).isRequired,
  nextStage: PropTypes.func.isRequired,
  setStage: PropTypes.func.isRequired,
};

export default FacebookLogin;
