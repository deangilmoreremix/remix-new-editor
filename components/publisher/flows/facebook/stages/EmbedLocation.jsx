import * as React from 'react';

import PropTypes from '../../../../../lib/PropTypes';

const EmbedLocation = ({ settings, updateCampaign }) => (
  <div className="embed-location">
    <h5 className="embed-title">URL Link to your page with your embedded video</h5>
    <input
      type="text"
      className="embed-page-input"
      value={settings.embedPage}
      onChange={({ target: { value } }) => {
        updateCampaign({ embedPage: value });
      }}
    />
  </div>
);

EmbedLocation.propTypes = {
  settings: PropTypes.shape({
    embedPage: PropTypes.string.isRequired,
  }).isRequired,
  updateCampaign: PropTypes.func.isRequired,
};

export default EmbedLocation;
