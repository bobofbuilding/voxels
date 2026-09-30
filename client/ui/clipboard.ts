function fallbackCopyTextToClipboard(text: string): boolean {
  const textArea = document.createElement('textarea')
  textArea.value = text

  // Avoid scrolling to bottom
  textArea.style.top = '0'
  textArea.style.left = '0'
  textArea.style.position = 'fixed'

  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()

  let result = false
  try {
    const successful = document.execCommand('copy')
    result = !!successful
  } catch (err) {
    result = false
  }
  document.body.removeChild(textArea)
  return result
}

export function copyTextToClipboard(text: string, onSuccess?: () => void, onFail?: () => void): void {
  if (!navigator.clipboard) {
    const copied = fallbackCopyTextToClipboard(text)
    copied ? onSuccess && onSuccess() : onFail && onFail()
    return
  }
  navigator.clipboard.writeText(text).then(onSuccess, onFail)
}
