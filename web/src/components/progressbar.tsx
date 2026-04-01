type Props = {
  progress: number
}

export function Progressbar(props: Props) {
  return (
    <div>
      <div style={`transform: scaleX(${props.progress})`}>
        <div></div>
      </div>
    </div>
  )
}
