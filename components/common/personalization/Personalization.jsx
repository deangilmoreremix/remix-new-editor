import React, { useState, useRef, useEffect } from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';

import { tokenModes as modes, INPUT_PLACEHOLDER, CUSTOM, TOKEN_WINDOW_TITLE } from '../../../lib/constants/tokens';
import FormTextField from '../../form/FormTextField';
import HelpIconComponent from '../HelpIcon';
import { CloseButton } from '../CloseButton';

import svgCogWheel from '../../../public/static/images/cogwheel.svg';

import { formatToken } from '../../../lib/utils/tokens-helper';
import { personalizeTooltips } from '../../../lib/constants/tooltips';


const Personalization = ({ closeModal, tokenList, onAdd, tokenModes }) => {
  const [token, setToken] = useState(tokenList[0]);
  const [customToken, setCustomToken] = useState(CUSTOM);
  const [tokenState, setTokenState] = useState(tokenModes.plain);
  const [disabled, setDisabled] = useState(true);
  const [fallbackValue, setFallbackValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setDisabled(tokenState !== tokenModes.fallbackValue);
  }, [tokenState]);

  useEffect(() => {
    if (!disabled) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const addToken = React.useCallback(() => {
    const tokenValue = token === CUSTOM ? customToken : token;
    const tokenString = formatToken(tokenValue.replace(/\s/g, '').toUpperCase(),
      tokenState, !disabled && fallbackValue);
    onAdd(tokenString);
    closeModal();
  }, [closeModal, customToken, disabled, fallbackValue, onAdd, token, tokenState]);

  return (
    <div className="personalization">
      <div className="personalization__wrapper">
        <div className="personalization__header">
          <p className="personalization__header__title">{TOKEN_WINDOW_TITLE}</p>
          <CloseButton onClick={closeModal} />
        </div>

        <div className="personalization__body">
          <div className={classnames('personalization__list', { personalization__list__border: tokenList.length > 9 })}>
            {
              tokenList.map((item) => (
                <div key={item} className="personalization__items">
                  <SVGInline
                    className={classnames('radio-button-icon', { personalization__svg__active: token === item })}
                    svg={svgCogWheel}
                    cleanup={['title']}
                  />
                  <button
                    type="button"
                    className={classnames('personalization__item', { 'personalization__item-active': token === item })}
                    onClick={() => setToken(item)}
                  >
                    {item}
                  </button>
                </div>
              ))
            }
          </div>

          <div className="personalization__info">
            <div>
              {
                tokenList.length > 1 ? (
                  <div>
                    {
                  token === CUSTOM ? (
                    <FormTextField
                      name="text"
                      inputClassName="personalization__input__image"
                      type="input"
                      value={customToken}
                      onChange={(v) => setCustomToken(v)}
                    />
                  )
                    : <p className="personalization__name">{token}</p>
                }
                  </div>
                )
                  : (
                    <FormTextField
                      name="text"
                      inputClassName="personalization__input__image"
                      type="input"
                      value={token}
                      onChange={(v) => setToken(v)}
                    />
                  )
              }

              <div className="personalization__item__right">
                {
                  Object.keys(tokenModes).map((item) => (
                    <div
                      key={tokenModes[item]}
                      className={classnames('personalization__item__container', { 'item-fallback': item === 'fallbackValue' })}
                    >
                      <button
                        type="button"
                        className={classnames('personalization__item', { 'personalization__item-active': tokenState === tokenModes[item] })}
                        onClick={() => setTokenState(tokenModes[item])}
                      >
                        {tokenModes[item]}
                      </button>
                      {item === 'fallbackValue'
                      && (
                        <>
                          <HelpIconComponent
                            noPadding
                            message={personalizeTooltips.fallbackValue}
                          />
                          <input
                            className="personalization__input"
                            type="text"
                            disabled={disabled}
                            ref={inputRef}
                            placeholder={INPUT_PLACEHOLDER}
                            value={fallbackValue}
                            onChange={(e) => { setFallbackValue(e.target.value); }}
                          />
                        </>
                      )}
                    </div>
                  ))
                }
              </div>

            </div>
            <button className="personalization__add" type="button" onClick={addToken}>+ add</button>
          </div>
        </div>
      </div>
    </div>
  );
};

Personalization.propTypes = {
  closeModal: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
  tokenList: PropTypes.arrayOf(PropTypes.string),
  tokenModes: PropTypes.shape({
    plain: PropTypes.string,
    fallbackValue: PropTypes.string,
    uppercase: PropTypes.string,
  }),
};

Personalization.defaultProps = {
  tokenModes: modes,
};

export default Personalization;
