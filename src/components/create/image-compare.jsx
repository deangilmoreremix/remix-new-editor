/**
 * Minimal ImageCompare stub for model-node port.
 */

export function ImageCompare({ beforeUrl, afterUrl, className }) {
  return (
    <div className={className} style={{ display: 'flex', gap: 4 }}>
      <img src={beforeUrl} alt="Before" style={{ width: '50%', height: '100%', objectFit: 'cover' }} />
      <img src={afterUrl} alt="After" style={{ width: '50%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
}
