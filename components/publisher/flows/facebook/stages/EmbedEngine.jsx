import * as React from 'react';

import PropTypes from '../../../../../lib/PropTypes';
import {
  DEFAULT,
  FACEBOOK_EMBED_LOCATIONS,
} from '../../../../../lib/constants/campaigns/constants';
import EmbedDataContainer from '../../../EmbedDataContainer';
import FormSelect from '../../../../form/FormSelect';

const EmbedEngine = ({ settings, project, updateCampaign }) => (
  <div className="embed-engine">
    <h5 className="embed-title">Where do you want to embed your video?</h5>
    <div className="embed-grid__layout">
      <div className="embed-group mb-3">

        <label className="cell row" htmlFor="embed-location-select">
          <div className="col-md-4">Embed Location</div>
          <div className="col-md-8">
            <FormSelect
              className=""
              labelClassName=""
              selectClassName=""
              value={settings.embedLocation.key}
              onChange={
                (value) => updateCampaign({
                  embedLocation: FACEBOOK_EMBED_LOCATIONS.find(item => item.key === value),
                })
              }
              items={
                FACEBOOK_EMBED_LOCATIONS.map(
                  ({ key, label }) => ({ value: key, label }),
                )
              }
            />
          </div>
        </label>
      </div>
      <div className="embed-group mb-3">
        <label className="cell row mb-2" htmlFor="preload-check">
          <div className="col-md-4">Preload</div>
          <div className="col-md-8">
            <div className="custom-checkbox">
              <input
                className="cell"
                type="checkbox"
                id="preload-check"
                checked={settings.preload}
                onChange={({ target: { checked } }) => updateCampaign({ preload: checked })}
              />
              <span className="label" />
            </div>
          </div>
        </label>
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
