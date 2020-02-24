import React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import ReactTooltip from 'react-tooltip';
import { ChromePicker } from 'react-color';
import { PopupboxManager } from 'react-popupbox';
import {
  Alert,
  FormGroup,
  Input,
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
} from 'reactstrap';
import { computed, observable, action, runInAction, reaction } from 'mobx';

import PopcornEditor from '../editor.popcorn';
import ImageUpload from '../../../../components/common/ImageUpload';
import { errMaxSize2mb } from '../../../validators/projectValidator';
import InfiniteLoading from '../../../../components/common/InfiniteLoading';
import SVGTrash from '../../../../static/images/editor/elements/new/clear.svg';
import SVGUpload from '../../../../static/images/editor/elements/image/upload.svg';
import GoogleFontsLoader from '../../../../components/wizard/editor/GoogleFontsLoader';
import SVGLogoUpload from '../../../../static/images/editor/elements/form/logo-upload.svg';

const errorTypes = {
  webhook: 1,
  mailAddress: 2,
};
const popupIntegrationOptions = {
  contentName: 'integrationPopupContent',
  title: 'Set integrations',
};
const WEBHOOK_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/;
const EMAIL_REGEX = /^(([^<>()\[\]\\.,;:\s@']+(\.[^<>()\[\]\\.,;:\s@']+)*)|('.+'))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;


@observer
export default class FormEditor extends PopcornEditor {
  @observable dropdownFontOpen = false;

  @observable listDropdownRef;

  @observable listFontRefs = {};

