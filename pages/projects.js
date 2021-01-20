import pageFactory from '../components/hoc/pageFactory';
import Projects from '../components/Projects';
import ListHeader from '../components/ListHeader';

// todo remove is list and add Header
export default pageFactory({ RootComponent: Projects, Header: ListHeader, className: 'projects' });
