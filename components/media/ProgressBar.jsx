import { Progress } from 'reactstrap';
import React, { useCallback, useMemo, useState, useEffect } from 'react';


const ProgressBar = () => {
  const [progressState, setProgressState] = useState(0);
  useEffect(() => {
    let counter = 0;
    const interval = setInterval(() => {
      if(counter < 100) {
        counter = counter + 10;
        }
        setProgressState(counter);
        if(counter == 100) {
            clearInterval(interval);
           
        }
    }, 100);
  },[])
 

    return ( <Progress
        className=""
        animated
        color="danger"
        value={progressState}
        style={{
          height: '40px',
        }}
      >
        {progressState}
        {' '}
        %
      </Progress>
      )
}

export default ProgressBar;