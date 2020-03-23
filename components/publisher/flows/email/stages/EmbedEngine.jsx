import * as React from 'react';

import { EMAIL_EMBED_LOCATIONS, WORDPRESS } from '../../../../../lib/constants/campaigns/constants';
import EmbedDataContainer from '../../../EmbedDataContainer';
import PropTypes from '../../../../../lib/PropTypes';

const EmbedEngine = ({ settings, updateCampaign, project }) => {
  const { embedLocation, preload } = settings;
  return (
    <div className="embed-engine">
      <h5 className="embed-title">Where do you want to embed your video?</h5>
      <div className="embed-grid">
        {embedLocation && (
          <div className="row embed-group">
            <label className="cell" htmlFor="embed-location-select">
              Embed Location
              <select
                className="cell"
                name="select"
                id="embed-location-select"
                value={embedLocation.key}
                onChange={({ target: { value } }) => updateCampaign({
                  embedLocation: EMAIL_EMBED_LOCATIONS.find(item => item.key === value),
                })}
              >
                {EMAIL_EMBED_LOCATIONS.map(
                  ({ key, label }) => <option key={label} value={key}>{label}</option>,
                )}
              </select>
            </label>
          </div>
        )}
        <div className="row embed-group">
          <label className="cell" htmlFor="preload-check">
            Preload
            <input
              className="cell"
              type="checkbox"
              id="preload-check"
              checked={preload}
              onChange={({ target: { checked } }) => updateCampaign({ preload: checked })}
            />
          </label>
        </div>
      </div>
      {embedLocation && (
        <div className="embed-details">
          {
            embedLocation.key === WORDPRESS
              ? (
                <span className="embed-line">
                  Click here to install the
                  <a href="https://cdn.vidcloud.io/wp/vr.zip">wp</a>
                  plugin.
                </span>
              )
              : null
          }
          <span className="embed-line">{embedLocation.prompt}</span>
          <EmbedDataContainer
            className="embed-item"
            url={project.url}
            stringGenerator={embedLocation.embedGenerator}
            resizable
          />
        </div>
      )}
    </div>
  );
};

EmbedEngine.propTypes = {
  settings: PropTypes.shape({
    embedLocation: PropTypes.shape({
      key: PropTypes.string.isRequired,
      prompt: PropTypes.string.isRequired,
      embedGenerator: PropTypes.func.isRequired,
    }),
    preload: PropTypes.bool,
  }).isRequired,
  updateCampaign: PropTypes.func.isRequired,
  project: PropTypes.shape({
    url: PropTypes.string.isRequired,
  }).isRequired,
};

export default EmbedEngine;
