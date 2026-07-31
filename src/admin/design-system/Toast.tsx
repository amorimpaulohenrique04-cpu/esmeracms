'use client'

import { Toast } from '@base-ui/react/toast'
import React from 'react'

export const esmeraToastManager = Toast.createToastManager()

function ToastList() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} className="esmera-toast">
      <Toast.Content className="esmera-toast-content">
        <div>
          <Toast.Title className="esmera-toast-title" />
          <Toast.Description className="esmera-toast-description" />
        </div>
        <Toast.Close className="esmera-toast-close" aria-label="Fechar notificação">×</Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ))
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider toastManager={esmeraToastManager}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="esmera-toast-viewport">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}
