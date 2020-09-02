import React, { Fragment, useCallback, useMemo } from 'react';

import { FB_PLUGINS } from '../../../../lib/constants/settings/social';
import {
  SOCIAL_TYPES,
  TYPE,
  START,
  END,
  HREF,
  EDITOR_WIDTH,
  EDITOR_HEIGHT,
  BACKGROUND,
} from '../../../../lib/constants/popcorn';
import PropTypes from '../../../../lib/PropTypes';

import FieldBuilder from '../../../form/FieldBuilder';
import DefaultBasic from '../../default-tabs/Basic';

const Basic = ({ values, fields, onChange }) => {
  const pluginType = useMemo(() => values.type || SOCIAL_TYPES.FB_LIKE, [values]);

  const pluginTitle = useMemo(() => (
    FB_PLUGINS[values.type] && FB_PLUGINS[values.type].title
      ? FB_PLUGINS[values.type].title : FB_PLUGINS[pluginType].title
  ), [FB_PLUGINS[values.type]]);

  const removeBackground = useCallback(() => {
    onChange({ background: 'rgb(255, 255, 255, 0)' });
  }, []);

  return (
    <Fragment>
      <DefaultBasic
        fields={{
          [START]: { ...fields[START] },
          [END]: { ...fields[END] },
        }}
        options={values}
        onChange={onChange}
        containerClass="social-settings__block"
      />

      <p className="social-settings__warning">
        {`For "${pluginTitle}" we use Facebook plugins. The dimensions in the editor and player may differ on different devices. Please be careful.`}
      </p>

      <DefaultBasic
        fields={{
          [TYPE]: { ...fields[TYPE] },
          [HREF]: { ...fields[HREF] },
        }}
        options={values}
        onChange={onChange}
      />

      {
        pluginType !== SOCIAL_TYPES.FB_PAGE && pluginType !== SOCIAL_TYPES.FB_POST && (
          <FieldBuilder
            type={fields[BACKGROUND].type}
            label={fields[BACKGROUND].label}
            value={values[BACKGROUND] || fields[BACKGROUND].default}
            name={BACKGROUND}
            onChange={onChange}
            allowReset={removeBackground}
            resetText="Remove background"
            {...fields[BACKGROUND]}
          />
        )
      }

      {
        (pluginType !== SOCIAL_TYPES.FB_LIKE) && (
          <FieldBuilder
            type={fields[EDITOR_WIDTH].type}
            label={fields[EDITOR_WIDTH].label}
            value={values[EDITOR_WIDTH] || FB_PLUGINS[pluginType].width}
            name={EDITOR_WIDTH}
            onChange={onChange}
            minValue={FB_PLUGINS[pluginType].minWidth}
            maxValue={FB_PLUGINS[pluginType].maxWidth}
            containerClassName="social-settings-slider-block"
            sliderClassName="video-settings-slider"
            inputClassName="video-settings-slider-input"
            labelClassName="map-settings-zoom-label"
          />
        )
      }

      {
       (values.type === SOCIAL_TYPES.FB_PAGE || values.type === SOCIAL_TYPES.FB_COMMENTS) && (
       <FieldBuilder
         type={fields[EDITOR_HEIGHT].type}
         label={fields[EDITOR_HEIGHT].label}
         value={values[EDITOR_HEIGHT] || FB_PLUGINS[pluginType].height}
         name={EDITOR_HEIGHT}
         onChange={onChange}
         minValue={FB_PLUGINS[pluginType].minHeight}
         maxValue={FB_PLUGINS[pluginType].maxHeight}
         containerClassName="social-settings-slider-block"
         sliderClassName="video-settings-slider"
         inputClassName="video-settings-slider-input"
         labelClassName="map-settings-zoom-label"
       />
       )
      }

      {
        pluginType === SOCIAL_TYPES.FB_COMMENTS && (
          <p className="social-settings__warning">
            {`The height of ${pluginTitle} is calculated in relation to the height of the player.`}
          </p>
        )
      }
    </Fragment>
  );
};

Basic.propTypes = {
  values: PropTypes.shape({
    start: PropTypes.number,
    end: PropTypes.number,
    title: PropTypes.string,
    zoom: PropTypes.number,
    heading: PropTypes.number,
    pitch: PropTypes.number,
    type: PropTypes.string,
    fullscreen: PropTypes.bool,
    location: PropTypes.string,
    transition: PropTypes.arrayOf(PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
    })),
  }),
  fields: PropTypes.shape({
    start: PropTypes.shape({
      type: PropTypes.string,
      label: PropTypes.string,
    }),
    end: PropTypes.shape({
      type: PropTypes.string,
      label: PropTypes.string,
    }),
    zoom: PropTypes.shape({
      default: PropTypes.number,
      label: PropTypes.string,
      maxValue: PropTypes.number,
      step: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number,
      ]),
      type: PropTypes.string,
    }),
    fullscreen: PropTypes.shape({
      default: PropTypes.bool,
      label: PropTypes.string,
      type: PropTypes.string,
    }),
    heading: PropTypes.shape({
      default: PropTypes.number,
      label: PropTypes.string,
      type: PropTypes.string,
    }),
    location: PropTypes.shape({
      default: PropTypes.string,
      label: PropTypes.string,
      type: PropTypes.string,
    }),
    pitch: PropTypes.shape({
      default: PropTypes.number,
      label: PropTypes.string,
      type: PropTypes.string,
    }),
    transition: PropTypes.shape({
      default: PropTypes.string,
      items: PropTypes.arrayOf(PropTypes.shape({
        label: PropTypes.string.isRequired,
        value: PropTypes.string.isRequired,
      })),
      label: PropTypes.string,
      type: PropTypes.string,
    }),
    type: PropTypes.shape({
      default: PropTypes.string,
      items: PropTypes.arrayOf(PropTypes.shape({
        label: PropTypes.string.isRequired,
        value: PropTypes.string.isRequired,
      })),
      label: PropTypes.string,
      type: PropTypes.string,
    }),
  }),
  onChange: PropTypes.func,
};

export default Basic;
