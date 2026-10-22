// The mark on every screen: K, "Kowboy Core", and which Core this is (Production, Staging, Local),
// so nobody mistakes the live service for a test one.

export function Brand({ instance, large = false }: { instance: string | null; large?: boolean }) {
  return (
    <span className={`k-brand${large ? ' k-brand-large' : ''}`}>
      <span className="k-brand-mark" aria-hidden="true">
        K
      </span>
      <span className="k-brand-name">
        Kowboy <strong>Core</strong>
      </span>
      {instance && <Instance name={instance} />}
    </span>
  );
}

export function Instance({ name }: { name: string }) {
  const live = name.toLowerCase() === 'production';
  return <span className={`k-instance${live ? ' k-instance-production' : ''}`}>{name}</span>;
}
