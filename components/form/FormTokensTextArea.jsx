import React, { useState } from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';
import ContentEditable from 'react-contenteditable';

import PropTypes from '../../lib/PropTypes';

import {
  wrapTokens,
  unwrapTokens,
  catchCaretCharacterOffsetWithin,
} from '../../lib/utils/tokens-helper';
import { ENTER_KEY } from '../../lib/constants/keyCodes';
import { MULTILINE } from '../../lib/constants/forms';


const FormTokensTextArea = observer((props) => {
  const {
    label,
    value,
    variant,
    onChange,
    className,
    caretName,
    updateCaret,
    textClassName,
    inputClassName,
    additionalFieldName,
    disabled,
    labelHint,
    maxTextSymbols,
    symbolsCount,
  } = props;

  const [isHint, setIsHint] = useState(false);

  const onEdit = async (e) => {
    let { target: { value: v } } = e;
    const text = unwrapTokens(v);
    const textLength = text.replace(/{{\w+}}/g, '').length;
    v = wrapTokens(v);
    const caretOffset = catchCaretCharacterOffsetWithin(e);
    if ((maxTextSymbols && textLength <= maxTextSymbols) || !maxTextSymbols) {
      onChange(v, { [caretName]: caretOffset, [additionalFieldName]: text });
    } else {
      const length = v.length - textLength + maxTextSymbols;
      await onChange(v, { [caretName]: caretOffset, [additionalFieldName]: text });
      onChange(v.slice(0, length), { [caretName]: caretOffset, [additionalFieldName]: text });
    }
  };

  const pasteData = (e) => {
    e.preventDefault();
    const sanitizingElem = document.createElement('DIV');
    sanitizingElem.innerHTML = (e.clipboardData || window.clipboardData).getData('text/plain');
    const pasteString = sanitizingElem.textContent || sanitizingElem.innerText || '';
    document.execCommand('insertHTML', false, wrapTokens(pasteString));
  };

  const onClick = (e) => {
    const caretOffset = catchCaretCharacterOffsetWithin(e);
    updateCaret({ [caretName]: caretOffset });
  };

  const onKeyPress = (e) => {
    if (variant !== MULTILINE && e.which === ENTER_KEY) {
      e.preventDefault();
    }
  };

  const handleShowHint = () => {
    if (labelHint) {
      setIsHint((prevIsHint) => !prevIsHint);
    }
  };

  return (
    <div className={classnames('container-tokens-textarea', className)}>
      <div className={classnames(textClassName, { 'tokens-textarea-head': label || symbolsCount !== undefined })}>
        {label && <p>{label}</p>}
        {labelHint && isHint && <span className="label-input-hint">{labelHint}</span>}
        {maxTextSymbols !== undefined && symbolsCount !== undefined ? (<p>{`${symbolsCount} / ${maxTextSymbols}`}</p>) : null}
        {!maxTextSymbols && symbolsCount !== undefined ? (<p>{symbolsCount}</p>) : null}
      </div>
      <ContentEditable
        className={classnames(inputClassName, 'text-area', variant)}
        tagName="pre"
        html={wrapTokens(value) || ''}
        onChange={onEdit}
        onClick={onClick}
        onPaste={pasteData}
        onFocus={handleShowHint}
        onBlur={handleShowHint}
        onKeyPress={onKeyPress}
        disabled={disabled}
      />
    </div>
  );
});

FormTokensTextArea.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string,
  variant: PropTypes.string,
  className: PropTypes.string,
  textClassName: PropTypes.string,
  inputClassName: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  additionalFieldName: PropTypes.string,
  updateCaret: PropTypes.func.isRequired,
  caretName: PropTypes.string,
  disabled: PropTypes.bool,
  labelHint: PropTypes.string,
  maxTextSymbols: PropTypes.number,
  symbolsCount: PropTypes.number,
};

FormTokensTextArea.defaultProps = {
  labelHint: '',
};

export default FormTokensTextArea;
