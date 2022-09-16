import React, { Fragment, useCallback, useEffect, useState } from 'react';

import PropTypes from '../../../../lib/PropTypes';
import * as popcornConstants from '../../../../lib/constants/popcorn';
import { addToken, wrapTokens } from '../../../../lib/utils/tokens-helper';
import { imgTokenModes } from '../../../../lib/constants/tokens';

import FieldBuilder from '../../../form/FieldBuilder';
import FormSelect from '../../../form/FormSelect';
import PersonalizeButton from '../../../common/personalization/PersonalizeButton';

const Basic = ({ values, fields, element, onChange }) => {
  const {
    linkSrc,
    htmlUrl,
    src,
    htmlSrc,
    urlCaretOffset,
    start,
    end,
    title,
    rotation,
  } = values; 

  useEffect(() => {
    if (!src) {
      onChange({ src: fields.src.default, htmlSrc: wrapTokens(fields.src.default) });
    }
  }, [fields.src.default, onChange, src]);

  const onAddSrc = useCallback((token) => {
    onChange({ src: token, htmlSrc: wrapTokens(token) });
  }, [onChange]);

  const onAddUrlToken = useCallback((token) => {
    const result = addToken(linkSrc, token, urlCaretOffset);
    console.log(result,"result")
    onChange({ linkSrc: result, htmlUrl: wrapTokens(result) });
  }, [linkSrc, urlCaretOffset, onChange]);

  const [shape, setShape] = useState('portrait');

  const shapeList = [
    { label: 'Portrait', value: 'portrait' },
    { label: 'Oval', value: 'oval' },
    { label: 'Landscape', value: 'landscape' }
  ];

  const onShapeSelect = v => {
    const item = shapeList.find(shapeList => shapeList.value === v).value;
    setShape(item);
    onChange({
      imageshape:item
    })
  };

  // ToDo Add logic for transition button
  return (
    <Fragment>
      <div className="vrimage-settings__block vrimage-settings__block--time">
        <FieldBuilder
          {...fields.start}
          value={start || fields.start.default}
          name={popcornConstants.START}
          onChange={onChange}
          className="vrimage-settings__time"
          element={element}
        />
        <FieldBuilder
          {...fields.end}
          value={end || fields.end.default}
          name={popcornConstants.END}
          onChange={onChange}
          className="vrimage-settings__time"
          element={element}
        />
      </div>

      <div className="vrimage-settings__block">
        <div className="vrimage-settings__cell--first">
          <FormSelect
            {...fields.shape}
            label="Shape"
            name={popcornConstants.SHAPE}
            items={shapeList}
            className="text-to-speech__select"
            value={values['imageshape']}
            onChange={onShapeSelect}
          />
        </div>
      </div>

      <div className="vrimage-settings__block">
        <div className="vrimage-settings__cell--first">
          <FieldBuilder
            inputClassName="input-text-area"
            value={htmlSrc || ''}
            {...fields.htmlSrc}
            onChange={onChange}
            updateCaret={(value) => onChange({ srcCaretOffset: value })}
            className="vrimage-settings__field"
            disabled
          />
        </div>
        <div className="vrimage-settings__cell--second">
          <PersonalizeButton
            elementType={popcornConstants.POPCORN_ELEMENT_TYPES.IMAGE}
            text="Personalized Image"
            onAdd={onAddSrc}
            className="vrimage-settings__button"
            tokenModes={imgTokenModes}
          />
        </div>
      </div>

      <div className="vrimage-settings__block">
        <div className="vrimage-settings__cell--first">
          <FieldBuilder
            {...fields.title}
            value={title || fields.title.default}
            name={popcornConstants.TITLE}
            onChange={onChange}
            className="vrimage-settings__field"
          />
        </div>
      </div>

      <div className="vrimage-settings__block">
        <div className="vrimage-settings__cell--first">
          <FieldBuilder
            value={htmlUrl || ''}
            {...fields.htmlUrl}
            onChange={onChange}
            updateCaret={(value) => onChange({ urlCaretOffset: value })}
            className="vrimage-settings__field"
          />
        </div>
        <div className="vrimage-settings__cell--second">
          <PersonalizeButton
            onAdd={onAddUrlToken}
            className="vrimage-settings__button"
          />
        </div>
      </div>

      {/* <div className="vrimage-settings__block"> */}
      {/* <div className="vrimage-settings__btn--block"> */}
      {/* <p>Transition</p> */}
      {/* <button */}
      {/* className="vrimage-settings__button vrimage-settings__button--little"> */}
      {/* Open Library</button> */}
      {/* </div> */}
      {/* </div> */}

      <div className="vrimage-settings__block vrimage-settings__block--rotate">
        <FieldBuilder
          {...fields.rotation}
          value={rotation || fields.rotation.default}
          name={popcornConstants.ROTATION}
          onChange={onChange}
          className="vrimage-settings__rotation"
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
    linkSrc: PropTypes.string,
    title: PropTypes.string,
    src: PropTypes.string,
    rotation: PropTypes.number,
    htmlUrl: PropTypes.string,
    htmlSrc: PropTypes.string,
    urlCaretOffset: PropTypes.number,
  }),
  onChange: PropTypes.func.isRequired,
  fields: PropTypes.shape({
    start: PropTypes.shape({
      type: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      default: PropTypes.number,
    }),
    end: PropTypes.shape({
      type: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      default: PropTypes.number,
    }),
    src: PropTypes.shape({
      type: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      default: PropTypes.string.isRequired,
    }),
    title: PropTypes.shape({
      type: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      default: PropTypes.string,
    }),
    rotation: PropTypes.shape({
      type: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      default: PropTypes.number.isRequired,
    }),
    linkSrc: PropTypes.shape({
      type: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
    htmlUrl: PropTypes.shape({}),
    htmlSrc: PropTypes.shape({
      default: PropTypes.string,
    }),
  }),
  closeModal: PropTypes.func,
};

export default Basic;
