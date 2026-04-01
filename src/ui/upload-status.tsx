import { Component } from 'preact'
import type Grid from '../grid'

interface Props {
  onBeginUpload: BABYLON.Observable<File>
  onCompleteUpload: BABYLON.Observable<File>
  onFailUpload: BABYLON.Observable<File>
}

interface State {
  files: Array<string>
}

export default class UploadStatusUI extends Component<Props, State> {
  files: Set<File>

  constructor() {
    super()
    this.files = new Set()
    this.state = {
      files: [],
    }
  }

  get grid() {
    return window.grid as Grid
  }

  onBeginUpload = (file: File) => {
    this.files.add(file)
    this.refreshFiles()
  }

  onCompleteUpload = (file: File) => {
    this.files.delete(file)
    this.refreshFiles()
  }

  refreshFiles() {
    this.setState({ files: Array.from(this.files).map((f) => f.name) })
  }

  componentDidMount() {
    this.props.onBeginUpload.add(this.onBeginUpload)
    this.props.onCompleteUpload.add(this.onCompleteUpload)
    this.props.onFailUpload.add(this.onCompleteUpload)
  }

  componentWillUnmount() {
    this.props.onBeginUpload.removeCallback(this.onBeginUpload)
    this.props.onCompleteUpload.removeCallback(this.onCompleteUpload)
    this.props.onFailUpload.removeCallback(this.onCompleteUpload)
  }

  render() {
    if (this.state.files.length > 0) {
      return (
        <div className="upload-status">
          <h2>Uploading files...</h2>
          <ul>
            {this.state.files.map((file) => (
              <li>{file}</li>
            ))}
          </ul>
        </div>
      )
    } else {
      return (
        <div className="upload-status -hidden">
          <h2>Uploading files...</h2>
          <ul>
            <li>Done</li>
          </ul>
        </div>
      )
    }
  }
}
