import { Progress } from 'reactstrap';
import React, { useState, useEffect } from 'react';


const PercentageProgressBar = ({progress}) => {
  const [progressState, setProgressState] = useState(0);
 
    if(!progress) {
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

    } else {
      useEffect(() => {
        setProgressState(progress)
      },[progress])
    }
 

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

export default PercentageProgressBar;