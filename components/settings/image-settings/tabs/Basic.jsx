import React, { Fragment, useState, useMemo } from 'react';
import SVGInline from 'react-svg-inline';
import { observer } from 'mobx-react';

import DropButton from '../../../media/DropButton';
import FieldBuilder from '../../../form/FieldBuilder';
import SetAsDefaultCheckbox from '../../default-settings/SetAsDefaultCheckbox';

import useUIStore from '../../../hooks/useUIStore';
import useUserStore from '../../../hooks/useUserStore';
import useModalStore from '../../../hooks/useModalStore';
import useProjectStore from '../../../hooks/useProjectStore';

import { FEATURES } from '../../../../lib/constants/features';
import { LIBRARY_TABS } from '../../../../lib/constants/library';
import * as popcornConstants from '../../../../lib/constants/popcorn';
import { TUI_IMAGE_EDITOR_MODAL } from '../../../../lib/constants/modals';
import { INITIAL_VALUES } from '../../../../lib/constants/settings/image';
import { EXTRA_MENU } from '../../../../lib/constants/imageEditor/tuiEditor';

import arrowIcon from '../../../../public/static/images/arrow-red.svg';

import PropTypes from '../../../../lib/PropTypes';

import { HINTS } from '../../../../lib/constants/text-info';
import withValidation from '../../../hoc/withValidation';

