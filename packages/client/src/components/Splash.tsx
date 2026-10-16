/** Full-screen splash shown once when the page first loads. */
export function Splash(): JSX.Element {
  return (
    <div className="splash" aria-hidden="true">
      <img src="/logo.png" alt="Skat Online" className="splash-logo" />
    </div>
  );
}
