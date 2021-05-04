import React from 'react';
import pageFactory from '../components/hoc/pageFactory';
import Account from '../components/Account';
import AccountHeader from '../components/AccountHeader';

export default pageFactory({
  RootComponent: Account,
  Header: () => <AccountHeader isAccount />,
  headerTitle: 'My Account Settings',
  className: 'account',
});
