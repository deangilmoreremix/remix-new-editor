// [remix] CineGen "Sets" (Gaussian-splat 3D scenes) needs GPU-heavy server-side reconstruction, which
// this web editor does not run. The vendored Create tab lazy-loads this component; it shows a notice.
export function SetsView(_props: Record<string, unknown>) {
  return (
    <div style={{ padding: 40, color: 'var(--text-secondary)' }}>
      Sets (3D scene reconstruction) is not available in the web editor.
    </div>
  );
}
