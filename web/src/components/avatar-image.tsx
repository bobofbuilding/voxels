import makeBlockie from 'ethereum-blockies-base64'

interface AvatarProps {
  wallet?: string
  size?: number
}

const AvatarImage = (props: AvatarProps) => {
  const size = props.size || 32
  const link = `/u/${props.wallet}`

  if (!props.wallet) {
    return (
      <span>
        <img width={size} height={size} style={{ width: size, height: size }} src="/images/no-image.png" />
      </span>
    )
  } else {
    return (
      <a href={link}>
        <img width={size} height={size} style={{ width: size, height: size }} src={makeBlockie(props.wallet)} />
      </a>
    )
  }
}

export default AvatarImage
