import TimeInput from '../../components/form/TimeInput';
import FormTextField from '../../components/form/FormTextField';
import FormColor from '../../components/form/FormColor';
import FormRadioButton from '../../components/form/FormRadioButton';
import FormSelect from '../../components/form/FormSelect';
import FormList from '../../components/form/FormList';
import FormCheckboxField from '../../components/form/FormCheckboxField';
import FormSlider from '../../components/form/FormSlider';
import AngleInput from '../../components/form/AngleInput';
import TagsFormInput from '../../components/form/TagsFormInput';
import FormTextArea from '../../components/form/FormTextArea';
import FormTokensTextArea from '../../components/form/FormTokensTextArea';
import DropButton from '../../components/media/DropButton';

export const TIME = 'time';
export const NUMBER = 'number';
export const INPUT = 'input';
export const COLOR = 'color';
export const RADIO = 'radio';
export const SELECT = 'select';
export const LIST = 'list';
export const CHECKBOX = 'checkbox';
export const SLIDER = 'slider';
export const INPUT_ANGLE = 'angle';
export const TAGS = 'tags';
export const INPUT_TEXTAREA = 'textarea';
export const CONTENTEDITABLE_TEXTAREA = 'contenteditableTextarea';
export const DROP_BUTTON = 'dropButton';

export const INPUT_ELEMENTS = {
  [TIME]: TimeInput,
  [NUMBER]: FormTextField,
  [INPUT]: FormTextField,
  [INPUT_TEXTAREA]: FormTextArea,
  [CONTENTEDITABLE_TEXTAREA]: FormTokensTextArea,
  [COLOR]: FormColor,
  [RADIO]: FormRadioButton,
  [SELECT]: FormSelect,
  [LIST]: FormList,
  [CHECKBOX]: FormCheckboxField,
  [SLIDER]: FormSlider,
  [INPUT_ANGLE]: AngleInput,
  [TAGS]: TagsFormInput,
  [DROP_BUTTON]: DropButton,
};

export const MULTILINE = 'multiline';
