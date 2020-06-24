import * as React from 'react';
import { observer } from 'mobx-react';

import DropButton from '../../../../media/DropButton';
import FieldBuilder from '../../../../form/FieldBuilder';
import LinkedinPostPreview from '../../../../common/post-previews/LinkedinPostPreview';

import { ASSET_TYPES } from '../../../../../lib/constants/media';
import {
  POSTER_FRAME_RECOMMENDED_RESOLUTION_PROMPT,
} from '../../../../../lib/constants/campaigns/constants';

import PropTypes from '../../../../../lib/PropTypes';

const LinkedinPost = observer((props) => {
  const { settings, updateCampaign } = props;
  const [isDisabledUpload, setIsDisabledUpload] = React.useState(false);

  return (
    <div className="linkedin-post">
      <h5 className="embed-title">
        What do you want the LinkedIn Share to look like?
      </h5>
      <div className="embed-grid__layout">
        <div className="embed-groupp">
          <div className="cell linkedin-post-details">
            <div className="row embed-group">
              <FieldBuilder
                type="input"
                name="title"
                label="Post Title"
                onChange={({ title }) => updateCampaign({
                  postData: {
                    ...settings.postData,
                    title,
                  },
                })}
                value={settings.postData.title}
                className="settings-input"
                labelClassName="settings-panel-text"
                placeholder="Post Title"
              />
            </div>
            <div className="row embed-group">
              <FieldBuilder
                type="input"
                name="description"
                label="Post Description"
                onChange={({ description }) => updateCampaign({
                  postData: {
                    ...settings.postData,
                    description,
                  },
                })}
                value={settings.postData.description}
                className="settings-input"
                labelClassName="settings-panel-text"
                placeholder="Post Description"
              />
            </div>
            <div className="row embed-group">
              <label className="col-md-4" htmlFor="linkedin-post-image-input">
                Post Image
              </label>
              {
                settings.postData
                && (
                  <div className="col-md-8">
                    {
                      settings.postData.thumbnail
                      && (
                        <div className="settings__row-img">
                          <p className="settings__row-text">Thumbnail</p>
                          <div className="settings-img-preview">
                            <img
                              src={settings.postData.thumbnail}
                              alt=""
                            />
                          </div>
                        </div>
                      )
                    }
                    <DropButton
                      onUploaded={({ url: thumbnail }) => updateCampaign({
                        postData: {
                          ...settings.postData,
                          thumbnail,
                        },
                      })}
                      startUpload={() => setIsDisabledUpload(true)}
                      endUpload={() => setIsDisabledUpload(false)}
                      isDisabled={isDisabledUpload}
                      needSaveAsset={false}
                      type={ASSET_TYPES.IMAGE}
                      multiple={false}
                      className="settings__add-file"
                    />
                  </div>
                )
              }
              <p className="col-md-12 my-2 text-resolution">
                {`*Recommended image resolution ${POSTER_FRAME_RECOMMENDED_RESOLUTION_PROMPT}`}
              </p>
            </div>
          </div>
          {
            settings.postData && settings.userData
            && (
              <LinkedinPostPreview
                className="cell"
                user={settings.userData}
                post={settings.postData}
              />
            )
          }
        </div>
      </div>
    </div>
  );
});

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
    preload: PropTypes.bool,
  }).isRequired,
  project: PropTypes.shape({
    url: PropTypes.string.isRequired,
  }).isRequired,
  updateCampaign: PropTypes.func.isRequired,
  provider: PropTypes.shape({
    logIn: PropTypes.func.isRequired,
  }).isRequired,
};

export default LinkedinPost;
