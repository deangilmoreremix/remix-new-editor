import * as React from 'react';
import { Input, Label } from 'reactstrap';

import PropTypes from '../../../../../lib/PropTypes';
import { POSTER_FRAME_RECOMMENDED_RESOLUTION_PROMPT } from '../../../../../lib/constants/campaigns/constants';
import LinkedinPostPreview from '../../../../common/post-previews/LinkedinPostPreview';

const LinkedinPost = ({ settings, updateCampaign, uploadFile }) => (
  <div className="linkedin-post">
    <h5 className="embed-title">
      What do you want the LinkedIn Share to look like?
    </h5>
    <div className="embed-grid">
      <div className="row embed-group">
        <div className="embed-grid cell linkedin-post-details">
          <div className="row embed-group">
            <Label className="cell" for="linkedin-post-url-input">
              Shared Url
            </Label>
            {settings.postData && (
              <Input
                id="linkedin-post-url-input"
                className="cell linkedin-post-input"
                type="text"
                value={settings.postData.link}
                onChange={({ target: { value } }) => {
                  updateCampaign({ postData: { link: value } });
                }}
              />
            )}
          </div>
          <div className="row embed-group">
            <Label className="cell" for="linkedin-post-title-input">
              Post Title
            </Label>
            {settings.postData && (
              <Input
                id="linkedin-post-title-input"
                className="cell linkedin-post-input"
                type="text"
                value={settings.postData.title}
                onChange={({ target: { value } }) => {
                  updateCampaign({ postData: { title: value } });
                }}
              />
            )}
          </div>
          <div className="row embed-group">
            <Label className="cell" for="linkedin-post-description-input">
              Post Description
            </Label>
            {settings.postData && (
              <Input
                id="linkedin-post-description-input"
                className="cell linkedin-post-input"
                type="text"
                value={settings.postData.description}
                onChange={({ target: { value } }) => {
                  updateCampaign({ postData: { description: value } });
                }}
              />
            )}
          </div>
          <div className="row embed-group">
            <Label className="cell" for="linkedin-post-image-input">
              Post Image
            </Label>
            {settings.postData && (
              <Input
                id="linkedin-post-image-input"
                className="cell linkedin-post-input"
                type="file"
                accept="image/*"
                onChange={uploadFile((imageData) => {
                  updateCampaign({ postData: { thumbnail: imageData.source } });
                })}
              />
            )}
            <p className="text-resolution">
              {`*Recommended image resolution ${POSTER_FRAME_RECOMMENDED_RESOLUTION_PROMPT}`}
            </p>
          </div>
        </div>
        {settings.postData && settings.userData && (
          <LinkedinPostPreview
            className="cell"
            user={settings.userData}
            post={settings.postData}
          />
        )}
      </div>
    </div>
  </div>
);

LinkedinPost.propTypes = {
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
    autoplay: PropTypes.bool,
    preload: PropTypes.bool,
  }).isRequired,
  project: PropTypes.shape({
    url: PropTypes.string.isRequired,
  }).isRequired,
  updateCampaign: PropTypes.func.isRequired,
  provider: PropTypes.shape({
    logIn: PropTypes.func.isRequired,
  }).isRequired,
  uploadFile: PropTypes.func.isRequired,
};

export default LinkedinPost;
