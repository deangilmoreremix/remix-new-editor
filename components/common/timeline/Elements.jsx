import React from 'react';
import { Button, Container } from 'reactstrap';
import { observer } from 'mobx-react';
// import { Draggable } from 'react-beautiful-dnd';

import Timeline from 'react-calendar-timeline';
// make sure you include the timeline stylesheet or the timeline will not be styled
// import 'react-calendar-timeline/lib/Timeline.css';

import moment from 'moment';

const groups = [{ id: 1, title: 'group 1' }, { id: 2, title: 'group 2' }];

const items = [
  {
    id: 1,
    group: 1,
    title: 'item 1',
    start_time: 1000,
    end_time: 2000,
  },
  {
    id: 2,
    group: 2,
    title: 'item 2',
    start_time: 1500,
    end_time: 2000,
  },
  {
    id: 3,
    group: 1,
    title: 'item 3',
    start_time: 3000,
    end_time: 10000,
  },
];

// todo implement it
const Elements = observer(({ item }) => (
  <div>
      Rendered by react!
    <Timeline
      groups={groups}
      items={items}
      defaultTimeStart={{ second: 0 }}
      defaultTimeEnd={{ second: 30 }}
      visibleTimeEnd={30}
      visibleTimeStart={0}
    />
  </div>
),
);

// Elements.propTypes = {
//   item: PropTypes.shape({
//     name: PropTypes.string.isRequired,
//     action: PropTypes.func.isRequired,
//   }).isRequired,
// };

export default Elements;
