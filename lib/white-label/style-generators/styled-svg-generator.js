/**
 * Created by Eugene Butusov on 29/11/2018.
 */

export default (id, theme) => `
.theme-${id} .menu-app-bar .container-menu .icon-button.active .redo-0,
.theme-${id} .menu-app-bar .container-menu .icon-button.active .undo-0,
.theme-${id} .menu-app-bar .container-menu .icon-button.active .save-0,
.theme-${id} .menu-app-bar .container-menu .icon-button,
.theme-${id} .menu-app-bar .container-menu .icon-button.active-save .redo-0,
.theme-${id} .menu-app-bar .container-menu .icon-button.active-save .undo-0,
.theme-${id} .menu-app-bar .container-menu .icon-button.active-save .save-0,
.theme-${id} .expandButton-active .expandButton-icon path,
.theme-${id} .toggler-icon path,
.theme-${id} .library__btn-active path,
.theme-${id} .library__icon-btn-svg path,
.theme-${id} .icon-svg-checked-svg path,
.theme-${id} .trash path,
.theme-${id} .stop-cls-1,
.theme-${id} .voice-modal__icon-arrow-svg path,
.theme-${id} .library__item-plus-svg circle,
.theme-${id} .deselect-icon path,
.theme-${id} .text-to-speech__slider-left:hover path,
.theme-${id} .text-to-speech__slider-right:hover path,
.theme-${id} .url-video-modal__icon-svg path,
.theme-${id} .library__search-unlock-icon-svg path,
.theme-${id} .arrow-image path,
.theme-${id} .icon-360-active svg path,
.theme-${id} .token-uppercase-icon-cls-1,
.theme-${id} .default-token-cls-1,
.theme-${id} .timeline-zoom__btn:hover path,
.theme-${id} .help-icon__icon-red,
.theme-${id} .create-folder-icon svg circle {
  fill: ${theme.primaryColor} !important;
}

.theme-${id} .template-generator-modal-content .generator-img .generator-img-svg .generator-cl-1,
.theme-${id} .Play_svg_st1,
.theme-${id} .st1,
.theme-${id} .icon-edit-timeline,
.theme-${id} .cls-3,
.theme-${id} .cls_addMedia-3,
.theme-${id} .cls_addMedia-4,
.theme-${id} .cls_Produce-3,
.theme-${id} .cls_Produce-4,
.theme-${id} .cls_Elements-3,
.theme-${id} .cls_Elements-4,
.theme-${id} .drag-arrow-svg path,
.theme-${id} .video-settings__icon path,
.theme-${id} .gif-library__icon svg path,
.theme-${id} .library__items--voice .library__item-delete .library__item-icon *,
.theme-${id} .voice-modal__icon-svg path,
.theme-${id} .tab-icon-active svg path,
.theme-${id} .deselect,
.theme-${id} .btn-speech-get .SVGInline-svg.SVGInline--cleaned-svg path,
.theme-${id} .timeline-pause-icon,
.theme-${id} .video-icon-wl,
.theme-${id} .autocomplete-container .autocomplete .autocomplete-input .autocomplete-input-tag svg path,
.theme-${id} .personalization__close svg path,
.theme-${id} .library__items--audio .library__item-delete .library__item-icon path,
.theme-${id} .add-folder-modal-icon svg path,
.theme-${id} .niche-scripts-preview-modal__icon-svg path,
.theme-${id} .library__items--audio .library__item-delete .library__item-icon path,
.theme-${id} .create-folder__hover-icon:hover svg path {
  stroke: ${theme.primaryColor} !important;
}
`;
