import React from 'react';
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
  } = props;

  const onEdit = (e) => {
    let { target: { value: v } } = e;
    const text = unwrapTokens(v);
    v = wrapTokens(v);
    const caretOffset = catchCaretCharacterOffsetWithin(e);
    onChange(v, { [caretName]: caretOffset, [additionalFieldName]: text });
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

  return (
    <div className={classnames('container-tokens-textarea', className)}>
      {label && <p className={classnames('text-area-label', textClassName)}>{label}</p>}
      <ContentEditable
        className={classnames(inputClassName, 'text-area', variant)}
        tagName="pre"
        html={wrapTokens(value) || ''}
        onChange={onEdit}
        onClick={onClick}
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
};

export default FormTokensTextArea;
