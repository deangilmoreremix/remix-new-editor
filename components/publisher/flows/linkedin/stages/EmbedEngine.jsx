import * as React from 'react';
import { Input, Label } from 'reactstrap';

import PropTypes from '../../../../../lib/PropTypes';
import { EMBED_LOCATIONS } from '../../../../../lib/constants/campaigns/constants';
import EmbedDataContainer from '../../../EmbedDataContainer';

const EmbedEngine = ({ settings, project, updateCampaign }) => (
  <div className="embed-engine">
    <h5 className="embed-title">Where do you want to embed your video?</h5>
    <div className="embed-grid">
      <div className="row embed-group">
        <Label className="cell" for="embed-location-select">Embed Location</Label>
        { settings.embedLocation && (
          <select
            className="cell"
            name="select"
            id="embed-location-select"
            value={settings.embedLocation.key}
            onChange={({ target: { value } }) => {
              const embedLocation = EMBED_LOCATIONS.find(
                item => item.key === value,
              );
              updateCampaign({ embedLocation });
            }}
          >
            {EMBED_LOCATIONS.map(
              ({ key, label }) => <option key={key} value={key}>{label}</option>,
            )}
          </select>
        )}
      </div>
      <div className="row embed-group">
        <Label className="cell" for="preload-check">
          Preload
        </Label>
        <Input
          className="cell"
          type="checkbox"
          id="preload-check"
          checked={settings.preload}
          onChange={({ target: { checked } }) => {
            updateCampaign({ preload: checked });
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
          checked={settings.autoplay}
          onChange={({ target: { checked } }) => {
            updateCampaign({ autoplay: checked });
          }}
        />
      </div>
    </div>
    {settings.embedLocation && (
      <div className={settings.embedLocation.embedGenerator ? 'embed-details' : 'hidden'}>
        <span className="embed-line">{settings.embedLocation.prompt}</span>
        <EmbedDataContainer
          className="embed-item"
          url={[
            project.url, [
              settings.autoplay ? 'autoplay=1' : null,
              !settings.preload ? 'preload=none' : null,
            ].filter(item => !!item).join('&')]
            .join('?')}
          stringGenerator={settings.embedLocation.embedGenerator}
          resizable
        />
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
    autoplay: PropTypes.bool,
    preload: PropTypes.bool,
  }).isRequired,
  project: PropTypes.shape({
    url: PropTypes.string.isRequired,
  }).isRequired,
  updateCampaign: PropTypes.func.isRequired,
  provider: PropTypes.shape({
    logIn: PropTypes.func.isRequired,
  }).isRequired,
};

export default EmbedEngine;
