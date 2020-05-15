import * as React from 'react';
import { observer } from 'mobx-react';

import CampaignStage from '../CampaignStage';
import PropTypes from '../../../../lib/PropTypes';
import useProjectStore from '../../../hooks/useProjectStore';
import { LINKEDIN_STAGES as STAGES } from '../../../../lib/constants/campaigns/stages';
import {
  DEFAULT,
  EMBED_ENGINE,
  EMBED_LOCATION,
  LINKEDIN_LOGIN,
  LINKEDIN_POST,
} from '../../../../lib/constants/campaigns/constants';

const LinkedinCampaign = observer(({
  init,
  isAuthorized,
  logIn,
  fetchPagesData,
  getPageTabs,
  createTab,
  fetchUserData,
  isLoading,
  settings,
  updateCampaign,
  share,
  uploadFile,
  setLoading,
}) => {
  const [currentStageIndex, setCurrentStageIndex] = React.useState(0);
  const [currentStage, setCurrentStage] = React.useState(STAGES[currentStageIndex]);

  const { embedLocation } = settings;

  const {
    item: project,
    updateItem,
  } = useProjectStore();

  const sharePost = async () => {
    setLoading(true);
    const { postData, embedPage, preload } = settings;

    updateItem({
      name: postData.title,
      description: postData.description,
      thumbnail: postData.thumbnail,
    });
    try {
      await share({
        title: postData.title,
        description: postData.description,
        url: [
          embedLocation.key === 'default' ? project.make.url : embedPage, [
            !preload ? 'preload=none' : null,
            'preferred_source=linkedin',
          ].filter(item => !!item).join('&'),
        ].join('?'),
        thumbnail: postData.thumbnail,
      });
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
    return project;
  };

  const canBypassStage = React.useCallback((stage) => {
    const { embedPage, postData, userData } = settings;

    switch (stage.key) {
      case EMBED_ENGINE:
        return true;
      case EMBED_LOCATION:
        return embedPage && embedPage.length > 0;
      case LINKEDIN_LOGIN: {
        return isAuthorized();
      }
      case LINKEDIN_POST:
        return userData && postData && postData.title && postData.title.length > 0;
      default:
        return false;
    }
  }, [isAuthorized, settings]);

  const nextStage = React.useCallback(() => {
    if (currentStage.key === STAGES[STAGES.length - 1].key) {
      return this.sharePost();
    }

    let nextStageIdx = Math.min(currentStageIndex + 1, STAGES.length - 1);
    if (STAGES[nextStageIdx].key === EMBED_LOCATION
      && [DEFAULT].includes(embedLocation.key)) {
      nextStageIdx += 1;
    }
    setCurrentStageIndex(nextStageIdx);
  }, [currentStage.key, currentStageIndex, embedLocation.key]);

  const prevStage = () => {
    let prevStageIdx = Math.min(
      currentStageIndex - 1,
      0,
    );
    if (STAGES[prevStageIdx].key === EMBED_LOCATION && embedLocation.key === DEFAULT) {
      prevStageIdx -= 1;
    }
    setCurrentStageIndex(prevStageIdx);
  };

  const setStage = React.useCallback((stageKey) => {
    if (currentStage.key === stageKey) {
      return;
    }

    const nextStageIdx = STAGES.findIndex(item => item.key === stageKey);

    setCurrentStageIndex(nextStageIdx);
  }, [currentStage]);

  const handleBackButtonClick = () => {
    if (isLoading || currentStageIndex === 0) {
      return;
    }
    return prevStage();
  };

  const handleNextButtonClick = () => {
    if (!canBypassStage(currentStage)) {
      return;
    }
    if (currentStage.key === STAGES[STAGES.length - 1].key) {
      return sharePost();
    } else {
      return nextStage();
    }
  };

  const bootstrapData = React.useMemo(() => ({
    init,
    isAuthorized,
    nextStage,
    setStage,
    fetchPagesData,
    updateCampaign,
    getPageTabs,
    fetchUserData,
    project,
    setLoading,
  }), [
    fetchPagesData,
    fetchUserData,
    getPageTabs,
    init,
    isAuthorized,
    nextStage,
    project,
    setStage,
    updateCampaign,
    setLoading,
  ]);

  const stageProps = React.useMemo(() => ({
    settings,
    updateCampaign,
    project,
    provider: {
      logIn,
      fetchPagesData,
      getPageTabs,
      createTab,
      fetchUserData,
    },
    setStage,
    nextStage,
    uploadFile,
    handleBackButtonClick,
    handleNextButtonClick,
    canBypassStage,
    isLoading,
  }), [
    isLoading,
    settings,
    updateCampaign,
    project,
    logIn,
    fetchPagesData,
    getPageTabs,
    createTab,
    fetchUserData,
    setStage,
    nextStage,
    uploadFile,
    handleBackButtonClick,
    handleNextButtonClick,
    canBypassStage,
  ]);

  React.useEffect(() => {
    setCurrentStage(STAGES[currentStageIndex]);
    bootstrap(STAGES[currentStageIndex]);
  }, [bootstrap, currentStageIndex]);

  const bootstrap = React.useCallback((st) => {
    if (st && st.bootstrap) {
      return st.bootstrap(bootstrapData);
    } else {
      setLoading(false);
    }
  }, [bootstrapData, setLoading]);

  return (
    <CampaignStage
      index={currentStageIndex}
      stage={currentStage}
      {...stageProps}
    />
  );
});

LinkedinCampaign.propTypes = {
  settings: PropTypes.shape({
    facebookPageTab: PropTypes.shape({
      name: PropTypes.string,
    }),
    facebookPages: PropTypes.array,
    selectedFbPage: PropTypes.string,
    embedPage: PropTypes.string,
    embedLocation: PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      prompt: PropTypes.string,
      embedGenerator: PropTypes.func,
    }),
    preload: PropTypes.bool,
    postData: PropTypes.shape({
      title: PropTypes.string,
      thumbnail: PropTypes.string,
    }),
  }).isRequired,
  collapseConductor: PropTypes.func.isRequired,
  expandConductor: PropTypes.func.isRequired,
  init: PropTypes.func.isRequired,
  isAuthorized: PropTypes.func.isRequired,
  logIn: PropTypes.func.isRequired,
  fetchPagesData: PropTypes.func,
  getPageTabs: PropTypes.func,
  createTab: PropTypes.func,
  fetchUserData: PropTypes.func.isRequired,
  share: PropTypes.func.isRequired,
  updateCampaign: PropTypes.func.isRequired,
};


export default LinkedinCampaign;
