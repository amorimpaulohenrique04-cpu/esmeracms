import React from 'react'

type ButtonTone = 'default' | 'primary' | 'quiet' | 'danger'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone
}

export function Button({ tone = 'default', className = '', type = 'button', ...props }: ButtonProps) {
  const toneClass = tone === 'default' ? '' : ` esmera-button--${tone}`
  return <button type={type} className={`esmera-button${toneClass}${className ? ` ${className}` : ''}`} {...props} />
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
