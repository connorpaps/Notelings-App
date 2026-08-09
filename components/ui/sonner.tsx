"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          // M4.2 reskin: dark liquid-glass toasts matching the Bloom world.
          "--normal-bg": "rgba(10, 10, 11, 0.72)",
          "--normal-text": "rgba(255, 255, 255, 0.92)",
          "--normal-border": "rgba(255, 255, 255, 0.14)",
          "--border-radius": "1rem",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !border backdrop-blur-2xl",
          title: "!text-white",
          description: "!text-white/60",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
