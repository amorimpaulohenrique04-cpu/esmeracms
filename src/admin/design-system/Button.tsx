import React from 'react'

type ButtonTone = 'default' | 'primary' | 'quiet' | 'danger'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone
  busy?: boolean
  busyLabel?: React.ReactNode
}

/**
 * Em `busy` o conteúdo original continua no DOM para travar largura e altura, mas
 * sai da árvore acessível: o leitor de tela anuncia apenas o `busyLabel`, uma vez.
 * O spinner é decorativo e a ativação real é bloqueada por `disabled`.
 */
export function Button({
  tone = 'default',
  className = '',
  type = 'button',
  busy = false,
  busyLabel = 'Processando…',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const toneClass = tone === 'default' ? '' : ` esmera-button--${tone}`
  return (
    <button
      type={type}
      className={`esmera-button${toneClass}${className ? ` ${className}` : ''}`}
      aria-busy={busy || undefined}
      disabled={busy || disabled}
      {...props}
    >
      <span className="esmera-button__content" aria-hidden={busy || undefined}>{children}</span>
      {busy ? (
        <span className="esmera-button__busy">
          <span className="esmera-button__spinner" aria-hidden="true" />
          <span>{busyLabel}</span>
        </span>
      ) : null}
    </button>
  )
}

type ButtonLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  tone?: ButtonTone
}

export function ButtonLink({ tone = 'default', className = '', ...props }: ButtonLinkProps) {
  const toneClass = tone === 'default' ? '' : ` esmera-button--${tone}`
  return <a className={`esmera-button${toneClass}${className ? ` ${className}` : ''}`} {...props} />
}

export function IconButton({ className = '', type = 'button', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`esmera-icon-button${className ? ` ${className}` : ''}`} {...props} />
}
