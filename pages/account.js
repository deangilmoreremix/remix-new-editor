import pageFactory from '../components/hoc/pageFactory';
import Account from '../components/Account';
import AccountHeader from '../components/AccountHeader';

export default pageFactory({
  RootComponent: Account,
  Header: AccountHeader,
  className: 'account',
});
