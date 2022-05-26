import React, { memo } from 'react';
import SVGInline from 'react-svg-inline';
import Link from 'next/link';
import PropTypes from '../lib/PropTypes';

import Menu from './common/Menu';
import UserBox from './common/user/UserBox';

import { USER_MENU_ITEMS } from '../lib/constants/ui';
import useCommonStore from './hooks/useCommonStore';

import logoIcon from '../public/static/svgImages/header/logo-2.svg';
import backgroundImage from '../public/static/images/background-header.jpg';

const AccountHeader = memo(({ isAccount }) => {
  const common = useCommonStore();
  return (
    <nav
      className="navigation"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="navigation-first-level">
        <Link href="/">
          <SVGInline
            className="navigation-logo"
            svg={logoIcon}
          />
        </Link>
        <Menu
          toggleElement={<UserBox greeting={false} />}
          items={USER_MENU_ITEMS(common)}
          className="user-bar flex-center"
          needEndIcon
        />
      </div>
      <div className="navigation-title">{isAccount ? 'My Account Settings' : 'Billing'}</div>
    </nav>
  );
});

AccountHeader.propTypes = {
  isAccount: PropTypes.bool,
};

AccountHeader.defaultProps = {
  isAccount: false,
};

export default AccountHeader;
