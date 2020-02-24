/* eslint-disable no-underscore-dangle */

import React from 'react';
import { action, observable, runInAction } from 'mobx';

import MediaTypeDetector from '../../../../lib/popcorn/util/mediaTypeDetector';
import { modalContent, isResolutionWrong } from '../../../../lib/utils/cropHelper';
import { showError } from '../../../../lib/services/alertService';
import StageComponent from './StageComponent';

const iframeStyling = `<!--- embed styling ---->
<style> 
  .iframe-container { position:relative; padding-bottom:56.25%; padding-top:30px; height:0; overflow:hidden; border:1px solid #ccc; }
  .iframe-container iframe,.iframe-container object,.iframe-container embed { position:absolute; top:0; left:0; width:100%; height:100%; }
</style>
<!--- End of embed styling ---->
`;

const posterframeRecommendedResolution = {
  width: 1200,
  height: 630,
};

class CampaignStager {
  static PostPreview = null;

  static posterframeRecommendedResolutionPrompt =`${posterframeRecommendedResolution.width}`
    + `x${posterframeRecommendedResolution.height}`;

  static generateStageComponent = render => props => (
    <StageComponent render={render} {...props} />
  );

  static EMBED_LOCATIONS = [
    {
      key: 'default',
      label: 'Direct (Default Hosting)',
    },
    {
      key: 'leadpages',
      label: 'LeadPages',
      prompt: 'Copy and paste this embed code into your LeadPage',
      embedGenerator: (url, width, height) => `${iframeStyling} <div class="iframe-container"><iframe id='vr-${url.split('/').reverse()[0]}' src='${url}' width='${width}' height='${height}' frameborder='0' allow="autoplay; fullscreen" mozallowfullscreen webkitallowfullscreen allowfullscreen></iframe></div>`,
    },
    {
      key: 'wordpress',
      label: 'WordPress',
      prompt: 'Copy and paste this embed code into your WordPress',
      embedGenerator: (url, width, height) => `${iframeStyling} <div class="iframe-container"><iframe id='vr-${url.split('/').reverse()[0]}' src='${url}' width='${width}' height='${height}' frameborder='0' allow="autoplay; fullscreen" mozallowfullscreen webkitallowfullscreen allowfullscreen></iframe></div>`,
    },
    {
      key: 'optimizepress',
      label: 'OptimizePress 2.0',
      prompt: 'Copy and paste this embed code into your Video Player OP 2.0 element',
      embedGenerator: (url, width, height) => `${iframeStyling} <div class="iframe-container"><iframe id='vr-${url.split('/').reverse()[0]}' src='${url}' width='${width}' height='${height}' frameborder='0' allow="autoplay; fullscreen" mozallowfullscreen webkitallowfullscreen allowfullscreen></iframe></div>`,
    },
    {
      key: 'other',
      label: 'Other',
      prompt: 'Copy & Paste this embed code inside the custom HTML element',
      embedGenerator: (url, width, height) => `${iframeStyling} <div class="iframe-container"><iframe id='vr-${url.split('/').reverse()[0]}' src='${url}' width='${width}' height='${height}' frameborder='0' allow="autoplay; fullscreen" mozallowfullscreen webkitallowfullscreen allowfullscreen></iframe></div>`,
    },
  ];

  _stages = [];

  @observable
  state = {
    currentStageIndex: 0,
    preload: true,
    embedLocation: this.constructor.EMBED_LOCATIONS[0],
  };

  @observable isUploading = false;

  @observable extraModal = null;

  constructor(provider, project, api) {
    this.provider = provider;
    this.project = project;
    this.api = api;
  }

  async sharePost() {
    const { project } = this;
    return project;
  }

  @action
  uploadFile = callback => async ({ target: { files: [file] } }) => {
    const { api } = this;
    if (!file) {
      return;
    }
    if (file.type.indexOf('image/') === -1) {
      showError('This image format is not supported.');
      return;
    }
    this.isUploading = true;
    try {
      const media = await api.uploadMedia({ data: file });
      const imageMeta = await new MediaTypeDetector().getMetadata(media.url);
      if (isResolutionWrong({
        imageMeta,
        recommendedResolution: posterframeRecommendedResolution,
      })) {
        runInAction(() => {
          this.extraModal = modalContent({
            imageMeta,
            recommendedResolution: posterframeRecommendedResolution,
            onFileUploaded: (res) => {
              callback(res);
              this.extraModal = null;
            },
          },
          );
        });
      } else {
        callback(imageMeta);
      }
    } catch (err) {
      showError(err.message || 'This image format is not supported.');
    } finally {
      this.isUploading = false;
    }
  };

  canBypassStage() {
    return true;
  }

  @action
  async nextStage() {
    if (this.currentStage.key
      === this._stages[this._stages.length - 1].key) {
      return this.sharePost();
    }

    const { currentStageIndex } = this.state;
    this.state.currentStageIndex = Math.min(currentStageIndex + 1, this._stages.length - 1);
    if (this._stages[this.state.currentStageIndex].bootstrap) {
      await this._stages[this.state.currentStageIndex].bootstrap(this);
    }
    return this._stages[this.state.currentStageIndex];
  }

  @action
  async prevStage() {
    const { currentStageIndex } = this.state;
    this.state.currentStageIndex = Math.min(currentStageIndex - 1, 0);
    if (this._stages[this.state.currentStageIndex].bootstrap) {
      await this._stages[this.state.currentStageIndex].bootstrap(this);
    }
    return this._stages[this.state.currentStageIndex];
  }

  @action
  async setStage(stageName) {
    const { currentStageIndex } = this.state;
    let currentStage = this._stages[currentStageIndex];
    if (currentStage.key === stageName) {
      return;
    }
    currentStage = this._stages.find(item => item.key === stageName);
    this.state.currentStageIndex = this._stages.indexOf(currentStage);
    if (currentStageIndex.bootstrap) {
      await currentStageIndex.bootstrap(this);
    }
    return currentStage;
  }

  get embedLocations() {
    return this.constructor.EMBED_LOCATIONS;
  }

  get stages() {
    return this._stages;
  }

  get currentStage() {
    return this._stages[this.state ? this.state.currentStageIndex : 0];
  }

  get variables() {
    return this.state;
  }

  set variables(value) {
    this.state = value;
  }
}

export default CampaignStager;
