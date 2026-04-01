import { isEqual } from 'lodash'
import { Component } from 'preact'
import { useEffect } from 'preact/compat'

export interface data {
  labels: Array<any>
  datasets: Array<any>
}

export interface State {
  loadingText: string
  loading: boolean
  data: data
}

export type Options = {
  title?: string
  legend?: boolean
  responsive?: boolean
  performance?: boolean
  minHeight?: string
  minWidth?: string
  height?: string
  elements?: { line?: any }
  maintainAspectRatio?: boolean
  hideAxes?: boolean
  maxY?: number
  scales?: any
  plugins?: any
}

export enum chartType {
  Pie = 'pie',
  Line = 'line',
  LineMoment = 'line-moment', // timeseries that require the Moment library
  Bar = 'bar',
  Scatter = 'scatter',
}

export class ChartBuilder extends Component<any, State> {
  static _listGraphs: Array<ChartBuilder> = []
  canvas: HTMLCanvasElement = undefined!
  context: any
  name?: string
  options: any
  chart: any
  type: string
  chartCanvas = this

  constructor(props: any) {
    super()
    this.name = props.name || ''
    this.context = null

    this.options = this.setOptions(props.options)

    this.type = !!props.type ? props.type : chartType.Pie

    this.state = {
      loading: false,
      loadingText: '',
      data: props.data,
    }
  }

  /**
   * Set list of graphs in the view.
   */
  static set setListOfGraphs(g: any) {
    ChartBuilder._listGraphs = g
  }

  /**
   * @returns Array of all the graphs
   */
  static get getlistOfGraphs() {
    return ChartBuilder._listGraphs as Array<any>
  }

  /**
   * Add graph to the list of graphs in the view
   * @param {ChartBuilder} g the graph
   */
  static addToListGraphs(g: any) {
    const l = ChartBuilder.getlistOfGraphs
    l.push(g)
    ChartBuilder.setListOfGraphs = l
  }

  /**
   * @returns Array of all the graphs
   */
  static findGraphByName(name: string) {
    return ChartBuilder._listGraphs.find((g) => g.name == name)
  }

  /**
   *
   * @param o Option object {title:{string},legend:{boolean},responsive:{boolean},hasTwoAxes{boolean},hideAxes{boolean},performance:{boolean}}
   * @returns Option object
   */
  setOptions(o?: any) {
    let options = {
      responsive: true,
      title: undefined as any,
      legend: undefined as any,
    }

    if (o) {
      options = Object.assign(options, o)

      options.title = {
        display: !!o.title,
        text: o.title ? o.title : '',
      }
      options.legend = {
        display: o.legend,
      }
      if (o.hasTwoAxes) {
        ;(options as any)['scales'] = {
          yAxes: [
            {
              id: 'A',
              type: 'linear',
              position: 'left',
            },
            {
              id: 'B',
              type: 'linear',
              position: 'right',
            },
          ],
        }
      }
      if (o.hideAxes) {
        ;(options as any)['scales'] = {
          xAxes: [
            {
              gridLines: {
                display: false,
              },
              ticks: {
                display: false,
              },
            },
          ],
          yAxes: [
            {
              gridLines: {
                display: false,
              },
              ticks: {
                display: false,
                max: o.maxY ? o.maxY : Math.max(this.state.data.datasets[0].data),
              },
            },
          ],
        }
      }
      if (o.performance) {
        ;(options as any)['animation'] = {
          duration: 0, // general animation time
        }
        ;(options as any)['hover'] = {
          animationDuration: 0, // duration of animations when hovering an item
        }
        ;(options as any)['responsiveAnimationDuration'] = 0 // animation duration after a resize
      }
    }
    return options
  }

  /**
   * Create the chart.
   * @returns Void
   */
  makeChart() {
    if (!this.context) {
      return
    }

    // @ts-expect-error - is loaded into the global scope in componentDidMount
    this.chart = new Chart(this.context, {
      type: this.type == chartType.LineMoment ? chartType.Line : this.type,
      data: this.state.data,
      options: this.options,
    })

    ChartBuilder.addToListGraphs(this)
  }

  /**
   * Load script into the window
   * @param src url of the script
   * @returns void
   */
  async loadScript(src: string) {
    if (window.Chart && this.type !== chartType.LineMoment) {
      // if the graph type is other than Linemoment, the Chart library suffice
      return
    }
    if (window.Chart && window.moment && this.type == chartType.LineMoment) {
      // If LineMoment, we need both libraries
      return
    }
    if (ChartBuilder.getlistOfGraphs.length > 1) {
      // if all graphs load at the same time we don't want them to create a script.
      // await scriptLoaded('Chart')
      return
    }
    if (this.type == chartType.LineMoment) {
      // line moment is a Line chart that requires the moment.js library.
      // await scriptLoaded('moment')
    }
    const scriptTags = document.getElementsByTagName('script')
    let scriptExists = false
    for (let i = 0; i < scriptTags.length; i++) {
      if (scriptTags[i].src == src) {
        // if the script is already loaded, we don't want to load it again.
        scriptExists = true
      }
    }

    if (!scriptExists) {
      const tag = document.createElement('script')
      tag.async = true
      tag.src = src
      const body = document.getElementsByTagName('body')[0]
      body.appendChild(tag)
    }
    // await scriptLoaded('Chart')
  }

  /**
   * Destroy the graph
   */
  destroyGraph() {
    // calls the chartJS function to destroy a graph
    ChartBuilder._listGraphs.splice(ChartBuilder._listGraphs.indexOf(this), 1)

    if (this.chart) {
      this.chart.destroy()
      this.chart = null!
    }
  }

  componentDidMount() {
    this.init()
  }

  async init() {
    await this.loadScript('/vendor/chart.js.min.js')
    if (this.canvas) {
      this.context = this.canvas.getContext('2d')
      this.makeChart()
    }
  }

  componentDidUpdate(prevProps: { data: data }) {
    if (!isEqual(prevProps.data, this.props.data)) {
      this.setState({ data: this.props.data }, () => {
        if (this.chart) {
          this.chart.data = this.state.data
          this.chart.update()
        } else {
          this.init()
        }
      })
    }
  }

  componentWillUnmount() {
    this.destroyGraph()
  }

  render() {
    return (
      <canvas
        ref={(c) => {
          this.canvas = c!
        }}
        width="400px"
        height="200px"
      />
    )
  }
}

export default function Graph(props: { name: string; type: chartType; data: data; options?: Options }) {
  const { name, type, data, options } = props

  useEffect(() => {
    return () => {
      ChartBuilder.findGraphByName(name)?.destroyGraph()
    }
  }, [])

  return (
    <div className={`chart_canvas ${name}`}>
      <ChartBuilder type={type} data={data} name={name} options={options} />
    </div>
  )
}
