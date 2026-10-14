import { useEffect, useState, type ReactNode } from 'react';
import { getJson } from '../api/client.js';

type Props<T> = {
  title: string;
  description: string;
  endpoint: string;
  responseKey: string;
  emptyMessage: string;
  renderItem: (item: T) => ReactNode;
};

export function CapabilityCard<T>({
  title,
  description,
  endpoint,
  responseKey,
  emptyMessage,
  renderItem,
}: Props<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getJson<Record<string, T[]>>(endpoint)
      .then((response) => {
        const data = response[responseKey];
        if (!Array.isArray(data)) {
          throw new Error(`Invalid ${title.toLowerCase()} response`);
        }
        if (active) setItems(data);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : 'Unknown error');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [endpoint, responseKey, title]);

  return (
    <section className="card h-100">
      <div className="card-body">
        <h2 className="h4">{title}</h2>
        <p>{description}</p>
        {loading && <p role="status">Loading {title.toLowerCase()}...</p>}
        {error && <p role="alert">Unable to load {title.toLowerCase()}: {error}</p>}
        {!loading && !error && items.length === 0 && <p>{emptyMessage}</p>}
        {!loading && !error && items.length > 0 && (
          <ul>
            {items.map((item, index) => <li key={index}>{renderItem(item)}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
