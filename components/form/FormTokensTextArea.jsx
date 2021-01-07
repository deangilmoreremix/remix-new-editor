import React, { useEffect, useReducer, useState } from 'react';
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
    languageValidator,
    onCheckValue,
    validationProps,
  } = props;

  const [isHint, setIsHint] = useState(false);
  const [localValue, setLocalValue] = useState();

  // eslint-disable-next-line no-unused-vars
  const [ignored, forceUpdate] = useReducer(x => x + 1, 0);

  useEffect(() => {
    if (value) {
      setLocalValue(value);
    }
  }, []);

  const onEdit = ({ target: { value: v } }) => {
    setLocalValue(v);
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
    if (languageValidator && e.key.match(languageValidator)) {
      e.preventDefault();
    }
    if (variant !== MULTILINE && e.which === ENTER_KEY) {
      e.preventDefault();
    }
  };

  const handleShowHint = () => {
    if (labelHint) {
      setIsHint((prevIsHint) => !prevIsHint);
    }
  };

  const handleBlur = (event) => {
    let { target: { innerHTML: v } } = event;

    const text = unwrapTokens(v);
    const textLength = text.replace(/{{\w+}}/g, '').length;
    const caretOffset = catchCaretCharacterOffsetWithin(event);
    const err = onCheckValue ? onCheckValue(v, validationProps) : null;

    v = wrapTokens(v);

    if (labelHint) {
      setIsHint((prevIsHint) => !prevIsHint);
    }

    if ((v && onCheckValue && !err) || v === '' || !onCheckValue) {
      onChange(v);

      if ((maxTextSymbols && textLength <= maxTextSymbols) || !maxTextSymbols) {
        onChange(v, { [caretName]: caretOffset, [additionalFieldName]: text });
      } else {
        const length = v.length - textLength + maxTextSymbols;
        forceUpdate();
        onChange(v.slice(0, length), { [caretName]: caretOffset, [additionalFieldName]: text });
      }
    }
  };

  return (
    <div className={classnames('container-tokens-textarea', className)}>
      <div className={classnames(textClassName, { 'tokens-textarea-head': label || symbolsCount !== undefined })}>
        {label && <p>{label}</p>}
        {labelHint && isHint && <span className="label-input-hint">{labelHint}</span>}
        {maxTextSymbols !== undefined && symbolsCount !== undefined ? (<p>{`${symbolsCount} / ${maxTextSymbols}`}</p>) : null}
      </div>
      <ContentEditable
        className={classnames(inputClassName, 'text-area', variant)}
        tagName="pre"
        html={wrapTokens(localValue) || ''}
        onChange={onEdit}
        onClick={onClick}
        onPaste={pasteData}
        onFocus={handleShowHint}
        onBlur={handleBlur}
        onKeyPress={onKeyPress}
        disabled={disabled}
      />
    </div>
  );
});

FormTokensTextArea.propTypes = {
  onCheckValue: PropTypes.func,
  validationProps: PropTypes.shape({
    type: PropTypes.string.isRequired,
    isRequired: PropTypes.bool,
    message: PropTypes.string,
    validationType: PropTypes.string,
  }),
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
  languageValidator: PropTypes.instanceOf(RegExp),
};

FormTokensTextArea.defaultProps = {
  labelHint: '',
};

export default FormTokensTextArea;
