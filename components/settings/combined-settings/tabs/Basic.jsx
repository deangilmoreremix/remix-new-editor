import React, { Fragment, useMemo } from 'react';

import { START, END, POPCORN_ELEMENT_TYPES } from '../../../../lib/constants/popcorn';
import PropTypes from '../../../../lib/PropTypes';

import FieldBuilder from '../../../form/FieldBuilder';
import LottieEditor from '../../../common/LottieEditor';

const Basic = ({ values, fields, onChange, element: elementData }) => {
  const ltItems = useMemo(() => {
    if (!values?.items.length) {
      return null;
    }
    return values?.items.filter(combinedItem => (
      combinedItem.type === POPCORN_ELEMENT_TYPES.JSON_ANIMATION
    ));
  }, [values?.items]);

  return (
    <Fragment>
      <div className="combined-settings__time">
        <div className="combined-settings__container">
          <FieldBuilder
            label={fields[START].label}
            type={fields[START].type}
            value={values[START] ?? fields[START].default}
            name={START}
            onChange={onChange}
            className="combined-settings__time-block"
            element={elementData}
          />
        </div>
        <div className="combined-settings__container">
          <FieldBuilder
            label={fields[END].label}
            type={fields[END].type}
            value={values[END] ?? fields[END].default}
            name={END}
            onChange={onChange}
            className="combined-settings__time-block"
            element={elementData}
          />
        </div>
      </div>
      {ltItems.length ? (
        ltItems.map(el => (
          <div className="combined-settings__lt" key={el.id}>
            <LottieEditor
              showPreview={false}
              file={el.url}
              setColor={colors => onChange({ colors, combinedItemId: el.id })}
              value={el.colors}
              key={el.id}
              formColorClassName="combined-settings__json-color"
              isLabel
            />
          </div>
        ))
      ) : null}
    </Fragment>
  );
};

Basic.propTypes = {
  values: PropTypes.shape({
    items: PropTypes.array.isRequired,
  }).isRequired,
  element: PropTypes.shape({
    id: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    popcornOptions: PropTypes.shape().isRequired,
    track: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]).isRequired,
  }).isRequired,
  fields: PropTypes.shape({
    start: PropTypes.shape({}),
    end: PropTypes.shape({}),
  }),
  onChange: PropTypes.func.isRequired,
};

export default Basic;
