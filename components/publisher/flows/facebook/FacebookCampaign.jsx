import * as React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../../lib/PropTypes';
import { FACEBOOK_STAGES as STAGES } from '../../../../lib/constants/campaigns/stages';
import {
  BACKEND_URL,
  DEFAULT_PERMISSIONS,
  FB_PAGE_PERMISSIONS,
  EMBED_ENGINE,
  EMBED_LOCATION,
  FACEBOOK_LOGIN,

  FACEBOOK_PAGE,
  FACEBOOK_POST,
  DEFAULT,
} from '../../../../lib/constants/campaigns/constants';
import useProjectStore from '../../../hooks/useProjectStore';
import useModalStore from '../../../hooks/useModalStore';
import CampaignStage from '../CampaignStage';
import { isEnoughFans } from '../../../../lib/utils/social-campaigns';
import { showError, showInfo } from '../../../../lib/services/alertService';
import { SOCIAL_CAMPAIGN_MODAL } from '../../../../lib/constants/modals';

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
  setLoading,
  isLoading,
  settings,
  updateCampaign,
  share,
  appId,
}) => {
  const [currentStageIndex, setCurrentStageIndex] = React.useState(0);
  const [currentStage, setCurrentStage] = React.useState(STAGES[currentStageIndex]);

  const {
    embedLocation,
    selectedFbPage,
    facebookPageTab,
    facebookPages,
    embedPage,
    postData,
    userData,
    preload,
  } = settings;

  const {
    item: project,
    invalidateFbCache,
    linkToFbPage,
    updateItem,
    save,
  } = useProjectStore();

  const { closeModal } = useModalStore();

  const sharePost = React.useCallback(async () => {
    setLoading(true);
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
    shareOptions.projectUrl = [
      project.url, [
        !preload ? 'preload=none' : null,
        'preferred_source=facebook',
      ].filter(item => !!item).join('&'),
    ].join('?');
    shareOptions.backendUrl = BACKEND_URL;

    updateItem({
      title: postData.title,
      description: postData.description,
      thumbnail: postData.thumbnail,
    });

    try {
      await save();
      await invalidateFbCache(shareOptions.projectUrl);

      expandConductor();
      const { result } = await share(shareOptions);

      collapseConductor();

      if (result.error_code) {
        return showError(result.error_message);
      }

      if (embedLocation.key === FACEBOOK_PAGE) {
        const queryString = [
          !preload ? 'preload=none' : null,
        ].filter(item => !!item).join('&');

        await linkToFbPage(project, selectedFbPage, queryString);
      }
      closeModal(SOCIAL_CAMPAIGN_MODAL);
      showInfo('Success');
    } catch (e) {
      collapseConductor();
      showError(e.message);
    } finally {
      setLoading(false);
    }
    return project;
  }, [
    appId,
    closeModal,
    collapseConductor,
    embedLocation.key,
    embedPage,
    expandConductor,
    invalidateFbCache,
    linkToFbPage,
    postData,
    preload,
    project,
    selectedFbPage,
    setLoading,
    share,
    updateItem,
  ]);

  const canBypassStage = React.useCallback((stage) => {
    switch (stage.key) {
      case EMBED_ENGINE:
        return true;
      case EMBED_LOCATION:
        return embedPage && embedPage.length > 0;
      case FACEBOOK_LOGIN:
        return userData;
      case FACEBOOK_PAGE:
        return selectedFbPage
          && isEnoughFans(facebookPages.find(
            page => page.id === selectedFbPage,
          ))
          && facebookPageTab && facebookPageTab.name.length > 0;
      case FACEBOOK_POST:
        return userData && postData && postData.title && postData.title.length > 0;
      default:
        return false;
    }
  }, [embedPage, facebookPageTab, facebookPages, postData, selectedFbPage, userData]);

  const nextStage = React.useCallback(() => {
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
  }, [currentStage, currentStageIndex, embedLocation.key, sharePost]);

  const prevStage = () => {
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

  const setStage = React.useCallback((stageKey) => {
    if (currentStage.key === stageKey) {
      return;
    }

    const nextStageIdx = STAGES.findIndex(item => item.key === stageKey);
    setCurrentStageIndex(nextStageIdx);
  }, [currentStage.key]);

  const handleBackButtonClick = () => {
    if (isLoading || currentStageIndex === 0) {
      return;
    }
    return prevStage();
  };

  const handleNextButtonClick = React.useCallback(() => {
    setLoading(true);
    if (!canBypassStage(currentStage)) {
      return;
    }
    if (currentStage.key === STAGES[STAGES.length - 1].key) {
      return sharePost();
    } else {
      return nextStage();
    }
  }, [canBypassStage, currentStage, nextStage, setLoading, sharePost]);

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
      setLoading,
    };
  }, [
    embedLocation,
    init,
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
    handleBackButtonClick,
    handleNextButtonClick,
    canBypassStage,
    isLoading,
  }), [
    settings,
    project,
    canBypassStage,
    createTab,
    fetchPagesData,
    fetchUserData,
    getPageTabs,
    handleBackButtonClick,
    handleNextButtonClick,
    logIn,
    nextStage,
    setStage,
    updateCampaign,
    isLoading,
  ]);

  React.useEffect(() => {
    setLoading(true);
    setCurrentStage(STAGES[currentStageIndex]);
    (async function startBootstrap() {
      await bootstrap(STAGES[currentStageIndex]);
      setLoading(false);
    }());
  }, [bootstrap, currentStageIndex, setLoading]);

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
      description: PropTypes.string,
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
};

export default FacebookCampaign;
