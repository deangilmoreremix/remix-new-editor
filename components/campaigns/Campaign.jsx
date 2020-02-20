import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { observable, action, runInAction, computed } from 'mobx';
import { Button } from 'reactstrap';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../lib/PropTypes';
import ProjectPropType from '../../lib/prop-types/ProjectPropType';
import InfiniteLoading from '../common/InfiniteLoading';
import FacebookCampaignStager from './social/stagers/FacebookCampaignStager';
import FacebookSocialProvider from '../../lib/campaign-provider/social/FacebookProvider';
import YoutubeCampaignStager from './social/stagers/YoutubeCampaignStager';
import YoutubeUploadProvider from '../../lib/campaign-provider/YoutubeUploadProvider';
import { showError } from '../../lib/services/alertService';
import SVGClose from '../../public/static/images/close.svg';
import useProjectStore from '../hooks/useProjectStore';

@observer
class Campaign extends Component {
  constructor(props) {
    super(props);
    this.activeSources = Object.values(this.constructor.sources);
    if (this.activeSources.length === 1) {
      this.stager = this.activeSources[0].loader(this);
    }

    const projectStore = useProjectStore();

    console.log({ projectStore });
    // todo: add
  }

  @action
  onLogin = async () => {
    this.isLoading = true;
    try {
      await this.stager.provider.logIn();
      if (await this.stager.provider.isAuthorized()) {
        return this.stager.nextStage();
      }
    } catch (e) {
      await showError(e.message);
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  };

  @computed
  get isPrevButtonHidden() {
    return this.stager.isFirstStep && this.activeSources.length === 1;
  }

  @action
  selectSource = key => async () => {
    this.isLoading = true;
    try {
      this.stager = await this.constructor.sources[key].loader(this);
    } catch (e) {
      showError(e.message);
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  };

  @action
  handleBackButtonClick = async () => {
    const { stager } = this;
    if (this.isLoading) {
      return;
    }
    if (stager.isFirstStep) {
      this.unsetStager();
      return;
    }
    this.isLoading = true;
    await stager.prevStage();
    runInAction(() => {
      this.isLoading = false;
    });
  };

  @action
  unsetStager = () => {
    this.stager = null;
  };

  @action
  handleNextButtonClick = async () => {
    const { stager } = this;
    if (!stager.canBypassStage(stager.currentStage)) {
      return;
    }
    this.isLoading = true;
    try {
      await stager.nextStage();
    } catch (e) {
      showError(e.message);
    }
    runInAction(() => {
      this.isLoading = false;
    });
  };

  @observable stager;

  @observable isLoading;

  render() {
    const { className, onCampaignFinished } = this.props;
    const { stager, isLoading } = this;

    const project = (stager && stager.project) || this.props.project;
    if (!project) {
      return null;
    }

    return (
      <>
        <div className={className}>
          <Button className="close-btn" onClick={onCampaignFinished}>
            <SVGInline className="svg-close-icon" classSuffix="" svg={SVGClose} cleanup={['title']} />
          </Button>
          <div className="container">
            {isLoading ? <InfiniteLoading /> : (
              <div className="workspace">
                {!stager
                && (
                  <div className="select-form">
                    <div className="project-container">
                      <div className="tile" style={{ backgroundImage: `url(${project.cover})` }} />
                      <p className="project-name">{project.title}</p>
                    </div>
                    <div className="list-container">
                      <p>Please select social network you want to continue with</p>
                      <ul className="source-list">
                        {this.activeSources.map(({ key, title, image }) => (
                          <li
                            className="source-list-item"
                            key={key}
                            onClick={this.selectSource(key)}
                          >
                            <img src={image} alt={title} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {stager
                && (
                  <stager.activeElement
                    project={project}
                    onLogin={this.onLogin}
                    onChangeData={stager.updateData}
                    data={stager.data}
                    className={stager.className}
                  />
                )}
              </div>
            )}
            {stager
            && (
              <div className="controls">
                {!this.isPrevButtonHidden
                && (
                  <Button
                    onClick={this.handleBackButtonClick}
                    disabled={isLoading}
                  >
                    Prev
                  </Button>
                )}
                {(!stager.isLastStep || stager.lastButtonName)
                && (
                <Button
                  className="next-button"
                  onClick={this.handleNextButtonClick}
                  disabled={!stager.canBypassStage(stager.step) || isLoading}
                >
                  {stager.isLastStep ? stager.lastButtonName : 'Next'}
                </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }
}

Campaign.sources = {
  facebook: {
    key: 'facebook',
    title: 'Facebook',
    image: '/static/images/campaign/fb.svg',
    loader: async (options) => {
      const {
        props: { project, onCampaignFinished, store: { common } },
        unsetStager,
      } = options;
      const stager = new FacebookCampaignStager({
        provider: new FacebookSocialProvider({
          appId: common.facebook.appId,
        }),
        project,
        common,
        onCampaignFinished,
        returnToSelect: unsetStager,
      });
      try {
        await stager.setStage(stager.constructor.steps[0]);
      } catch (e) {
        showError(e.message);
      }
      return stager;
    },
  },
  youtube: {
    key: 'youtube',
    title: 'YouTube',
    image: '/static/images/campaign/youtube.svg',
    loader: async (options) => {
      const { props: { project, store, onCampaignFinished }, unsetStager } = options;
      const stager = new YoutubeCampaignStager({
        provider: new YoutubeUploadProvider({
          backend: store.common.backend,
          request: store.request,
        }),
        project,
        store,
        onCampaignFinished,
        returnToSelect: unsetStager,
      });
      await stager.setStage(stager.constructor.steps[0]);
      return stager;
    },
  },
  // instagram: {
  //   key: 'instagram',
  //   title: 'Instagram',
  //   image: '/static/images/campaign/instagram.svg',
  //   loader: () => {},
  // },
  // twitter: {
  //   key: 'twitter',
  //   title: 'Twitter',
  //   image: '/static/images/campaign/twitter.svg',
  //   loader: () => {},
  // },
  // linkedin: {
  //   key: 'linkedin',
  //   title: 'LinkedIn',
  //   image: '/static/images/campaign/linked-in.svg',
  //   loader: () => {},
  // },
};

Campaign.propTypes = {
  className: PropTypes.string,
  project: ProjectPropType.isRequired,
  onCampaignFinished: PropTypes.func.isRequired,
};

export default Campaign;
