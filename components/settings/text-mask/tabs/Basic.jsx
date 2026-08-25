import React, { Fragment, useCallback, useMemo } from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../../lib/PropTypes';

import FieldBuilder from '../../../form/FieldBuilder';

import PersonalizeButton from '../../../common/personalization/PersonalizeButton';

import { addToken, wrapTokens, wrapSvgTokens } from '../../../../lib/utils/tokens-helper';
import { TOKEN_FORMATS } from '../../../../lib/constants/tokens';
import { MAX_LENGTH_TEXT_MASK } from '../../../../lib/constants/text-info';
import { TYPES, VALIDATION_TYPES } from '../../../../lib/constants/validator';
import withValidation from '../../../hoc/withValidation';

const Basic = observer(({ options, element, fields, onChange, checkValue }) => {
  const {
    start,
    end,
    text,
    caretOffset,
    htmlText,
  } = options;

  const onAddTextToken = useCallback((token) => {
    const result = addToken(text, token, caretOffset);
    checkValue(result,
      {
        type: TYPES.MAX_TEXT_LENGTH,
        message: MAX_LENGTH_TEXT_MASK.text,
        validationType: VALIDATION_TYPES.WARNING,
      });
    onChange({ text: result, htmlText: wrapSvgTokens(result) });
  }, [text, caretOffset, onChange]);

  const textToRender = useMemo(() => {
    if (htmlText !== undefined) {
      return htmlText;
    } else if (htmlText === undefined && text !== undefined) {
      return wrapTokens(text);
    } else {
      return fields.htmlText.default;
    }
  }, [htmlText, text, fields]);

  const handleChange = (value, otherOptions) => {
    checkValue(otherOptions.text,
      {
        type: TYPES.MAX_TEXT_LENGTH,
        message: MAX_LENGTH_TEXT_MASK.text,
        validationType: VALIDATION_TYPES.WARNING,
      });
    onChange(value, otherOptions);
  };

  return (
    <Fragment>
      <div className="time-section">
        <FieldBuilder
          value={start || fields.start.default}
          {...fields.start}
          element={element}
          className="input-time-position"
          onChange={onChange}
        />
        <FieldBuilder
          value={end || fields.end.default}
          {...fields.end}
          element={element}
          className="input-time-position"
          onChange={onChange}
        />
      </div>
      <div className="text-section">
        <FieldBuilder
          className="input-textarea-container"
          inputClassName="input-text-area"
          value={textToRender}
          {...fields.htmlText}
          onChange={handleChange}
          updateCaret={(value) => onChange({ caretOffset: value })}
          tokenType={TOKEN_FORMATS.SVG}
        />
      </div>
      <PersonalizeButton onAdd={onAddTextToken} />
    </Fragment>
  );
});

Basic.propTypes = {
  options: PropTypes.shape({
    start: PropTypes.number,
    end: PropTypes.number,
    htmlText: PropTypes.string,
  }),
  onChange: PropTypes.func.isRequired,
  checkValue: PropTypes.func.isRequired,
  fields: PropTypes.shape({
    start: PropTypes.shape({}),
    end: PropTypes.shape({}),
    text: PropTypes.shape({}),
    htmlText: PropTypes.shape({}),
  }),
};

export default withValidation(Basic);
