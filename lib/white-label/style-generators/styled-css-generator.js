/**
 * Created by Eugene Butusov on 29/11/2018.
 */

export default (id, brandLogo, theme) => `
.theme-${id} .timeline-slider .MuiSlider-thumb:before,
.theme-${id} .checkmark.checked .MuiIconButton-label::after,
.theme-${id} .slider-element .MuiSlider-track,
.theme-${id} .img-size-settings .base-button,
.theme-${id} .text-to-speech .radio-button-icon.icon-svg-checked:after,
.theme-${id} .library-voice-filter__types .radio-button-icon.icon-svg-checked:after,
.theme-${id} .library__item-delete {
  background-color: ${theme.primaryColor};
}

.theme-${id} .MuiSwitch-track,
.theme-${id} .base-editor .base-editor-elements::-webkit-scrollbar-thumb,
.theme-${id} .library__body::-webkit-scrollbar-thumb,
.theme-${id} .elements-panel-container::-webkit-scrollbar-thumb,
.theme-${id} .select-element .select__menu .select__menu-list::-webkit-scrollbar-thumb,
.theme-${id} .library__items::-webkit-scrollbar-thumb,
.theme-${id} .produce-block::-webkit-scrollbar-thumb,
.theme-${id} .generator-body::-webkit-scrollbar-thumb,
.theme-${id} .layers::-webkit-scrollbar-thumb,
.theme-${id} .list-items::-webkit-scrollbar-thumb,
.theme-${id} .stickers-content::-webkit-scrollbar-thumb,
.theme-${id} .personalization__list::-webkit-scrollbar-thumb,
.theme-${id} .text-to-speech__content::-webkit-scrollbar-thumb,
.theme-${id} .project-data-list::-webkit-scrollbar-thumb,
.theme-${id} textarea::-webkit-scrollbar-thumb,
.theme-${id} .lower-thirds-content::-webkit-scrollbar-thumb {
  background-color: ${theme.primaryColor} !important;
}

.theme-${id} .menu-app-bar .container-menu .icon-button.active-save,
.theme-${id} .expandButton-active,
.theme-${id} .menu-app-bar .container-menu .icon-button.active,
.theme-${id} .header-tabs__item--active,
.theme-${id} .library__tab-active,
.theme-${id} .produce__tab-active,
.theme-${id} .library__btn-active p,
.theme-${id} .library__placeholder span,
.theme-${id} a.library__block--title:hover,
.theme-${id} .select-element .select__indicators .select__dropdown-indicator,
.theme-${id} .stickers__header,
.theme-${id} .recorder__header,
.theme-${id} .social-settings__warning,
.theme-${id} .lower-thirds__header,
.theme-${id} .overlay__header,
.theme-${id} .overlay__tab-active,
.theme-${id} .view-project-window__header,
.theme-${id} .library-cta__header,
.theme-${id} .blendmode-library__header,
.theme-${id} .personalization__header,
.theme-${id} .personalization__close,
.theme-${id} .personalization__close:hover,
.theme-${id} .personalization__info .personalization__item-active,
.theme-${id} .personalization__info .personalization__item:hover,
.theme-${id} .personalization__item-active,
.theme-${id} .personalization__items:hover .personalization__item,
.theme-${id} .text-to-speech__title,
.theme-${id} .text-to-speech__notification span,
.theme-${id} .gif-library__header {
  color: ${theme.primaryColor};
}

.theme-${id} .MuiCheckbox-colorSecondary.Mui-checked {
  color: ${theme.primaryColor} !important;
}

.theme-${id} .menu__item:hover,
.theme-${id} .generator-offer__yes,
.theme-${id} .canvas-size-item.active,
.theme-${id} .btn-personalize,
.theme-${id} .btn-library,
.theme-${id} .btn-upload,
.theme-${id} .btn-custom,
.theme-${id} .angle-circle__line,
.theme-${id} .angle-circle:before,
.theme-${id} .select-element .select__menu .select__menu-list .select__option:hover,
.theme-${id} .stickers-tab-active,
.theme-${id} .retarget-form .brand-logo-container .upload-container .button-add-file,
.theme-${id} .lead-form .brand-logo-container .upload-container .button-add-file,
.theme-${id} .addfield-container-button,
.theme-${id} .image-settings__btn,
.theme-${id} .color-reset-button,
.theme-${id} .overlay__use,
.theme-${id} .view-project-window__use,
.theme-${id} .library__items--audio .library__item-use,
.theme-${id} .video-transition-btn.merge,
.theme-${id} .video-transition-btn.apply,
.theme-${id} .personalization__add:hover,
.theme-${id} .library-voice-filter__btn,
.theme-${id} button.generator-use {
  background: ${theme.primaryColor};
}

.theme-${id} .checkmark .MuiIconButton-label:hover,
.theme-${id} .canvas-size-selector .canvas-size-item:hover,
.theme-${id} .checkmark.checked .MuiIconButton-label,
.theme-${id} button[type='button'].canvas-size-item:hover,
.theme-${id} .text-input:hover,
.theme-${id} .blend-mode-select .menu__open:after,
.theme-${id} .library__add,
.theme-${id} .library__search,
.theme-${id} .produce-panel__icon,
.theme-${id} .react-tagsinput:hover,
.theme-${id} .time-input,
.theme-${id} .container-tokens-textarea .text-area:focus,
.theme-${id} .select-element .select__control:hover,
.theme-${id} .angle-circle,
.theme-${id} .stickers-tab,
.theme-${id} .elements .react-grid-item,
.theme-${id} .popcorn-text.active .resize-handle,
.theme-${id} .container-textarea textarea:hover,
.theme-${id} textarea.text-input:focus, textarea.text-input:hover,
.theme-${id} .overlay-container,
.theme-${id} .input-background-time:hover input,
.theme-${id} .input-time-start:hover input,
.theme-${id} .input-loop-start:hover input,
.theme-${id} .input-loop-end:hover input,
.theme-${id} .view-project-window__container,
.theme-${id} .button-add-file__label,
.theme-${id} .gif-library__input,
.theme-${id} .img-size-settings .border-button,
.theme-${id} .library-cta-item:hover .inner-wrapper,
.theme-${id} .personalization__info .personalization__item-active:before,
.theme-${id} .personalized-token,
.theme-${id} .personalization__add,
.theme-${id} .text-to-speech .btn-custom.btn-open-library,
.theme-${id} .text-to-speech .radio-button-icon.icon-svg-checked,
.theme-${id} .text-to-speech .MuiIconButton-label:hover .radio-button-icon,
.theme-${id} .library-voice-filter__types .radio-button-icon.icon-svg-checked,
.theme-${id} .library-voice-filter__types .MuiIconButton-label:hover .radio-button-icon,
.theme-${id} .recorder-panel__button:hover,
.theme-${id} .library__items--audio .library__item-play {
  border-color: ${theme.primaryColor};
}

.theme-${id} .MuiSwitch-track,
.theme-${id} .MuiOutlinedInput-root:hover fieldset,
.theme-${id} .MuiOutlinedInput-root.Mui-focused fieldset {
  border-color: ${theme.primaryColor} !important;
}

.theme-${id} .slider-element .MuiSlider-thumb {
  border: 1px solid ${theme.primaryColor};
}
`;
