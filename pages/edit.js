import pageFactory from '../components/hoc/pageFactory';
import Home from '../components/Home';

export default pageFactory({
  RootComponent: Home,
  className: 'home',
  layoutClassName: 'layout-container',
});
