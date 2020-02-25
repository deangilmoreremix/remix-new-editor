/* eslint-disable no-underscore-dangle */

import React from 'react';
import { action, observable } from 'mobx';
import { Input, Label } from 'reactstrap';

import EmbedDataContainer from '../../EmbedDataContainer';
import FacebookPostPreview from '../../../common/post-previews/FacebookPostPreview';
import CampaignStager from './CampaignStager';

const BACKEND_URL = 'https://api.vidcloud.io';
const MIN_FANS_PAGE = 2000;
const FB_PAGE_PERMISSIONS = 'public_profile,email,manage_pages,pages_show_list';
const DEFAULT_PERMISSIONS = 'public_profile,email';

class FacebookCampaignStager extends CampaignStager {
  static PostPreview = FacebookPostPreview;

  static EMBED_LOCATIONS = [
    ...CampaignStager.EMBED_LOCATIONS.slice(0, CampaignStager.EMBED_LOCATIONS.length - 1), {
      key: 'facebook-page',
      label: 'Facebook Page',
    }, CampaignStager.EMBED_LOCATIONS[CampaignStager.EMBED_LOCATIONS.length - 1],
  ];

  _stages = [
    {
      key: 'embed-engine',
      completionPercentage: 25,
      element: this.constructor.generateStageComponent(state => (
        <div className="embed-engine">
          <h5 className="embed-title">Where do you want to embed your video?</h5>
          <div className="embed-grid">
            <div className="row embed-group">
              <Label className="cell" for="embed-location-select">Embed Location</Label>
              <select
                className="cell"
                name="select"
                id="embed-location-select"
                value={state.variables.embedLocation.key}
                onChange={({ target: { value } }) => {
                  state.variables.embedLocation = this.constructor.EMBED_LOCATIONS.find(
                    item => item.key === value,
                  );
                  state.onVariablesUpdated(state.variables);
                }}
              >
                {this.constructor.EMBED_LOCATIONS.map(
                  ({ key, label }) => <option key={key} value={key}>{label}</option>,
                )}
              </select>
            </div>
            <div className="row embed-group">
              <Label className="cell" for="preload-check">
                Preload
              </Label>
              <Input
                className="cell"
                type="checkbox"
                id="preload-check"
                checked={state.variables.preload}
                onChange={({ target: { checked } }) => {
                  state.variables.preload = checked;
                  state.onVariablesUpdated(state.variables);
                }}
              />
            </div>
            <div className="row embed-group">
              <Label className="cell" for="autoplay-check">
                Autoplay
              </Label>
              <Input
                className="cell"
                type="checkbox"
                id="autoplay-check"
                checked={state.variables.autoplay}
                onChange={({ target: { checked } }) => {
                  state.variables.autoplay = checked;
                  state.onVariablesUpdated(state.variables);
                }}
              />
            </div>
          </div>
          <div className={state.variables.embedLocation.embedGenerator ? 'embed-details' : 'hidden'}>
            <span className="embed-line">{state.variables.embedLocation.prompt}</span>
            <EmbedDataContainer
              className="embed-item"
              url={[
                state.project.url, [
                  state.variables.autoplay ? 'autoplay=1' : null,
                  !state.variables.preload ? 'preload=none' : null,
                ].filter(item => !!item).join('&')]
                .join('?')}
              stringGenerator={state.variables.embedLocation.embedGenerator}
              resizable
            />
          </div>
        </div>
      )),
    },
    {
      key: 'embed-location',
      completionPercentage: 25,
      element: this.constructor.generateStageComponent(state => (
        <div className="embed-location">
          <h5 className="embed-title">URL Link to your page with your embedded video</h5>
          <Input
            type="text"
            className="embed-page-input"
            value={state.variables.embedPage}
            onChange={({ target: { value } }) => {
              state.variables.embedPage = value;
            }}
          />
        </div>
      )),
    },
    {
      key: 'facebook-login',
      completionPercentage: 50,
      element: this.constructor.generateStageComponent(state => (
        <div className="facebook-login">
          <div className="login-note">
            <span>
              You must login to Facebook and authorize our app to post Videos into Facebook Pages
            </span>
          </div>
          <button
            className="go-button fb-login"
            onClick={async () => {
              try {
                await this.provider.logIn(
                  state.variables.embedLocation === 'facebook-page' ? FB_PAGE_PERMISSIONS : DEFAULT_PERMISSIONS,
                );
                return this.nextStage();
              } catch (e) {
                return this.setStage('facebook-login');
              }
            }}
            type="button"
          >
            <i className="fa fa-facebook-official" />
            Log in
          </button>
        </div>
      )),
      bootstrap: async (instance) => {
        await instance.provider.init();
        try {
          const permissions = instance.state.embedLocation === 'facebook-page'
            ? FB_PAGE_PERMISSIONS
            : DEFAULT_PERMISSIONS;
          if (await instance.provider.isAuthorized(permissions)) {
            return instance.nextStage();
          }
          return instance.setStage('facebook-login');
        } catch (error) {
          console.error(error.message);
          return instance.setStage('facebook-login');
        }
      },
    },
    {
      key: 'facebook-page',
      completionPercentage: 50,
      element: this.constructor.generateStageComponent(state => (
        <div className="facebook-page">
          <h5 className="embed-title">
            Which one of your Facebook Pages do you want to embed your Video into?
          </h5>
          <div className="embed-grid">
            <div className="row embed-group">
              <Label className="cell" for="facebook-page-select">
                Facebook pages
              </Label>
              <select
                id="facebook-page-select"
                className="cell"
                name="select"
                value={state.variables.selectedFbPage}
                onChange={async ({ target: { value } }) => {
                  const fbPage = state.variables.facebookPages.find(page => page.id === value);
                  state.variables.selectedFbPage = value;
                  [state.variables.facebookPageTab] = await this.provider
                    .getPageTabs(fbPage.id, fbPage.token);
                  state.onVariablesUpdated(state.variables);
                }}
              >
                {state.variables.facebookPages.map(
                  ({ id, name }) => <option key={id} value={id}>{name}</option>,
                )}
              </select>
            </div>
            {
              state.variables.selectedFbPage
              && (state.variables.facebookPages.find(
                page => page.id === state.variables.selectedFbPage,
              ).fanCount >= MIN_FANS_PAGE)
                ? (
                  <div className="row embed-group">
                    <Label className="cell" for="facebook-page-tab-input">
                    Facebook Page tab name
                    </Label>
                    <Input
                      id="facebook-page-tab-input"
                      className="cell facebook-page-tab"
                      type="text"
                      value={state.variables.facebookPageTab.name}
                      onChange={({ target: { value } }) => {
                        state.variables.facebookPageTab.name = value;
                      }}
                    />
                  </div>
                ) : null
            }
          </div>
          {!state.variables.selectedFbPage
          || (state.variables.facebookPages.find(
            page => page.id === state.variables.selectedFbPage,
          ).fanCount < MIN_FANS_PAGE)
            ? (
              <div className="warning">
                <strong>Warning! </strong>
                The selected page has less than 2,000 fans. As a result, and due to a
                new Facebook limitation introduced on February 5th, 2018, your video can only be
                shared on Facebook and not embedded in a tab. This will be corrected soon.
              </div>
            ) : null}
        </div>
      )),
      bootstrap: async (instance) => {
        try {
          const facebookPages = await instance.provider.fetchPagesData();
          if (facebookPages.length) {
            instance.state.selectedFbPage = facebookPages[0].id;
            instance.state.facebookPages = facebookPages;
            if (facebookPages[0].fanCount >= MIN_FANS_PAGE) {
              const pageTabs = await instance.provider
                .getPageTabs(facebookPages[0].id, facebookPages[0].token);
              instance.state.facebookPages = facebookPages;
              [instance.state.facebookPageTab] = pageTabs;
            }
          }
        } catch (error) {
          console.error(error.message);
        }
      },
    },
    {
      key: 'facebook-post',
      actionButtonClassName: 'fb-login',
      actionButtonIconClassName: 'fa fa-facebook-official',
      actionButtonCaption: 'Share',
      completionPercentage: 75,
      element: this.constructor.generateStageComponent(state => (
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
                  <Input
                    id="facebook-post-url-input"
                    className="cell facebook-post-input"
                    type="text"
                    value={state.variables.postData.link}
                    onChange={({ target: { value } }) => {
                      const { postData } = state.variables;
                      postData.link = value;
                      state.variables.postData = postData;
                      state.onVariablesUpdated(state.variables);
                    }}
                  />
                </div>
                <div className="row embed-group">
                  <Label className="cell" htmlFor="facebook-post-title-input">
                    Post Title
                  </Label>
                  <Input
                    id="facebook-post-title-input"
                    className="cell facebook-post-input"
                    type="text"
                    value={state.variables.postData.title}
                    onChange={({ target: { value } }) => {
                      const { postData } = state.variables;
                      postData.title = value;
                      state.variables.postData = postData;
                      state.onVariablesUpdated(state.variables);
                    }}
                  />
                </div>
                <div className="row embed-group">
                  <Label className="cell" for="facebook-post-description-input">
                    Post Description
                  </Label>
                  <Input
                    id="facebook-post-description-input"
                    className="cell facebook-post-input"
                    type="text"
                    value={state.variables.postData.description}
                    onChange={({ target: { value } }) => {
                      const { postData } = state.variables;
                      postData.description = value;
                      state.variables.postData = postData;
                      state.onVariablesUpdated(state.variables);
                    }}
                  />
                </div>
                <div className="row embed-group">
                  <Label className="cell" for="facebook-post-image-input">
                    Post Image
                  </Label>
                  <Input
                    id="facebook-post-image-input"
                    className="cell facebook-post-input"
                    type="file"
                    accept="image/*"
                    onChange={this.uploadFile((imageData) => {
                      const { postData } = state.variables;
                      postData.thumbnail = imageData.source;
                      state.variables.postData = postData;
                      state.onVariablesUpdated(state.variables);
                    })}
                  />
                  <p className="text-resolution">
                    {`*Recommended image resolution ${this.constructor.posterframeRecommendedResolutionPrompt}`}
                  </p>
                </div>
              </div>
              <this.constructor.PostPreview
                className="cell"
                user={state.variables.userData}
                post={state.variables.postData}
              />
            </div>
          </div>
        </div>
      )),
      bootstrap: async (instance) => {
        const { project } = instance;
        const { facebookPages, facebookPageTab, selectedFbPage } = instance.state;
        if (selectedFbPage && facebookPageTab) {
          const fbPage = facebookPages.find(page => page.id === selectedFbPage);
          try {
            const result = instance.provider.createTab(
              fbPage.id, fbPage.token, facebookPageTab.name,
            );
            const parsedTabUrl = result.url.split('/');
            facebookPageTab.id = parsedTabUrl[parsedTabUrl.length - 1];
            if (!facebookPageTab.id) {
              facebookPageTab.id = parsedTabUrl[parsedTabUrl.length - 2];
            }
            try {
              instance.state.userData = await instance.provider.fetchUserData();
            } catch (e) {
              console.error(e.message);
            }
          } catch (error) {
            console.error(error.message);
          }
        } else {
          instance.state.userData = await instance.provider.fetchUserData();
        }
        instance.state.postData = {
          title: project.name,
          thumbnail: project.thumbnail,
          description: project.description,
          link: project.make.url,
        };
      },
    },
  ];

