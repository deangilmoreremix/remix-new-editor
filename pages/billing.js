import pageFactory from '../components/hoc/pageFactory';
import Billing from '../components/Billing';
import AccountHeader from '../components/AccountHeader';

export default pageFactory({
  RootComponent: Billing,
  Header: AccountHeader,
  className: 'billing',
});
