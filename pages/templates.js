import pageFactory from '../components/hoc/pageFactory';
import Templates from '../components/Templates';
import ListHeader from '../components/ListHeader';

export default pageFactory({ RootComponent: Templates, Header: ListHeader, className: 'templates' });
