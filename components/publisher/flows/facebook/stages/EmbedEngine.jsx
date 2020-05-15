import * as React from 'react';

import PropTypes from '../../../../../lib/PropTypes';
import { DEFAULT, FACEBOOK_EMBED_LOCATIONS } from '../../../../../lib/constants/campaigns/constants';
import EmbedDataContainer from '../../../EmbedDataContainer';

const EmbedEngine = ({ settings, project, updateCampaign }) => (
  <div className="embed-engine">
    <h5 className="embed-title">Where do you want to embed your video?</h5>
    <div className="embed-grid">
      <div className="row embed-group">
        <label className="cell" htmlFor="embed-location-select">Embed Location</label>
        {settings.embedLocation && (
          <select
            className="cell"
            name="select"
            id="embed-location-select"
            value={settings.embedLocation.key}
            onChange={({ target: { value } }) => {
              const location = FACEBOOK_EMBED_LOCATIONS.find(
                item => item.key === value,
              );
              updateCampaign({ embedLocation: location });
            }}
          >
            {FACEBOOK_EMBED_LOCATIONS.map(
              ({ key, label }) => <option key={key} value={key}>{label}</option>,
            )}
          </select>
        )}
      </div>
      <div className="row embed-group">
        <label className="cell" htmlFor="preload-check">
          Preload
        </label>
        <input
          className="cell"
          type="checkbox"
          id="preload-check"
          checked={settings.preload}
          onChange={({ target: { checked } }) => {
            updateCampaign({ preload: checked });
          }}
        />
      </div>
    </div>
    {settings.embedLocation && (
      <div className={settings.embedLocation.embedGenerator ? 'embed-details' : 'hidden'}>
        <span className="embed-line">{settings.embedLocation.prompt}</span>
        {settings.embedLocation.key === DEFAULT ? null : (
          <EmbedDataContainer
            className="embed-item"
            url={[
              project.url, [
                !settings.preload ? 'preload=none' : null,
              ].filter(item => !!item).join('&')]
              .join('?')}
            stringGenerator={settings.embedLocation.embedGenerator}
            resizable
          />
        )}
      </div>
    )}
  </div>
);

EmbedEngine.propTypes = {
  settings: PropTypes.shape({
    facebookPageTab: PropTypes.shape({
      name: PropTypes.string,
    }),
    facebookPages: PropTypes.array,
    selectedFbPage: PropTypes.string,
    embedLocation: PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      prompt: PropTypes.string,
      embedGenerator: PropTypes.func,
    }),
    preload: PropTypes.bool,
  }).isRequired,
  project: PropTypes.shape({
    url: PropTypes.string.isRequired,
  }).isRequired,
  updateCampaign: PropTypes.func.isRequired,
  provider: PropTypes.shape({
    logIn: PropTypes.func.isRequired,
    getPageTabs: PropTypes.func.isRequired,
  }).isRequired,
};

export default EmbedEngine;
