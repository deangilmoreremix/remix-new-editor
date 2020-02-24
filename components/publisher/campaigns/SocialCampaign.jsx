import React, { Component } from 'react';
import { Progress } from 'reactstrap';
import { inject, observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';

import Project from '../../../lib/editor/Project';
import PropTypes from '../../../lib/PropTypes';
import InfiniteLoading from '../../common/InfiniteLoading';

import FacebookCampaignStager from './campaign-stagers/FacebookCampaignStager';
import FacebookSocialProvider from '../../../lib/social-providers/FacebookSocialProvider';
import LinkedinCampaignStager from './campaign-stagers/LinkedinCampaignStager';
import LinkedinSocialProvider from '../../../lib/social-providers/LinkedinSocialProvider';
import svgFB from '../../../public/static/images/campaign/fb.svg';
import svgLinkedin from '../../../public/static/images/campaign/linked-in.svg';

@inject('api')
@inject('projectStore')
@observer
class SocialCampaign extends Component {
  static socialSources = [{
    key: 'facebook',
    title: 'Facebook',
    image: svgFB,
    loader: (props) => {
      const { iframeConductor, project, api } = props;
      return new FacebookCampaignStager(
        new FacebookSocialProvider({
          conductor: iframeConductor,
          appId: '1728968890675795', // TODO: extract to env or any other vars
        }),
        project,
        api,
      );
    },
  }, {
    key: 'linkedin',
    title: 'LinkedIn',
    image: svgLinkedin,
    loader: (props) => {
      const { iframeConductor, project, api } = props;
      return new LinkedinCampaignStager(
        new LinkedinSocialProvider({
          conductor: iframeConductor,
          clientId: '77dc93kxh13kfc', // TODO: extract to env or any other vars
        }),
        project,
        api,
      );
    },
  }];

  constructor(props) {
    super(props);

    const { project } = this.props;
    this.activeSocialSources = this.constructor.socialSources
      .filter(item => project.allowedSocials && project.allowedSocials.includes(item.key));

    this.state = {
      isLoading: false,
      stager: null,
    };

    if (this.activeSocialSources.length === 1) {
      this.state = {
        isLoading: false,
        stager: this.activeSocialSources[0].loader(this.props),
      };
    }
  }

  sharePost = async () => {
    const { projectStore, onCampaignFinished } = this.props;
    const { stager } = this.state;

    try {
      projectStore.activeProject = await stager.sharePost(projectStore);
      onCampaignFinished();
    } catch (error) {
      return console.error(error.message || 'Unable to post');
    }
  };

  selectSocialSource = (key) => {
    const { onTitleUpdated } = this.props;
    const selectedSource = this.activeSocialSources.find(item => item.key === key);
    this.setState({ stager: selectedSource.loader(this.props) });
    onTitleUpdated(`${selectedSource.title} Social Campaign`);
  };

  handleBackButtonClick = async () => {
    const { stager, isLoading } = this.state;
    if (isLoading) {
      return;
    }
    this.setState({ isLoading: true });
    await stager.prevStage();
    this.setState({ isLoading: false });
  };

  handleNextButtonClick = async () => {
    const { stager } = this.state;
    if (!stager.canBypassStage(stager.currentStage)) {
      return;
    }
    this.setState({ isLoading: true });
    if (stager.currentStage.key === stager.stages[stager.stages.length - 1].key) {
      await this.sharePost();
    } else {
      await stager.nextStage();
    }
    this.setState({ isLoading: false });
  };

  render() {
    const { className, project } = this.props;
    const { stager, isLoading } = this.state;
    const loading = isLoading || (stager && stager.isUploading);

    return (
      <>
        <div className={`social-campaign ${className}`}>
          <div className={`loading-screen workspace ${!loading ? 'hidden' : ''}`}>
            <InfiniteLoading />
          </div>
          <div className={`workspace ${loading ? 'hidden' : ''}`}>
            {!stager && (
              <div className="social-source-container">
                <span>Please select social network you want to continue with</span>
                <ul className="social-source-list">
                  {this.activeSocialSources.map(({ key, image }) => (
                    <li
                      className="social-source-list-item"
                      key={key}
                      onClick={() => this.selectSocialSource(key)}
                    >
                      <SVGInline className="campaign-icon" classSuffix="-inline" svg={image} cleanup={['title']} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {stager && !stager.extraModal && (
              <Progress
                className="embed-progress"
                value={stager.currentStage.completionPercentage}
              />
            )}
            {stager && !stager.extraModal && (
              <stager.currentStage.element
                variables={stager.variables}
                project={project}
              />
            )}
          </div>
          {stager && !stager.extraModal && (
            <div className="controls">
              <button
                className={`go-button back ${stager.currentStage.key === stager.stages[0].key ? 'hidden' : ''}`}
                onClick={this.handleBackButtonClick}
                type="button"
              >
                Back
              </button>
              <button
                className={
                  `go-button ${`next ${stager.currentStage.actionButtonClassName || ''}`} ${
                    stager.canBypassStage(stager.currentStage) ? '' : 'inactive'}`
                }
                onClick={this.handleNextButtonClick}
                type="button"
              >
                <i
                  className={stager.currentStage.actionButtonIconClassName || 'hidden'}
                />
                {stager.currentStage.actionButtonCaption || 'Next'}
              </button>
            </div>
          )}
          {stager && stager.extraModal && stager.extraModal.content}
        </div>
      </>
    );
  }
}

SocialCampaign.propTypes = {
  className: PropTypes.string,
  project: PropTypes.instanceOf(Project).isRequired,
  onCampaignFinished: PropTypes.func,
  onTitleUpdated: PropTypes.func,
  iframeConductor: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(React.Node) }),
  ]),
  projectStore: PropTypes.shape({
    activeProject: PropTypes.object,
  }),
};

export default SocialCampaign;
