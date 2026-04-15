declare module 'react-simple-maps' {
  import { ComponentType, ReactNode } from 'react'

  interface ComposableMapProps {
    projection?: string
    projectionConfig?: Record<string, unknown>
    style?: React.CSSProperties
    viewBox?: string
    children?: ReactNode
  }

  interface ZoomableGroupProps {
    zoom?: number
    minZoom?: number
    maxZoom?: number
    center?: [number, number]
    children?: ReactNode
  }

  interface GeographiesProps {
    geography: string | Record<string, unknown>
    children: (data: { geographies: Geography[] }) => ReactNode
  }

  interface Geography {
    rpiKey: string
    properties: Record<string, string>
  }

  interface GeographyProps {
    geography: Geography
    fill?: string
    stroke?: string
    strokeWidth?: number
    style?: {
      default?: React.CSSProperties
      hover?: React.CSSProperties
      pressed?: React.CSSProperties
    }
  }

  interface MarkerProps {
    coordinates: [number, number]
    children?: ReactNode
    onClick?: () => void
    onMouseEnter?: () => void
    onMouseLeave?: () => void
  }

  export const ComposableMap: ComponentType<ComposableMapProps>
  export const ZoomableGroup: ComponentType<ZoomableGroupProps>
  export const Geographies: ComponentType<GeographiesProps>
  export const Geography: ComponentType<GeographyProps>
  export const Marker: ComponentType<MarkerProps>
}
