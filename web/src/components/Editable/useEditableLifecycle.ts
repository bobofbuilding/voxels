import { useCallback, useEffect, useState } from 'preact/hooks'
import { app } from '../../state'
import { PanelType } from '../panel'

type EditableLifecycleProps = {
  value: string
  save(value: string): Promise<{ success: boolean; error?: string }>
  onSaveSuccess: (s: string) => void | null
  onSaveFailure: (s: string) => void | null
  validationRule?: (s: string) => boolean
}

type EditableLifecycle = {
  value: string
  isEditing: boolean
  onEditBegin(): void
  onEditCancel(): void
  onEditComplete(): void
  onEditUpdate(newValue: string): void
}

export function useEditableLifecycle({ value: originalValue, save, onSaveFailure, onSaveSuccess, validationRule }: EditableLifecycleProps): EditableLifecycle {
  const [value, setValue] = useState<string>(originalValue || '')
  const [pendingValue, setPendingValue] = useState<string | null>(null)
  const isEditing = pendingValue !== null

  useEffect(() => setValue(originalValue), [originalValue])

  const onEditBegin = useCallback(() => setPendingValue(value), [value])

  const onEditCancel = useCallback(() => {
    setPendingValue(null)
  }, [])

  const onEditComplete = useCallback(async () => {
    if (pendingValue === null) {
      return
    }
    const result = await save(pendingValue)
    if (result.success) {
      app.showSnackbar('Successfully saved!', PanelType.Success)
      onSaveSuccess?.(pendingValue)
    } else {
      app.showSnackbar(result.error ?? 'Something went wrong...', PanelType.Danger)
      onSaveFailure?.(pendingValue)
    }

    setValue(pendingValue)
    setPendingValue(null)
  }, [pendingValue, save])

  const passValidation = (newValue: string) => {
    return validationRule?.(newValue) ?? true
  }

  const onEditUpdate = useCallback((newValue: string) => {
    if (passValidation(newValue)) {
      setPendingValue(newValue)
    }
  }, [])

  return {
    value: isEditing ? pendingValue! : value,
    isEditing,
    onEditBegin,
    onEditCancel,
    onEditComplete,
    onEditUpdate,
  }
}
