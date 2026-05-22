import Grid from '../grid'

interface Props {
  grid: Grid
  scene: BABYLON.Scene
}

export default function HomeButton(props: Props) {
  return (
    <a class="home-button" href="/">
      <img src="/images/newlogo.png" alt="Home" />
    </a>
  )
}
