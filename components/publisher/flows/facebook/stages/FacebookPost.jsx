import * as React from 'react';
import { Input, Label } from 'reactstrap';

import PropTypes from '../../../../../lib/PropTypes';
import { POSTER_FRAME_RECOMMENDED_RESOLUTION_PROMPT } from '../../../../../lib/constants/campaigns/constants';
import FacebookPostPreview from '../../../../common/post-previews/FacebookPostPreview';

const FacebookPost = ({ settings, updateCampaign, uploadFile }) => (
  <div className="facebook-post">
    <h5 className="embed-title">
      What do you want the Facebook Share to look like?
    </h5>
    <div className="embed-grid">
      <div className="row embed-group">
        <div className="embed-grid cell facebook-post-details">
          <div className="row embed-group">
            <Label className="cell" for="facebook-post-url-input">
              Shared Url
            </Label>
            {settings.postData && (
              <Input
                id="facebook-post-url-input"
                className="cell facebook-post-input"
                type="text"
                value={settings.postData.link}
                onChange={({ target: { value: link } }) => updateCampaign({
                  postData: {
                    ...settings.postData,
                    link,
                  },
                })}
              />
            )}
          </div>
          <div className="row embed-group">
            <Label className="cell" htmlFor="facebook-post-title-input">
              Post Title
            </Label>
            {settings.postData && (
              <Input
                id="facebook-post-title-input"
                className="cell facebook-post-input"
                type="text"
                name="title"
                value={settings.postData.title}
                onChange={({ target: { value: title } }) => updateCampaign({
                  postData: {
                    ...settings.postData,
                    title,
                  },
                })}
              />
            )}
          </div>
          <div className="row embed-group">
            <Label className="cell" for="facebook-post-description-input">
              Post Description
            </Label>
            {settings.postData && (
              <Input
                id="facebook-post-description-input"
                className="cell facebook-post-input"
                type="text"
                name="description"
                value={settings.postData.description}
                onChange={({ target: { value: description } }) => updateCampaign({
                  postData: {
                    ...settings.postData,
                    description,
                  },
                })}
              />
            )}
          </div>
          <div className="row embed-group">
            <Label className="cell" for="facebook-post-image-input">
              Post Image
            </Label>
            {settings.postData && (
              <Input
                id="facebook-post-image-input"
                className="cell facebook-post-input"
                type="file"
                accept="image/*"
                name="image"
                onChange={uploadFile(({ source: thumbnail }) => updateCampaign({
                  postData: {
                    ...settings.postData,
                    thumbnail,
                  },
                }))}
              />
            )}
            <p className="text-resolution">
              {`*Recommended image resolution ${POSTER_FRAME_RECOMMENDED_RESOLUTION_PROMPT}`}
            </p>
          </div>
        </div>
        {settings.postData && settings.userData && (
          <FacebookPostPreview
            className="cell"
            user={settings.userData}
            post={settings.postData}
          />
        )}
      </div>
    </div>
  </div>
);

FacebookPost.propTypes = {
  settings: PropTypes.shape({
    userData: PropTypes.shape({}),
    postData: PropTypes.shape({
      link: PropTypes.string,
      title: PropTypes.string,
      description: PropTypes.string,
      thumbnail: PropTypes.string,
    }),
    facebookPageTab: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
    })),
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
    getPageTabs: PropTypes.func.isRequired,
  }).isRequired,
  uploadFile: PropTypes.func.isRequired,
};

export default FacebookPost;