  @observable
  state = {
    currentStageIndex: 0,
    preload: true,
    facebookPages: [],
    embedLocation: this.constructor.EMBED_LOCATIONS[0],
    userData: {},
    postData: {},
  };

  async sharePost(api) {
    const { project } = this;
    const {
      autoplay,
      preload,
      embedLocation,
      selectedFbPage,
      embedPage,
      postData,
    } = this.state;

    const shareOptions = {
      shouldCreateTab: embedLocation.key === 'facebook-page',
    };
    if (embedLocation.key === 'facebook-page') {
      shareOptions.pageId = selectedFbPage;
      shareOptions.redirectUrl = `${BACKEND_URL}/api/makes/fb/${shareOptions.pageId}`
        + `/${this.provider.constructor.FB_APP_ID}?mid=${project.make._id}`;
    } else if (embedLocation.key === 'default') {
      shareOptions.redirectUrl = project.make.url;
    } else {
      shareOptions.redirectUrl = embedPage;
    }
    shareOptions.projectUrl = [
      project.make.url, [
        autoplay ? 'autoplay=1' : null,
        !preload ? 'preload=none' : null,
        'preferred_source=facebook',
      ].filter(item => !!item).join('&'),
    ].join('?');
    shareOptions.backendUrl = BACKEND_URL;

    project.name = postData.title;
    project.description = postData.description;
    project.thumbnail = postData.thumbnail;

    await api.publish(await api.save(project));

    await api.invalidateFbCache(shareOptions.projectUrl);

    this.provider.expandConductor();
    const { result } = await this.provider.share(shareOptions);

    this.provider.collapseConductor();

    if (result.error_code) {
      throw new Error(result.error_message);
    }

    if (embedLocation.key === 'facebook-page') {
      const queryString = [
        autoplay ? 'autoplay=1' : null,
        !preload ? 'preload=none' : null,
      ].filter(item => !!item).join('&');

      await api.linkToFbPage(project, selectedFbPage, queryString);
    }
    return project;
  }

