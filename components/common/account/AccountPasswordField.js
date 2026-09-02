import { Component } from '../../../base/Component.js';
import FormTextField from '../../form/FormTextField.js';

const validationSchema = {
  password: (value) => {
    if (!value) return 'New password is required';
    if (value.length < 8) return 'Password should be of minimum 8 characters length';
    if (value.length > 100) return 'Password should be of maximum 100 characters length';
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!_\\-@#\\$%\\^&\\*])(?=.{0,})/.test(value)) {
      return 'Must Contain One Uppercase, One Lowercase, One Number and one special case Character';
    }
    return null;
  },
  repeatPassword: (value, password) => {
    if (!value) return 'Repeating password is required';
    if (value !== password) return 'Passwords must match';
    return null;
  },
  currentPassword: (value) => {
    if (!value) return 'Current password is required';
    if (value.length < 8) return 'Password should be of minimum 8 characters length';
    return null;
  },
};

export class AccountPasswordField extends Component {
  constructor(props = {}) {
    super(props);

    this.state = {
      updatePassword: props.updatePassword,
      password: '',
      repeatPassword: '',
      currentPassword: '',
      errors: {},
    };

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChange(event) {
    const { name, value } = event.target;
    this.setState({ [name]: value });
  }

  handleSubmit(event) {
    event.preventDefault();
    const { password, repeatPassword, currentPassword, updatePassword } = this.state;

    const errors = {
      password: validationSchema.password(password),
      repeatPassword: validationSchema.repeatPassword(repeatPassword, password),
      currentPassword: validationSchema.currentPassword(currentPassword),
    };

    this.setState({ errors });

    if (!errors.password && !errors.repeatPassword && !errors.currentPassword) {
      updatePassword(password, currentPassword);
    }
  }

  render() {
    const { password, repeatPassword, currentPassword, errors } = this.state;

    const hasErrors = Object.values(errors).some(e => e);

    const formTextField1 = new FormTextField({
      type: 'password',
      id: 'password',
      name: 'password',
      value: password,
      onEdit: this.handleChange,
      placeholder: '********',
      inputClass: 'user-panel__data-field-input-password',
      error: errors.password,
      helperText: errors.password,
    });

    const formTextField2 = new FormTextField({
      id: 'repeatPassword',
      name: 'repeatPassword',
      placeholder: '********',
      type: 'password',
      value: repeatPassword,
      onEdit: this.handleChange,
      inputClass: 'user-panel__data-field-input-password',
      error: Boolean(errors.repeatPassword),
      helperText: errors.repeatPassword,
    });

    const formTextField3 = new FormTextField({
      id: 'currentPassword',
      name: 'currentPassword',
      placeholder: '********',
      type: 'password',
      value: currentPassword,
      onEdit: this.handleChange,
      inputClass: 'user-panel__data-field-input-password',
      error: Boolean(errors.currentPassword),
      helperText: errors.currentPassword,
    });

    const html = `
      <form onsubmit="${this.handleSubmit.name}">
        <div class="user-panel__data-field">
          <span class="user-panel__data-field-label">New password<p>*</p></span>
          ${formTextField1.render().outerHTML}
          <div class="user-panel__data-field-dummy"></div>
        </div>
        <div class="user-panel__data-field">
          <span class="user-panel__data-field-label">Confirm new password<p>*</p></span>
          ${formTextField2.render().outerHTML}
          <div class="user-panel__data-field-dummy"></div>
        </div>
        <div class="user-panel__data-field">
          <span class="user-panel__data-field-label">Current password<p>*</p></span>
          ${formTextField3.render().outerHTML}
          <div class="user-panel__data-field-dummy"></div>
        </div>
        <div class="user-panel__buttons-box">
          <div class="user-panel__data-field-label"></div>
          <div class="user-panel__data-field-button">
            <button class="user-panel__buttons-box-button" type="submit" ${hasErrors || !password ? 'disabled' : ''}>Confirm</button>
          </div>
          <div class="user-panel__data-field-link"></div>
        </div>
      </form>
    `;

    return this.createElementFromHTML(html);
  }
}
