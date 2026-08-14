'use client'

import type { ReactNode } from 'react'
import { OfficeBuilderProvider, useOfficeBuilder } from './OfficeBuilderContext'
import OfficeBuilderPanel from './OfficeBuilderPanel'
import OfficeCanvas from './OfficeCanvas'

function BuilderCanvas() {
  const { consumeSuppressedClick, selectItem } = useOfficeBuilder()
  return (
    <OfficeCanvas
      onPointerMissed={() => {
        if (consumeSuppressedClick()) return
        selectItem(null)
      }}
    />
  )
}

export default function OfficeBuilderApp({ children }: { children?: ReactNode }) {
  return (
    <OfficeBuilderProvider>
      {children ?? <BuilderCanvas />}
      <OfficeBuilderPanel />
    </OfficeBuilderProvider>
  )
}
