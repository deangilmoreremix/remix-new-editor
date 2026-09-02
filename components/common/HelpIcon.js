import React from 'react';

export class HelpIconComponent extends React.Component {
  static defaultProps = {
    placement: 'top',
    noPadding: false,
    message: '',
  };

  render() {
    const { noPadding, message, className } = this.props;
    const cls = `help-icon ${noPadding ? 'no-padding' : ''} ${className || ''}`.trim();
    return (
      <span className={cls} title={message} role="img" aria-label="help">
        ?
      </span>
    );
  }
}

export default HelpIconComponent;