const Basic = observer(({
  values,
  fields,
  onChange,
  handleClose,
  checkValue,
  element: elementData,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { setLibraryType, setUpdateElementInLibrary, openAnimation } = useUIStore();
  const { findAndUpdate, element } = useProjectStore();
  const {
    currentUser: user,
    isfeatureEnabled: checkStateFeature,
    clickToPhoneCall,
  } = useUserStore();
  const { openImageEditor, closeModal } = useModalStore();

  const backToLibrary = () => {
    handleClose();
    setUpdateElementInLibrary(element.id);
    setLibraryType(LIBRARY_TABS.IMAGE);
  };

  const onChangeWithValidation = (v, error) => {
    if (!error) {
      onChange(v);
    }
  };

  const selectImage = (item) => {
    findAndUpdate(element.id, { ...INITIAL_VALUES, ...item, src: item.url });
  };

  const onImageEdited = (image) => {
    findAndUpdate(element.id, { ...INITIAL_VALUES, src: image });
    closeModal(TUI_IMAGE_EDITOR_MODAL);
  };

  const hint = useMemo(() => (clickToPhoneCall ? HINTS.LINK_URL_PHONE : HINTS.LINK_URL));

  // ToDo add select field "Select the kind of Image you want to add"
  return (
    <Fragment>
      <div className="image-settings__block">
        <div className="image-settings__cell--first">
          <FieldBuilder
            label={fields[popcornConstants.TITLE].label}
            type={fields[popcornConstants.TITLE].type}
            value={values[popcornConstants.TITLE] || fields[popcornConstants.TITLE].default}
            name={popcornConstants.TITLE}
            onChange={onChange}
            labelClassName="image-settings__label--input"
            className="image-settings__field"
          />
          {values.kind !== popcornConstants.BLEND_MODE && (
            <FieldBuilder
              {...fields[popcornConstants.CALL_NOTIFY_ADDRESS]}
              value={
                values[popcornConstants.CALL_NOTIFY_ADDRESS]
                || fields[popcornConstants.CALL_NOTIFY_ADDRESS].default
              }
              onChange={onChangeWithValidation}
              checkValue={checkValue}
            />
          )}
        </div>
        <div className="image-settings__cell--second">
          <button className="image-settings__back" onClick={backToLibrary}>
            <SVGInline
              className="image-settings__arrow"
              svg={arrowIcon}
              cleanup={['arrow']}
            />
            <span>Back to Library</span>
          </button>
          <DropButton
            isArea
            onUploaded={selectImage}
            mediaType={LIBRARY_TABS.IMAGE}
            multiple={false}
            startUpload={() => setIsLoading(true)}
            endUpload={() => setIsLoading(false)}
            isDisabled={isLoading}
            isArrows={false}
            value={element.popcornOptions.src}
          />
        </div>
      </div>

      {values.kind !== popcornConstants.BLEND_MODE && (
        <div className="image-settings__block">
          <div className="image-settings__cell--first">
            <FieldBuilder
              {...fields[popcornConstants.LINKSRC]}
              labelHint={hint}
              label={user
              && user.features
              && checkStateFeature(FEATURES.REVOLUTION_CLICK_TO_PHONE_CALL)
                ? popcornConstants.LABEL_CLICK_TO_PHONE : fields[popcornConstants.LINKSRC].label}
              value={values[popcornConstants.LINKSRC] || fields[popcornConstants.LINKSRC].default}
              onChange={onChangeWithValidation}
              checkValue={checkValue}
            />
          </div>
        </div>
      )}

      <div className="image-settings__block">
        <FieldBuilder
          label={fields[popcornConstants.START].label}
          type={fields[popcornConstants.START].type}
          value={values[popcornConstants.START] || fields[popcornConstants.START].default}
          name={popcornConstants.START}
          onChange={onChange}
          className="image-settings__time"
          element={elementData}
        />
        <FieldBuilder
          label={fields[popcornConstants.END].label}
          type={fields[popcornConstants.END].type}
          value={values[popcornConstants.END] || fields[popcornConstants.END].default}
          name={popcornConstants.END}
          onChange={onChange}
          className="image-settings__time"
          element={elementData}
        />
        <div className="image-settings__btn--block image-settings__btn--transition">
          <div className="image-settings__btn--wrapper">
            <p>Transition</p>
            <button
              className="image-settings__btn"
              onClick={openAnimation}
            >
              Open Library
            </button>
          </div>
        </div>
      </div>

      <div className="image-settings__block">
        <FieldBuilder
          label={fields[popcornConstants.ROTATION].label}
          type={fields[popcornConstants.ROTATION].type}
          value={values[popcornConstants.ROTATION] || fields[popcornConstants.ROTATION].default}
          name={popcornConstants.ROTATION}
          onChange={onChange}
          className="image-settings__rotation"
        />
        <FieldBuilder
          label={fields[popcornConstants.CORNER_RADIUS].label}
          type={fields[popcornConstants.CORNER_RADIUS].type}
          value={
            values[popcornConstants.CORNER_RADIUS] ?? fields[popcornConstants.CORNER_RADIUS].default
          }
          name={popcornConstants.CORNER_RADIUS}
          onChange={onChange}
          floatClassName="image-settings__checkbox"
        />
      </div>

      <div className="image-settings__block">
        <div className="image-settings__btn--block">
          <button
            className="image-settings__btn"
            onClick={() => {
              openImageEditor({
                src: element.popcornOptions.src,
                onImageEdited,
                startUpload: () => setIsLoading(true),
                endUpload: () => setIsLoading(false),
                menu: EXTRA_MENU,
              });
            }}
            disabled={isLoading}
          >
            Image Editor
          </button>
        </div>
      </div>
      <FieldBuilder
        label={fields[popcornConstants.FILL].label}
        type={fields[popcornConstants.FILL].type}
        value={values[popcornConstants.FILL]}
        name={popcornConstants.FILL}
        onChange={onChange}
        floatClassName="image-settings__checkbox"
      />
      <SetAsDefaultCheckbox
        floatClassName="image-settings__checkbox"
      />
    </Fragment>
  );
});

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
    [popcornConstants.START]: PropTypes.number,
    [popcornConstants.END]: PropTypes.number,
    [popcornConstants.LINKSRC]: PropTypes.string,
    [popcornConstants.TITLE]: PropTypes.string,
    [popcornConstants.CALL_NOTIFY_ADDRESS]: PropTypes.string,
    [popcornConstants.ROTATION]: PropTypes.number,
    [popcornConstants.CORNER_RADIUS]: PropTypes.bool,
    kind: PropTypes.string,
  }),
  onChange: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
  checkValue: PropTypes.func.isRequired,
  fields: PropTypes.shape({
    [popcornConstants.START]: PropTypes.shape({
      type: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      default: PropTypes.number.isRequired,
    }),
    [popcornConstants.END]: PropTypes.shape({
      type: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      default: PropTypes.number,
    }),
    [popcornConstants.LINKSRC]: PropTypes.shape({
      type: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      default: PropTypes.string.isRequired,
    }),
    [popcornConstants.TITLE]: PropTypes.shape({
      type: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      default: PropTypes.string.isRequired,
    }),
    [popcornConstants.CALL_NOTIFY_ADDRESS]: PropTypes.shape({
      type: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      default: PropTypes.string.isRequired,
    }),
    [popcornConstants.ROTATION]: PropTypes.shape({
      type: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      default: PropTypes.number.isRequired,
    }),
    [popcornConstants.CORNER_RADIUS]: PropTypes.shape({
      type: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      default: PropTypes.bool.isRequired,
    }),
  }),
};

export default withValidation(Basic);
