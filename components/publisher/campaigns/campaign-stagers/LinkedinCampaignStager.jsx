/* eslint-disable no-underscore-dangle */

import React from 'react';
import { action, observable } from 'mobx';
import { Input, Label } from 'reactstrap';

import CampaignStager from './CampaignStager';
import EmbedDataContainer from '../../EmbedDataContainer';
import LinkedinPostPreview from '../../../common/post-previews/LinkedinPostPreview';

class LinkedinCampaignStager extends CampaignStager {
  static PostPreview = LinkedinPostPreview;

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
                state.project.make.url, [
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
      key: 'login',
      completionPercentage: 50,
      element: this.constructor.generateStageComponent(() => (
        <div className="facebook-login">
          <div className="login-note">
            <label>
              You must login to LinkedIn and authorize our app to share videos into timeline
            </label>
          </div>
          <button
            className="go-button linkedin-login"
            onClick={async () => {
              try {
                await this.provider.logIn();
                return this.nextStage();
              } catch (e) {
                return this.setStage('login');
              }
            }}
          >
            <i className="fa fa-linkedin-square" />
            Log in
          </button>
        </div>
      )),
      bootstrap: async (instance) => {
        await instance.provider.init();
        try {
          if (await instance.provider.isAuthorized()) {
            return instance.nextStage();
          }
          return instance.setStage('login');
        } catch (error) {
          alert(error.message);
          return instance.setStage('login');
        }
      },
    },
    {
      key: 'post',
      completionPercentage: 75,
      actionButtonClassName: 'linkedin-login',
      actionButtonIconClassName: 'fa fa-linkedin-square',
      actionButtonCaption: 'Share',
      element: this.constructor.generateStageComponent(state => (
        <div className="linkedin-post">
          <h5 className="embed-title">
            What do you want the LinkedIn Share to look like?
          </h5>
          <div className="embed-grid">
            <div className="row embed-group">
              <div className="embed-grid cell linkedin-post-details">
                <div className="row embed-group">
                  <label className="cell" htmlFor="linkedin-post-url-input">
                    Shared Url
                  </label>
                  <Input
                    id="linkedin-post-url-input"
                    className="cell linkedin-post-input"
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
                  <label className="cell" htmlFor="linkedin-post-title-input">
                    Post Title
                  </label>
                  <Input
                    id="linkedin-post-title-input"
                    className="cell linkedin-post-input"
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
                  <label className="cell" htmlFor="linkedin-post-description-input">
                    Post Description
                  </label>
                  <Input
                    id="linkedin-post-description-input"
                    className="cell linkedin-post-input"
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
                  <label className="cell" htmlFor="linkedin-post-image-input">
                    Post Image
                  </label>
                  <Input
                    id="linkedin-post-image-input"
                    className="cell linkedin-post-input"
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
        instance.state.userData = await instance.provider.fetchUserData();
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
      embedPage,
      postData,
    } = this.state;

    project.name = postData.title;
    project.description = postData.description;
    project.thumbnail = postData.thumbnail;

    await api.publish(await api.save(project));

    await this.provider.share({
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
    return project;
  }

  canBypassStage(stage) {
    const { isLoading, embedPage, userData, postData } = this.state;
    if (isLoading || this.isUploading) {
      return false;
    }
    switch (stage.key) {
      case 'embed-engine':
        return true;
      case 'embed-location':
        return embedPage && embedPage.length > 0;
      case 'login':
        return this.provider.isAuthorized();
      case 'post':
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
    if (this._stages[nextStageIdx].key === 'embed-location'
      && ['default'].indexOf(embedLocation.key) !== -1) {
      nextStageIdx += 1;
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
    let prevStageIdx = Math.min(
      currentStageIndex - 1,
      0,
    );
    if (this._stages[prevStageIdx].key === 'embed-location' && embedLocation.key === 'default') {
      prevStageIdx -= 1;
    }
    this.state.currentStageIndex = prevStageIdx;
    if (this._stages[this.state.currentStageIndex].bootstrap) {
      await this._stages[this.state.currentStageIndex].bootstrap(this);
    }
    return this._stages[this.state.currentStageIndex];
  }
}

export default LinkedinCampaignStager;
