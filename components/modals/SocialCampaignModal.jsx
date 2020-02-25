import React, { Component, Fragment, createRef } from 'react';
import { observer, inject } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';

import SocialCampaign from '../publisher/campaigns/SocialCampaign';

@inject('common')
@observer
class SocialCampaignModal extends Component {
  iframeConductor = createRef();

  constructor(props) {
    super(props);

    this.state = { isLoaded: false };
  }

  componentDidMount() {
    if (this.iframeConductor.current) this.setState({ isLoaded: true });
  }

  render() {
    const { common: { cdnHostname }, updateTitle, handleClose } = this.props;
    const { isLoaded } = this.state;
    return (
      <Fragment>
        {isLoaded && (
          <SocialCampaign
            iframeConductor={this.iframeConductor.current}
            onTitleUpdated={updateTitle}
            onCampaignFinished={handleClose}
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
      </Fragment>
    );
  }
}

SocialCampaignModal.propTypes = {
  updateTitle: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
};

export default SocialCampaignModal;
