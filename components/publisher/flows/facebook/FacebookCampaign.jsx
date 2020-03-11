import * as React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../../lib/PropTypes';
import { FACEBOOK_STAGES as STAGES } from '../../../../lib/constants/campaigns/stages';
import {
  BACKEND_URL,
  DEFAULT_PERMISSIONS,
  FACEBOOK_EMBED_LOCATIONS,
  FB_PAGE_PERMISSIONS,
  MIN_FANS_PAGE,
  EMBED_ENGINE,
  EMBED_LOCATION,
  FACEBOOK_LOGIN,
  FACEBOOK_PAGE,
  FACEBOOK_POST,
  DEFAULT,
} from '../../../../lib/constants/campaigns/constants';
import useProjectStore from '../../../hooks/useProjectStore';
import CampaignStage from '../CampaignStage';

const FacebookCampaign = observer(({
  collapseConductor,
  expandConductor,
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
  appId,
}) => {
  const [currentStageIndex, setCurrentStageIndex] = React.useState(0);
  const currentStage = STAGES[currentStageIndex];

  // Campaign initialization on first render
  React.useEffect(() => {
    updateCampaign({ embedLocation: FACEBOOK_EMBED_LOCATIONS[0] });
  }, []);

  const {
    embedLocation,
    selectedFbPage,
    facebookPageTab,
    facebookPages,
    embedPage,
    postData,
    userData,
    autoplay,
    preload,
  } = settings;

  const {
    item: project,
    publish,
    save,
    invalidateFbCache,
    linkToFbPage,
    updateItem,
  } = useProjectStore();

  // TODO: Refactor share post when project store is ready (save, serialize, etc)
  const sharePost = async () => {
    const shareOptions = {
      shouldCreateTab: embedLocation.key === FACEBOOK_PAGE,
    };

    if (embedLocation.key === FACEBOOK_PAGE) {
      shareOptions.pageId = selectedFbPage;
      shareOptions.redirectUrl = `${BACKEND_URL}/api/makes/fb/${shareOptions.pageId}`
        + `/${appId}?mid=${project.project._id}`;
    } else if (embedLocation.key === DEFAULT) {
      shareOptions.redirectUrl = project.project.url;
    } else {
      shareOptions.redirectUrl = embedPage;
    }
    shareOptions.project = [
      project.project.url, [
        autoplay ? 'autoplay=1' : null,
        !preload ? 'preload=none' : null,
        'preferred_source=facebook',
      ].filter(item => !!item).join('&'),
    ].join('?');
    shareOptions.backendUrl = BACKEND_URL;

    updateItem({
      name: postData.title,
      description: postData.description,
      thumbnail: postData.thumbnail,
    });

    try {
      await publish(await save(project));

      await invalidateFbCache(shareOptions.projectUrl);

      expandConductor();
      const { result } = await share(shareOptions);

      collapseConductor();

      if (result.error_code) {
        throw new Error(result.error_message);
      }

      if (embedLocation.key === FACEBOOK_PAGE) {
        const queryString = [
          autoplay ? 'autoplay=1' : null,
          !preload ? 'preload=none' : null,
        ].filter(item => !!item).join('&');

        await linkToFbPage(project, selectedFbPage, queryString);
      }
    } catch (e) {
      console.error(e);
    }

    return project;
  };

  const canBypassStage = (stage) => {
    if (isLoading) {
      return false;
    }
    switch (stage.key) {
      case EMBED_ENGINE:
        return true;
      case EMBED_LOCATION:
        return embedPage && embedPage.length > 0;
      case FACEBOOK_LOGIN:
        return userData;
      case FACEBOOK_PAGE:
        return selectedFbPage
          && facebookPages.find(
            page => page.id === selectedFbPage,
          ).fanCount >= MIN_FANS_PAGE
          && facebookPageTab && facebookPageTab.name.length > 0;
      case FACEBOOK_POST:
        return userData && postData
          && postData.title && postData.title.length > 0
          && postData.thumbnail && postData.thumbnail.length > 0;
      default:
        return false;
    }
  };

  const nextStage = async () => {
    if (currentStage.key === STAGES[STAGES.length - 1].key) {
      return sharePost();
    }

    let nextStageIdx = Math.min(currentStageIndex + 1, STAGES.length - 1);
    if (currentStage.key === FACEBOOK_LOGIN) {
      switch (embedLocation.key) {
        case FACEBOOK_PAGE:
          nextStageIdx = STAGES.findIndex(item => item.key === FACEBOOK_PAGE);
          break;
        default:
          nextStageIdx = STAGES.findIndex(item => item.key === FACEBOOK_POST);
          break;
      }
    } else {
      if (STAGES[nextStageIdx].key === EMBED_LOCATION
        && [DEFAULT, FACEBOOK_PAGE].includes(embedLocation.key)) {
        nextStageIdx += 1;
      }
      if (STAGES[nextStageIdx].key === FACEBOOK_PAGE && embedLocation.key !== FACEBOOK_PAGE) {
        nextStageIdx += 1;
      }
    }
    setCurrentStageIndex(nextStageIdx);
  };

  const prevStage = async () => {
    if (STAGES[currentStageIndex].key === FACEBOOK_PAGE) {
      updateCampaign({ selectedFbPage: null });
    }
    let prevStageIdx = Math.min(currentStageIndex - 1, 0);
    if (
      (STAGES[prevStageIdx].key === EMBED_LOCATION && embedLocation.key === DEFAULT)
      || (STAGES[prevStageIdx].key === FACEBOOK_PAGE && embedLocation.key !== FACEBOOK_PAGE)
    ) {
      prevStageIdx -= 1;
    }
    setCurrentStageIndex(prevStageIdx);
  };

  const setStage = async (stageKey) => {
    if (currentStage.key === stageKey) {
      return;
    }

    const nextStageIdx = STAGES.findIndex(item => item.key === stageKey);
    setCurrentStageIndex(nextStageIdx);
  };

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

  const bootstrapData = React.useMemo(() => {
    const permissions = embedLocation === FACEBOOK_PAGE
      ? FB_PAGE_PERMISSIONS
      : DEFAULT_PERMISSIONS;

    return {
      init,
      permissions,
      isAuthorized,
      nextStage,
      setStage,
      fetchPagesData,
      updateCampaign,
      getPageTabs,
      fetchUserData,
      project,
      facebookPageTab,
      selectedFbPage,
      facebookPages,
      createTab,
    };
  }, [
    project,
    embedLocation,
    facebookPageTab,
    selectedFbPage,
    facebookPages,
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
      newStage.bootstrap(bootstrapData);
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

FacebookCampaign.propTypes = {
  appId: PropTypes.string.isRequired,
  settings: PropTypes.shape({
    facebookPageTab: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
    })),
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
  fetchPagesData: PropTypes.func.isRequired,
  getPageTabs: PropTypes.func.isRequired,
  createTab: PropTypes.func.isRequired,
  fetchUserData: PropTypes.func.isRequired,
  share: PropTypes.func.isRequired,
  updateCampaign: PropTypes.func.isRequired,
  uploadFile: PropTypes.func.isRequired,
};

export default FacebookCampaign;
