import { Component } from 'preact'
import { route } from 'preact-router'
import { app } from '../state'

export default class Redirect extends Component<{ to: string }, any> {
  componentWillMount() {
    route(this.props.to)
    app.showSnackbar(`You've been redirected`)
  }

  render() {
    return null
  }
}
