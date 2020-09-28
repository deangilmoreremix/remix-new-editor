import React, { Fragment, useEffect, useMemo, useState } from 'react';

import * as popcornConstants from '../../../../lib/constants/popcorn';
import { GOOGLE_MAP_VALUES } from '../../../../lib/constants/googleMap';
import PropTypes from '../../../../lib/PropTypes';

import FieldBuilder from '../../../form/FieldBuilder';

const Basic = ({ values, fields, onChange, element }) => {
  const [locationValue, setLocationValue] = useState();

  useEffect(() => {
    setLocationValue(values[popcornConstants.LOCATION]
      || fields[popcornConstants.LOCATION].default);
  }, [values[popcornConstants.LOCATION]]);

  const viewSettingStreet = useMemo(() => (
    values[popcornConstants.TYPE] === GOOGLE_MAP_VALUES.STREETVIEW
  ), [values[popcornConstants.TYPE]]);

  const changeLocation = (value) => {
    setLocationValue(value.location);
  };

  const updateLocation = (location) => {
    if (!location) {
      setLocationValue(fields[popcornConstants.LOCATION].default);
      return onChange({ location: fields[popcornConstants.LOCATION].default });
    }
    onChange({ location });
  };

  const typeValue = useMemo(() => {
    const valueType = values[popcornConstants.TYPE];
    const typeItems = fields[popcornConstants.TYPE].items;
    if (valueType === popcornConstants.POPCORN_ELEMENT_TYPES.GOOGLE_MAP || !valueType) {
      const result = typeItems.filter(item => item.value === fields[popcornConstants.TYPE].default);
      return result[0].value;
    }
    return valueType;
  }, [values[popcornConstants.TYPE]]);

  const transitionValue = useMemo(() => {
    const valueType = values[popcornConstants.TRANSITION];
    const typeItems = fields[popcornConstants.TRANSITION].items;
    if (!valueType) {
      const result = typeItems.filter(item => item.value
        === fields[popcornConstants.TRANSITION].default);
      return result[0].value;
    }
    return valueType;
  }, [values[popcornConstants.TRANSITION]]);

  return (
    <Fragment>
      <div className="map-settings__block">
        <div className="map-settings__time-wrapper">
          <FieldBuilder
            label={fields[popcornConstants.START].label}
            type={fields[popcornConstants.START].type}
            value={values[popcornConstants.START] || fields[popcornConstants.START].default}
            name={popcornConstants.START}
            onChange={onChange}
            className="map-settings__time"
            element={element}
          />
          <FieldBuilder
            label={fields[popcornConstants.END].label}
            type={fields[popcornConstants.END].type}
            value={values[popcornConstants.END] || fields[popcornConstants.END].default}
            name={popcornConstants.END}
            onChange={onChange}
            className="map-settings__time"
            element={element}
          />
        </div>
        <FieldBuilder
          label={fields[popcornConstants.ZOOM].label}
          type={fields[popcornConstants.ZOOM].type}
          value={values[popcornConstants.ZOOM]
            !== undefined ? values[popcornConstants.ZOOM] : fields[popcornConstants.ZOOM].default}
          name={popcornConstants.ZOOM}
          onChange={onChange}
          maxValue={fields[popcornConstants.ZOOM].maxValue}
          containerClassName="map-settings-slider-block"
          sliderClassName="video-settings-slider"
          inputClassName="video-settings-slider-input"
          labelClassName="map-settings-zoom-label"
        />
      </div>

      {viewSettingStreet ? (
        <div className="map-settings__block map-settings__numbers">
          <div>
            <FieldBuilder
              label={fields[popcornConstants.HEADING].label}
              type={fields[popcornConstants.HEADING].type}
              value={values[popcornConstants.HEADING]
              !== undefined ? values[popcornConstants.HEADING]
                : fields[popcornConstants.HEADING].default}
              name={popcornConstants.HEADING}
              onChange={onChange}
              inputClassName="map-setting-number"
            />
          </div>
          <FieldBuilder
            label={fields[popcornConstants.PITCH].label}
            type={fields[popcornConstants.PITCH].type}
            value={values[popcornConstants.PITCH]
            !== undefined ? values[popcornConstants.PITCH]
              : fields[popcornConstants.PITCH].default}
            name={popcornConstants.PITCH}
            onChange={onChange}
            inputClassName="map-setting-number"
          />
        </div>
      ) : null}

      <div className="map-settings__block map-settings__type">
        <div className="map-settings__block-child">
          <span className="map-settings__text">Map Type</span>
        </div>
        <FieldBuilder
          type={fields[popcornConstants.TYPE].type}
          value={typeValue}
          name={popcornConstants.TYPE}
          onChange={onChange}
          items={fields[popcornConstants.TYPE].items}
          className="map-settings-select"
        />
        <FieldBuilder
          type={fields[popcornConstants.FULLSCREEN].type}
          value={values[popcornConstants.FULLSCREEN]
            || fields[popcornConstants.FULLSCREEN].default}
          name={popcornConstants.FULLSCREEN}
          onChange={onChange}
          label={fields[popcornConstants.FULLSCREEN].label}
          floatClassName="map-settings-checkbox"
        />
      </div>

      <div className="map-settings__block">
        <div className="map-settings__block-child">
          <span className="map-settings__text">Location</span>
        </div>
        <FieldBuilder
          type={fields[popcornConstants.LOCATION].type}
          value={locationValue}
          name={popcornConstants.LOCATION}
          onChange={changeLocation}
          onEnter={updateLocation}
          className="map-settings-select"
        />
      </div>

      <div className="map-settings__block map-settings__transition">
        <div className="map-settings__block-child">
          <span className="map-settings__text">Transition</span>
        </div>
        <FieldBuilder
          type={fields[popcornConstants.TRANSITION].type}
          value={transitionValue}
          name={popcornConstants.TRANSITION}
          onChange={onChange}
          items={fields[popcornConstants.TRANSITION].items}
          className="map-settings-select"
        />
      </div>
    </Fragment>
  );
};

Basic.propTypes = {
  element: PropTypes.shape({
    id: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    popcornOptions: PropTypes.shape().isRequired,
    track: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]).isRequired,
  }).isRequired,
  values: PropTypes.shape({
    start: PropTypes.number,
    end: PropTypes.number,
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
