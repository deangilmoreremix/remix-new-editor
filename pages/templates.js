import pageFactory from '../components/hoc/pageFactory';
import Templates from '../components/Templates';
import ListHeader from '../components/ListHeader';

// todo remove is list and add Header
export default pageFactory({ RootComponent: Templates, Header: ListHeader, className: 'templates' });
