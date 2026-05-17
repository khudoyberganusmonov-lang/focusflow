import { useEffect, useState } from 'react';
import AppIcon from '../AppIcon';

export default function AppRowIcon({ name, size = 22 }) {
  const [icon, setIcon] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = window.focusflow?.apps?.getIconUrlForApp;
    if (!load) return undefined;
    load(name).then((url) => {
      if (!cancelled) setIcon(url);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  return <AppIcon src={icon} name={name} size={size} />;
}
