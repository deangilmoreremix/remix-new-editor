import EmbedFacebookEngine from '../../../components/publisher/flows/facebook/stages/EmbedEngine';
import EmbedFacebookLocation from '../../../components/publisher/flows/facebook/stages/EmbedLocation';
import FacebookLogin from '../../../components/publisher/flows/facebook/stages/FacebookLogin';
import FacebookPage from '../../../components/publisher/flows/facebook/stages/FacebookPage';
import FacebookPost from '../../../components/publisher/flows/facebook/stages/FacebookPost';
import LinkedinLogin from '../../../components/publisher/flows/linkedin/stages/LinkedinLogin';
import LinkedinPost from '../../../components/publisher/flows/linkedin/stages/LinkedinPost';
import {
  MIN_FANS_PAGE,
  EMBED_ENGINE,
  EMBED_LOCATION,
  FACEBOOK_LOGIN,
  FACEBOOK_PAGE,
  FACEBOOK_POST,
  LINKEDIN_LOGIN,
  LINKEDIN_POST,
  SERVICE_PROVIDER,
} from './constants';
import EmailEmbedEngine from '../../../components/publisher/flows/email/stages/EmbedEngine';
import EmailEmbedLocation from '../../../components/publisher/flows/email/stages/EmbedLocation';
import EmailServiceProvider from '../../../components/publisher/flows/email/stages/ServiceProvider';

export const FACEBOOK_STAGES = [
  {
    key: EMBED_ENGINE,
    completionPercentage: 25,
    element: EmbedFacebookEngine,
  },
  {
    key: EMBED_LOCATION,
    completionPercentage: 25,
    element: EmbedFacebookLocation,
  },
  {
    key: FACEBOOK_LOGIN,
    completionPercentage: 50,
    element: FacebookLogin,
    bootstrap: async ({ init, permissions, isAuthorized, nextStage, setStage }) => {
      await init();
      try {
        const isLoggedIn = await isAuthorized(permissions);
        if (isLoggedIn) {
          nextStage();
        } else {
          setStage(FACEBOOK_LOGIN);
        }
      } catch (error) {
        setStage(FACEBOOK_LOGIN);
      }
    },
  },
  {
    key: FACEBOOK_PAGE,
    completionPercentage: 50,
    element: FacebookPage,
    bootstrap: async ({
      fetchPagesData,
      updateCampaign,
      getPageTabs,
    }) => {
      try {
        const facebookPages = await fetchPagesData();
        if (facebookPages.length) {
          updateCampaign({ facebookPages, selectedFbPage: facebookPages[0].id });
          if (facebookPages[0].fanCount >= MIN_FANS_PAGE) {
            const facebookPageTab = await getPageTabs(facebookPages[0].id, facebookPages[0].token);
            updateCampaign({ facebookPages, facebookPageTab, selectedFbPage: facebookPages[0].id });
          }
        }
      } catch (error) {
        console.error(error.message);
      }
    },
  },
  {
    key: FACEBOOK_POST,
    actionButtonClassName: 'fb-login',
    actionButtonIconClassName: 'fa fa-facebook-official',
    actionButtonCaption: 'Share',
    completionPercentage: 75,
    element: FacebookPost,
    bootstrap: async ({
      project,
      facebookPages,
      facebookPageTab,
      selectedFbPage,
      createTab,
      updateCampaign,
      fetchUserData,
    }) => {
      if (selectedFbPage && facebookPageTab) {
        const fbPage = facebookPages.find(page => page.id === selectedFbPage);
        try {
          let id;
          const result = createTab(
            fbPage.id, fbPage.token, facebookPageTab.name,
          );
          const parsedTabUrl = result.url.split('/');
          id = parsedTabUrl[parsedTabUrl.length - 1];
          updateCampaign({ facebookPageTab: { ...facebookPageTab, id } });
          if (!id) {
            id = parsedTabUrl[parsedTabUrl.length - 2];
            updateCampaign({ facebookPageTab: { ...facebookPageTab, id } });
          }
        } catch (error) {
          console.error(error.message);
        }
      }

      try {
        const userData = await fetchUserData();
        updateCampaign({
          userData,
          postData: {
            title: project.project.name,
            thumbnail: project.thumbnail,
            description: project.description,
            link: project.url,
          },
        });
      } catch (e) {
        console.error(e.message);
      }
    },
  },
];

export const LINKEDIN_STAGES = [
  // {
  //   key: EMBED_ENGINE,
  //   completionPercentage: 25,
  //   element: EmbedLinkedinEngine,
  // },
  // {
  //   key: EMBED_LOCATION,
  //   completionPercentage: 25,
  //   element: EmbedLinkedinLocation,
  // },
  {
    key: LINKEDIN_LOGIN,
    completionPercentage: 50,
    element: LinkedinLogin,
    bootstrap: async ({ init, isAuthorized, nextStage, setStage, updateCampaign }) => {
      try {
        await init();
        const authorized = await isAuthorized();
        updateCampaign({ authorized });
        if (authorized) {
          nextStage();
        } else {
          setStage(LINKEDIN_LOGIN);
        }
      } catch (error) {
        console.error(error.message);
        setStage(LINKEDIN_LOGIN);
      }
    },
  },
  {
    key: LINKEDIN_POST,
    completionPercentage: 75,
    actionButtonClassName: 'linkedin-login',
    actionButtonIconClassName: 'fa fa-linkedin-square',
    actionButtonCaption: 'Share',
    element: LinkedinPost,
    bootstrap: async ({ project, setStage, fetchUserData, updateCampaign }) => {
      try {
        const userData = await fetchUserData();
        const postData = {
          title: project.title,
          thumbnail: project.thumbnail,
          description: project.description,
          link: project.url,
        };
        updateCampaign({ userData, postData });
      } catch (e) {
        console.error(e.message);
        setStage(LINKEDIN_POST);
      }
    },
  },
];

export const EMAIL_STAGES = [
  {
    key: EMBED_ENGINE,
    completionPercentage: (1 / 3.0) * 100,
    element: EmailEmbedEngine,
  },
  {
    key: EMBED_LOCATION,
    completionPercentage: (2 / 3.0) * 100,
    element: EmailEmbedLocation,
  },
  {
    key: SERVICE_PROVIDER,
    completionPercentage: 100,
    element: EmailServiceProvider,
  },
];
