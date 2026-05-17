import { useEffect, useMemo, useState } from 'react';

export function useInstalledApps() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load = window.focusflow?.apps?.list;
    if (!load) {
      setLoading(false);
      return undefined;
    }
    load()
      .then((list) => {
        if (!cancelled) setApps(list || []);
      })
      .catch(() => {
        if (!cancelled) setApps([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const iconByName = useMemo(() => {
    const map = new Map();
    for (const app of apps) {
      const icon = app.icon || null;
      map.set(app.app_name.toLowerCase(), icon);
      map.set(app.process_name.toLowerCase(), icon);
    }
    return map;
  }, [apps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter(
      (a) =>
        a.app_name.toLowerCase().includes(q) ||
        a.process_name.toLowerCase().includes(q)
    );
  }, [apps, search]);

  const getIcon = (appName) => {
    if (!appName) return null;
    return iconByName.get(String(appName).toLowerCase()) || null;
  };

  return {
    apps,
    filtered,
    loading,
    search,
    setSearch,
    getIcon,
    iconByName,
  };
}
