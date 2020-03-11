import * as React from 'react';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';
import FacebookProvider from './facebook/FacebookProvider';
import LinkedinProvider from './linkedin/LinkedinProvider';
import useProjectStore from '../../hooks/useProjectStore';
import useMediaStore from '../../hooks/useMediaStore';
import {
  FACEBOOK_SOURCE_ID,
  LINKEDIN_SOURCE_ID,
  SOCIAL_SOURCES,
  POSTER_FRAME_RECOMMENDED_RESOLUTION,
} from '../../../lib/constants/campaigns/constants';
import { isResolutionWrong, modalContent } from '../../../lib/utils/cropHelper';
import MediaTypeDetector from '../../../lib/utils/mediaTypeDetector';
import withModal from '../../hoc/withModal';
import useCommonStore from '../../hooks/useCommonStore';

const CampaignSelector = (props) => {
  const { openModal, closeModal } = props;

  const [flowId, setFlow] = React.useState(null);
  const { uploadMedia } = useMediaStore();

  const { facebookAppId, linkedinAppId } = useCommonStore();

  const [settings, setSettings] = React.useState({
    embedLocation: null,
    postData: null,
    userData: null,
    selectedFbPage: null,
    embedPage: null,
    facebookPages: null,
    facebookPageTab: null,
    preload: true,
    error: null,
  });

  const updateCampaign = (newSettings) => {
    setSettings({ ...settings, ...newSettings });
  };

  const showError = (error, timeout = null) => {
    updateCampaign({ error: error.message || 'This image format is not supported.' });
    if (timeout) {
      setTimeout(() => {
        updateCampaign({ error: null });
      }, timeout);
    }
  };

  const uploadFile = callback => async ({ target: { files: [file] } }) => {
    if (!file) {
      return;
    }
    if (!file.type.includes('image/')) {
      showError('This image format is not supported.', 5000);
      openModal({
        header: 'Error',
        body: 'This image format is not supported.',
      });
      return;
    }
    try {
      const media = await uploadMedia({ data: file });
      const imageMeta = await new MediaTypeDetector().getMetadata(media.url);
      if (isResolutionWrong({
        imageMeta,
        recommendedResolution: POSTER_FRAME_RECOMMENDED_RESOLUTION,
      })) {
        openModal(modalContent({
          imageMeta,
          recommendedResolution: POSTER_FRAME_RECOMMENDED_RESOLUTION,
          onFileUploaded: (res) => {
            callback(res);
            closeModal();
          },
        }));
      } else {
        callback(imageMeta);
      }
    } catch (err) {
      console.log(err);
      openModal({
        header: 'Error',
      });
      showError(err.message || 'This image format is not supported.', 5000);
    }
  };

  const { item: { project } } = useProjectStore();

  const renderFlowSelector = () => (
    <div className="social-source-list">
      {project && project.allowedSocials && project.allowedSocials.map(socialId => {
        const source = SOCIAL_SOURCES.find(s => s.key === socialId);
        if (!source) {
          return null;
        }

        return (
          <button
            className="social-source-list-item"
            key={socialId}
            onClick={() => setFlow(socialId)}
            type="button"
          >
            <SVGInline className="campaign-icon" classSuffix="-inline" svg={source.image} cleanup={['title']} />
          </button>
        );
      })}
    </div>
  );

  const renderFlow = (key) => {
    switch (key) {
      case FACEBOOK_SOURCE_ID: {
        return (
          <FacebookProvider
            {...props}
            settings={settings}
            updateCampaign={updateCampaign}
            uploadFile={uploadFile}
            appId={facebookAppId}
          />
        );
      }
      case LINKEDIN_SOURCE_ID: {
        return (
          <LinkedinProvider
            {...props}
            settings={settings}
            updateCampaign={updateCampaign}
            uploadFile={uploadFile}
            appId={linkedinAppId}
          />
        );
      }
      default: return null;
    }
  };

  return (
    <React.Fragment>
      {flowId ? renderFlow(flowId) : renderFlowSelector()}
      {settings.error && (
        <div className="campaign-error">
          {settings.error}
        </div>
      )}
    </React.Fragment>
  );
};

CampaignSelector.propTypes = {
  openModal: PropTypes.func.isRequired,
  closeModal: PropTypes.func.isRequired,
};

export default withModal(CampaignSelector);
