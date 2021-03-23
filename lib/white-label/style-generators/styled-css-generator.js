/**
 * Created by Eugene Butusov on 29/11/2018.
 */

export default (id, brandLogo, theme) => `
.theme-${id} .navbar-logo-wl {
    background: url('${brandLogo || '../public/static/svgImages/logo.svg'}') no-repeat 0;
}

.theme-${id} .MuiSwitch-colorSecondary.Mui-checked + .MuiSwitch-track,
.theme-${id} .timeline .slider-element .MuiSlider-thumb:before,
.theme-${id} .MuiAutocomplete-popper .MuiPaper-root .listbox-content li[aria-selected="true"] {
  background-color: ${theme.primaryColor} !important;
}

.theme-${id} .timeline-slider .MuiSlider-thumb:before,
.theme-${id} .checkmark.checked .MuiIconButton-label:after,
.theme-${id} .slider-element .MuiSlider-track,
.theme-${id} .img-size-settings .base-button,
.theme-${id} .text-to-speech .radio-button-icon.icon-svg-checked:after,
.theme-${id} .library-voice-filter__types .radio-button-icon.icon-svg-checked:after,
.theme-${id} button.settings__edit-file,
.theme-${id} button.settings__edit-file:hover,
.theme-${id} library__item-button:hover,
.theme-${id} .social-campaign .progress-bar,
.theme-${id} .library__item-use,
.theme-${id} .library__item-audio-delete,
.theme-${id} .tui-image-editor-container .tui-image-editor-wrap::-webkit-scrollbar-track,
.theme-${id} .tui-image-editor-container .tui-image-editor-wrap::-webkit-scrollbar-thumb,
.theme-${id} .tui-image-editor-container .tui-image-editor-virtual-range-bar,
.theme-${id} .tui-image-editor-container .tui-image-editor-virtual-range-subbar,
.theme-${id} button .settings__edit-file,
.theme-${id} .library__item-delete,
.theme-${id} .slider-arrow,
.theme-${id} .library__item-button:hover {
  background-color: ${theme.primaryColor} !important;
}

.theme-${id} .stickers-content__delete {
  background-color: ${theme.primaryColor} !important;
  opacity: 0.8;
}

.theme-${id} .menu-app-bar .container-menu .icon-button.active-save,
.theme-${id} .expandButton-active,
.theme-${id} .menu-app-bar .container-menu .icon-button.active,
.theme-${id} .container-menu__project-name span,
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
.theme-${id} .text-to-speech__radio-active,
.theme-${id} .library__search-icon-box,
.theme-${id} .text-to-speech__warning,
.theme-${id} .social-campaign .embed-line a,
.theme-${id} .img-size-settings .zoom-icon,
.theme-${id} .library__search-unlock-box:hover,
.theme-${id} .text-to-speech__info,
.theme-${id} .react-tagsinput-remove:before,
.theme-${id} .templates .active-category,
.theme-${id} .gif-library__header,
.theme-${id} .projects .active-category {
  color: ${theme.primaryColor};
}

.theme-${id} .MuiCheckbox-colorSecondary.Mui-checked,
.theme-${id} .autocomplete-container .action-icons .clear-icon, .autocomplete-container .action-icons .popup-icon,
.theme-${id} .autocomplete-container .action-icons .clear-icon, .autocomplete-container .action-icons .clear-icon,
.theme-${id} .tui-image-editor-container .tui-image-editor-checkbox input[type='checkbox']:checked+span:before {
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
.theme-${id} .add-field-container-button,
.theme-${id} .image-settings__btn,
.theme-${id} .color-reset-button,
.theme-${id} .overlay__use,
.theme-${id} .view-project-window__use,
.theme-${id} .library__items--audio .library__item-use,
.theme-${id} .library__items--voice .library__item-use,
.theme-${id} .video-transition-btn.merge,
.theme-${id} .video-transition-btn.apply,
.theme-${id} .personalization__add:hover,
.theme-${id} .library-voice-filter__btn,
.theme-${id} .recorder-modal-options__button_save,
.theme-${id} .recorder-modal-options__button_upload,
.theme-${id} .email-campaign-modal .service-provider-list-item.selected button,
.theme-${id} .email-campaign-modal .personalized-link-copy,
.theme-${id} .text-to-speech__button,
.theme-${id} .text-to-speech__library-delete,
.theme-${id} div.modal-container__media-content .preview-video-button,
.theme-${id} .open-text-to-speech,
.theme-${id} .line-duration__toggle:after,
.theme-${id} .line-duration__toggle,
.theme-${id} .timeline .slider-element .MuiSlider-thumb,
.theme-${id} .email-campaign-modal .personalized-link-section .tooltip-copied,
.theme-${id} .close-button,
.theme-${id} .close-button-produce,
.theme-${id} .template-preview-modal__panel-button,
.theme-${id} .produce-panel .personalized-link-copy,
.theme-${id} .templates-header__create-icon,
.theme-${id} .projects-library__item.library__item button.projects-item-edit,
.theme-${id} button.generator-use,
.theme-${id} .add-folder-modal__content-data__buttons-box button {
  background: ${theme.primaryColor};
}

.theme-${id} .MuiAutocomplete-popper .MuiPaper-root .listbox-content li:hover {
  background: ${theme.primaryColor} !important;
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
.theme-${id} .selected,
.theme-${id} .social-campaign .controls .go-button:hover,
.theme-${id} .email-campaign-modal .service-provider-list-item button:hover,
.theme-${id} .social-campaign .facebook-login .fb-login:hover,
.theme-${id} .voice-modal__btn,
.theme-${id} .text-to-speech__radio-active,
.theme-${id} .text-to-speech__textarea.text-area.multiline:focus,
.theme-${id} .library__items--voice .library__item-play,
.theme-${id} button.library__tab-active,
.theme-${id} .btn-add,
.theme-${id} .library__item-preview,
.theme-${id} .library__item-selected,
.theme-${id} .text-to-speech__library-play,
.theme-${id} .url-video-modal__btn,
.theme-${id} div.modal-container__media-content .preview-video-button-cancel,
.theme-${id} .svg-token-none,
.theme-${id} .active .delete-handle,
.theme-${id} .container-tokens-textarea .personalized-token-svg,
.theme-${id} .popcorn-element-text .personalized-token-svg,
.theme-${id} .line-duration-slider,
.theme-${id} .timeline .slider-element .MuiSlider-thumb:before,
.theme-${id} .rct9k-active-item,
.theme-${id} .rct9k-timeline-div .out-animation-element,
.theme-${id} .rct9k-timeline-div .in-animation-element,
.theme-${id} .rct9k-timeline-div .idle-animation-element,
.theme-${id} .react-tagsinput-tag,
.theme-${id} .library__items--audio .library__item-play,
.theme-${id} .popcorn-combined .resize-handle,
.theme-${id} .combined-settings__convert,
.theme-${id} .produce-panel .personalized-link-copy:after,
.theme-${id} .combined-settings .btn-personalize {
  border-color: ${theme.primaryColor};
}

.theme-${id} .email-campaign-modal .personalized-link-copy:after,
.theme-${id} .timeline .slider-element .MuiSlider-thumb:after {
  border-color: ${theme.primaryColor} transparent transparent transparent;
}

.theme-${id} .MuiSwitch-track,
.theme-${id} .MuiOutlinedInput-root:hover fieldset,
.theme-${id} .social-campaign .custom-checkbox:hover input[type="checkbox"] + .label,
.theme-${id} .tui-image-editor-container .tui-image-editor-virtual-range-pointer,
.theme-${id} .tui-image-editor-container .tui-image-editor-checkbox input[type='checkbox']:checked+span:before,
.theme-${id} .resize-handle,
.theme-${id} .autocomplete-container .autocomplete .autocomplete-input .autocomplete-input-tag,
.theme-${id} .MuiOutlinedInput-root.Mui-focused fieldset {
  border-color: ${theme.primaryColor} !important;
}

.theme-${id} .slider-element .MuiSlider-thumb {
  border: 1px solid ${theme.primaryColor};
}

.theme-${id} .theme-${id} .templates-header__select:after {
  border-bottom: 1px solid ${theme.primaryColor};
  border-left: 1px solid ${theme.primaryColor};
}

.theme-${id} .close-button-extend svg path,
.theme-${id} .templates-header__logo path,
.theme-${id} SVGInline SVGInline--cleaned toggler-icon path {
  fill: ${theme.primaryColor};
}

.theme-${id} .templates-header__search-icon path {
  stroke: ${theme.primaryColor}
}
`;
