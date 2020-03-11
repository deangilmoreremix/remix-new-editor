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
  EMBED_LOCATIONS,
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
}) => {
  const [currentStageIndex, setCurrentStageIndex] = React.useState(0);
  const currentStage = STAGES[currentStageIndex];

  // Campaign initialization on first render
  React.useEffect(() => {
    updateCampaign({ embedLocation: EMBED_LOCATIONS[0] });
  }, []);

  const { embedLocation } = settings;

  const {
    item: project,
    publish,
    save,
    updateItem,
  } = useProjectStore();

  const sharePost = async () => {
    const { postData, embedPage, autoplay, preload } = settings;

    updateItem({
      name: postData.title,
      description: postData.description,
      thumbnail: postData.thumbnail,
    });
    try {
      await publish(await save(project));

      await share({
        title: postData.title,
        description: postData.description,
        url: [
          embedLocation.key === 'default' ? project.make.url : embedPage, [
            autoplay ? 'autoplay=1' : null,
            !preload ? 'preload=none' : null,
            'preferred_source=linkedin',
          ].filter(item => !!item).join('&'),
        ].join('?'),
        thumbnail: postData.thumbnail,
      });
    } catch (error) {
      console.error(error);
    }
    return project;
  };

  const canBypassStage = (stage) => {
    const { embedPage, postData, userData } = settings;

    if (isLoading) {
      return false;
    }

    switch (stage.key) {
      case EMBED_ENGINE:
        return true;
      case EMBED_LOCATION:
        return embedPage && embedPage.length > 0;
      case LINKEDIN_LOGIN: {
        return isAuthorized();
      }
      case LINKEDIN_POST:
        return userData && postData
          && postData.title && postData.title.length > 0
          && postData.thumbnail && postData.thumbnail.length > 0;
      default:
        return false;
    }
  };

  const nextStage = () => {
    if (currentStage.key === STAGES[STAGES.length - 1].key) {
      return this.sharePost();
    }

    let nextStageIdx = Math.min(currentStageIndex + 1, STAGES.length - 1);
    if (STAGES[nextStageIdx].key === EMBED_LOCATION
      && [DEFAULT].includes(embedLocation.key)) {
      nextStageIdx += 1;
    }
    setCurrentStageIndex(nextStageIdx);
  };

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

  const handleBackButtonClick = async () => {
    if (isLoading || currentStageIndex === 0) {
      return;
    }
    await prevStage();
  };

  const handleNextButtonClick = async () => {
    if (!canBypassStage(currentStage)) {
      return;
    }
    if (currentStage.key === STAGES[STAGES.length - 1].key) {
      await sharePost();
    } else {
      await nextStage();
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
  }), [
    project,
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
  }), [
    settings,
    project,
  ]);

  // bootstrap new stage
  React.useEffect(() => {
    const newStage = STAGES[currentStageIndex];
    if (newStage && newStage.bootstrap) {
      currentStage.bootstrap(bootstrapData);
    }
  }, [currentStageIndex]);

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
  uploadFile: PropTypes.func.isRequired,
};


export default LinkedinCampaign;
