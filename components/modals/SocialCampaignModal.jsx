import * as React from 'react';
import { observer, inject } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';
import Project from '../../lib/editor/Project';
import SocialCampaign from '../publisher/campaigns/SocialCampaign';

@inject('common')
@inject('projectStore')
@observer
class SocialCampaignModal extends React.Component {
  iframeConductor = React.createRef();

  constructor(props) {
    super(props);

    this.state = { isLoaded: false };
  }

  componentDidMount() {
    if (this.iframeConductor.current) this.setState({ isLoaded: true });
  }

  render() {
    const { projectStore: { item }, common: { cdnHostname }, updateTitle } = this.props;
    const { isLoaded } = this.state;
    return (
      <>
        {isLoaded && (
          <SocialCampaign
            project={new Project(item)}
            iframeConductor={this.iframeConductor.current}
            onTitleUpdated={updateTitle}
          />
        )}
        <iframe
          title="Iframe social conductor"
          src={`${cdnHostname}/social-campaign/social-campaign.html`}
          frameBorder="0"
          className="conductor-iframe"
          id="conductor-iframe"
          ref={this.iframeConductor}
        />
      </>
    );
  }
}

SocialCampaignModal.propsTypes = {
  updateTitle: PropTypes.func.isRequired,
};

export default SocialCampaignModal;