  constructor(props) {
    super(props);

    const { element } = props;
    this.state = {
      showFontColorPicker: false,
      showBackgroundColorPicker: false,
    };
    this.integrationOptions = {
      webhook: element.webhook,
      emailAddress: element.emailAddress,
      emailEnabled: element.emailEnabled,
      webhookEnabled: element.webhookEnabled,
    };
    reaction(
      () => this.integrationOptions.emailEnabled,
      enabled => !enabled && this.unsetIntegrationFields('emailAddress'),
    );
    reaction(
      () => this.integrationOptions.webhookEnabled,
      enabled => !enabled && this.unsetIntegrationFields('webhook', true),
    );
    reaction(
      () => this.listDropdownRef && this.listDropdownRef.context.isOpen,
      (res) => {
        if (res) {
          const { element: { fontFamily } } = this.props;
          this.listFontRefs[fontFamily].scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      },
    );
  }

  onChange = key => (e) => {
    const value = e && e.target ? e.target.value : e;
    this.updateElement(key, value);
  };

  @action
  toggleDropdownFont = () => {
    this.dropdownFontOpen = !this.dropdownFontOpen;
  };

  @action
  setRefToItem = font => (element) => {
    this.listFontRefs[font] = element;
  };

  updateColor = (key, needRgb) => (color) => {
    const value = needRgb ? `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`
      : color.hex;
    this.updateElement(key, value);
  };

  onFileChange = key => (url) => {
    this.updateElement(key, url);
    PopupboxManager.close();
  };

  @action
  unsetIntegrationFields(key, isWebhook) {
    this.integrationOptions[key] = '';
    this.setValidationState(true, '', errorTypes[key])();
    if (isWebhook) {
      this.setValidationState();
    }
    this.updatePopup(popupIntegrationOptions);
  }

  validate(regexp, value) {
    let isValid = true;
    value.split(',').map(item => item.trim()).forEach((item) => {
      if (!regexp.test(item)) {
        isValid = false;
      }
    });
    return isValid;
  }

  integrationValidate = (regexp, key, textErr) => () => {
    const value = this.integrationOptions[key];
    if (!value || !this.validate(regexp, value)) {
      this.setValidationState()();
      this.setValidationState(true, textErr, errorTypes[key])();
    } else {
      this.setValidationState(true, null, errorTypes[key])();
    }
    this.updatePopup(popupIntegrationOptions);
  };

  openPopup = (content, text) => () => {
    PopupboxManager.open({
      content,
      config: {
        titleBar: {
          enable: true,
          text,
        },
        fadeIn: true,
        fadeInSpeed: 100,
      },
    });
  };

  @action
  appleIntegrationOptions = async () => {
    this.isLoading = true;
    this.updatePopup(popupIntegrationOptions);
    if (this.integrationOptions.emailEnabled) {
      if (!this.integrationOptions.emailAddress) {
        this.integrationOptions.emailEnabled = false;
      } else {
        this.integrationValidate(EMAIL_REGEX, 'emailAddress', 'EMAIL IS INVALID.')();
      }
    }
    if (this.validationState.error.value) {
      return;
    }
    if (this.integrationOptions.webhookEnabled) {
      if (!this.integrationOptions.webhook) {
        this.integrationOptions.webhookEnabled = false;
      } else {
        this.integrationValidate(WEBHOOK_REGEX, 'webhook', 'WEBHOOK URL IS INVALID.')();
      }
    }
    if (this.validationState.error.value) {
      return;
    }
    if (this.integrationOptions.webhookEnabled) {
      await this.testWebhook(false)();
    }
    if (this.validationState.error.value) {
      return;
    }

    this.updateMultiple({
      webhook: this.integrationOptions.webhook,
      emailEnabled: this.integrationOptions.emailEnabled,
      emailAddress: this.integrationOptions.emailAddress,
      webhookEnabled: this.integrationOptions.webhookEnabled,
    });
    this.setValidationState();
    this.setValidationState(true);
    PopupboxManager.close();
    runInAction(() => {
      this.isLoading = false;
    });
  };

  remove = () => {
    this.removeElement();
  };

  @action
  setValidationState = (isErr, text, type) => () => {
    if (isErr) {
      if (!text && this.validationState.error.type !== type) {
        return;
      }
      this.validationState.error = { type, value: text || null };
      return;
    }
    this.validationState.success = text || null;
  };

  updateState = options => (event) => {
    const { key, checkbox } = options;
    this.setState(
      prevState => ({ [key]: checkbox ? !prevState[key]
        : event && event.target && event.target.value }),
    );
  };

  @action
  testWebhook = (showLoading = true) => async () => {
    if (showLoading) {
      this.isWebhookLoading = true;
      this.updatePopup(popupIntegrationOptions);
    }
    try {
      await fetch(this.integrationOptions.webhook, {
        method: 'POST',
        body: JSON.stringify({
          EMAIL: 'john@doe.com',
          NAME: 'John Doe',
          MOBILE: '123-456-78-90',
        }),
      });
      if (this.validationState.error.type === errorTypes.webhook) {
        this.setValidationState(true)();
      }
      this.setValidationState(false, 'Webhook test successful.')();
    } catch (e) {
      this.setValidationState(false)();
      this.setValidationState(true, `Webhook test error: HTTP error ${e.status}`, errorTypes.webhook)();
    } finally {
      if (showLoading) {
        runInAction(() => {
          this.isWebhookLoading = false;
          this.updatePopup(popupIntegrationOptions);
        });
      }
    }
  };

  @action
  updateIntegration = options => (event) => {
    const { key, checkbox } = options;
    if (checkbox) {
      this.integrationOptions[key] = !this.integrationOptions[key];
    } else {
      this.integrationOptions[key] = event && event.target ? event.target.value : event;
    }
    this.updatePopup(popupIntegrationOptions);
  };

  updatePopup(options) {
    if (!options) {
      return;
    }
    PopupboxManager.update({ content: this[options.contentName],
      config: {
        titleBar: {
          enable: true,
          text: options.title,
        },
        fadeIn: true,
        fadeInSpeed: 100,
      } });
  }

  @computed
  get integrationPopupContent() {
    return (
      <React.Fragment>
        <div className="validation-state">
          <Alert
            className="alert-error"
            color="danger"
            isOpen={!!this.validationState.error.value}
          >
            {this.validationState.error.value}
          </Alert>
          <Alert
            className="alert-error"
            color="success"
            isOpen={!!this.validationState.success}
          >
            {this.validationState.success}
          </Alert>
        </div>
        <FormGroup className="webhook-options">
          <label className="popup-label" htmlFor="webhook-checkbox">
            <input
              id="webhook-checkbox"
              type="checkbox"
              className="popup-checkbox"
              checked={this.integrationOptions.webhookEnabled}
              onChange={this.updateIntegration({ key: 'webhookEnabled', checkbox: true })}
            />
            Webhook Call
          </label>
          <div className="editable-text">
            <p className="popup-label"> Webhook Address </p>
            <input
              id="webhook-value"
              type="text"
              value={this.integrationOptions.webhook}
              disabled={!this.integrationOptions.webhookEnabled}
              onChange={this.updateIntegration({ key: 'webhook' })}
              onBlur={this.integrationValidate(WEBHOOK_REGEX, 'webhook', 'WEBHOOK URL IS INVALID.')}
            />
          </div>
          { this.isWebhookLoading
            ? <InfiniteLoading />
            : (
              <button
                className="go-button submit-button"
                onClick={this.testWebhook()}
                disabled={
                      !this.integrationOptions.webhookEnabled || !this.integrationOptions.webhook
                      || this.validationState.error.type === errorTypes.webhook || this.isLoading}
              >
                    Test Webhook
              </button>
            )
            }
        </FormGroup>
        <FormGroup className="email-options">
          <label className="popup-label" htmlFor="email-checkbox">
            <input
              id="email-checkbox"
              type="checkbox"
              className="popup-checkbox"
              checked={this.integrationOptions.emailEnabled}
              onChange={this.updateIntegration({ key: 'emailEnabled', checkbox: true })}
            />
              Email Notification
          </label>
          <div className="editable-text">
            <p className="popup-label"> Email Address </p>
            <input
              id="email-value"
              type="text"
              value={this.integrationOptions.emailAddress}
              disabled={!this.integrationOptions.emailEnabled}
              onBlur={this.integrationValidate(EMAIL_REGEX, 'emailAddress', 'EMAIL IS INVALID.')}
              onChange={this.updateIntegration({ key: 'emailAddress' })}
            />
          </div>
        </FormGroup>
        { this.isLoading
          ? <InfiniteLoading />
          : (
            <button
              className="go-button submit-button"
              onClick={this.appleIntegrationOptions}
              data-tip="Save button options"
              disabled={this.validationState.error.value || this.isWebhookLoading}
            >
              Save
            </button>
          )
        }
      </React.Fragment>
    );
  }

  @computed
  get fontInputSize() {
    const { element: { fontFamily } } = this.props;

    if ((fontFamily === 'Palanquin') || (fontFamily === 'Palanquin Dark')
      || (fontFamily === 'Homemade Apple') || (fontFamily === 'Rock Salt')) {
      return '0.7rem';
    }
    return '1rem';
  }

  @observable integrationOptions = {};

  @observable validationState = {
    error: { value: null },
    success: null,
  };

  @observable isWebhookLoading = false;

  @observable isLoading = false;

  render() {
    const { element } = this.props;

    return (
      <div className="popcorn-editor text-editor">
        <ReactTooltip
          effect="solid"
        />
        <GoogleFontsLoader fonts={this.fonts} />
        <Dropdown isOpen={this.dropdownFontOpen} toggle={this.toggleDropdownFont}>
          <DropdownToggle className="font-input form-control" caret>
            <span style={{ fontFamily: `"${element.fontFamily}"`, fontSize: this.fontInputSize }}>
              {element.fontFamily}
            </span>
          </DropdownToggle>
          <DropdownMenu ref={(ref) => {
            this.listDropdownRef = ref;
          }}
          >
            <div className="scrolled">
              {this.fonts.map(font => (
                <DropdownItem
                  className={font === this.props.element.fontFamily ? 'select-item-font' : ''}
                  key={font}
                  onClick={() => this.updateElement('fontFamily', font)}
                >
                  <span ref={this.setRefToItem(font)} style={{ fontFamily: font }}>{font}</span>
                </DropdownItem>
              ))}
            </div>
          </DropdownMenu>
        </Dropdown>
        <Input
          className="font-size-input"
          type="number"
          value={element.fontSize}
          onChange={this.onChange('fontSize')}
          data-tip="Font size"
        />
        <div className="icon-group color-picker-button-container">
          <button
            className="color-picker-button"
            style={{ color: element.fontColor }}
            onClick={this.updateState({ key: 'showFontColorPicker', checkbox: true })}
            data-tip="Font color"
          >
              Txt
          </button>
        </div>
        { this.state.showFontColorPicker
          ? (
            <div className="color-picker">
              <div
                tabIndex="0"
                role="button"
                onClick={this.updateState({ key: 'showFontColorPicker', checkbox: true })}
                onKeyPress={this.updateState({ key: 'showFontColorPicker', checkbox: true })}
                className="color-picker-inner"
              />
              <ChromePicker
                color={this.parseRgba(element.fontColor)}
                onChangeComplete={this.updateColor('fontColor', true)}
              />
            </div>
          ) : null }
        <div className="icon-group color-picker-button-container">
          <button
            className="color-picker-button"
            style={{ color: element.backgroundColor || 'inherit' }}
            onClick={this.updateState({ key: 'showBackgroundColorPicker', checkbox: true })}
            data-tip="Background color"
          >
              Bkg
          </button>
        </div>
        { this.state.showBackgroundColorPicker
          ? (
            <div className="color-picker">
              <div
                tabIndex="0"
                role="button"
                onClick={this.updateState({ key: 'showBackgroundColorPicker', checkbox: true })}
                onKeyPress={this.updateState({ key: 'showBackgroundColorPicker', checkbox: true })}
                className="color-picker-inner"
              />
              <ChromePicker
                color={this.parseRgba(element.backgroundColor)}
                onChangeComplete={this.updateColor('backgroundColor')}
              />
            </div>
          ) : null }
        <SVGInline
          className="icon upload-icon"
          classSuffix=""
          svg={SVGUpload}
          cleanup={['title']}
          alt="Upload Background Image"
          onClick={
            this.openPopup(<ImageUpload
              onFileUploaded={this.onFileChange('backgroundImage')}
              onValidate={errMaxSize2mb}
              recommendedResolution={{ width: 1024, height: 1024 }}
              isModal
            />,
            'Upload a new background image')
          }
          data-tip="Upload/Replace background image"
        />
        <SVGInline
          className="icon upload-icon"
          classSuffix=""
          svg={SVGLogoUpload}
          cleanup={['title']}
          alt="Upload brand Logo Image"
          onClick={
            this.openPopup(<ImageUpload
              onFileUploaded={this.onFileChange('brandLogoSrc')}
              onValidate={errMaxSize2mb}
              recommendedResolution={{ width: 300, height: 100 }}
              isModal
            />,
            'Upload a new brand logo image')
          }
          data-tip="Upload/Replace brand logo image"
        />
        <div className="separator" />
        <div className="icon-group color-picker-button-container">
          <button
            className="color-picker-button"
            onClick={this.openPopup(this.integrationPopupContent, popupIntegrationOptions.title)}
            data-tip="Integration options"
          >
            Integrations
          </button>
        </div>
        <div className="separator" />
        <div className="icon-group">
          <SVGInline
            className="icon clear-icon"
            classSuffix=""
            svg={SVGTrash}
            cleanup={['title']}
            alt="Remove Element"
            onClick={this.remove}
            data-tip="Remove Lead Generator element"
          />
        </div>

      </div>);
  }
}

PopcornEditor.editors.form = FormEditor;
