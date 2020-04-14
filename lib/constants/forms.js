import TimeInput from '../../components/form/TimeInput';
import FormTextField from '../../components/form/FormTextField';
import FormColor from '../../components/form/FormColor';
import FormRadioButton from '../../components/form/FormRadioButton';
import FormSelect from '../../components/form/FormSelect';
import FormList from '../../components/form/FormList';
import FormCheckboxField from '../../components/form/FormCheckboxField';
import FormSlider from '../../components/form/FormSlider';
import TagsFormInput from '../../components/form/TagsFormInput';

export const TIME = 'time';
export const NUMBER = 'number';
export const INPUT = 'input';
export const TEXT = 'text';
export const COLOR = 'color';
export const RADIO = 'radio';
export const SELECT = 'select';
export const LIST = 'list';
export const CHECKBOX = 'checkbox';
export const SLIDER = 'slider';
export const TAGS = 'tags';

export const INPUT_ELEMENTS = {
  [TIME]: TimeInput,
  [NUMBER]: FormTextField,
  [INPUT]: FormTextField,
  [TEXT]: FormTextField,
  [COLOR]: FormColor,
  [RADIO]: FormRadioButton,
  [SELECT]: FormSelect,
  [LIST]: FormList,
  [CHECKBOX]: FormCheckboxField,
  [SLIDER]: FormSlider,
  [TAGS]: TagsFormInput,
};
