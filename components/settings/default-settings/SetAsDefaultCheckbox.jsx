import * as React from 'react';
import { observer } from 'mobx-react';

import useProjectStore from '../../hooks/useProjectStore';
import FormCheckboxField from '../../form/FormCheckboxField';


const SetAsDefaultCheckbox = observer(() => {
  const { pluginDefaults, element, activeElementId, setAsDefault } = useProjectStore();
  const value = React.useMemo(() => pluginDefaults[element.type].id === activeElementId,
    [activeElementId, pluginDefaults[element.type].id]);

  return (
    <FormCheckboxField
      value={value}
      label="Set as Default"
      onChange={() => setAsDefault(value)}
    />
  );
});

export default SetAsDefaultCheckbox;
