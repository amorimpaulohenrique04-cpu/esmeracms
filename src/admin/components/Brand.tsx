export function EsmeraIcon() {
  return (
    <span className="esmera-brand-icon" aria-hidden="true">
      <svg viewBox="0 0 32 32" role="img">
        <path d="M7 19.2C7 11.9 13.4 6.4 24 6c-.3 10.5-5.8 17-13.1 17C8.4 23 7 21.6 7 19.2Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 21c2.7-4.6 6.7-8.2 12.1-10.9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    </span>
  )
}

export function EsmeraLogo() {
  return (
    <div className="esmera-login-logo" aria-label="Esméra CMS">
      <EsmeraIcon />
      <div>
        <strong>Esméra</strong>
        <span>Management Portal</span>
      </div>
    </div>
  )
}
