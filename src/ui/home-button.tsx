import Grid from '../grid'
import { Scene } from '../scene'

interface Props {
  grid: Grid
  scene: Scene
}

export default function HomeButton(props: Props) {
  return (
    <a class="home-button" href="/">
      <img src="/images/newlogo.png" alt="Home" />
    </a>
  )
}
