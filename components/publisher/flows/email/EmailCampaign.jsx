import * as React from 'react';

import PropTypes from '../../../../lib/PropTypes';
import CampaignStage from '../CampaignStage';
import { EMAIL_STAGES } from '../../../../lib/constants/campaigns/stages';
import PROVIDERS from '../../../../lib/constants/campaigns/email-providers';
import useProjectStore from '../../../hooks/useProjectStore';
import {
  EMAIL_EMBED_LOCATIONS,
  EMBED_LOCATION,
  DEFAULT, SERVICE_PROVIDER,
} from '../../../../lib/constants/campaigns/constants';

const EmaiCampaign = ({ isLoading }) => {
  const [currentStage, setStage] = React.useState(EMAIL_STAGES[0]);
  const [settings, setSettings] = React.useState({
    embedLocation: EMAIL_EMBED_LOCATIONS[0],
    embedPage: null,
    emailProvider: null,
    preload: true,
    error: null,
  });

  const { item: project, personalizations } = useProjectStore();

  const updateCampaign = (newSettings) => {
    setSettings({ ...settings, ...newSettings });
  };

  const canBypassStage = (stage) => () => {
    const {
      embedPage,
      emailProvider,
    } = settings;
    if (isLoading) {
      return false;
    }
    switch (stage.key) {
      case EMAIL_STAGES[0]:
        return true;
      case EMAIL_STAGES[1]:
        return embedPage && embedPage.length > 0;
      case EMAIL_STAGES[2]:
        return emailProvider;
      default:
        return false;
    }
  };

  const handleNextButtonClick = () => {
    if (!canBypassStage(currentStage)) {
      return;
    }
    const { embedLocation } = settings;
    let nextStageIdx = Math.min(
      EMAIL_STAGES.findIndex(item => currentStage.key === item.key) + 1,
      EMAIL_STAGES.length - 1,
    );
    if (EMAIL_STAGES[nextStageIdx].key === EMBED_LOCATION && embedLocation.key === DEFAULT) {
      nextStageIdx += 1;
    }
    setStage(EMAIL_STAGES[nextStageIdx]);
  };

  const handleBackButtonClick = () => {
    const { embedLocation } = settings;
    let prevStageIdx = Math.min(
      EMAIL_STAGES.findIndex(item => currentStage.key === item.key) - 1,
      0,
    );
    if (EMAIL_STAGES[prevStageIdx].key === EMBED_LOCATION && embedLocation.key === DEFAULT) {
      prevStageIdx -= 1;
    }
    setStage(EMAIL_STAGES[prevStageIdx]);
  };

  const handleSelectPage = ({ value }, name) => {
    switch (name) {
      case EMBED_LOCATION:
        updateCampaign({ name: EMAIL_EMBED_LOCATIONS.find(item => item.key === value) });
        break;
      case SERVICE_PROVIDER:
        updateCampaign({ name: PROVIDERS.find(item => item.key === value) });
        break;
      default:
    }
  };

  const handleSelectProvider = (emailProvider) => () => {
    updateCampaign({ emailProvider });
  };

  const generatePersonalizedLink = () => {
    const { preload, embedLocation, emailProvider, embedPage } = settings;
    const { token, lookup, format } = emailProvider;
    const basicPath = embedLocation.key === DEFAULT ? project.url : embedPage;

    const queryParams = Array.from(personalizations).map(param => {
      const { open, close } = token;
      let formattedParam;

      if (lookup && param in lookup) {
        formattedParam = lookup[param];
      } else if (format) {
        formattedParam = format(param);
      } else {
        formattedParam = param;
      }
      return `${param}=${open}${formattedParam}${close}`;
    });

    if (!preload) {
      queryParams.unshift('preload=none');
    }

    return `${basicPath}${queryParams.length ? `?${queryParams.join('&')}` : ''}`;
  };

  const stageProps = React.useMemo(() => ({
    settings,
    project,
    updateCampaign,
    canBypassStage,
    generatePersonalizedLink,
    handleSelectPage,
    handleSelectProvider,
  }), [settings, project]);

  return (
    <CampaignStage
      index={EMAIL_STAGES.findIndex(stage => stage.key === currentStage.key)}
      stage={currentStage}
      {...stageProps}
      handleBackButtonClick={handleBackButtonClick}
      handleNextButtonClick={handleNextButtonClick}
    />
  );
};

EmaiCampaign.propTypes = {
  isLoading: PropTypes.bool.isRequired,
};

export default EmaiCampaign;
