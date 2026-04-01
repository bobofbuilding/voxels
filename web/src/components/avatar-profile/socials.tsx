import { saveAsset } from '../../helpers/save-helper'
import { AssetType } from '../../components/Editable/editable'
import { PanelType } from '../../components/panel'
import { app } from '../../state'
import { useState } from 'preact/hooks'
import { ApiAvatar } from '../../../../common/messages/api-avatars'

interface InputType {
  socialLinkNumber: number
  avatar?: ApiAvatar
  onSave: (cacheBust: boolean) => void
}

export function EditSocialLink(props: InputType) {
  const { socialLinkNumber, avatar, onSave } = props
  if (!socialLinkNumber || !avatar) return null
  const socialProperty = `social_link_${socialLinkNumber}`
  //@ts-expect-error dynamically getting the property
  const prevLink = avatar[socialProperty]
  const [socialLink, setSocialLink] = useState<string>(prevLink)
  const [saving, setSaving] = useState<boolean>(false)
  const isEmail = (value: string) => {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    return re.test(String(value).toLowerCase())
  }
  const isURL = (value: string) => {
    try {
      new URL(value).toString()
      return true
    } catch {}
    return false
  }
  const save = async () => {
    if (socialLink === prevLink) return
    if (socialLink != '' && !isURL(socialLink) && !isEmail(socialLink)) {
      app.showSnackbar('Invalid social link', PanelType.Danger)
      return
    }
    setSaving(true)
    const p = await saveAsset(AssetType.Avatar, avatar.id, { [socialProperty]: socialLink.toString() })
    if (!!p.success) {
      app.showSnackbar('Social link saved!', PanelType.Success)
      onSave(true)
    } else {
      app.showSnackbar('Could not save Social link', PanelType.Danger)
    }
    setSaving(false)
  }

  const onBlur = () => {
    if (saving) {
      return
    }
    save()
  }

  const keyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !saving) {
      save()
    }
  }

  return <input type="text" placeholder={`Link ${socialLinkNumber}..`} name="name" disabled={saving} onBlur={onBlur} value={socialLink} onInput={(e: any) => setSocialLink(e.target['value'])} onKeyDown={keyDown} />
}

export function SocialLink(props: { socialUrl: string; maxLength?: number }) {
  const { socialUrl } = props
  const isEmail = (value: string) => {
    const re = /^\S+@\S+\.\S+$/
    return re.test(String(value).toLowerCase())
  }
  const getHostName = () => {
    try {
      const u = new URL(socialUrl)
      return u.hostname
    } catch {}
    return null
  }
  if (!getHostName() && !isEmail(socialUrl)) return null
  const link = isEmail(socialUrl) ? `email:${socialUrl}` : socialUrl
  let content = socialUrl
  if (props.maxLength && socialUrl.length > props.maxLength) {
    content = socialUrl.slice(0, props.maxLength - 1) + '…'
  }
  return <a href={link}>{content}</a>
}
