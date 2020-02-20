/**
 * Created by Ekaterina Maksimlyuk on 14/05/2019.
 */

import { action, observable, computed, runInAction } from 'mobx';

class Stager {
  static steps = [];

  @observable stages;

  @observable data;

  @observable step;

  @observable project;

  @computed get activeElement() {
    return this.stages[this.step].element;
  }

  @computed get isLastStep() {
    if (this.constructor.steps.length === 0) {
      return true;
    }
    return this.step === this.constructor.steps[this.constructor.steps.length - 1];
  }

  @computed get isFirstStep() {
    if (this.constructor.steps.length === 0) {
      return true;
    }
    return this.step === this.constructor.steps[0];
  }

  @computed get className() {
    return this.stages[this.step].className;
  }

  constructor(options) {
    const { provider, project, common, onCampaignFinished, returnToSelect } = options;
    this.provider = provider;
    this.onCampaignFinished = onCampaignFinished;
    this.returnToSelect = returnToSelect;
    this.project = project;
    this.common = common;
    this.data = {};
    this.stages = [];
    [this.step] = this.constructor.steps;
  }

  async publish() {
    await this.provider.publish({
      backend: this.common.backend,
      projectLink: this.project.artifact,
      thumbnail: this.project.cover,
      stagerData: this.data,
    });
    this.onCampaignFinished();
  }

  canBypassStage() {
    return true;
  }

  nextStage = async () => {
    if (this.isLastStep) {
      return this.publish();
    }
    const index = this.constructor.steps.indexOf(this.step);
    const newIndex = Math.min(index + 1, this.constructor.steps.length - 1);
    runInAction(async () => {
      this.step = this.constructor.steps[newIndex];
      if (this.stages[this.step].bootstrap) {
        await this.stages[this.step].bootstrap(this, this.nextStage);
      }
    });
  };

  @action prevStage = async () => {
    const index = this.constructor.steps.indexOf(this.step);
    if (index < 0) {
      return;
    }
    runInAction(async () => {
      const newIndex = index - 1;
      if (newIndex < 0) {
        this.returnToSelect();
      } else {
        this.step = this.constructor.steps[newIndex];
        if (this.stages[this.step].bootstrap) {
          await this.stages[this.step].bootstrap(this, this.prevStage);
        }
      }
    });
  };

  @action async setStage(stageName) {
    this.step = this.constructor.steps[this.constructor.steps.indexOf(stageName)];
    if (this.stages[this.step].bootstrap) {
      await this.stages[this.step].bootstrap(this);
    }
  }

  @action updateData = (options) => {
    this.data = { ...this.data, ...options };
  };
}

export default Stager;
