import React, { Fragment, useCallback, useMemo } from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../../../lib/PropTypes';

import FieldBuilder from '../../../form/FieldBuilder';

import PersonalizeButton from '../../../common/personalization/PersonalizeButton';

import { addToken, wrapTokens, wrapSvgTokens } from '../../../../lib/utils/tokens-helper';
import { TOKEN_FORMATS } from '../../../../lib/constants/tokens';

const Basic = observer(({ options, element, fields, onChange }) => {
  const {
    start,
    end,
    text,
    caretOffset,
    htmlText,
  } = options;

  const onAddTextToken = useCallback((token) => {
    const result = addToken(text, token, caretOffset);
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
          onChange={onChange}
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
  fields: PropTypes.shape({
    start: PropTypes.shape({}),
    end: PropTypes.shape({}),
    text: PropTypes.shape({}),
    htmlText: PropTypes.shape({}),
  }),
};

export default Basic;