  canBypassStage(stage) {
    const {
      isLoading,
      embedPage,
      facebookPages,
      selectedFbPage,
      facebookPageTab,
      userData,
      postData,
    } = this.state;

    if (isLoading || this.isUploading) {
      return false;
    }
    switch (stage.key) {
      case 'embed-engine':
        return true;
      case 'embed-location':
        return embedPage && embedPage.length > 0;
      case 'facebook-login':
        return userData;
      case 'facebook-page':
        return selectedFbPage
          && facebookPages.find(page => page.id === selectedFbPage).fanCount >= MIN_FANS_PAGE
          && facebookPageTab && facebookPageTab.name.length > 0;
      case 'facebook-post':
        return userData && postData
          && postData.title && postData.title.length > 0
          && postData.thumbnail && postData.thumbnail.length > 0;
      default:
        return false;
    }
  }

  @action
  async nextStage() {
    if (this.currentStage.key
      === this._stages[this._stages.length - 1].key) {
      return this.sharePost();
    }

    const { currentStageIndex, embedLocation } = this.state;
    let nextStageIdx = Math.min(currentStageIndex + 1, this._stages.length - 1);
    if (this._stages[currentStageIndex].key === 'facebook-login') {
      switch (embedLocation.key) {
        case 'facebook-page':
          nextStageIdx = this._stages.indexOf(
            this._stages.find(item => item.key === 'facebook-page'),
          );
          break;
        default:
          nextStageIdx = this._stages.indexOf(
            this._stages.find(item => item.key === 'facebook-post'),
          );
          break;
      }
    } else {
      if (this._stages[nextStageIdx].key === 'embed-location'
        && ['default', 'facebook-page'].indexOf(embedLocation.key) !== -1) {
        nextStageIdx += 1;
      }
      if (this._stages[nextStageIdx].key === 'facebook-page' && embedLocation.key !== 'facebook-page') {
        nextStageIdx += 1;
      }
    }
    this.state.currentStageIndex = nextStageIdx;
    if (this._stages[this.state.currentStageIndex].bootstrap) {
      await this._stages[this.state.currentStageIndex].bootstrap(this);
    }
    return this._stages[this.state.currentStageIndex];
  }

  @action
  async prevStage() {
    const { currentStageIndex, embedLocation } = this.state;
    if (this._stages[currentStageIndex].key === 'facebook-page') {
      this.state.selectedFbPage = null;
    }
    let prevStageIdx = Math.min(
      currentStageIndex - 1,
      0,
    );
    if ((this._stages[prevStageIdx].key === 'embed-location' && embedLocation.key === 'default')
      || (this._stages[prevStageIdx].key === 'facebook-page' && embedLocation.key !== 'facebook-page')) {
      prevStageIdx -= 1;
    }
    this.state.currentStageIndex = prevStageIdx;
    if (this._stages[this.state.currentStageIndex].bootstrap) {
      await this._stages[this.state.currentStageIndex].bootstrap(this);
    }
    return this._stages[this.state.currentStageIndex];
  }
}

export default FacebookCampaignStager;
