import { createContext } from 'preact'
import { useContext } from 'preact/hooks'
import type { templateFromFeature } from '../../tools/feature'

export type FeatureContext = {
  templateFromFeature: typeof templateFromFeature
}

export const FeatureContext = createContext<FeatureContext>(null!)

export const useFeatureContext = (): FeatureContext => useContext(FeatureContext)
